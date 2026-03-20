"""Pydantic models for GitHub webhook events."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class GitHubUser(BaseModel):
    login: str
    id: int
    avatar_url: str | None = None


class GitHubRepo(BaseModel):
    id: int
    name: str
    full_name: str
    owner: GitHubUser | None = None


class PullRequestDetail(BaseModel):
    number: int
    title: str
    state: str
    user: GitHubUser
    body: str | None = None
    head: dict[str, Any] | None = None
    base: dict[str, Any] | None = None
    html_url: str | None = None


class PushEvent(BaseModel):
    ref: str
    before: str
    after: str
    repository: GitHubRepo
    sender: GitHubUser
    head_commit: dict[str, Any] | None = None
    commits: list[dict[str, Any]] | None = None


class PullRequestEvent(BaseModel):
    action: str
    number: int
    pull_request: PullRequestDetail
    repository: GitHubRepo
    sender: GitHubUser


class IssueEvent(BaseModel):
    action: str
    issue: dict[str, Any]
    repository: GitHubRepo
    sender: GitHubUser


class PingEvent(BaseModel):
    zen: str
    hook_id: int
    hook: dict[str, Any]
    repository: GitHubRepo | None = None
    sender: GitHubUser


EVENT_MODEL_MAP: dict[str, type[BaseModel]] = {
    "push": PushEvent,
    "pull_request": PullRequestEvent,
    "issues": IssueEvent,
    "ping": PingEvent,
}
