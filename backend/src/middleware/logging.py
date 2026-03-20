"""Centralized logging middleware.

Handles structured JSON logs and correlation IDs.
"""

import logging

def setup_logging():
    """Setup global logging handlers."""
    logging.basicConfig(level=logging.INFO)

def handle_error(exception):
    """Global error handler."""
    return {"error": str(exception)}
