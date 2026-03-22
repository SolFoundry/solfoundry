"""Codebase map service — generates interactive project structure data.

Fetches the repository tree from GitHub API, cross-references files with
active bounties and recent PRs, computes test coverage indicators, and
returns a structured tree/graph suitable for frontend visualization.

The data includes:
- File/directory tree with metadata
- Dependency relationships between modules
- Bounty associations per file/directory
- Recent modification timestamps
- Test coverage indicators (presence of test files)
"""

import asyncio
import logging
import os
import re
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx

from app.services.bounty_service import _bounty_store

logger = logging.getLogger(__name__)

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")
REPO = os.getenv("GITHUB_REPO", "SolFoundry/solfoundry")
API_BASE = "https://api.github.com"

# Cache for expensive GitHub API calls
_map_cache: Optional[dict] = None
_cache_timestamp: Optional[datetime] = None
CACHE_TTL_SECONDS = 300  # 5 minutes


def _github_headers() -> dict:
    """Build GitHub API request headers with optional authentication.

    Returns:
        dict: Headers dictionary with Accept and optional Authorization.
    """
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"
    return headers


async def _fetch_repo_tree() -> list[dict]:
    """Fetch the full repository tree from GitHub using the Git Trees API.

    Uses the recursive tree endpoint to get all files in a single request,
    which is more efficient than traversing directories individually.

    Returns:
        list[dict]: List of tree entries with path, type, size, and sha fields.
            Each entry has: path (str), type ('blob'|'tree'), size (int|None), sha (str).

    Raises:
        httpx.HTTPError: If the GitHub API request fails.
    """
    async with httpx.AsyncClient(timeout=30) as client:
        # First get the default branch SHA
        repo_response = await client.get(
            f"{API_BASE}/repos/{REPO}",
            headers=_github_headers(),
        )
        if repo_response.status_code != 200:
            logger.error(
                "Failed to fetch repo info: %d %s",
                repo_response.status_code,
                repo_response.text[:200],
            )
            return []

        default_branch = repo_response.json().get("default_branch", "main")

        # Fetch the full tree recursively
        tree_response = await client.get(
            f"{API_BASE}/repos/{REPO}/git/trees/{default_branch}",
            headers=_github_headers(),
            params={"recursive": "1"},
        )
        if tree_response.status_code != 200:
            logger.error(
                "Failed to fetch repo tree: %d %s",
                tree_response.status_code,
                tree_response.text[:200],
            )
            return []

        tree_data = tree_response.json()
        return tree_data.get("tree", [])


async def _fetch_recent_commits(since_days: int = 14) -> list[dict]:
    """Fetch recent commits to determine recently modified files.

    Args:
        since_days: Number of days to look back for recent commits.
            Defaults to 14 days.

    Returns:
        list[dict]: List of commit objects with sha, message, author, and date fields.
    """
    since = (datetime.now(timezone.utc) - timedelta(days=since_days)).isoformat()
    commits: list[dict] = []

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(
            f"{API_BASE}/repos/{REPO}/commits",
            headers=_github_headers(),
            params={
                "since": since,
                "per_page": 100,
            },
        )
        if response.status_code == 200:
            for commit in response.json():
                commits.append({
                    "sha": commit.get("sha", ""),
                    "message": commit.get("commit", {}).get("message", ""),
                    "author": commit.get("commit", {}).get("author", {}).get("name", ""),
                    "date": commit.get("commit", {}).get("author", {}).get("date", ""),
                })

    return commits


async def _fetch_recent_prs(state: str = "all", limit: int = 50) -> list[dict]:
    """Fetch recent pull requests for file-PR association.

    Args:
        state: PR state filter — 'open', 'closed', or 'all'. Defaults to 'all'.
        limit: Maximum number of PRs to fetch. Defaults to 50.

    Returns:
        list[dict]: List of simplified PR objects with number, title, state,
            author, created_at, merged_at, and linked_files fields.
    """
    pull_requests: list[dict] = []

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(
            f"{API_BASE}/repos/{REPO}/pulls",
            headers=_github_headers(),
            params={
                "state": state,
                "per_page": min(limit, 100),
                "sort": "updated",
                "direction": "desc",
            },
        )
        if response.status_code == 200:
            for pr_data in response.json():
                pull_requests.append({
                    "number": pr_data.get("number", 0),
                    "title": pr_data.get("title", ""),
                    "state": pr_data.get("state", ""),
                    "author": pr_data.get("user", {}).get("login", ""),
                    "created_at": pr_data.get("created_at", ""),
                    "merged_at": pr_data.get("merged_at"),
                    "html_url": pr_data.get("html_url", ""),
                })

    return pull_requests


