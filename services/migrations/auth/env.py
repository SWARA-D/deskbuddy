"""Alembic env.py for auth_service — deskbuddy_auth database."""
import os
from logging.config import fileConfig
from alembic import context

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://deskbuddy:deskbuddy@postgres:5432/deskbuddy_auth",
)

def run_migrations_offline() -> None:
    context.configure(url=DATABASE_URL, literal_binds=True,
                      dialect_opts={"paramstyle": "named"})
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online() -> None:
    from sqlalchemy import create_engine
    engine = create_engine(DATABASE_URL)
    with engine.connect() as connection:
        context.configure(connection=connection)
        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
