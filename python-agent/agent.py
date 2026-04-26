import os
import re
import json
import time
import logging
from typing import Any, Dict, List, Optional

import requests
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("observai-agent")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
MCP_SERVER_URL = os.getenv("MCP_SERVER_URL", "http://localhost:5001")
AGENT_MODEL = os.getenv("AGENT_MODEL", "gpt-4.1-nano")

if not OPENAI_API_KEY:
    raise ValueError("OPENAI_API_KEY is missing")

client = OpenAI(api_key=OPENAI_API_KEY)

# ─────────────────────────────────────────────
# UUID regex — used to validate entity extraction
# ─────────────────────────────────────────────
UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)

# Max characters of tool output we'll pass to the final LLM prompt.
# Prevents token blow-up when many log results are returned.
MAX_CONTEXT_CHARS = 12_000


INTENT_PROMPT = """
You are an SRE intent router.

Classify the user's question into exactly one intent.

Allowed intents:
- system_health
- order_failure_rca
- order_trace
- metrics_question
- log_search
- unknown

Extract entities ONLY if they are explicitly present in the question:
- order_id      → must look like a UUID (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx). If absent, set null.
- correlation_id → must look like a UUID. If absent, set null.
- service       → only if a specific service name is mentioned (e.g. "order-service"). If absent, set null.
- time_window_minutes → integer, default 60.

IMPORTANT: Never invent or guess values for order_id or correlation_id.
If no UUID is present in the question, both fields must be null.

Rules:
- If question asks why orders are failing, choose order_failure_rca.
- If question contains a UUID and "correlationId", choose order_trace.
- If question contains a UUID and "orderId", choose order_trace.
- If question asks request counts, success rate, failures count, choose metrics_question.
- If question asks recent errors/logs, choose log_search.
- If question asks health/status, choose system_health.

Return ONLY valid JSON:
{{
  "intent": "...",
  "entities": {{
    "order_id": null,
    "correlation_id": null,
    "service": null,
    "time_window_minutes": 60
  }}
}}

User question:
{question}
"""

FINAL_PROMPT = """
You are ObservAI, a production SRE AI.

User question:
{question}

Intent:
{intent}

Execution results (truncated to fit context):
{context}

Answer format:
Status: HEALTHY | DEGRADED | CRITICAL | UNKNOWN

Summary:
Short clear summary.

Evidence:
- concrete metrics/logs/timestamps/services

Root Cause:
- If root cause is known, state it clearly.
- If inventory failed before payment, say inventory is root cause.
- If payment failed after inventory, say payment is root cause.
- Do not blame payment if payment-service was not reached.

Recommendation:
- practical next steps.
"""


def llm_text(messages: List[Dict[str, str]], temperature: float = 0.1) -> str:
    res = client.chat.completions.create(
        model=AGENT_MODEL,
        messages=messages,
        temperature=temperature,
    )
    return res.choices[0].message.content or ""


def safe_json(text: str) -> Dict[str, Any]:
    try:
        return json.loads(text)
    except Exception:
        start = text.find("{")
        end = text.rfind("}")
        if start >= 0 and end >= 0:
            return json.loads(text[start : end + 1])
        raise


def is_valid_uuid(value: Any) -> bool:
    """Return True only if value is a non-empty string matching UUID v4 format."""
    return isinstance(value, str) and bool(UUID_RE.match(value.strip()))


def sanitize_entities(entities: Dict[str, Any]) -> Dict[str, Any]:
    """
    Guard against LLM hallucinating non-UUID strings into id fields.

    The LLM sometimes sets order_id = "last failed request" or
    correlation_id = "some phrase" when no real UUID exists in the question.
    This function resets those fields to None if they don't pass UUID validation.
    """
    for field in ("order_id", "correlation_id"):
        raw = entities.get(field)
        if raw is not None and not is_valid_uuid(raw):
            logger.warning(
                "Entity '%s' rejected (not a valid UUID): %r → None", field, raw
            )
            entities[field] = None
    return entities


def extract_entities_fallback(question: str) -> Dict[str, Any]:
    """Regex-based fallback when LLM JSON parsing fails entirely."""
    uuid_match = re.search(
        r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
        question,
        re.IGNORECASE,
    )
    q = question.lower()

    return {
        "order_id": uuid_match.group(0) if uuid_match and "order" in q else None,
        "correlation_id": uuid_match.group(0) if uuid_match and "correlation" in q else None,
        "service": None,
        "time_window_minutes": 60,
    }


def route_intent(question: str) -> Dict[str, Any]:
    prompt = INTENT_PROMPT.format(question=question)

    try:
        raw = llm_text(
            [
                {"role": "system", "content": "Return strict JSON only. No markdown, no explanation."},
                {"role": "user", "content": prompt},
            ]
        )
        routed = safe_json(raw)
    except Exception:
        # Full LLM or parse failure — keyword fallback
        q = question.lower()
        entities = extract_entities_fallback(question)

        if "why" in q and "order" in q and ("fail" in q or "failing" in q):
            intent = "order_failure_rca"
        elif "correlation" in q or "orderid" in q or "order id" in q:
            intent = "order_trace"
        elif "request" in q or "success rate" in q or "how many" in q:
            intent = "metrics_question"
        elif "log" in q or "error" in q:
            intent = "log_search"
        elif "health" in q or "status" in q:
            intent = "system_health"
        else:
            intent = "unknown"

        routed = {"intent": intent, "entities": entities}

    routed.setdefault("entities", {})
    routed["entities"].setdefault("time_window_minutes", 60)

    # ── KEY FIX: always sanitize entities after LLM extraction ──
    routed["entities"] = sanitize_entities(routed["entities"])

    return routed