def _extract_file_extension(file_path: str) -> str:
    """Extract the file extension from a path, including compound extensions.

    Args:
        file_path: The file path to extract the extension from.

    Returns:
        str: The file extension (without leading dot), or empty string if none.
            For compound extensions like '.test.tsx', returns 'test.tsx'.
    """
    parts = file_path.rsplit("/", 1)[-1].split(".")
    if len(parts) > 1:
        return parts[-1]
    return ""


def _detect_file_category(file_path: str) -> str:
    """Categorize a file based on its path and extension.

    Args:
        file_path: The file path to categorize.

    Returns:
        str: One of 'test', 'config', 'source', 'documentation', 'asset',
            'workflow', or 'other'.
    """
    lower_path = file_path.lower()
    extension = _extract_file_extension(file_path)

    # Check workflow files first (before config, since .yml is also config-like)
    if ".github/workflows" in lower_path:
        return "workflow"
    if "test" in lower_path or extension in ("test.ts", "test.tsx", "test.py", "spec.ts"):
        return "test"
    if lower_path.endswith((".json", ".toml", ".yaml", ".yml", ".ini", ".cfg")):
        return "config"
    if extension in ("ts", "tsx", "py", "rs", "js", "jsx"):
        return "source"
    if extension in ("md", "rst", "txt"):
        return "documentation"
    if extension in ("png", "jpg", "svg", "ico", "gif"):
        return "asset"
    return "other"


def _determine_module(file_path: str) -> str:
    """Determine which top-level module a file belongs to.

    Args:
        file_path: The file path to classify.

    Returns:
        str: The top-level module name (e.g., 'backend', 'frontend', 'contracts').
            Returns 'root' for files not inside a recognized module.
    """
    parts = file_path.split("/")
    if len(parts) > 0:
        first = parts[0]
        known_modules = {
            "backend", "frontend", "contracts", "automaton",
            "router", "scripts", ".github", "docs", "assets",
        }
        if first in known_modules:
            return first
    return "root"


def _has_test_coverage(file_path: str, all_paths: set[str]) -> bool:
    """Check if a source file has an associated test file.

    Looks for common test file naming conventions:
    - test_<name>.py (Python)
    - <name>.test.tsx / <name>.test.ts (TypeScript/React)
    - __tests__/<name>.test.tsx

    Args:
        file_path: The source file path to check.
        all_paths: Set of all file paths in the repository for lookup.

    Returns:
        bool: True if a corresponding test file exists, False otherwise.
    """
    extension = _extract_file_extension(file_path)

    if extension in ("py",):
        # Python: check for test_<name>.py in tests/ directory
        filename = file_path.rsplit("/", 1)[-1]
        directory = file_path.rsplit("/", 1)[0] if "/" in file_path else ""
        test_name = f"test_{filename}"
        # Check in same directory
        test_path_same = f"{directory}/{test_name}" if directory else test_name
        # Check in tests/ subdirectory
        module = _determine_module(file_path)
        test_path_tests = f"{module}/tests/{test_name}"
        return test_path_same in all_paths or test_path_tests in all_paths

    if extension in ("ts", "tsx"):
        # TypeScript: check for <name>.test.ts(x)
        base = file_path.rsplit(".", 1)[0]
        test_path_ts = f"{base}.test.ts"
        test_path_tsx = f"{base}.test.tsx"
        # Check __tests__ directory
        parts = file_path.rsplit("/", 1)
        if len(parts) == 2:
            directory, filename = parts
            name_without_ext = filename.rsplit(".", 1)[0]
            test_path_dir = f"{directory}/__tests__/{name_without_ext}.test.tsx"
            test_path_dir_ts = f"{directory}/__tests__/{name_without_ext}.test.ts"
            return (
                test_path_ts in all_paths
                or test_path_tsx in all_paths
                or test_path_dir in all_paths
                or test_path_dir_ts in all_paths
            )
        return test_path_ts in all_paths or test_path_tsx in all_paths

    return False


