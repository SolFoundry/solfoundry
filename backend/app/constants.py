"""Shared application constants.

Centralizes magic values used across modules so they are defined once
and imported everywhere.
"""

# UUID used by automated pipelines (review bot, CI) to record reputation
# on behalf of contributors. Both auth.py and contributors.py reference
# this value.
INTERNAL_SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000001"
