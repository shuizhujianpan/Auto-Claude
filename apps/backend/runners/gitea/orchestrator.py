"""
Gitea Automation Orchestrator
==============================

Main coordinator for Gitea automation workflows:
- PR Review: AI-powered pull request review
- Follow-up Review: Review changes since last review
"""

from __future__ import annotations

import json
import traceback
import urllib.error
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

try:
    from .gitea_client import GiteaClient, GiteaConfig
    from .models import (
        GiteaRunnerConfig,
        MergeVerdict,
        PRContext,
        PRReviewResult,
    )
    from .services import PRReviewEngine
except ImportError:
    # Fallback for direct script execution (not as a module)
    from gitea_client import GiteaClient, GiteaConfig
    from models import (
        GiteaRunnerConfig,
        MergeVerdict,
        PRContext,
        PRReviewResult,
    )
    from services import PRReviewEngine

# Import safe_print for BrokenPipeError handling
try:
    from core.io_utils import safe_print
except ImportError:
    # Fallback for direct script execution
    import sys
    from pathlib import Path

    sys.path.insert(0, str(Path(__file__).parent.parent.parent))
    from core.io_utils import safe_print


@dataclass
class ProgressCallback:
    """Callback for progress updates."""

    phase: str
    progress: int  # 0-100
    message: str
    pr_index: int | None = None


