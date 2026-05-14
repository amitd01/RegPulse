FROM python:3.11-slim AS base

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ADR A29 (S5) — pre-bake the cross-encoder reranker so DEMO_MODE no longer
# skips reranking. Downloads ~90MB from HuggingFace once at image build;
# runtime load is offline + sub-second. CI must restore this layer from cache.
ENV HF_HOME=/app/.cache/huggingface
RUN python -c "from sentence_transformers import CrossEncoder; CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')"

COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]

# ---------------------------------------------------------------------------
# Dev target — includes test/lint dependencies for `make eval`
# ---------------------------------------------------------------------------
FROM base AS dev

COPY requirements-dev.txt .
RUN pip install --no-cache-dir -r requirements-dev.txt

CMD ["pytest", "tests/", "-v"]

# ---------------------------------------------------------------------------
# Production target — explicitly LAST so `docker build` without --target
# produces the prod image (uvicorn CMD), not the dev image (pytest CMD).
# Build with: docker build --target=production -t backend:prod .
# ---------------------------------------------------------------------------
FROM base AS production
