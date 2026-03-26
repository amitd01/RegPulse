"""Admin prompt versions — CRUD + activate."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.dependencies.auth import require_admin
from app.models.admin import AdminAuditLog, PromptVersion
from app.models.user import User
from app.schemas.admin import (
    PromptVersionCreate,
    PromptVersionListResponse,
    PromptVersionResponse,
)

router = APIRouter()


@router.get("", response_model=PromptVersionListResponse)
async def list_prompts(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> PromptVersionListResponse:
    """List all prompt versions (newest first)."""
    stmt = select(PromptVersion).order_by(desc(PromptVersion.created_at))
    result = await db.execute(stmt)
    prompts = list(result.scalars().all())
    return PromptVersionListResponse(
        data=[PromptVersionResponse.model_validate(p) for p in prompts]
    )


@router.post("", response_model=PromptVersionResponse)
async def create_prompt(
    body: PromptVersionCreate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> PromptVersionResponse:
    """Create a new prompt version and activate it."""
    # Deactivate all existing
    existing = await db.execute(select(PromptVersion).where(PromptVersion.is_active.is_(True)))
    for p in existing.scalars().all():
        p.is_active = False

    prompt = PromptVersion(
        id=uuid.uuid4(),
        version_tag=body.version_tag,
        prompt_text=body.prompt_text,
        is_active=True,
        created_by=admin.id,
    )
    db.add(prompt)

    audit = AdminAuditLog(
        id=uuid.uuid4(),
        actor_id=admin.id,
        action="create_prompt_version",
        target_table="prompt_versions",
        target_id=prompt.id,
        new_value={"version_tag": body.version_tag, "is_active": True},
    )
    db.add(audit)
    await db.commit()
    await db.refresh(prompt)

    return PromptVersionResponse.model_validate(prompt)


@router.post("/{prompt_id}/activate")
async def activate_prompt(
    prompt_id: uuid.UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Activate a specific prompt version (deactivates all others)."""
    stmt = select(PromptVersion).where(PromptVersion.id == prompt_id)
    result = await db.execute(stmt)
    target = result.scalar_one_or_none()

    if target is None:
        return {"success": False, "error": "Prompt version not found", "code": "NOT_FOUND"}

    # Deactivate all
    all_prompts = await db.execute(select(PromptVersion).where(PromptVersion.is_active.is_(True)))
    for p in all_prompts.scalars().all():
        p.is_active = False

    target.is_active = True
    await db.commit()

    return {"success": True, "message": f"Prompt {target.version_tag} activated"}
