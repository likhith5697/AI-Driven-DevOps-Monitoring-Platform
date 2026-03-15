# Use Python 3.11 (stable for LangChain + ChromaDB)
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Copy the rest of the app
COPY . .

# Expose FastAPI port
EXPOSE 5000

# Run your FastAPI app
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "5000"]