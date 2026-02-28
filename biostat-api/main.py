"""
NuPhorm Biostatistics API
CDISC / ADaM compliant analysis and dataset generation service.

Run locally:
    pip install -r requirements.txt
    uvicorn main:app --reload --port 8001

OpenAPI docs:  http://localhost:8001/docs
ReDoc:         http://localhost:8001/redoc
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routers import analyze, adam_datasets, analytics_extended, compliance, smart_cleaning, data_parse

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("NuPhorm Biostatistics API starting on port %s", settings.port)
    yield
    logger.info("NuPhorm Biostatistics API shutting down")


app = FastAPI(
    title="NuPhorm Biostatistics API",
    description=(
        "CDISC-compliant ADaM dataset generation, statistical analysis, "
        "Define-XML production, and Dataset-JSON v1.0 export.\n\n"
        "**Standards supported:** ADaMIG 1.3/1.4 · CDISC CT (NCI) · "
        "Dataset-JSON v1.0 · Define-XML 2.1"
    ),
    version="1.0.0",
    contact={"name": "NuPhorm Platform", "email": "support@nuphorm.com"},
    license_info={"name": "Proprietary"},
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_tags=[
        {
            "name": "Analysis",
            "description": "Submit raw/SDTM data → receive ADaM datasets + statistics.",
        },
        {
            "name": "ADaM Datasets",
            "description": "Retrieve pre-generated ADaM datasets for a study.",
        },
        {
            "name": "CDISC Metadata",
            "description": "Proxy endpoints to the CDISC Library API.",
        },
        {
            "name": "Extended Analytics",
            "description": "Inferential statistics, power analysis, custom scripts, data cleaning and transformation.",
        },
        {
            "name": "Compliance",
            "description": "GLP/GCP audit trail, validation checks, TLF Excel/PDF reports, eCTD package export.",
        },
        {
            "name": "Smart Cleaning",
            "description": "AI-assisted data quality analysis with GxP-compliant audit trail, pharma domain validation, and per-fix approval workflow.",
        },
        {
            "name": "Data Parse",
            "description": "Robust server-side CSV/TSV/Excel parsing via pandas with GxP upload logging, missing-value stats, and type inference.",
        },
        {"name": "Health", "description": "Service health check."},
    ],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyze.router, prefix="/api/v1", tags=["Analysis"])
app.include_router(adam_datasets.router, prefix="/api/v1", tags=["ADaM Datasets"])
app.include_router(analytics_extended.router, prefix="/api/v1", tags=["Extended Analytics"])
app.include_router(compliance.router, prefix="/api/v1", tags=["Compliance"])
app.include_router(smart_cleaning.router, prefix="/api/v1/clean", tags=["Smart Cleaning"])
app.include_router(data_parse.router, prefix="/api/v1/data", tags=["Data Parse"])


@app.get("/health", tags=["Health"], summary="Health check")
async def health() -> dict:
    return {"status": "ok", "version": "1.0.0", "service": "nuphorm-biostat-api"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host=settings.host, port=settings.port, reload=True)
