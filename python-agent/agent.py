import os
from dotenv import load_dotenv
from openai import OpenAI
from datetime import datetime, timedelta, timezone

from opensearch_client import search_logs
from prometheus_client import query_prometheus

# Load .env file
load_dotenv()

# Initialize OpenAI client
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    raise ValueError("OPENAI_API_KEY not found in .env file!")

client = OpenAI(api_key=api_key)

# Approximate cost per 1k tokens for GPT-4.1 nano
COST_PER_1K_TOKENS = 1.0  # in cents, for learning purposes


def summarize_metrics(metrics, time_window_hours=1):
    """Return structured summary for last X hours"""
    end = datetime.now(timezone.utc)
    start = end - timedelta(hours=time_window_hours)
    total = success = fail = 0

    for m in metrics:
        ts = float(m.get("value", [0, 0])[0])
        status = int(m.get("metric", {}).get("status", 0))
        if ts >= start.timestamp():
            total += 1
            if status == 200:
                success += 1
            else:
                fail += 1
    return {"total": total, "success": success, "fail": fail}


def summarize_logs(logs, keyword=None, time_window_hours=1):
    """Filter and summarize logs for LLM prompt"""
    end = datetime.now(timezone.utc)  # aware datetime
    start = end - timedelta(hours=time_window_hours)
    filtered = []

    for log in logs:
        ts = datetime.fromisoformat(log["timestamp"])
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)  # make aware
        if ts >= start and (keyword is None or keyword.lower() in log["message"].lower()):
            filtered.append(log)

    return filtered[:10]  # latest 10 logs


def create_prompt(question):
    # Fetch latest logs from OpenSearch
    logs = search_logs(size=50)

    # Fetch some metrics from Prometheus (example)
    metrics = query_prometheus("http_requests_total")

    logs_summary = summarize_logs(logs, keyword=None)
    metrics_summary = summarize_metrics(metrics)

    prompt = f"""
You are an observability AI assistant for a Node.js microservice.

Logs Summary:
{logs_summary}

Metrics Summary:
{metrics_summary}

Question:
{question}

Explain clearly.
"""
    return prompt


def estimate_cost(prompt, answer):
    # Rough token estimate: 1 token ≈ 4 characters
    tokens = (len(prompt) + len(answer)) / 4
    cost = (tokens / 1000) * COST_PER_1K_TOKENS
    return cost


def ask_agent(question):
    prompt = create_prompt(question)

    # Use GPT-4.1 nano (your purchased model)
    response = client.chat.completions.create(
        model="gpt-4.1-nano",
        messages=[{"role": "user", "content": prompt}]
    )

    # Extract the answer
    answer = response.choices[0].message.content

    # Estimate cost
    cost = estimate_cost(prompt, answer)
    print(f"[Approximate cost for this request: ${cost:.4f}]")

    return answer


if __name__ == "__main__":
    print("Observability AI Agent (GPT-4.1 nano)")
    while True:
        question = input("\nAsk Agent: ")
        if question.lower() in ("exit", "quit"):
            break
        answer = ask_agent(question)
        print("\nAgent:", answer)