def execute_mcp_tool(tool: str, args: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    args = args or {}

    for attempt in range(3):
        try:
            r = requests.post(
                f"{MCP_SERVER_URL}/tools/{tool}",
                json=args,
                timeout=30,
            )
            if r.status_code == 200:
                return r.json()
            return {"success": False, "error": f"HTTP {r.status_code}", "body": r.text}
        except Exception as e:
            if attempt == 2:
                return {"success": False, "error": str(e)}
            time.sleep(1)

    return {"success": False, "error": "unknown MCP failure"}


def truncate_context(context: Dict[str, Any]) -> str:
    """
    Serialize context to JSON and truncate to MAX_CONTEXT_CHARS.

    Without this, a wide time window returning 90+ logs across 3 services
    can exceed the model's context or send an enormous (costly) prompt.
    When truncation happens, we append a notice so the LLM knows data is partial.
    """
    raw = json.dumps(context, indent=2, default=str)
    if len(raw) <= MAX_CONTEXT_CHARS:
        return raw

    truncated = raw[:MAX_CONTEXT_CHARS]
    logger.warning(
        "Context truncated from %d to %d chars to fit prompt budget.",
        len(raw),
        MAX_CONTEXT_CHARS,
    )
    return truncated + "\n\n[... context truncated for token budget ...]"


def run_intent_plan(intent: str, entities: Dict[str, Any], question: str) -> Dict[str, Any]:
    steps = []

    def run(step_name: str, tool: str, args: Dict[str, Any]):
        started = time.time()
        result = execute_mcp_tool(tool, args)
        latency_ms = round((time.time() - started) * 1000, 2)

        step = {
            "step": step_name,
            "tool": tool,
            "args": args,
            "latency_ms": latency_ms,
            "success": result.get("success", False),
            "result": result.get("result", result),
        }
        steps.append(step)
        return step

    if intent == "system_health":
        run("Check service health", "get_service_health", {})
        run("Check business metrics", "get_business_metrics", {})
        run("Check recent critical logs", "search_logs", {
            "query": "error OR failed OR out of stock OR timeout",
            "size": 20,
            "time_window_hours": 1,
        })

    elif intent == "metrics_question":
        run("Fetch HTTP request metrics", "get_http_metrics", {
            "time_window_minutes": entities.get("time_window_minutes", 60)
        })
        run("Fetch business metrics", "get_business_metrics", {})

    elif intent == "order_trace":
        args = {
            "order_id": entities.get("order_id"),
            "correlation_id": entities.get("correlation_id"),
            "time_window_hours": 24,
        }
        run("Build distributed request timeline", "get_flow_timeline", args)

    elif intent == "order_failure_rca":
        args = {
            "order_id": entities.get("order_id"),
            "correlation_id": entities.get("correlation_id"),
            "time_window_hours": 24,
        }

        if entities.get("order_id") or entities.get("correlation_id"):
            run("Run correlation/order RCA", "get_order_failure_rca", args)
        else:
            run("Check order HTTP failures", "get_http_metrics", {
                "time_window_minutes": entities.get("time_window_minutes", 60)
            })
            run("Search order-service failures", "search_logs", {
                "service": "order-service",
                "query": "Inventory not available OR Payment failed OR createOrder API error OR failed",
                "size": 30,
                "time_window_hours": 1,
            })
            run("Search inventory failures", "search_logs", {
                "service": "inventory-service",
                "query": "out of stock OR Stock reservation failed OR failed",
                "size": 30,
                "time_window_hours": 1,
            })
            run("Search payment failures", "search_logs", {
                "service": "payment-service",
                "query": "payment failed OR Payment processing failed OR failed",
                "size": 30,
                "time_window_hours": 1,
            })

    elif intent == "log_search":
        run("Search relevant logs", "search_logs", {
            "query": "error OR failed OR out of stock OR timeout",
            "service": entities.get("service"),
            "size": 30,
            "time_window_hours": 1,
        })

    else:
        run("Fallback health check", "get_service_health", {})
        run("Fallback logs", "search_logs", {
            "query": "error OR failed OR out of stock",
            "size": 20,
            "time_window_hours": 1,
        })

    return {"intent": intent, "entities": entities, "steps": steps}


def generate_answer(question: str, routed: Dict[str, Any], context: Dict[str, Any]) -> str:
    prompt = FINAL_PROMPT.format(
        question=question,
        intent=json.dumps(routed, indent=2),
        context=truncate_context(context),   # ← bounded, not raw dump
    )

    return llm_text(
        [
            {"role": "system", "content": "You are a precise production SRE assistant."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.1,
    )


def ask_agent(question: str) -> Dict[str, Any]:
    started = time.time()

    routed = route_intent(question)
    intent = routed.get("intent", "unknown")
    entities = routed.get("entities", {})

    logger.info("Intent routed: %s | entities: %s", intent, entities)

    context = run_intent_plan(intent, entities, question)
    answer = generate_answer(question, routed, context)

    return {
        "answer": answer,
        "intent": intent,
        "entities": entities,
        "steps": context["steps"],
        "latency_ms": round((time.time() - started) * 1000, 2),
    }