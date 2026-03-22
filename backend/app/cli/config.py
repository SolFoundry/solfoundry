"""Configuration file management for the SolFoundry CLI.

Reads and writes ``~/.solfoundry/config.yaml`` which stores:
- ``api_url``: Base URL of the SolFoundry API server.
- ``api_key``: Bearer token used for authenticated requests.
- ``default_format``: Preferred output format (``table`` or ``json``).
- ``wallet_address``: Solana wallet address for submissions.

The configuration directory is created automatically on first use.
Environment variables ``SOLFOUNDRY_API_URL`` and ``SOLFOUNDRY_API_KEY``
override the corresponding config-file values when set.
"""

import os
import logging
from pathlib import Path
from typing import Any, Dict, Optional

import yaml

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

CONFIG_DIR = Path.home() / ".solfoundry"
CONFIG_FILE = CONFIG_DIR / "config.yaml"

# ---------------------------------------------------------------------------
# Defaults
# ---------------------------------------------------------------------------

DEFAULT_API_URL = "https://api.solfoundry.org"
DEFAULT_FORMAT = "table"

_DEFAULTS: Dict[str, Any] = {
    "api_url": DEFAULT_API_URL,
    "api_key": "",
    "default_format": DEFAULT_FORMAT,
    "wallet_address": "",
}


# ---------------------------------------------------------------------------
# Public helpers
# ---------------------------------------------------------------------------


def ensure_config_dir() -> Path:
    """Create the ``~/.solfoundry`` directory if it does not exist.

    Returns:
        Path: The configuration directory path.
    """
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    return CONFIG_DIR


def load_config() -> Dict[str, Any]:
    """Load configuration from disk, falling back to defaults.

    Environment variables take precedence over the config file:
    - ``SOLFOUNDRY_API_URL`` overrides ``api_url``
    - ``SOLFOUNDRY_API_KEY`` overrides ``api_key``

    Returns:
        Dict[str, Any]: Merged configuration dictionary.
    """
    config: Dict[str, Any] = dict(_DEFAULTS)

    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as file_handle:
                file_data = yaml.safe_load(file_handle)
                if isinstance(file_data, dict):
                    config.update(file_data)
        except (yaml.YAMLError, OSError) as exc:
            logger.warning("Failed to read config file %s: %s", CONFIG_FILE, exc)

    # Environment overrides
    env_url = os.getenv("SOLFOUNDRY_API_URL")
    if env_url:
        config["api_url"] = env_url

    env_key = os.getenv("SOLFOUNDRY_API_KEY")
    if env_key:
        config["api_key"] = env_key

    return config


def save_config(config: Dict[str, Any]) -> None:
    """Persist configuration to ``~/.solfoundry/config.yaml``.

    Only keys present in the default configuration are written; unknown
    keys are silently dropped to prevent config-file pollution.

    Args:
        config: Configuration dictionary to persist.

    Raises:
        OSError: If the file cannot be written.
    """
    ensure_config_dir()
    # Only persist known keys
    filtered = {key: config.get(key, _DEFAULTS[key]) for key in _DEFAULTS}
    with open(CONFIG_FILE, "w", encoding="utf-8") as file_handle:
        yaml.safe_dump(filtered, file_handle, default_flow_style=False)
    # Restrict permissions on the config file (contains API key)
    try:
        CONFIG_FILE.chmod(0o600)
    except OSError:
        pass  # Windows may not support chmod


def get_api_key(config: Optional[Dict[str, Any]] = None) -> str:
    """Return the API key from config, failing with a clear message if unset.

    Args:
        config: Pre-loaded configuration. Loaded from disk when ``None``.

    Returns:
        str: The API key / Bearer token.

    Raises:
        SystemExit: When no API key is configured.
    """
    if config is None:
        config = load_config()
    api_key = config.get("api_key", "")
    if not api_key:
        raise SystemExit(
            "No API key configured. Run 'sf configure' or set SOLFOUNDRY_API_KEY."
        )
    return api_key


def get_api_url(config: Optional[Dict[str, Any]] = None) -> str:
    """Return the base API URL, stripped of trailing slashes.

    Args:
        config: Pre-loaded configuration. Loaded from disk when ``None``.

    Returns:
        str: The API base URL.
    """
    if config is None:
        config = load_config()
    return config.get("api_url", DEFAULT_API_URL).rstrip("/")
