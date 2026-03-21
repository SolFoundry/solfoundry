"""Health monitoring service for SolFoundry - Sovereign 14.0 Component."""

import time
import logging
from typing import Dict, Any, Optional
from threading import Lock

log = logging.getLogger(__name__)

class HealthMonitor:
    """In-memory request and performance tracker for the health dashboard."""

    def __init__(self):
        self._lock = Lock()
        self._request_count = 0
        self._status_codes: Dict[int, int] = {}
        self._path_counts: Dict[str, int] = {}
        self._error_count = 0
        self._start_time = time.time()
        self._running = False

    def start(self):
        """Enable metric collection."""
        with self._lock:
            self._running = True
            log.info("Health monitor started.")

    def stop(self):
        """Disable metric collection."""
        with self._lock:
            self._running = False
            log.info("Health monitor stopped.")

    def track_request(self, path: str, method: str, status_code: int, duration: float):
        """Record metrics for a single HTTP request."""
        if not self._running:
            return

        with self._lock:
            self._request_count += 1
            self._status_codes[status_code] = self._status_codes.get(status_code, 0) + 1
            self._path_counts[path] = self._path_counts.get(path, 0) + 1
            if 400 <= status_code < 600:
                self._error_count += 1

    def get_stats(self) -> Dict[str, Any]:
        """Return aggregate statistics for the health API."""
        with self._lock:
            uptime = time.time() - self._start_time
            return {
                "request_count": self._request_count,
                "error_count": self._error_count,
                "uptime": round(uptime, 2),
                "status_codes": self._status_codes,
                "top_paths": sorted(self._path_counts.items(), key=lambda x: x[1], reverse=True)[:5]
            }

# Global singleton monitor instance
monitor = HealthMonitor()
