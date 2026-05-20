#!/usr/bin/env python3
"""Seed 4 demo action items matching the UI snapshot."""
from __future__ import annotations

import asyncio
import os
import sys
import uuid
from pathlib import Path

_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_root))

_DEFAULTS = {
    "REDIS_URL": "redis://redis:6379/0",
    "JWT_PRIVATE_KEY": "not-used",
    "JWT_PUBLIC_KEY": "not-used",
    "ANTHROPIC_API_KEY": "not-used",
    "RAZORPAY_KEY_ID": "rzp_test",
    "RAZORPAY_KEY_SECRET": "rzp_secret",
    "RAZORPAY_WEBHOOK_SECRET": "whsec",
    "SMTP_HOST": "localhost",
    "SMTP_PORT": "587",
    "SMTP_USER": "x",
    "SMTP_PASS": "x",
    "SMTP_FROM": "x@x.com",
    "FRONTEND_URL": "http://localhost:3000",
}
for k, v in _DEFAULTS.items():
    os.environ.setdefault(k, v)

ITEMS = [
    {
        "title": "Update Risk Assessment Framework for NRI Accounts",
        "description": (
            "Review and update risk scoring criteria to incorporate enhanced due diligence "
            "requirements for high-value NRI accounts (>Rs 10L)"
        ),
        "assigned_team": "Risk Management",
        "priority": "HIGH",
        "due_date": "2025-11-25",
        "status": "PENDING",
    },
    {
        "title": "Update Account Opening Forms",
        "description": (
            "Modify NRI account opening forms to capture additional information required "
            "for enhanced due diligence processes"
        ),
        "assigned_team": "Operations",
        "priority": "MEDIUM",
        "due_date": "2025-11-30",
        "status": "PENDING",
    },
    {
        "title": "Conduct Compliance Audit of NRI Accounts",
        "description": (
            "Review existing NRI account portfolio to ensure compliance with "
            "November 2025 amendments to KYC guidelines"
        ),
        "assigned_team": "Compliance",
        "priority": "HIGH",
        "due_date": "2025-12-15",
        "status": "PENDING",
    },
    {
        "title": "Train Branch Staff on New KYC Procedures",
        "description": (
            "Organize training sessions for branch personnel on updated documentary "
            "requirements and verification processes"
        ),
        "assigned_team": "Operations",
        "priority": "MEDIUM",
        "due_date": "2025-12-05",
        "status": "IN_PROGRESS",
    },
]


async def main() -> None:
    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import create_async_engine

    engine = create_async_engine(os.environ["DATABASE_URL"], echo=False)

    async with engine.begin() as conn:
        # Find the first verified non-admin user (demo user)
        row = await conn.execute(
            text(
                "SELECT id, email FROM users "
                "WHERE email_verified = TRUE AND is_admin = FALSE "
                "AND email NOT LIKE 'system@%' "
                "ORDER BY created_at LIMIT 1"
            )
        )
        user = row.fetchone()
        if not user:
            print("ERROR: No verified non-admin user found. Register one first.")
            return

        user_id, email = user
        print(f"Seeding action items for: {email} ({user_id})")

        # Check existing count
        cnt = (
            await conn.execute(
                text("SELECT COUNT(*) FROM action_items WHERE user_id = :uid"),
                {"uid": user_id},
            )
        ).scalar()
        if cnt and cnt >= 4:
            print(f"Already {cnt} action items present — skipping. Pass --reseed to replace.")
            if "--reseed" not in sys.argv:
                return
            await conn.execute(
                text("DELETE FROM action_items WHERE user_id = :uid"), {"uid": user_id}
            )
            print("Cleared existing action items.")

        uid = str(user_id)
        for item in ITEMS:
            item_id = str(uuid.uuid4())
            # Escape single-quotes in text values
            title = item["title"].replace("'", "''")
            desc = item["description"].replace("'", "''")
            team = item["assigned_team"].replace("'", "''")
            priority = item["priority"]
            due_date = item["due_date"]
            status = item["status"]
            sql = (
                f"INSERT INTO action_items "
                f"(id, user_id, title, description, assigned_team, priority, due_date, status, "
                f"source_question_id, source_circular_id, created_at, updated_at) "
                f"VALUES ("
                f"'{item_id}'::uuid, '{uid}'::uuid, "
                f"'{title}', '{desc}', '{team}', '{priority}', "
                f"'{due_date}'::date, '{status}'::action_item_status_enum, "
                f"NULL, NULL, NOW(), NOW()) "
                f"ON CONFLICT (id) DO NOTHING"
            )
            await conn.execute(text(sql))
            print(f"  Inserted: {item['title']}")

    await engine.dispose()
    print("Seed complete.")


if __name__ == "__main__":
    asyncio.run(main())
