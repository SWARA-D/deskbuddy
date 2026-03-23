"""Initial checkin schema

Revision ID: 001
Revises:
Create Date: 2026-03-22
"""
from alembic import op
import sqlalchemy as sa

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    op.create_table(
        "daily_checkins",
        sa.Column("id",           sa.UUID(),     primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("user_id",      sa.UUID(),     nullable=False),
        sa.Column("checkin_date", sa.Date(),     nullable=False),
        sa.Column("caption",      sa.Text(),     nullable=True),
        sa.Column("photo_url",    sa.String(500), nullable=True),
        sa.Column("created_at",   sa.DateTime(), server_default=sa.text("NOW()")),
        sa.UniqueConstraint("user_id", "checkin_date", name="uq_checkin_user_date"),
    )
    op.create_index("idx_checkins_user", "daily_checkins", ["user_id", "checkin_date"])


def downgrade() -> None:
    op.drop_table("daily_checkins")
