import os
import subprocess
import sys
from pathlib import Path

import pytest

from app.core.config import Environment, Settings, get_settings, load_settings
from tests.conftest import TEST_SECRET

SERVICE_ROOT = Path(__file__).resolve().parents[1]


def test_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("ENV")
    monkeypatch.delenv("DATA_DIR")
    monkeypatch.delenv("COOKIE_SECURE")
    settings = load_settings()
    assert settings.env is Environment.PRODUCTION
    assert settings.data_dir == Path("./data")
    assert settings.cookie_secure is True
    assert settings.llm_providers == ["ollama"]
    assert settings.ollama_url == "http://localhost:11434"
    assert settings.gemini_api_key is None
    assert settings.gemini_model == "gemini-3.8-flash"
    assert settings.import_daily_cap == 50
    assert settings.llm_max_tokens == 4096
    assert settings.app_timezone == "Asia/Jerusalem"
    assert settings.log_level == "INFO"


def test_reads_env_file(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("JWT_SECRET")
    (tmp_path / ".env").write_text(
        "JWT_SECRET=from-file\nLLM_PROVIDERS=ollama, gemini\nGEMINI_API_KEY=\n",
        encoding="utf-8",
    )
    settings = load_settings()
    assert settings.jwt_secret.get_secret_value() == "from-file"
    assert settings.llm_providers == ["ollama", "gemini"]
    assert settings.gemini_api_key is None


def test_env_vars_override_env_file(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    (tmp_path / ".env").write_text("JWT_SECRET=from-file\n", encoding="utf-8")
    assert load_settings().jwt_secret.get_secret_value() == TEST_SECRET


@pytest.mark.parametrize("value", [None, "", "   "])
def test_missing_or_blank_jwt_secret_fails_fast(
    value: str | None, monkeypatch: pytest.MonkeyPatch
) -> None:
    if value is None:
        monkeypatch.delenv("JWT_SECRET")
    else:
        monkeypatch.setenv("JWT_SECRET", value)
    with pytest.raises(SystemExit) as exc_info:
        load_settings()
    message = str(exc_info.value)
    assert "JWT_SECRET" in message
    assert ".env.example" in message


def test_secret_never_appears_in_error(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("JWT_SECRET", "super-secret-value")
    monkeypatch.setenv("IMPORT_DAILY_CAP", "0")
    with pytest.raises(SystemExit) as exc_info:
        load_settings()
    assert "IMPORT_DAILY_CAP" in str(exc_info.value)
    assert "super-secret-value" not in str(exc_info.value)


def test_insecure_cookie_refused_outside_dev(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ENV", "production")
    monkeypatch.setenv("COOKIE_SECURE", "false")
    with pytest.raises(SystemExit) as exc_info:
        load_settings()
    message = str(exc_info.value)
    assert "COOKIE_SECURE" in message
    assert "ENV" in message


def test_insecure_cookie_allowed_in_dev(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("COOKIE_SECURE", "false")
    assert load_settings().cookie_secure is False


def test_get_settings_is_cached() -> None:
    assert get_settings() is get_settings()
    assert isinstance(get_settings(), Settings)


def test_app_refuses_to_start_without_jwt_secret(tmp_path: Path) -> None:
    env = {k: v for k, v in os.environ.items() if k != "JWT_SECRET"}
    env["PYTHONPATH"] = str(SERVICE_ROOT)
    result = subprocess.run(
        [sys.executable, "-c", "import app.main"],
        cwd=tmp_path,
        env=env,
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert result.returncode != 0
    assert "JWT_SECRET" in result.stderr
    assert ".env.example" in result.stderr
