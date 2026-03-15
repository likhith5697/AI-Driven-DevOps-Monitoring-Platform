import os
from dotenv import load_dotenv
from openai import OpenAI
from datetime import datetime, timedelta, timezone
from collections import defaultdict

from opensearch_client import search_logs
from my_prometheus_client import query_prometheus

from langchain.vectorstores import Chroma
from langchain.embeddings.openai import OpenAIEmbeddings
from langchain.docstore.document import Document

# Load .env file
load_dotenv()

# Initialize OpenAI client
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    raise ValueError("OPENAI_API_KEY not found in .env file!")

client = OpenAI(api_key=api_key)

# Approximate cost per 1k tokens for GPT-4.1 nano
COST_PER_1K_TOKENS = 1.0  # in cents

# =======================
# Metrics Summarization
# =======================
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

# =======================
# Log Processing
# =======================
def deduplicate_logs_by_order(logs):
    grouped = defaultdict(list)
    deduped = []

    for log in logs:
        order_id = log.get("orderId") or log.get("body", {}).get("id")
        if order_id:
            grouped[order_id].append(log)
        else:
            if log.get("message") == "Received createOrder API call":
                deduped.append(log)

    for order_id, logs_list in grouped.items():
        logs_list.sort(key=lambda x: x["timestamp"])
        deduped.append(logs_list[0])

    deduped.sort(key=lambda x: x["timestamp"], reverse=True)
    return deduped[:10]

def summarize_logs(logs, keyword=None, time_window_hours=1):
    end = datetime.now(timezone.utc)
    start = end - timedelta(hours=time_window_hours)
    filtered = []

    for log in logs:
        ts = datetime.fromisoformat(log["timestamp"])
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        if ts >= start and (keyword is None or keyword.lower() in log["message"].lower()):
            filtered.append(log)

    return deduplicate_logs_by_order(filtered)

# =======================
# RAG Setup with Chroma
# =======================
embedding_model = "text-embedding-3-small"
embeddings = OpenAIEmbeddings(model=embedding_model)
persist_dir = "vector_store"

# Load or initialize vector store
if os.path.exists(persist_dir):
    vector_store = Chroma(persist_directory=persist_dir, embedding_function=embeddings)
else:
    vector_store = Chroma(embedding_function=embeddings, persist_directory=persist_dir)
    historical_logs = search_logs(size=1000)
    for log in historical_logs:
        text = f"{log['timestamp']} - {log.get('message')} - {log.get('body', '')}"
        vector_store.add_documents([Document(page_content=text, metadata=log)])
    vector_store.persist()

def retrieve_logs_with_rag(question, k=5):
    docs = vector_store.similarity_search(question, k=k)
    return [doc.page_content for doc in docs]

# =======================
# Prompt Construction
# =======================
def create_prompt(question):
    rag_logs = retrieve_logs_with_rag(question, k=5)
    live_logs = summarize_logs(search_logs(size=10))
    metrics = query_prometheus("http_requests_total")
    metrics_summary = summarize_metrics(metrics)

    prompt = f"""
You are an observability AI assistant for a Node.js microservice.

Historical logs: {rag_logs}
Recent logs: {live_logs}
Metrics Summary: {metrics_summary}

Question: {question}

Explain clearly.
"""
    return prompt

# =======================
# Cost Estimation
# =======================
def estimate_cost(prompt, answer):
    tokens = (len(prompt) + len(answer)) / 4  # rough 1 token ≈ 4 chars
    cost = (tokens / 1000) * COST_PER_1K_TOKENS
    return cost

# =======================
# Ask Agent
# =======================
def ask_agent(question):
    prompt = create_prompt(question)
    response = client.chat.completions.create(
        model="gpt-4.1-nano",
        messages=[{"role": "user", "content": prompt}]
    )
    answer = response.choices[0].message.content
    cost = estimate_cost(prompt, answer)
    print(f"[Approximate cost for this request: ${cost:.4f}]")
    return answer

# =======================
# CLI Run
# =======================
if __name__ == "__main__":
    print("Observability AI Agent (GPT-4.1 nano + Chroma RAG)")
    while True:
        question = input("\nAsk Agent: ")
        if question.lower() in ("exit", "quit"):
            break
        answer = ask_agent(question)
        print("\nAgent:", answer)