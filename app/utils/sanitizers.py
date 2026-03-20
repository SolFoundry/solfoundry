# app/utils/sanitizers.py
import html
import re

def sanitize_text_input(text):
    if not isinstance(text, str): return ""
    return html.escape(text.strip())

def validate_solana_address(address):
    if not isinstance(address, str): return False
    return bool(re.fullmatch(r'^[1-9A-HJ-NP-Za-km-z]{32,44}$', address))
