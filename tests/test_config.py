"""Tests for configuration management."""

import pytest
import yaml
from pathlib import Path
from unittest.mock import patch, MagicMock

from solfoundry_cli.config import Config, ConfigManager, config_manager


@pytest.fixture
def temp_config_dir(tmp_path):
    """Create temporary config directory."""
    config_dir = tmp_path / ".solfoundry"
    config_dir.mkdir()
    return config_dir


def test_config_default_values():
    """Test default configuration values."""
    config = Config()
    
    assert config.api_url == "https://api.solfoundry.io"
    assert config.api_key is None
    assert config.wallet_path is None
    assert config.default_output_format == "table"
    assert config.default_tier is None


def test_config_manager_load_default(temp_config_dir):
    """Test loading default configuration."""
    manager = ConfigManager(config_dir=str(temp_config_dir))
    config = manager.load()
    
    assert config.api_url == "https://api.solfoundry.io"
    # Should create config file
    assert manager.config_file.exists()


def test_config_manager_save_load(temp_config_dir):
    """Test saving and loading configuration."""
    manager = ConfigManager(config_dir=str(temp_config_dir))
    
    config = Config(
        api_url="https://custom.api.solfoundry.io",
        api_key="test_key_123",
        default_output_format="json"
    )
    
    manager.save(config)
    
    # Load fresh
    manager2 = ConfigManager(config_dir=str(temp_config_dir))
    loaded_config = manager2.load()
    
    assert loaded_config.api_url == "https://custom.api.solfoundry.io"
    assert loaded_config.api_key == "test_key_123"
    assert loaded_config.default_output_format == "json"


def test_config_manager_environment_override(temp_config_dir):
    """Test environment variable overrides."""
    # Create config file
    manager = ConfigManager(config_dir=str(temp_config_dir))
    config = Config(api_key="file_key")
    manager.save(config)
    
    # Override with environment
    with patch.dict('os.environ', {
        'SOLFOUNDRY_API_KEY': 'env_key',
        'SOLFOUNDRY_API_URL': 'https://env.api.solfoundry.io'
    }):
        manager2 = ConfigManager(config_dir=str(temp_config_dir))
        loaded_config = manager2.load()
        
        assert loaded_config.api_key == 'env_key'
        assert loaded_config.api_url == 'https://env.api.solfoundry.io'


def test_config_file_format(temp_config_dir):
    """Test configuration file YAML format."""
    manager = ConfigManager(config_dir=str(temp_config_dir))
    
    config = Config(
        api_url="https://test.api.io",
        api_key="secret_key",
        default_output_format="json"
    )
    
    manager.save(config)
    
    # Read raw file
    with open(manager.config_file, 'r') as f:
        data = yaml.safe_load(f)
    
    assert data['api_url'] == "https://test.api.io"
    assert data['api_key'] == "secret_key"
    assert data['default_output_format'] == "json"


def test_get_api_key_priority(temp_config_dir):
    """Test API key retrieval priority (env > file)."""
    manager = ConfigManager(config_dir=str(temp_config_dir))
    
    # Save config with key
    config = Config(api_key="file_key")
    manager.save(config)
    
    # No env - should use file key
    assert manager.get_api_key() == "file_key"
    
    # With env - should use env key
    with patch.dict('os.environ', {'SOLFOUNDRY_API_KEY': 'env_key'}):
        manager2 = ConfigManager(config_dir=str(temp_config_dir))
        assert manager2.get_api_key() == "env_key"


def test_config_ensure_dir(temp_config_dir):
    """Test configuration directory creation."""
    new_dir = temp_config_dir / "nested" / "config"
    manager = ConfigManager(config_dir=str(new_dir))
    
    # Should create directory
    manager._ensure_config_dir()
    assert new_dir.exists()
    assert new_dir.is_dir()
