"""Initial journal schema

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
        "journal_entries",
        sa.Column("id",           sa.UUID(),          primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("user_id",      sa.UUID(),          nullable=False),
        sa.Column("text",         sa.Text(),          nullable=False),
        sa.Column("input_type",   sa.String(20),      server_default="typed"),
        sa.Column("sentiment",    sa.String(20),      nullable=True),
        sa.Column("emotion",      sa.String(32),      nullable=True),
        sa.Column("confidence",   sa.Float(),         nullable=True),
        sa.Column("mood_summary", sa.Text(),          nullable=True),
        sa.Column("created_at",   sa.DateTime(),      server_default=sa.text("NOW()")),
    )
    op.create_index("idx_journal_user", "journal_entries", ["user_id", "created_at"])


def downgrade() -> None:
    op.drop_table("journal_entries")
