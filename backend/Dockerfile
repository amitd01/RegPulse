FROM python:3.11-slim AS base

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]

# ---------------------------------------------------------------------------
# Dev target — includes test/lint dependencies for `make eval`
# ---------------------------------------------------------------------------
FROM base AS dev

COPY requirements-dev.txt .
RUN pip install --no-cache-dir -r requirements-dev.txt

CMD ["pytest", "tests/", "-v"]
