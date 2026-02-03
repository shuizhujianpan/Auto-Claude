"""
Gitea API Client
================

Client for Gitea API operations.
Uses direct API calls with token authentication.
"""

from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Any


@dataclass
class GiteaConfig:
    """Gitea configuration loaded from project."""

    token: str
    repository: str  # owner/repo format
    instance_url: str


def encode_repository_path(repository: str) -> str:
    """URL-encode a repository path for API calls."""
    return urllib.parse.quote(repository, safe="")


# Valid Gitea API endpoint patterns
VALID_ENDPOINT_PATTERNS = (
    "/repos/",
    "/user",
    "/users/",
    "/orgs/",
    "/pulls/",
    "/issues/",
    "/releases",
)


def validate_endpoint(endpoint: str) -> None:
    """
    Validate that an endpoint is a legitimate Gitea API path.
    Raises ValueError if the endpoint is suspicious.
    """
    if not endpoint:
        raise ValueError("Endpoint cannot be empty")

    # Must start with /
    if not endpoint.startswith("/"):
        raise ValueError("Endpoint must start with /")

    # Check for path traversal attempts
    if ".." in endpoint:
        raise ValueError("Endpoint contains path traversal sequence")

    # Check for null bytes
    if "\x00" in endpoint:
        raise ValueError("Endpoint contains null byte")

    # Validate against known patterns
    if not any(endpoint.startswith(pattern) for pattern in VALID_ENDPOINT_PATTERNS):
        raise ValueError(
            f"Endpoint does not match known Gitea API patterns: {endpoint}"
        )


