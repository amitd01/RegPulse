-- Add GCS PDF storage path to circular_documents.
-- NULL means the PDF was not uploaded to GCS (pre-feature rows, or upload failed).
ALTER TABLE circular_documents
    ADD COLUMN IF NOT EXISTS gcs_pdf_path TEXT;
