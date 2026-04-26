import os
import json
import time
import logging
from typing import Any, Dict, List

import requests
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

logger = logging.getLogger("observai-agent")
logging.basicConfig(level=logging.INFO)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
MCP_SERVER_URL = os.getenv("MCP_SERVER_URL", "http://localhost:5001")
AGENT_MODEL = os.getenv("AGENT_MODEL", "gpt-4.1-nano")

if not OPENAI_API_KEY:
    raise ValueError("OPENAI_API_KEY is missing")

client = OpenAI(api_key=OPENAI_API_KEY)

AVAILABLE_TOOLS = {
    "get_recent_logs": {
        "description": "Fetch recent logs across services.",
        "default_args": {"size": 20}
    },
    "search_logs": {
        "description": "Search logs by keyword, service, error, orderId, correlationId.",
        "default_args": {"query": "error", "size": 20, "time_window_hours": 1}
    },
    "get_order_logs": {
        "description": "Trace a specific orderId through logs.",
        "default_args": {"order_id": None}
    },
    "get_correlation_logs": {
        "description": "Trace a specific correlationId through logs.",
        "default_args": {"correlation_id": None}
    },
    "get_service_health": {
        "description": "Fetch high-level service health from Prometheus.",
        "default_args": {}
    },
    "get_http_metrics": {
        "description": "Fetch HTTP request metrics.",
        "default_args": {"time_window_minutes": 60}
    },
    "get_metrics_summary": {
        "description": "Fetch key metrics summary.",
        "default_args": {}
    }
}

PLANNER_PROMPT = """
You are a production SRE AI planner.

Create a short tool execution plan to answer the user's question.

Available tools:
{tools}

Rules:
- Return ONLY valid JSON.
- Do not include markdown.
- Max 5 steps.
- Prefer metrics first for health/failure questions.
- Prefer logs first for debugging specific errors.
- If question has orderId, use get_order_logs.
- If question has correlationId, use get_correlation_logs.
- If unsure, use get_service_health, get_http_metrics, and search_logs.

JSON format:
[
  {{
    "step": "short step name",
    "tool": "tool_name",
    "args": {{}},
    "reason": "why this step is needed"
  }}
]

User question:
{question}
"""

FINAL_PROMPT = """
You are ObservAI, a production SRE agent.

Use the collected tool results to answer the user's question.

User question:
{question}

Execution plan:
{plan}

Tool results:
{context}

Answer format:
Status: HEALTHY | DEGRADED | CRITICAL | UNKNOWN

Summary:
1-2 sentences.

Evidence:
- Use concrete numbers, services, orderId, correlationId, timestamps, errors.

Root Cause:
- State the most likely cause.
- If unknown, say exactly what is missing.

Recommendation:
- Give clear next actions.
- Be concise and practical.

Do not invent data. If logs or metrics are unavailable, say so.
"""

def call_llm(messages: List[Dict[str, str]], temperature: float = 0.1) -> str:
    response = client.chat.completions.create(
        model=AGENT_MODEL,
        messages=messages,
        temperature=temperature
    )
    return response.choices[0].message.content or ""

def safe_json_loads(text: str) -> Any:
    try:
        return json.loads(text)
    except Exception:
        start = text.find("[")
        end = text.rfind("]")
        if start != -1 and end != -1:
            return json.loads(text[start:end + 1])
        raise

def execute_mcp_tool(tool_name: str, args: Dict[str, Any] | None = None) -> Dict[str, Any]:
    args = args or {}

    for attempt in range(3):
        try:
            response = requests.post(
                f"{MCP_SERVER_URL}/tools/{tool_name}",
                json=args,
                timeout=20
            )

            if response.status_code == 200:
                return response.json()

            return {
                "success": False,
                "error": f"MCP tool returned HTTP {response.status_code}",
                "body": response.text
            }

        except Exception as e:
            if attempt == 2:
                return {
                    "success": False,
                    "error": str(e)
                }
            time.sleep(1)

    return {
        "success": False,
        "error": "Unknown MCP tool failure"
    }

def create_plan(question: str) -> List[Dict[str, Any]]:
    tools_text = json.dumps(AVAILABLE_TOOLS, indent=2)

    prompt = PLANNER_PROMPT.format(
        tools=tools_text,
        question=question
    )

    raw_plan = call_llm(
        [
            {
                "role": "system",
                "content": "You are a strict JSON planner. Return only valid JSON."
            },
            {
                "role": "user",
                "content": prompt
            }
        ]
    )

    try:
        plan = safe_json_loads(raw_plan)
    except Exception:
        logger.warning("Planner failed JSON parse. Falling back to default plan.")
        plan = [
            {
                "step": "Check service health",
                "tool": "get_service_health",
                "args": {},
                "reason": "Default health check"
            },
            {
                "step": "Check HTTP metrics",
                "tool": "get_http_metrics",
                "args": {"time_window_minutes": 60},
                "reason": "Default metrics check"
            },
            {
                "step": "Search recent errors",
                "tool": "search_logs",
                "args": {"query": "error OR failed OR timeout", "size": 20, "time_window_hours": 1},
                "reason": "Default log check"
            }
        ]

    clean_plan = []

    for step in plan[:5]:
        tool = step.get("tool")
        if tool not in AVAILABLE_TOOLS:
            continue

        args = step.get("args") or {}
        default_args = AVAILABLE_TOOLS[tool]["default_args"].copy()
        default_args.update(args)

        clean_plan.append({
            "step": step.get("step", tool),
            "tool": tool,
            "args": default_args,
            "reason": step.get("reason", "")
        })

    if not clean_plan:
        clean_plan = [
            {
                "step": "Check service health",
                "tool": "get_service_health",
                "args": {},
                "reason": "Fallback"
            }
        ]

    return clean_plan

def execute_plan(plan: List[Dict[str, Any]]) -> Dict[str, Any]:
    context = {
        "steps": [],
        "tool_outputs": {}
    }

    for step in plan:
        tool = step["tool"]
        args = step.get("args", {})

        logger.info("Executing tool: %s args=%s", tool, args)

        started = time.time()
        result = execute_mcp_tool(tool, args)
        latency_ms = round((time.time() - started) * 1000, 2)

        step_result = {
            "step": step["step"],
            "tool": tool,
            "args": args,
            "reason": step.get("reason", ""),
            "latency_ms": latency_ms,
            "success": result.get("success", False),
            "result": result.get("result", result)
        }

        context["steps"].append(step_result)
        context["tool_outputs"][tool] = step_result

    return context

def generate_answer(question: str, plan: List[Dict[str, Any]], context: Dict[str, Any]) -> str:
    prompt = FINAL_PROMPT.format(
        question=question,
        plan=json.dumps(plan, indent=2),
        context=json.dumps(context, indent=2, default=str)
    )

    return call_llm(
        [
            {
                "role": "system",
                "content": "You are a concise production SRE assistant."
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        temperature=0.2
    )

def ask_agent(question: str) -> Dict[str, Any]:
    started = time.time()

    plan = create_plan(question)
    context = execute_plan(plan)
    answer = generate_answer(question, plan, context)

    latency_ms = round((time.time() - started) * 1000, 2)

    return {
        "answer": answer,
        "plan": plan,
        "steps": context["steps"],
        "latency_ms": latency_ms
    }