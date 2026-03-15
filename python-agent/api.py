# main.py

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from agent import ask_agent
import logging

# --------------------------------------------------
# Logging setup
# --------------------------------------------------

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("observai")

# --------------------------------------------------
# FastAPI App
# --------------------------------------------------

app = FastAPI(
    title="ObservAI GenAI SRE Agent",
    description="AI assistant that analyzes logs and metrics from OpenSearch and Prometheus.",
    version="1.0.0"
)

# --------------------------------------------------
# CORS Configuration (React Frontend)
# --------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------------------------------------
# Root Endpoint
# --------------------------------------------------

@app.get("/")
def home():
    """
    Basic endpoint to confirm API is running
    """
    return {
        "service": "ObservAI Agent",
        "status": "running"
    }

# --------------------------------------------------
# Health Check Endpoint (for monitoring tools)
# --------------------------------------------------

@app.get("/health")
def health_check():
    """
    Health check endpoint for uptime monitoring.
    """
    return {
        "status": "healthy",
        "service": "ObservAI AI Agent"
    }

# --------------------------------------------------
# Chat Endpoint (Used by React UI)
# --------------------------------------------------

@app.get("/ask")
def ask(question: str = Query(..., min_length=3)):
    """
    Chat-style endpoint.

    Flow:
    User question
        ↓
    Agent fetches logs (OpenSearch)
        ↓
    Agent fetches metrics (Prometheus)
        ↓
    LLM performs reasoning
        ↓
    Response returned to UI
    """

    try:

        logger.info(f"User question received: {question}")

        answer = ask_agent(question)

        return {
            "answer": answer
        }

    except Exception as e:

        logger.error(f"Agent error: {str(e)}")

        raise HTTPException(
            status_code=500,
            detail="AI agent failed to process request"
        )

# --------------------------------------------------
# System Health Report Endpoint
# --------------------------------------------------

@app.get("/health-report")
def health_report():
    """
    Generates a system health summary using logs + metrics.
    """

    try:

        prompt = (
            "Provide a system health summary for the last hour. "
            "Include request failures, CPU usage, memory signals, and notable errors."
        )

        answer = ask_agent(prompt)

        return {
            "report": answer
        }

    except Exception as e:

        logger.error(f"Health report error: {str(e)}")

        raise HTTPException(
            status_code=500,
            detail="Failed to generate health report"
        )

# --------------------------------------------------
# Optional: Recent Logs Endpoint (debugging)
# --------------------------------------------------

@app.get("/logs")
def get_recent_logs():
    """
    Useful for debugging UI or testing OpenSearch connection.
    """

    try:

        logs = ask_agent("Show the last 5 logs from the system")

        return {
            "logs": logs
        }

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail="Failed to fetch logs"
        )