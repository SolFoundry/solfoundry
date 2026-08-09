"""GitHub REST API client for repo discovery and metadata enrichment."""
import httpx

from app.config import settings

GITHUB_API = "https://api.github.com"


class GitHubClient:
    def __init__(self, token: str = ""):
        self.token = token or settings.github_token
        self.headers = {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        if self.token:
            self.headers["Authorization"] = f"Bearer {self.token}"

    async def get_repo_metadata(self, owner: str, name: str) -> dict:
        """Fetch enriched metadata for a single public repo."""
        async with httpx.AsyncClient(timeout=15, headers=self.headers) as client:
            resp = await client.get(f"{GITHUB_API}/repos/{owner}/{name}")
            resp.raise_for_status()
            return resp.json()

    async def search_repos(self, q: str, sort: str = "stars", order: str = "desc", per_page: int = 20) -> list[dict]:
        """Search GitHub repos by query (language, stars, topics)."""
        params = {"q": q, "sort": sort, "order": order, "per_page": min(per_page, 100)}
        async with httpx.AsyncClient(timeout=15, headers=self.headers) as client:
            resp = await client.get(f"{GITHUB_API}/search/repositories", params=params)
            resp.raise_for_status()
            return resp.json().get("items", [])

    @staticmethod
    def parse_repo_url(url: str) -> tuple[str, str]:
        """Extract (owner, name) from a GitHub repo URL."""
        url = url.rstrip("/")
        parts = url.split("/")
        if "github.com" in url:
            # https://github.com/owner/repo
            idx = url.index("github.com/")
            tail = url[idx + len("github.com/"):]
            segs = [s for s in tail.split("/") if s]
            if len(segs) >= 2:
                return segs[0], segs[1]
        # fallback: treat last two path segments as owner/name
        parts = [s for s in parts if s]
        if len(parts) >= 2:
            return parts[-2], parts[-1]
        raise ValueError(f"Cannot parse repo URL: {url}")