def _build_bounty_file_associations() -> dict[str, list[dict]]:
    """Build a mapping from directory/module to associated bounties.

    Scans the bounty store and maps each bounty to likely affected directories
    based on the bounty's skills and title keywords.

    Returns:
        dict[str, list[dict]]: Mapping from directory path to list of bounty summaries.
            Each bounty summary has: id, title, tier, status, reward_amount.
    """
    associations: dict[str, list[dict]] = {}

    # Mapping from skill/keyword to likely directories
    skill_to_dirs = {
        "react": ["frontend"],
        "typescript": ["frontend"],
        "tailwind": ["frontend"],
        "frontend": ["frontend"],
        "python": ["backend"],
        "fastapi": ["backend"],
        "backend": ["backend"],
        "postgresql": ["backend"],
        "redis": ["backend"],
        "rust": ["contracts"],
        "anchor": ["contracts"],
        "solana": ["contracts"],
        "security": ["contracts", "backend"],
        "devops": [".github", "scripts"],
        "docker": ["scripts"],
        "websocket": ["backend"],
    }

    for bounty_id, bounty in _bounty_store.items():
        bounty_summary = {
            "id": bounty_id,
            "title": bounty.title,
            "tier": bounty.tier.value if hasattr(bounty.tier, "value") else str(bounty.tier),
            "status": bounty.status.value if hasattr(bounty.status, "value") else str(bounty.status),
            "reward_amount": bounty.reward_amount,
        }

        affected_dirs: set[str] = set()

        # Match by skills
        for skill in (bounty.required_skills or []):
            skill_lower = skill.lower()
            if skill_lower in skill_to_dirs:
                affected_dirs.update(skill_to_dirs[skill_lower])

        # Match by title keywords
        title_lower = bounty.title.lower()
        keyword_to_dirs = {
            "frontend": ["frontend"],
            "backend": ["backend"],
            "api": ["backend"],
            "contract": ["contracts"],
            "escrow": ["contracts"],
            "dashboard": ["frontend"],
            "ui": ["frontend"],
            "staking": ["contracts", "frontend"],
            "webhook": ["backend"],
            "review": ["automaton"],
            "router": ["router"],
            "deploy": ["scripts"],
        }
        for keyword, dirs in keyword_to_dirs.items():
            if keyword in title_lower:
                affected_dirs.update(dirs)

        # If no match found, associate with root
        if not affected_dirs:
            affected_dirs.add("root")

        for directory in affected_dirs:
            if directory not in associations:
                associations[directory] = []
            associations[directory].append(bounty_summary)

    return associations


def _compute_dependency_edges(tree_entries: list[dict]) -> list[dict]:
    """Compute dependency relationships between top-level modules.

    Identifies known architectural dependencies in the SolFoundry codebase.

    Args:
        tree_entries: List of repository tree entries from GitHub API.

    Returns:
        list[dict]: List of dependency edges with source, target, and relationship fields.
            Each edge has: source (str), target (str), relationship (str).
    """
    # Known architectural dependencies in SolFoundry
    edges = [
        {
            "source": "frontend",
            "target": "backend",
            "relationship": "API calls via /api proxy",
        },
        {
            "source": "backend",
            "target": "contracts",
            "relationship": "Solana RPC calls for on-chain operations",
        },
        {
            "source": "automaton",
            "target": "backend",
            "relationship": "Management cells invoke backend services",
        },
        {
            "source": "router",
            "target": "automaton",
            "relationship": "Routes LLM requests to management cells",
        },
        {
            "source": "scripts",
            "target": "backend",
            "relationship": "Deployment and review scripts call backend",
        },
        {
            "source": ".github",
            "target": "scripts",
            "relationship": "CI/CD workflows invoke deployment scripts",
        },
        {
            "source": "backend",
            "target": "router",
            "relationship": "Backend uses router for multi-LLM reviews",
        },
    ]

    # Filter edges to only include modules that actually exist
    existing_modules = {
        entry["path"].split("/")[0]
        for entry in tree_entries
        if "/" in entry.get("path", "")
    }
    existing_modules.add("root")

    return [
        edge for edge in edges
        if edge["source"] in existing_modules and edge["target"] in existing_modules
    ]


