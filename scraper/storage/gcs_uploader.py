"""Upload raw PDF bytes to Google Cloud Storage.

Auth uses Application Default Credentials (ADC):
- GCP (Cloud Run / GCE): the attached service account is used automatically.
- Local dev: set GOOGLE_APPLICATION_CREDENTIALS=/path/to/service_account_key.json

Object name format:  {prefix}/{YYYY}/{MM}/{doc_id}.pdf
Full URI stored:     gs://{bucket}/{object_name}
"""

from __future__ import annotations

import datetime

import structlog

logger: structlog.stdlib.BoundLogger = structlog.get_logger("regpulse.gcs")


def build_object_name(prefix: str, doc_id: str) -> str:
    """Return a date-partitioned object path: {prefix}/{YYYY}/{MM}/{doc_id}.pdf"""
    today = datetime.date.today()
    return f"{prefix}/{today.year}/{today.month:02d}/{doc_id}.pdf"


def upload_pdf(
    pdf_bytes: bytes,
    object_name: str,
    bucket_name: str,
) -> str:
    """Upload PDF bytes to GCS and return the full GCS URI.

    Raises google.cloud.exceptions.GoogleCloudError on upload failure.
    Callers are expected to catch and handle (upload is non-fatal in the pipeline).
    """
    from google.cloud import storage  # imported here so the module is importable without the lib installed

    client = storage.Client()
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(object_name)
    blob.upload_from_string(pdf_bytes, content_type="application/pdf")

    gcs_uri = f"gs://{bucket_name}/{object_name}"
    logger.info(
        "gcs_pdf_uploaded",
        bucket=bucket_name,
        object_name=object_name,
        size_bytes=len(pdf_bytes),
        uri=gcs_uri,
    )
    return gcs_uri
