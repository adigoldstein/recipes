from enum import StrEnum
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal, Self

from pydantic import (
    Field,
    PositiveInt,
    SecretStr,
    ValidationError,
    field_validator,
    model_validator,
)
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Environment(StrEnum):
    DEV = "dev"
    PRODUCTION = "production"


class Settings(BaseSettings):
    """Every runtime setting, read once from env vars (and `.env` in the cwd)."""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # Defaults to production so a forgotten ENV fails safe (e.g. secure cookies).
    env: Environment = Environment.PRODUCTION
    data_dir: Path = Path("./data")
    jwt_secret: SecretStr
    cookie_secure: bool = True
    llm_providers: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["ollama"]
    )
    ollama_url: str = "http://localhost:11434"
    gemini_api_key: SecretStr | None = None
    gemini_model: str = "gemini-3.8-flash"
    import_daily_cap: PositiveInt = 50
    llm_max_tokens: PositiveInt = 4096
    # Photo uploads (AD-27): the largest file, and the largest picture (width x height)
    # a decoder is allowed to open, so a small file cannot expand into gigabytes.
    photo_max_bytes: PositiveInt = 10 * 1024 * 1024
    photo_max_pixels: PositiveInt = 40_000_000
    app_timezone: str = "Asia/Jerusalem"
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"

    @field_validator("jwt_secret")
    @classmethod
    def _secret_not_blank(cls, value: SecretStr) -> SecretStr:
        if not value.get_secret_value().strip():
            raise ValueError("must not be empty")
        return value

    @field_validator("llm_providers", mode="before")
    @classmethod
    def _split_providers(cls, value: object) -> object:
        if isinstance(value, str):
            return [name.strip() for name in value.split(",") if name.strip()]
        return value

    @field_validator("gemini_api_key", mode="before")
    @classmethod
    def _blank_key_is_none(cls, value: object) -> object:
        return None if isinstance(value, str) and not value.strip() else value

    @model_validator(mode="after")
    def _insecure_cookie_only_in_dev(self) -> Self:
        if not self.cookie_secure and self.env is not Environment.DEV:
            raise ValueError("COOKIE_SECURE=false is only allowed when ENV=dev")
        return self


def _describe(error: ValidationError) -> str:
    lines = []
    for item in error.errors(include_input=False, include_url=False):
        field = ".".join(str(part) for part in item["loc"]).upper() or "config"
        lines.append(f"  - {field}: {item['msg']}")
    return "\n".join(
        ["Invalid configuration:", *lines, "See .env.example for every setting."]
    )


def load_settings() -> Settings:
    """Build Settings, turning validation errors into a readable startup failure."""
    try:
        return Settings()
    except ValidationError as error:
        raise SystemExit(_describe(error)) from None


@lru_cache
def get_settings() -> Settings:
    """Cached settings, injectable with `Depends(get_settings)`."""
    return load_settings()
