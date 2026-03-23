"""Initial auth schema

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
        "users",
        sa.Column("id",            sa.UUID(),           primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("email",         sa.String(255),      nullable=False, unique=True),
        sa.Column("password_hash", sa.Text(),           nullable=False),
        sa.Column("created_at",    sa.DateTime(),       server_default=sa.text("NOW()")),
    )
    op.create_index("idx_users_email", "users", ["email"])


def downgrade() -> None:
    op.drop_table("users")
