"""Initial tasks schema

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
        "tasks",
        sa.Column("id",         sa.UUID(),          primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("user_id",    sa.UUID(),          nullable=False),
        sa.Column("title",      sa.String(200),     nullable=False),
        sa.Column("category",   sa.String(64),      nullable=True),
        sa.Column("difficulty", sa.SmallInteger(),  server_default="1"),
        sa.Column("status",     sa.String(20),      server_default="todo"),
        sa.Column("due_at",     sa.DateTime(),      nullable=False),
        sa.Column("created_at", sa.DateTime(),      server_default=sa.text("NOW()")),
    )
    op.create_index("idx_tasks_user", "tasks", ["user_id", "due_at"])


def downgrade() -> None:
    op.drop_table("tasks")
