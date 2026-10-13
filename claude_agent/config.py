import os

# --- Claude API Configuration ---
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
CLAUDE_MODEL = "claude-3-opus-20240229" # Or "claude-3-sonnet-20240229", "claude-3-haiku-20240229"
MAX_TOKENS = 4000 # Max tokens for Claude's response

# --- Agent Capabilities ---
AGENT_CAPABILITIES = [
    "Python programming (intermediate)",
    "JavaScript programming (basic)",
    "Solidity smart contract development (basic)",
    "Web development (HTML, CSS, basic JS)",
    "API integration (REST)",
    "Unit testing (Python, JavaScript)",
    "Git and GitHub workflow understanding",
    "Documentation writing",
    "Problem-solving and algorithm design",
]

# --- Output Configuration ---
OUTPUT_DIR = "output"
