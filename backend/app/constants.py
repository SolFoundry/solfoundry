"""Shared application constants."""

import time

# UUID used by automated pipelines
INTERNAL_SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000001"

# Application version for health check and telemetry
VERSION = "1.0.1"

# Application start time for heartbeat
START_TIME = time.monotonic()