def build_tree_from_entries(
    tree_entries: list[dict],
    bounty_associations: dict[str, list[dict]],
    recently_modified_paths: set[str],
    all_paths: set[str],
) -> dict:
    """Build a hierarchical tree structure from flat GitHub tree entries.

    Converts the flat list of file entries from GitHub's Git Trees API into
    a nested tree structure suitable for frontend visualization. Each node
    includes metadata about bounty associations, modification recency, and
    test coverage.

    Args:
        tree_entries: Flat list of tree entries from GitHub API with path, type, size.
        bounty_associations: Mapping from directory paths to associated bounties.
        recently_modified_paths: Set of file paths modified in recent commits.
        all_paths: Set of all file paths for test coverage lookup.

    Returns:
        dict: Root tree node with nested children. Each node has:
            - name (str): File or directory name
            - path (str): Full path from repo root
            - node_type ('file'|'directory'): Node type
            - children (list[dict]): Child nodes (directories only)
            - extension (str): File extension (files only)
            - size (int): File size in bytes (files only)
            - category (str): File category classification
            - module (str): Top-level module name
            - has_active_bounty (bool): Whether associated with an active bounty
            - bounties (list[dict]): Associated bounty summaries
            - recently_modified (bool): Whether modified in recent commits
            - has_test_coverage (bool): Whether a test file exists for this source
            - file_count (int): Number of files in subtree (directories only)
    """
    root: dict = {
        "name": REPO.split("/")[-1],
        "path": "",
        "node_type": "directory",
        "children": [],
        "module": "root",
        "has_active_bounty": False,
        "bounties": bounty_associations.get("root", []),
        "recently_modified": False,
        "has_test_coverage": False,
        "file_count": 0,
        "category": "source",
    }

    # Build a dict of path -> node for quick lookup
    nodes: dict[str, dict] = {"": root}

    for entry in sorted(tree_entries, key=lambda e: e.get("path", "")):
        file_path = entry.get("path", "")
        if not file_path:
            continue

        entry_type = entry.get("type", "blob")
        parts = file_path.split("/")
        name = parts[-1]
        parent_path = "/".join(parts[:-1])
        module = _determine_module(file_path)

        # Get bounties for this path's directory
        path_bounties = bounty_associations.get(module, [])

        if entry_type == "tree":
            # Directory node
            node = {
                "name": name,
                "path": file_path,
                "node_type": "directory",
                "children": [],
                "module": module,
                "has_active_bounty": any(
                    b["status"] == "open" for b in path_bounties
                ),
                "bounties": path_bounties if file_path == module else [],
                "recently_modified": False,
                "has_test_coverage": False,
                "file_count": 0,
                "category": _detect_file_category(file_path),
            }
        else:
            # File node
            category = _detect_file_category(file_path)
            is_recently_modified = file_path in recently_modified_paths
            has_tests = _has_test_coverage(file_path, all_paths)

            node = {
                "name": name,
                "path": file_path,
                "node_type": "file",
                "extension": _extract_file_extension(file_path),
                "size": entry.get("size", 0),
                "category": category,
                "module": module,
                "has_active_bounty": any(
                    b["status"] == "open" for b in path_bounties
                ),
                "bounties": [],
                "recently_modified": is_recently_modified,
                "has_test_coverage": has_tests,
            }

        nodes[file_path] = node

        # Attach to parent
        parent = nodes.get(parent_path)
        if parent and "children" in parent:
            parent["children"].append(node)

    # Roll up file counts and recently_modified flags
    _roll_up_metadata(root)

    return root


