# 🤖 AI Agent Flow – Clean Explanation (ObservAI)

---

## 🧠 1. User Question Entry

```text
GET /ask?question=why are orders failing
```

👉 Entry point in code:

```python
answer = ask_agent(question)
```

---

## 🧠 2. Intent Detection (LLM decides)

👉 The **LLM converts natural language → structured intent**

```python
route_intent(question)
```

Example output:

```json
{
  "intent": "order_failure_rca"
}
```

✔️ This step answers:

> “What is the user asking?”

---

## 🧠 3. Tool Selection (Agent decides)

👉 Based on intent, **agent code chooses tools (NOT LLM)**

```python
run_intent_plan(intent)
```

Example:

```python
if intent == "order_failure_rca":
    run("get_http_metrics")
    run("search_logs order-service")
    run("search_logs inventory-service")
    run("search_logs payment-service")
```

✔️ This step answers:

> “What data do we need to answer this?”

---

## 🧠 4. What is a Tool?

👉 Tool = **function exposed via MCP server**

Examples:

| Tool                | Purpose               |
| ------------------- | --------------------- |
| get_service_health  | Overall system health |
| get_http_metrics    | Prometheus metrics    |
| get_metrics_summary | Aggregated metrics    |
| search_logs         | OpenSearch logs       |
| get_recent_logs     | Latest logs           |

---

## 🧠 5. MCP Call (Agent → Tool Layer)

👉 Agent calls tool via HTTP

```python
execute_mcp_tool(tool, args)
```

Internally:

```text
POST http://mcp-server:5001/tools/{tool}
```

✔️ This step answers:

> “Fetch real data from system”

---

## 🧠 6. MCP Server Execution

```python
@app.post("/tools/{tool_name}")
def execute_tool(tool_name, params):
    return tool.execute(params)
```

Examples:

* `search_logs` → queries OpenSearch
* `get_http_metrics` → queries Prometheus

---

## 🧠 7. Tool Output (Data Returned)

Example logs:

```json
{
  "logs": [
    {"message": "Inventory out of stock"},
    {"message": "Stock reserved"}
  ]
}
```

Example metrics:

```json
{
  "total": 15,
  "fail": 5
}
```

---

## 🧠 8. Context Aggregation (Agent)

👉 Agent collects all tool outputs:

```python
context = {
  "steps": [tool_results]
}
```

✔️ This step answers:

> “Combine all evidence”

---

## 🧠 9. Final LLM Reasoning

```python
generate_answer(question, context)
```

👉 LLM sees:

* logs
* metrics
* health

👉 And produces:

```text
Root cause = inventory out of stock
```

---

## 🔁 FINAL FLOW

```text
1. User asks question

2. LLM → decides intent

3. Agent → selects tools

4. Agent → calls MCP

5. MCP → executes tools

6. Tools → return logs/metrics

7. Agent → aggregates results

8. LLM → final reasoning

9. Response returned
```

---

## ⚠️ Current Design Limitation

👉 Your system is:

```text
Plan → Execute → Summarize
```

❌ LLM does NOT dynamically choose next tool

👉 Agent executes a **predefined plan**

---

## 🚀 What Advanced Agents Do (Future)

```text
LLM → choose tool
→ execute
→ read result
→ choose next tool
→ repeat
→ final answer
```

✔️ This is called:
👉 **ReAct / Autonomous Agent**

---

## 🧠 Simple Analogy

| Type           | Behavior             |
| -------------- | -------------------- |
| Current System | Checklist debugging  |
| Advanced Agent | Think → decide → act |

---

## ✅ TL;DR

| Step                | Owner |
| ------------------- | ----- |
| Understand question | LLM   |
| Decide intent       | LLM   |
| Choose tools        | Agent |
| Execute tools       | MCP   |
| Fetch data          | Tools |
| Analyze             | LLM   |

---

## 🔥 Summary

This system combines:

* LLM reasoning
* Tool-based execution
* Observability data

👉 To create a **production-style AI SRE debugging agent**

---
