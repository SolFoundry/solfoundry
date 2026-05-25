"""Implementer — executes the solution plan by creating/modifying files."""

import logging
import os
import subprocess
from typing import Optional
from .planner import SolutionPlan

log = logging.getLogger(__name__)


class Implementer:
    """Implements bounty solutions by creating or modifying files."""

    def __init__(self, repo_path: str):
        self.repo_path = repo_path

    def implement(self, plan: SolutionPlan) -> bool:
        """Execute the solution plan. Returns True if successful."""
        log.info(f"Implementing bounty #{plan.bounty_number}: {plan.bounty_title}")

        try:
            for fc in plan.files_to_create:
                self._create_file(fc["path"], fc.get("content", ""), fc.get("purpose", ""))

            for fm in plan.files_to_modify:
                self._modify_file(fm["path"], fm.get("content", ""), fm.get("purpose", ""))

            return True
        except Exception as e:
            log.error(f"Implementation failed: {e}")
            return False

    def create_from_template(self, template_path: str, dest_path: str, variables: dict) -> bool:
        """Create a file from a template, replacing {{var}} placeholders."""
        try:
            full_path = os.path.join(self.repo_path, dest_path)
            os.makedirs(os.path.dirname(full_path), exist_ok=True)

            with open(os.path.join(self.repo_path, template_path)) as f:
                content = f.read()

            for key, value in variables.items():
                content = content.replace("{{" + key + "}}", str(value))

            with open(full_path, "w") as f:
                f.write(content)

            log.info(f"Created {dest_path} from template")
            return True
        except Exception as e:
            log.error(f"Template creation failed: {e}")
            return False

    def _create_file(self, filepath: str, content: str, purpose: str = "") -> None:
        """Create a new file in the repository."""
        full_path = os.path.join(self.repo_path, filepath)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)

        if not content:
            content = f"# {os.path.basename(filepath)}\n# Purpose: {purpose}\n# Created by Bounty Hunter\n"

        with open(full_path, "w") as f:
            f.write(content)
        log.info(f"Created {filepath}")

    def _modify_file(self, filepath: str, content: str, purpose: str = "") -> None:
        """Modify an existing file in the repository."""
        full_path = os.path.join(self.repo_path, filepath)
        if not os.path.exists(full_path):
            log.warning(f"File {filepath} does not exist, creating instead")
            self._create_file(filepath, content, purpose)
            return

        if content:
            with open(full_path, "a") as f:
                f.write(f"\n# {purpose}\n{content}\n")
            log.info(f"Modified {filepath}")
        else:
            log.info(f"No changes to apply to {filepath}")

    def run_command(self, cmd: list[str], cwd: Optional[str] = None) -> subprocess.CompletedProcess:
        """Run a shell command in the repo directory."""
        return subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            cwd=cwd or self.repo_path,
            timeout=60,
        )
