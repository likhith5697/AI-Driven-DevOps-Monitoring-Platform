import logging

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from agent import ask_agent

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("observai-api")

app = FastAPI(
    title="ObservAI GenAI SRE Agent",
    description="Advanced multi-step AI SRE agent for logs, metrics, and incident analysis.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {
        "service": "ObservAI Agent",
        "status": "running",
        "version": "2.0.0",
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "ObservAI AI Agent",
    }


@app.get("/ask")
def ask(question: str = Query(..., min_length=3)):
    try:
        logger.info("User question received: %s", question)
        result = ask_agent(question)
        return result
    except Exception:
        logger.exception("Agent error")
        raise HTTPException(status_code=500, detail="AI agent failed — check server logs.")


@app.get("/health-report")
def health_report():
    try:
        question = (
            "Generate a production health report for the last hour. "
            "Include service health, errors, failed requests, latency clues, "
            "order failures, payment issues, inventory issues, and recommendations."
        )
        result = ask_agent(question)
        return result
    except Exception:
        logger.exception("Health report error")
        raise HTTPException(status_code=500, detail="Health report failed — check server logs.")