# AI-Driven DevOps Monitoring Platform

## Overview

This project demonstrates an **advanced observability and SRE platform** powered by Generative AI. It integrates:

- Microservices monitoring  
- Metrics collection and visualization  
- Log aggregation and intelligent summarization using a GenAI agent  

It showcases how to combine **Node.js microservices**, **Prometheus metrics**, **OpenSearch logs**, and a **Python-based LLM agent** (GPT-4.1 nano) for actionable insights.

---

## Architecture

The platform consists of three core layers:

1. **Application Layer**  
   - Node.js microservices exposing APIs and producing metrics.  
   - Optional stateful components like databases (MongoDB, PostgreSQL) can be integrated.

2. **Observability Layer**  
   - Prometheus for collecting metrics from services.  
   - OpenSearch for log aggregation and query.  
   - Dashboards (OpenSearch Dashboards / Grafana) for visual insights.

3. **Intelligence Layer**  
   - Python GenAI agent consumes metrics and logs.  
   - Generates natural language summaries, insights, and alerts.  
   - Supports querying recent logs and service health with structured responses.  

---

## Key Features

- Real-time **HTTP and service metrics** tracking.  
- Aggregated **log analysis** over configurable time windows.  
- **LLM-driven observability** for automated reasoning and suggestions.  
- CI/CD deployment pipeline for automated build and production rollout.  
- Secure secrets management via CI/CD without storing sensitive data on the host.  

---

## DevOps & SRE Principles

- **Infrastructure as Code**: Services defined via Docker Compose.  
- **Continuous Integration & Deployment**: Automated testing and deployment with GitHub Actions.  
- **Secrets Management**: API keys and credentials injected dynamically, avoiding hard-coded secrets.  
- **Scalability & Observability**: Modular architecture allows scaling individual services and monitoring them seamlessly.  
- **Reproducibility**: Containers ensure consistent environment across dev, test, and production.  

---

## Use Cases

- **Service health monitoring** in production environments.  
- **Automatic log summarization** for faster incident triage.  
- **Cost and performance insights** via metrics and LLM reasoning.  
- **SRE playbooks** enhanced by AI-generated recommendations.  

---

## Takeaways

This project illustrates how to combine **modern DevOps practices** with **Generative AI**:

- Containerized microservices for consistency.  
- Observability stack for metrics and logs.  
- LLM-powered insights for intelligent SRE.  
- CI/CD automation for rapid deployment and testing.  

It is designed to be a **learning platform for advanced GenAI DevOps workflows** while being production-capable for small-scale deployments.

---

**Author:** Likhith  
**Focus:** GenAI Observability, DevOps, SRE Automation
