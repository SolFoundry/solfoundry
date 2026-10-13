import os
import json
import subprocess
from datetime import datetime
from anthropic import Anthropic
from dotenv import load_dotenv

from config import ANTHROPIC_API_KEY, CLAUDE_MODEL, MAX_TOKENS, AGENT_CAPABILITIES, OUTPUT_DIR

# Load environment variables from .env file
load_dotenv()

class ClaudeAgent:
    def __init__(self, api_key: str, model: str, capabilities: list):
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY is not set. Please set it in your environment or .env file.")
        self.client = Anthropic(api_key=api_key)
        self.model = model
        self.capabilities = capabilities
        self.output_dir = OUTPUT_DIR
        os.makedirs(self.output_dir, exist_ok=True)
        print(f"Claude Agent initialized with model: {self.model}")
        print(f"Agent capabilities: {', '.join(self.capabilities)}")

    def _call_claude(self, system_prompt: str, user_message: str) -> str:
        """Helper to call the Claude API."""
        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=MAX_TOKENS,
                system=system_prompt,
                messages=[
                    {"role": "user", "content": user_message}
                ]
            )
            return response.content[0].text
        except Exception as e:
            print(f"Error calling Claude API: {e}")
            return f"ERROR: {e}"

    def _parse_claude_output(self, output: str) -> dict:
        """
        Parses Claude's output, expecting a JSON block with file paths and content.
        Example format:
        