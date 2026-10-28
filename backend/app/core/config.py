from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    APP_NAME: str = "CloudVault"
    APP_SECRET: str = "change-me-in-production-use-a-long-random-string"
    DEBUG: bool = False

    DATABASE_URL: str = "sqlite:///./cloudvault.db"

    FRONTEND_URL: str = "http://localhost:3000"
    BACKEND_URL: str = "http://localhost:8000"

    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    STORAGE_BACKEND: str = "local"
    LOCAL_STORAGE_PATH: str = "./storage_data"

    S3_ENDPOINT_URL: Optional[str] = None
    S3_BUCKET: str = "cloudvault"
    S3_REGION: str = "us-east-1"
    S3_ACCESS_KEY_ID: Optional[str] = None
    S3_SECRET_ACCESS_KEY: Optional[str] = None

    MAX_FILE_SIZE_MB: int = 100
    DEFAULT_STORAGE_QUOTA_BYTES: int = 1073741824  # 1 GB

    TRASH_RETENTION_DAYS: int = 30

    RATE_LIMIT_AUTH: str = "10/minute"
    RATE_LIMIT_UPLOAD: str = "30/minute"
    RATE_LIMIT_DEFAULT: str = "120/minute"

    CORS_ORIGINS: str = "http://localhost:3000"

    model_config = {"env_file": ".env", "case_sensitive": True}

    @property
    def max_file_size_bytes(self) -> int:
        return self.MAX_FILE_SIZE_MB * 1024 * 1024

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()
