"""
Coder module for the Bounty Hunter Agent.
Handles code generation, file creation, and codebase exploration.
"""

import os
import subprocess
import shutil
from dataclasses import dataclass
from typing import Optional


@dataclass
class FileChange:
    """Represents a file that was created or modified."""
    path: str
    content: str
    action: str  # "create" or "modify"


class Coder:
    """
    Code generation and manipulation module.
    Works with local git clones for efficient file operations.
    """

    def __init__(self, local_repo_path: str):
        self.local_repo_path = local_repo_path

    def apply_changes(self, changes: dict[str, str]) -> list[FileChange]:
        """
        Apply a dict of {filepath: content} changes to the local repo.
        Returns list of FileChange objects.
        """
        applied = []
        for path, content in changes.items():
            full_path = os.path.join(self.local_repo_path, path)
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            with open(full_path, "w", encoding="utf-8") as f:
                f.write(content)
            action = "modify" if os.path.exists(full_path) else "create"
            applied.append(FileChange(path=path, content=content, action=action))
        return applied

    def read_file(self, path: str) -> Optional[str]:
        """Read a file from the local repo."""
        try:
            full_path = os.path.join(self.local_repo_path, path)
            with open(full_path, "r", encoding="utf-8") as f:
                return f.read()
        except Exception:
            return None

    def file_exists(self, path: str) -> bool:
        """Check if a file exists in the local repo."""
        return os.path.exists(os.path.join(self.local_repo_path, path))

    def list_directory(self, path: str = "") -> list[str]:
        """List files in a directory (non-recursive)."""
        full_path = os.path.join(self.local_repo_path, path)
        if not os.path.isdir(full_path):
            return []
        return os.listdir(full_path)

    def get_codebase_structure(self, max_depth: int = 3, exclude_dirs: list[str] = None) -> str:
        """
        Generate a tree-style overview of the codebase structure.
        """
        exclude_dirs = exclude_dirs or [
            "node_modules", ".git", "__pycache__", ".venv", "venv",
            "dist", "build", ".pytest_cache", "*.pyc", ".next"
        ]
        
        lines = []
        for root, dirs, files in os.walk(self.local_repo_path):
            # Filter exclude dirs in-place
            dirs[:] = [d for d in dirs if not any(
                ex in d or d.endswith(ex.replace("*", ""))
                for ex in exclude_dirs
            )]
            
            depth = root.replace(self.local_repo_path, "").count(os.sep)
            if depth > max_depth:
                continue
                
            indent = "  " * depth
            rel_path = os.path.relpath(root, self.local_repo_path)
            if rel_path == ".":
                rel_path = "/"
            lines.append(f"{indent}{os.path.basename(root)}/")
            
            file_indent = "  " * (depth + 1)
            for f in sorted(files):
                if not any(ex in f for ex in exclude_dirs):
                    lines.append(f"{file_indent}{f}")
        
        return "\n".join(lines)

    def run_command(self, cmd: list[str], timeout: int = 120) -> tuple[int, str, str]:
        """
        Run a shell command in the repo directory.
        Returns (exit_code, stdout, stderr).
        """
        try:
            result = subprocess.run(
                cmd,
                cwd=self.local_repo_path,
                capture_output=True,
                text=True,
                timeout=timeout
            )
            return result.returncode, result.stdout, result.stderr
        except subprocess.TimeoutExpired:
            return -1, "", "Command timed out"
        except Exception as e:
            return -1, "", str(e)

    def install_deps(self) -> tuple[int, str, str]:
        """Install dependencies if a package file exists."""
        if os.path.exists(os.path.join(self.local_repo_path, "package.json")):
            return self.run_command(["npm", "install"], timeout=300)
        elif os.path.exists(os.path.join(self.local_repo_path, "requirements.txt")):
            return self.run_command(["pip", "install", "-r", "requirements.txt"], timeout=300)
        elif os.path.exists(os.path.join(self.local_repo_path, "pyproject.toml")):
            return self.run_command(["pip", "install", "-e", "."], timeout=300)
        return (0, "No dependency file found", "")

    def stage_and_commit(self, files: list[str], message: str) -> tuple[int, str]:
        """
        Git add and commit files. Returns (exit_code, output).
        """
        # Add files
        code, out, err = self.run_command(["git", "add", "--"] + files)
        if code != 0:
            return code, f"git add failed: {err}"
        
        # Commit
        code, out, err = self.run_command(["git", "commit", "-m", message])
        if code != 0:
            return code, f"git commit failed: {err}"
        
        return 0, out

    def push_branch(self, branch: str) -> tuple[int, str]:
        """Push the current branch to origin."""
        code, out, err = self.run_command(["git", "push", "-u", "origin", branch])
        return code, out + err

    def get_staged_files(self) -> list[str]:
        """Get list of currently staged files."""
        code, out, err = self.run_command(["git", "diff", "--cached", "--name-only"])
        if code == 0:
            return [f.strip() for f in out.split("\n") if f.strip()]
        return []

    def get_changed_files(self) -> list[str]:
        """Get list of all changed (staged + unstaged) files."""
        code, out, err = self.run_command(["git", "diff", "--name-only"])
        files = []
        if code == 0:
            files.extend([f.strip() for f in out.split("\n") if f.strip()])
        code2, out2, _ = self.run_command(["git", "diff", "--cached", "--name-only"])
        if code2 == 0:
            files.extend([f.strip() for f in out2.split("\n") if f.strip() and f.strip() not in files])
        return files
