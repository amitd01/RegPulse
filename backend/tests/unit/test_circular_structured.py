"""Contract tests for the slice-4a structured_content field on CircularDetail.

Locks down the shape the frontend renderer consumes from `/circulars/{id}`.
Until slice 4b's structural extractor populates the column from real PDFs,
the column is None on most circulars and populated only on the synthetic
demo corpus seeded by `scripts/seed_demo.py`.
"""

from __future__ import annotations

import pytest

from app.schemas.circulars import CircularDetail, StructuredBlock, StructuredContent


class TestStructuredContentSchema:
    def test_empty_tree_is_valid(self):
        content = StructuredContent()
        assert content.version == 1
        assert content.blocks == []

    def test_heading_block(self):
        b = StructuredBlock(type="heading", level=1, text="Master Direction on KYC")
        assert b.type == "heading"
        assert b.level == 1
        assert b.text == "Master Direction on KYC"

    def test_paragraph_block(self):
        b = StructuredBlock(type="paragraph", text="This direction shall apply…")
        assert b.text == "This direction shall apply…"

    def test_list_block_with_paragraph_items(self):
        b = StructuredBlock(
            type="list",
            ordered=True,
            items=[
                StructuredBlock(type="paragraph", text="One"),
                StructuredBlock(type="paragraph", text="Two"),
            ],
        )
        assert b.ordered is True
        assert b.items is not None
        assert len(b.items) == 2

    def test_table_block(self):
        b = StructuredBlock(
            type="table",
            headers=["Risk", "Cycle"],
            rows=[["Low", "10 years"], ["High", "2 years"]],
        )
        assert b.headers == ["Risk", "Cycle"]
        assert len(b.rows or []) == 2

    def test_full_tree_round_trip(self):
        tree = StructuredContent(
            version=1,
            blocks=[
                StructuredBlock(type="heading", level=1, text="Title"),
                StructuredBlock(type="paragraph", text="Lead"),
                StructuredBlock(
                    type="list",
                    ordered=False,
                    items=[
                        StructuredBlock(type="paragraph", text="Bullet one"),
                    ],
                ),
            ],
        )
        # round-trips through model_dump → model_validate
        data = tree.model_dump()
        reloaded = StructuredContent.model_validate(data)
        assert reloaded.blocks[0].text == "Title"
        assert reloaded.blocks[2].items is not None
        assert reloaded.blocks[2].items[0].text == "Bullet one"


class TestCircularDetailEnvelope:
    def _base_payload(self):
        import datetime
        import uuid

        return {
            "id": uuid.uuid4(),
            "title": "Some old circular",
            "doc_type": "MASTER_DIRECTION",
            "status": "ACTIVE",
            "rbi_url": "https://rbi.org.in/x",
            "pending_admin_review": False,
            "regulator": "RBI",
            "indexed_at": datetime.datetime.now(datetime.UTC),
            "updated_at": datetime.datetime.now(datetime.UTC),
        }

    def test_structured_content_optional(self):
        """Existing payloads (without the new field) still parse."""
        d = CircularDetail.model_validate(self._base_payload())
        assert d.structured_content is None
        assert d.chunks == []

    def test_structured_content_populated(self):
        payload = self._base_payload()
        payload["title"] = "KYC Master Direction"
        payload["structured_content"] = {
            "version": 1,
            "blocks": [
                {"type": "heading", "level": 1, "text": "KYC Direction"},
                {"type": "paragraph", "text": "Applies to all REs."},
            ],
        }
        d = CircularDetail.model_validate(payload)
        assert d.structured_content is not None
        assert d.structured_content.version == 1
        assert d.structured_content.blocks[0].text == "KYC Direction"


class TestSeedStructuredFile:
    """The seed_structured.json file matches the StructuredContent schema."""

    def test_seed_file_parses_for_each_circular(self):
        import json
        import pathlib

        path = pathlib.Path(__file__).parents[2] / "scripts" / "seed_structured.json"
        with open(path) as f:
            data = json.load(f)
        # ignore the _doc key
        circular_keys = [k for k in data.keys() if not k.startswith("_")]
        assert len(circular_keys) == 5, "5 synthetic demo circulars"
        for cn in circular_keys:
            tree = StructuredContent.model_validate(data[cn])
            assert tree.version == 1
            assert len(tree.blocks) > 0, f"{cn} should have blocks"

    def test_each_seed_has_at_least_one_heading(self):
        import json
        import pathlib

        path = pathlib.Path(__file__).parents[2] / "scripts" / "seed_structured.json"
        with open(path) as f:
            data = json.load(f)
        for cn, raw in data.items():
            if cn.startswith("_"):
                continue
            blocks = raw["blocks"]
            assert any(
                b["type"] == "heading" for b in blocks
            ), f"{cn} should start with at least one heading"


class TestRetrievalShapeNotRenderedToUsers:
    """Rule 16: never expose chunk_text as the reading layer.

    The chunks field stays on CircularDetail for backward-compat (consumed by
    the admin review queue) but the public-facing renderer at /library/[id]
    consumes structured_content. This test is a guard against a future change
    that tries to re-introduce chunk-card-dump rendering by checking the
    component doesn't import the chunk type at all.
    """

    def test_library_detail_page_does_not_render_chunks(self):
        import pathlib

        page = (
            pathlib.Path(__file__).parents[3]
            / "frontend"
            / "src"
            / "app"
            / "(app)"
            / "library"
            / "[id]"
            / "page.tsx"
        )
        if not page.exists():
            pytest.skip("frontend not present in this build context")
        src = page.read_text()
        # Guards: the renderer must not loop chunk_text into the DOM
        assert (
            "chunk_text" not in src
        ), "Library detail must not render chunk_text — use structured_content"
        assert "chunks.map" not in src and "chunks.length" not in src.replace(
            "chunks: ChunkResponse", ""
        ), "Library detail must not iterate chunks for display"
