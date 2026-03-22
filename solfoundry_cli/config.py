"""Configuration management for SolFoundry CLI."""

import os
import yaml
from pathlib import Path
from typing import Optional
from pydantic import BaseModel, Field


class Config(BaseModel):
    """SolFoundry CLI configuration."""
    
    api_url: str = Field(default="https://api.solfoundry.io", description="SolFoundry API URL")
    api_key: Optional[str] = Field(default=None, description="API key for authentication")
    wallet_path: Optional[str] = Field(default=None, description="Path to wallet keyfile")
    default_output_format: str = Field(default="table", description="Default output format (table/json)")
    default_tier: Optional[str] = Field(default=None, description="Default tier filter")
    
    model_config = {"arbitrary_types_allowed": True}


class ConfigManager:
    """Manage SolFoundry CLI configuration."""
    
    def __init__(self, config_dir: Optional[str] = None):
        if config_dir:
            self.config_dir = Path(config_dir)
        else:
            self.config_dir = Path.home() / ".solfoundry"
        
        self.config_file = self.config_dir / "config.yaml"
        self._config: Optional[Config] = None
    
    def _ensure_config_dir(self) -> None:
        """Ensure configuration directory exists."""
        self.config_dir.mkdir(parents=True, exist_ok=True)
    
    def load(self) -> Config:
        """Load configuration from file."""
        if self._config is not None:
            return self._config
        
        if not self.config_file.exists():
            # Create default config
            self._config = Config()
            self.save()
            return self._config
        
        with open(self.config_file, "r") as f:
            data = yaml.safe_load(f) or {}
        
        # Override with environment variables
        if os.getenv("SOLFOUNDRY_API_URL"):
            data["api_url"] = os.getenv("SOLFOUNDRY_API_URL")
        if os.getenv("SOLFOUNDRY_API_KEY"):
            data["api_key"] = os.getenv("SOLFOUNDRY_API_KEY")
        if os.getenv("SOLFOUNDRY_WALLET_PATH"):
            data["wallet_path"] = os.getenv("SOLFOUNDRY_WALLET_PATH")
        
        self._config = Config(**data)
        return self._config
    
    def save(self, config: Optional[Config] = None) -> None:
        """Save configuration to file."""
        if config:
            self._config = config
        
        if self._config is None:
            self._config = Config()
        
        self._ensure_config_dir()
        
        with open(self.config_file, "w") as f:
            yaml.dump(
                self._config.model_dump(exclude_none=True),
                f,
                default_flow_style=False,
                sort_keys=False
            )
    
    def get_api_key(self) -> Optional[str]:
        """Get API key from config or environment."""
        config = self.load()
        return config.api_key or os.getenv("SOLFOUNDRY_API_KEY")
    
    def get_api_url(self) -> str:
        """Get API URL from config or environment."""
        config = self.load()
        return config.api_url or os.getenv("SOLFOUNDRY_API_URL", "https://api.solfoundry.io")


# Global config manager instance
config_manager = ConfigManager()