class GiteaOrchestrator:
    """
    Orchestrates Gitea automation workflows.

    Usage:
        orchestrator = GiteaOrchestrator(
            project_dir=Path("/path/to/project"),
            config=config,
        )

        # Review a PR
        result = await orchestrator.review_pr(pr_index=123)
    """

    def __init__(
        self,
        project_dir: Path,
        config: GiteaRunnerConfig,
        progress_callback: Callable[[ProgressCallback], None] | None = None,
    ):
        self.project_dir = Path(project_dir)
        self.config = config
        self.progress_callback = progress_callback

        # Gitea directory for storing state
        self.gitea_dir = self.project_dir / ".auto-claude" / "gitea"
        self.gitea_dir.mkdir(parents=True, exist_ok=True)

        # Load Gitea config
        self.gitea_config = GiteaConfig(
            token=config.token,
            repository=config.repository,
            instance_url=config.instance_url,
        )

        # Initialize client
        self.client = GiteaClient(
            project_dir=self.project_dir,
            config=self.gitea_config,
        )

        # Initialize review engine
        self.review_engine = PRReviewEngine(
            project_dir=self.project_dir,
            gitea_dir=self.gitea_dir,
            config=self.config,
            progress_callback=self._forward_progress,
        )

    def _report_progress(
        self,
        phase: str,
        progress: int,
        message: str,
        pr_index: int | None = None,
    ) -> None:
        """Report progress to callback if set."""
        if self.progress_callback:
            self.progress_callback(
                ProgressCallback(
                    phase=phase,
                    progress=progress,
                    message=message,
                    pr_index=pr_index,
                )
            )

    def _forward_progress(self, callback) -> None:
        """Forward progress from engine to orchestrator callback."""
        if self.progress_callback:
            self.progress_callback(callback)

    async def _gather_pr_context(self, pr_index: int) -> PRContext:
        """Gather context for a PR."""
        safe_print(f"[Gitea] Fetching PR #{pr_index} data...")

        # Get PR details
        pr_data = self.client.get_pull_request(pr_index)

        # Get diff
        diff = self.client.get_pr_diff(pr_index)

        # Get commits
        commits = self.client.get_pr_commits(pr_index)

        # Get files
        files_data = self.client.get_pr_files(pr_index)

        # Parse diff for stats
        total_additions = 0
        total_deletions = 0
        changed_files = []

        for file in files_data:
            changed_files.append({
                "new_path": file.get("filename", ""),
                "old_path": file.get("filename", ""),
                "diff": "",  # Already have full diff
            })
            total_additions += file.get("additions", 0)
            total_deletions += file.get("deletions", 0)

        # Get head SHA
        head_sha = pr_data.get("head", {}).get("sha")

        return PRContext(
            pr_index=pr_index,
            title=pr_data.get("title", ""),
            description=pr_data.get("body", ""),
            author=pr_data.get("user", {}).get("login", "unknown"),
            source_branch=pr_data.get("head", {}).get("ref", ""),
            target_branch=pr_data.get("base", {}).get("ref", ""),
            state=pr_data.get("state", "open"),
            changed_files=changed_files,
            diff=diff,
            total_additions=total_additions,
            total_deletions=total_deletions,
            commits=commits,
            head_sha=head_sha,
        )

    async def review_pr(self, pr_index: int) -> PRReviewResult:
        """
        Perform AI-powered review of a pull request.

        Args:
            pr_index: The PR index to review

        Returns:
            PRReviewResult with findings and overall assessment
        """
        safe_print(f"[Gitea] Starting review for PR #{pr_index}")

        self._report_progress(
            "gathering_context",
            10,
            f"Gathering context for PR #{pr_index}...",
            pr_index=pr_index,
        )

        try:
            # Gather PR context
            context = await self._gather_pr_context(pr_index)
            safe_print(
                f"[Gitea] Context gathered: {context.title} "
                f"({len(context.changed_files)} files, {context.total_additions}+/{context.total_deletions}-)"
            )

            self._report_progress(
                "analyzing", 30, "Running AI review...", pr_index=pr_index
            )

            # Run review
            findings, verdict, summary, blockers = await self.review_engine.run_review(
                context
            )
            safe_print(f"[Gitea] Review complete: {len(findings)} findings")

            # Map verdict to overall_status
            if verdict == MergeVerdict.BLOCKED:
                overall_status = "request_changes"
            elif verdict == MergeVerdict.NEEDS_REVISION:
                overall_status = "request_changes"
            elif verdict == MergeVerdict.MERGE_WITH_CHANGES:
                overall_status = "comment"
            else:
                overall_status = "approve"

            # Generate summary
            full_summary = self.review_engine.generate_summary(
                findings=findings,
                verdict=verdict,
                verdict_reasoning=summary,
                blockers=blockers,
            )

            # Create result
            result = PRReviewResult(
                pr_index=pr_index,
                repository=self.config.repository,
                success=True,
                findings=findings,
                summary=full_summary,
                overall_status=overall_status,
                verdict=verdict,
                verdict_reasoning=summary,
                blockers=blockers,
                reviewed_commit_sha=context.head_sha,
            )

            # Save result
            result.save(self.gitea_dir)

            self._report_progress("complete", 100, "Review complete!", pr_index=pr_index)

            return result

        except urllib.error.HTTPError as e:
            error_msg = f"Gitea API error {e.code}"
            if e.code == 401:
                error_msg = "Gitea authentication failed. Check your token."
            elif e.code == 403:
                error_msg = "Gitea access forbidden. Check your permissions."
            elif e.code == 404:
                error_msg = f"PR #{pr_index} not found in Gitea."
            elif e.code == 429:
                error_msg = "Gitea rate limit exceeded. Please try again later."
            safe_print(f"[Gitea] Review failed for #{pr_index}: {error_msg}")
            result = PRReviewResult(
                pr_index=pr_index,
                repository=self.config.repository,
                success=False,
                error=error_msg,
            )
            result.save(self.gitea_dir)
            return result

        except json.JSONDecodeError as e:
            error_msg = f"Invalid JSON response from Gitea: {e}"
            safe_print(f"[Gitea] Review failed for #{pr_index}: {error_msg}")
            result = PRReviewResult(
                pr_index=pr_index,
                repository=self.config.repository,
                success=False,
                error=error_msg,
            )
            result.save(self.gitea_dir)
            return result

        except OSError as e:
            error_msg = f"File system error: {e}"
            safe_print(f"[Gitea] Review failed for #{pr_index}: {error_msg}")
            result = PRReviewResult(
                pr_index=pr_index,
                repository=self.config.repository,
                success=False,
                error=error_msg,
            )
            result.save(self.gitea_dir)
            return result

        except Exception as e:
            # Catch-all for unexpected errors, with full traceback for debugging
            error_details = f"{type(e).__name__}: {e}"
            full_traceback = traceback.format_exc()
            safe_print(f"[Gitea] Review failed for #{pr_index}: {error_details}")
            safe_print(f"[Gitea] Traceback:\n{full_traceback}")

            result = PRReviewResult(
                pr_index=pr_index,
                repository=self.config.repository,
                success=False,
                error=f"{error_details}\n\nTraceback:\n{full_traceback}",
            )
            result.save(self.gitea_dir)
            return result

    async def followup_review_pr(self, pr_index: int) -> PRReviewResult:
        """
        Perform a follow-up review of a PR.

        Only reviews changes since the last review.

        Args:
            pr_index: The PR index to review

        Returns:
            PRReviewResult with follow-up analysis
        """
        safe_print(f"[Gitea] Starting follow-up review for PR #{pr_index}")

        # Load previous review
        previous_review = PRReviewResult.load(self.gitea_dir, pr_index)

        if not previous_review:
            raise ValueError(
                f"No previous review found for PR #{pr_index}. Run initial review first."
            )

        if not previous_review.reviewed_commit_sha:
            raise ValueError(
                f"Previous review for PR #{pr_index} doesn't have commit SHA. "
                "Re-run initial review."
            )

        self._report_progress(
            "gathering_context",
            10,
            f"Gathering follow-up context for PR #{pr_index}...",
            pr_index=pr_index,
        )

        try:
            # Get current PR state
            context = await self._gather_pr_context(pr_index)

            # Check if there are new commits
            if context.head_sha == previous_review.reviewed_commit_sha:
                print(
                    f"[Gitea] No new commits since last review at {previous_review.reviewed_commit_sha[:8]}",
                    flush=True,
                )
                result = PRReviewResult(
                    pr_index=pr_index,
                    repository=self.config.repository,
                    success=True,
                    findings=previous_review.findings,
                    summary="No new commits since last review. Previous findings still apply.",
                    overall_status=previous_review.overall_status,
                    verdict=previous_review.verdict,
                    verdict_reasoning="No changes since last review.",
                    reviewed_commit_sha=context.head_sha,
                    is_followup_review=True,
                    unresolved_findings=[f.id for f in previous_review.findings],
                )
                result.save(self.gitea_dir)
                return result

            self._report_progress(
                "analyzing",
                30,
                "Analyzing changes since last review...",
                pr_index=pr_index,
            )

            # Run full review on current state
            findings, verdict, summary, blockers = await self.review_engine.run_review(
                context
            )

            # Compare with previous findings
            previous_finding_titles = {f.title for f in previous_review.findings}
            current_finding_titles = {f.title for f in findings}

            resolved = previous_finding_titles - current_finding_titles
            unresolved = previous_finding_titles & current_finding_titles
            new_findings = current_finding_titles - previous_finding_titles

            # Map verdict to overall_status
            if verdict == MergeVerdict.BLOCKED:
                overall_status = "request_changes"
            elif verdict == MergeVerdict.NEEDS_REVISION:
                overall_status = "request_changes"
            elif verdict == MergeVerdict.MERGE_WITH_CHANGES:
                overall_status = "comment"
            else:
                overall_status = "approve"

            # Generate summary
            full_summary = self.review_engine.generate_summary(
                findings=findings,
                verdict=verdict,
                verdict_reasoning=summary,
                blockers=blockers,
            )

            # Add follow-up info
            full_summary = f"""### Follow-up Review

**Resolved**: {len(resolved)} finding(s)
**Still Open**: {len(unresolved)} finding(s)
**New Issues**: {len(new_findings)} finding(s)

---

{full_summary}"""

            result = PRReviewResult(
                pr_index=pr_index,
                repository=self.config.repository,
                success=True,
                findings=findings,
                summary=full_summary,
                overall_status=overall_status,
                verdict=verdict,
                verdict_reasoning=summary,
                blockers=blockers,
                reviewed_commit_sha=context.head_sha,
                is_followup_review=True,
                resolved_findings=list(resolved),
                unresolved_findings=list(unresolved),
                new_findings_since_last_review=list(new_findings),
            )

            result.save(self.gitea_dir)

            self._report_progress(
                "complete", 100, "Follow-up review complete!", pr_index=pr_index
            )

            return result

        except urllib.error.HTTPError as e:
            error_msg = f"Gitea API error {e.code}"
            if e.code == 401:
                error_msg = "Gitea authentication failed. Check your token."
            elif e.code == 403:
                error_msg = "Gitea access forbidden. Check your permissions."
            elif e.code == 404:
                error_msg = f"PR #{pr_index} not found in Gitea."
            elif e.code == 429:
                error_msg = "Gitea rate limit exceeded. Please try again later."
            print(
                f"[Gitea] Follow-up review failed for #{pr_index}: {error_msg}",
                flush=True,
            )
            result = PRReviewResult(
                pr_index=pr_index,
                repository=self.config.repository,
                success=False,
                error=error_msg,
                is_followup_review=True,
            )
            result.save(self.gitea_dir)
            return result

        except json.JSONDecodeError as e:
            error_msg = f"Invalid JSON response from Gitea: {e}"
            print(
                f"[Gitea] Follow-up review failed for #{pr_index}: {error_msg}",
                flush=True,
            )
            result = PRReviewResult(
                pr_index=pr_index,
                repository=self.config.repository,
                success=False,
                error=error_msg,
                is_followup_review=True,
            )
            result.save(self.gitea_dir)
            return result

        except Exception as e:
            # Catch-all for unexpected errors
            error_details = f"{type(e).__name__}: {e}"
            print(
                f"[Gitea] Follow-up review failed for #{pr_index}: {error_details}",
                flush=True,
            )
            result = PRReviewResult(
                pr_index=pr_index,
                repository=self.config.repository,
                success=False,
                error=error_details,
                is_followup_review=True,
            )
            result.save(self.gitea_dir)
            return result
