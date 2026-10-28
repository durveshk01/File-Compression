"""Database engine and session configuration with PostgreSQL and SQLite support."""

import re
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.core.config import settings

url = settings.DATABASE_URL

# If postgresql:// is specified without driver, check if psycopg (v3) is available
if url.startswith("postgresql://"):
    try:
        import psycopg  # noqa: F401
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    except ImportError:
        pass

connect_args = {}
engine_kwargs = {}
if url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
else:
    engine_kwargs = {
        "pool_pre_ping": True,
        "pool_size": 10,
        "max_overflow": 20,
    }

engine = create_engine(url, connect_args=connect_args, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