class GiteaClient:
    """Client for Gitea API operations."""

    def __init__(
        self,
        project_dir: Path,
        config: GiteaConfig,
        default_timeout: float = 30.0,
    ):
        self.project_dir = Path(project_dir)
        self.config = config
        self.default_timeout = default_timeout

    def _api_url(self, endpoint: str) -> str:
        """Build full API URL."""
        base = self.config.instance_url.rstrip("/")
        if not endpoint.startswith("/"):
            endpoint = f"/{endpoint}"
        return f"{base}/api/v1{endpoint}"

    def _fetch(
        self,
        endpoint: str,
        method: str = "GET",
        data: dict | None = None,
        timeout: float | None = None,
        max_retries: int = 3,
    ) -> Any:
        """Make an API request to Gitea with rate limit handling."""
        validate_endpoint(endpoint)
        url = self._api_url(endpoint)
        headers = {
            "Authorization": f"token {self.config.token}",
            "Content-Type": "application/json",
        }

        request_data = None
        if data:
            request_data = json.dumps(data).encode("utf-8")

        last_error = None
        for attempt in range(max_retries):
            req = urllib.request.Request(
                url,
                data=request_data,
                headers=headers,
                method=method,
            )

            try:
                with urllib.request.urlopen(
                    req, timeout=timeout or self.default_timeout
                ) as response:
                    if response.status == 204:
                        return None
                    response_body = response.read().decode("utf-8")
                    try:
                        return json.loads(response_body)
                    except json.JSONDecodeError as e:
                        raise Exception(
                            f"Invalid JSON response from Gitea: {e}"
                        ) from e
            except urllib.error.HTTPError as e:
                error_body = e.read().decode("utf-8") if e.fp else ""
                last_error = e

                # Handle rate limit (429) with exponential backoff
                if e.code == 429:
                    # Default to exponential backoff: 1s, 2s, 4s
                    wait_time = 2**attempt

                    # Check for Retry-After header (can be integer seconds or HTTP-date)
                    retry_after = e.headers.get("Retry-After")
                    if retry_after:
                        try:
                            # Try parsing as integer seconds first
                            wait_time = int(retry_after)
                        except ValueError:
                            # Try parsing as HTTP-date (e.g., "Wed, 21 Oct 2015 07:28:00 GMT")
                            try:
                                retry_date = parsedate_to_datetime(retry_after)
                                now = datetime.now(timezone.utc)
                                delta = (retry_date - now).total_seconds()
                                wait_time = max(1, int(delta))  # At least 1 second
                            except (ValueError, TypeError):
                                # Parsing failed, keep exponential backoff default
                                pass

                    if attempt < max_retries - 1:
                        print(
                            f"[Gitea] Rate limited (429). Retrying in {wait_time}s "
                            f"(attempt {attempt + 1}/{max_retries})...",
                            flush=True,
                        )
                        time.sleep(wait_time)
                        continue

                raise Exception(f"Gitea API error {e.code}: {error_body}") from e

        # Should not reach here, but just in case
        raise Exception(f"Gitea API error after {max_retries} retries") from last_error

    def get_issue(self, index: int) -> dict:
        """Get issue details by index."""
        encoded_repo = encode_repository_path(self.config.repository)
        return self._fetch(f"/repos/{encoded_repo}/issues/{index}")

    def get_pull_request(self, index: int) -> dict:
        """Get pull request details by index."""
        encoded_repo = encode_repository_path(self.config.repository)
        return self._fetch(f"/repos/{encoded_repo}/pulls/{index}")

    def get_pr_diff(self, index: int) -> str:
        """Get the full diff for a pull request."""
        encoded_repo = encode_repository_path(self.config.repository)
        # Gitea provides .diff endpoint for getting raw diff
        url = self._api_url(f"/repos/{encoded_repo}/pulls/{index}.diff")
        headers = {
            "Authorization": f"token {self.config.token}",
        }

        req = urllib.request.Request(url, headers=headers)

        try:
            with urllib.request.urlopen(req, timeout=self.default_timeout) as response:
                return response.read().decode("utf-8")
        except urllib.error.HTTPError as e:
            error_body = e.read().decode("utf-8") if e.fp else ""
            raise Exception(f"Gitea API error {e.code}: {error_body}") from e

    def get_pr_commits(self, index: int) -> list[dict]:
        """Get commits for a pull request."""
        encoded_repo = encode_repository_path(self.config.repository)
        return self._fetch(f"/repos/{encoded_repo}/pulls/{index}/commits")

    def get_pr_files(self, index: int) -> list[dict]:
        """Get files changed in a pull request."""
        encoded_repo = encode_repository_path(self.config.repository)
        return self._fetch(f"/repos/{encoded_repo}/pulls/{index}/files")

    def get_current_user(self) -> dict:
        """Get current authenticated user."""
        return self._fetch("/user")

    def post_issue_comment(self, index: int, body: str) -> dict:
        """Post a comment to an issue."""
        encoded_repo = encode_repository_path(self.config.repository)
        return self._fetch(
            f"/repos/{encoded_repo}/issues/{index}/comments",
            method="POST",
            data={"body": body},
        )

    def post_pr_comment(self, index: int, body: str) -> dict:
        """Post a comment to a pull request."""
        # In Gitea, PR comments use the same endpoint as issue comments
        return self.post_issue_comment(index, body)

    def approve_pr(self, index: int) -> dict:
        """Approve a pull request."""
        encoded_repo = encode_repository_path(self.config.repository)
        return self._fetch(
            f"/repos/{encoded_repo}/pulls/{index}/reviews",
            method="POST",
            data={"event": "APPROVED"},
        )

    def merge_pr(
        self,
        index: int,
        merge_method: str = "merge",
    ) -> dict:
        """
        Merge a pull request.

        Args:
            index: PR index
            merge_method: Merge method - "merge", "rebase", or "squash"

        Returns:
            Merge response
        """
        encoded_repo = encode_repository_path(self.config.repository)
        # Gitea uses 'do' parameter for merge action
        return self._fetch(
            f"/repos/{encoded_repo}/pulls/{index}/merge",
            method="POST",
            data={"do": merge_method},
        )

    def create_release(
        self,
        tag: str,
        name: str,
        body: str,
    ) -> dict:
        """Create a release."""
        encoded_repo = encode_repository_path(self.config.repository)
        return self._fetch(
            f"/repos/{encoded_repo}/releases",
            method="POST",
            data={
                "tag_name": tag,
                "name": name,
                "body": body,
            },
        )

    def get_issues(
        self,
    ) -> list[dict]:
        """List issues for the repository."""
        encoded_repo = encode_repository_path(self.config.repository)
        return self._fetch(f"/repos/{encoded_repo}/issues")

    def get_pull_requests(
        self,
    ) -> list[dict]:
        """List pull requests for the repository."""
        encoded_repo = encode_repository_path(self.config.repository)
        return self._fetch(f"/repos/{encoded_repo}/pulls")

    def get_issue_comments(self, index: int) -> list[dict]:
        """Get comments for an issue."""
        encoded_repo = encode_repository_path(self.config.repository)
        return self._fetch(f"/repos/{encoded_repo}/issues/{index}/comments")

    def get_pr_comments(self, index: int) -> list[dict]:
        """Get comments for a pull request."""
        # In Gitea, PR comments use the same endpoint as issue comments
        return self.get_issue_comments(index)


def load_gitea_config(project_dir: Path) -> GiteaConfig | None:
    """Load Gitea config from project's .auto-claude/gitea/config.json."""
    config_path = project_dir / ".auto-claude" / "gitea" / "config.json"

    if not config_path.exists():
        return None

    try:
        with open(config_path, encoding="utf-8") as f:
            data = json.load(f)

        token = data.get("token")
        repository = data.get("repository")
        instance_url = data.get("instance_url", "https://gitea.com")

        if not token or not repository:
            return None

        return GiteaConfig(
            token=token,
            repository=repository,
            instance_url=instance_url,
        )
    except Exception:
        return None
