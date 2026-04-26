# 🤖 AI-Driven DevOps Observability Platform (GenAI SRE Agent)

## 🚀 Overview

This project implements a **production-style AI-powered observability and SRE platform** that combines:

- Microservices (Order, Payment, Inventory)
- Metrics (Prometheus)
- Logs (OpenSearch)
- AI Orchestration Layer (LLM + MCP Tooling)

👉 The system enables **natural language debugging of distributed systems** using an intelligent multi-step AI agent.

---

## 🧠 What Makes This Advanced

Unlike basic GenAI apps, this platform includes:

- ✅ **Multi-step AI reasoning (not single prompt)**
- ✅ **Tool-based architecture (MCP server)**
- ✅ **Cross-service log correlation (order → inventory → payment)**
- ✅ **Metrics + Logs combined reasoning**
- ✅ **Production-style SRE debugging flows**

---

## 🏗️ Architecture

### 1. Application Layer (Microservices)

| Service | Port | Responsibility |
|--------|------|---------------|
| order-service | 3000 | Orchestrates order flow |
| payment-service | 3001 | Handles payment processing |
| inventory-service | 3002 | Manages stock |

Each service:
- Emits structured logs → OpenSearch
- Exposes Prometheus metrics

---

### 2. Observability Layer

| Component | Purpose |
|----------|--------|
| Prometheus | Metrics scraping & aggregation |
| OpenSearch | Centralized logging |
| Dashboards (optional) | Visualization |

---

### 3. Intelligence Layer (GenAI SRE Agent)

#### 🔹 Health Agent (FastAPI)
- Endpoint: `http://localhost:5000/ask`
- Accepts natural language queries
- Orchestrates reasoning

#### 🔹 MCP Server (Tool Layer)
- Endpoint: `http://localhost:5001`
- Executes tools like:
  - `get_service_health`
  - `get_http_metrics`
  - `search_logs`
  - `get_metrics_summary`

---

## 🔁 AI Agent Flow (CORE DESIGN)

```text
User Question
   ↓
LLM (Intent Detection)
   ↓
Agent Plan (multi-step)
   ↓
MCP Tool Calls (logs + metrics)
   ↓
Context Aggregation
   ↓
LLM Final Reasoning (RCA)