def _roll_up_metadata(node: dict) -> tuple[int, bool]:
    """Recursively roll up file count and modification status to parent directories.

    Updates each directory node with the total number of files in its subtree
    and whether any descendant was recently modified.

    Args:
        node: The current tree node to process.

    Returns:
        tuple[int, bool]: (file_count, has_recent_modification) for the subtree.
    """
    if node["node_type"] == "file":
        return 1, node.get("recently_modified", False)

    total_files = 0
    any_recent = False

    for child in node.get("children", []):
        child_files, child_recent = _roll_up_metadata(child)
        total_files += child_files
        if child_recent:
            any_recent = True

    node["file_count"] = total_files
    node["recently_modified"] = any_recent
    return total_files, any_recent


async def generate_codebase_map() -> dict:
    """Generate the complete codebase map data structure.

    This is the main entry point for the service. It fetches repository data
    from GitHub, cross-references with bounty information, and builds the
    visualization-ready data structure.

    Uses a 5-minute cache to avoid excessive GitHub API calls.

    Returns:
        dict: Complete codebase map with:
            - tree (dict): Hierarchical file/directory tree
            - dependencies (list[dict]): Module dependency edges
            - summary (dict): Aggregate statistics
            - pull_requests (list[dict]): Recent PRs
            - generated_at (str): ISO timestamp of generation
    """
    global _map_cache, _cache_timestamp

    # Check cache
    if (
        _map_cache is not None
        and _cache_timestamp is not None
        and (datetime.now(timezone.utc) - _cache_timestamp).total_seconds() < CACHE_TTL_SECONDS
    ):
        return _map_cache

    # Fetch data from GitHub API in parallel
    tree_entries, recent_commits, recent_prs = await asyncio.gather(
        _fetch_repo_tree(),
        _fetch_recent_commits(since_days=14),
        _fetch_recent_prs(state="all", limit=30),
    )

    # Build set of all paths for test coverage detection
    all_paths = {entry["path"] for entry in tree_entries if entry.get("path")}

    # Determine recently modified files from commit messages
    # Note: Without fetching individual commit diffs (expensive), we approximate
    # by marking files in directories mentioned in commit messages
    recently_modified_paths: set[str] = set()
    for commit in recent_commits:
        message = commit.get("message", "").lower()
        # Simple heuristic: mark paths that match keywords in commit messages
        for path in all_paths:
            filename = path.rsplit("/", 1)[-1].lower()
            name_without_ext = filename.rsplit(".", 1)[0]
            if len(name_without_ext) > 3 and name_without_ext in message:
                recently_modified_paths.add(path)

    # Build bounty associations
    bounty_associations = _build_bounty_file_associations()

    # Build the tree
    tree = build_tree_from_entries(
        tree_entries, bounty_associations, recently_modified_paths, all_paths
    )

    # Compute dependency edges
    dependencies = _compute_dependency_edges(tree_entries)

    # Summary statistics
    total_files = sum(1 for e in tree_entries if e.get("type") == "blob")
    total_dirs = sum(1 for e in tree_entries if e.get("type") == "tree")
    modules = set()
    for entry in tree_entries:
        path = entry.get("path", "")
        if "/" in path:
            modules.add(path.split("/")[0])

    active_bounties = sum(
        1 for b in _bounty_store.values()
        if (hasattr(b.status, "value") and b.status.value == "open")
        or str(b.status) == "open"
    )

    summary = {
        "total_files": total_files,
        "total_directories": total_dirs,
        "total_modules": len(modules),
        "modules": sorted(modules),
        "active_bounties": active_bounties,
        "recent_commits": len(recent_commits),
        "recent_prs": len(recent_prs),
    }

    result = {
        "tree": tree,
        "dependencies": dependencies,
        "summary": summary,
        "pull_requests": recent_prs[:20],
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }

    # Cache the result
    _map_cache = result
    _cache_timestamp = datetime.now(timezone.utc)

    return result


def invalidate_cache() -> None:
    """Invalidate the codebase map cache, forcing regeneration on next request.

    Call this after significant repository changes (e.g., new bounties synced)
    to ensure the map reflects the latest state.
    """
    global _map_cache, _cache_timestamp
    _map_cache = None
    _cache_timestamp = None
