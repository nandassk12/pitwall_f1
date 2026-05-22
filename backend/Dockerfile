FROM python:3.10-slim

WORKDIR /app

# Install build dependencies for compiling Python extensions safely
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Pre-install our core data science and API frameworks
RUN pip install --no-cache-dir fastapi uvicorn fastf1 pandas numpy

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
