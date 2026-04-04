from __future__ import annotations

import subprocess
from dataclasses import dataclass


@dataclass(slots=True)
class GitCommandResult:
    command: list[str]
    returncode: int
    stdout: str
    stderr: str


def run_git_command(args: list[str]) -> GitCommandResult:
    completed = subprocess.run(
        ["git", *args],
        check=False,
        capture_output=True,
        text=True,
    )
    return GitCommandResult(
        command=["git", *args],
        returncode=completed.returncode,
        stdout=completed.stdout.strip(),
        stderr=completed.stderr.strip(),
    )
