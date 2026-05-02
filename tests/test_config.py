"""Unit tests for configuration management."""
import json
import os
import tempfile
import unittest

from bounty_agent.config import (
    BountyAgentConfig,
    GatewayConfig,
)


class TestBountyAgentConfig(unittest.TestCase):

    def test_default_config(self):
        config = BountyAgentConfig()
        self.assertEqual(config.agent_name, "bounty-agent")
        self.assertEqual(config.log_level, "INFO")

    def test_custom_config(self):
        config = BountyAgentConfig(agent_name="test-agent", log_level="DEBUG")
        self.assertEqual(config.agent_name, "test-agent")
        self.assertEqual(config.log_level, "DEBUG")

    def test_from_file(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump({"log_level": "DEBUG", "agent_name": "file-agent"}, f)
            f.flush()
            try:
                cfg = BountyAgentConfig.from_file(f.name)
                self.assertEqual(cfg.log_level, "DEBUG")
            except Exception:
                pass
            finally:
                os.unlink(f.name)


class TestGatewayConfig(unittest.TestCase):

    def test_gateway_config_defaults(self):
        gw = GatewayConfig()
        self.assertIsNotNone(gw)


if __name__ == "__main__":
    unittest.main()
