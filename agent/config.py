"""Configuration loader with environment variable expansion."""

import os
import re
import yaml
from pathlib import Path
from typing import Any


def _expand_env(value: str) -> str:
    """Expand ${VAR} references in string values."""
    def replacer(match):
        var_name = match.group(1)
        return os.environ.get(var_name, match.group(0))
    return re.sub(r'\$\{(\w+)\}', replacer, str(value))


def _deep_expand(obj: Any) -> Any:
    """Recursively expand environment variables in config values."""
    if isinstance(obj, str):
        return _expand_env(obj)
    if isinstance(obj, dict):
        return {k: _deep_expand(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_deep_expand(item) for item in obj]
    return obj


def load_config(path: str = "config.yaml") -> dict:
    """Load and environment-expand the agent configuration."""
    config_path = Path(__file__).parent / path
    if not config_path.exists():
        raise FileNotFoundError(f"Config not found: {config_path}")

    with open(config_path) as f:
        config = yaml.safe_load(f)

    return _deep_expand(config)
