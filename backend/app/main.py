"""RegPulse Backend — FastAPI application entry point."""

from fastapi import FastAPI

app = FastAPI(
    title="RegPulse API",
    description="RBI Regulatory Intelligence Platform",
    version="0.1.0",
    docs_url="/api/v1/docs",
    openapi_url="/api/v1/openapi.json",
)


@app.get("/api/v1/health")
async def health_check() -> dict:
    return {"status": "healthy", "service": "regpulse-api"}
