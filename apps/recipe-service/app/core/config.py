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
    """All the app settings. They are read once from env vars and from the `.env`
    file in the current folder."""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # The default is production, so if ENV is missing we get the safe settings
    # (for example, secure cookies).
    env: Environment = Environment.PRODUCTION
    data_dir: Path = Path("./data")
    # When the app starts with no recipes, it adds the demo recipes from
    # `app/seed_data/demo_recipes.json`. Users do not change this. Only the tests and
    # the e2e server set SEED_DEMO=false, so they start with an empty database.
    seed_demo: bool = True
    jwt_secret: SecretStr
    cookie_secure: bool = True
    # Which AI engine imports recipes (AD-12). The app uses the first name in the
    # list. To switch engines, change this setting. If the engine fails, the app does
    # not try another one.
    llm_providers: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["anthropic"]
    )
    gemini_api_key: SecretStr | None = None
    gemini_model: str = "gemini-3.5-flash-lite"
    # How many seconds to wait for Gemini before the import fails (Story 5.1 spike).
    gemini_timeout_seconds: PositiveInt = 30
    anthropic_api_key: SecretStr | None = None
    anthropic_model: str = "claude-haiku-5-5"
    anthropic_timeout_seconds: PositiveInt = 30
    import_daily_cap: PositiveInt = 50
    # The maximum length, in characters, of text pasted into an import.
    import_max_chars: PositiveInt = 20_000
    llm_max_tokens: PositiveInt = 4096
    # Importing from a URL (AD-13): the maximum page size, and the maximum time for
    # the whole download, including redirects.
    page_max_bytes: PositiveInt = 3 * 1024 * 1024
    page_fetch_timeout_seconds: PositiveInt = 15
    # Photo uploads (AD-27): the maximum file size, and the maximum picture size
    # (width x height) we agree to open. The second limit stops a small file from
    # turning into gigabytes in memory.
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

    @field_validator("gemini_api_key", "anthropic_api_key", mode="before")
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
    """Creates the settings. If a setting is invalid, stops with a readable error."""
    try:
        return Settings()
    except ValidationError as error:
        raise SystemExit(_describe(error)) from None


@lru_cache
def get_settings() -> Settings:
    """Returns the settings, created once and then reused.

    Routes get them with `Depends(get_settings)`.
    """
    return load_settings()
