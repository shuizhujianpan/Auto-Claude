#!/usr/bin/env python3
"""
Gitea Automation Runner
=======================

CLI interface for Gitea automation features:
- PR Review: AI-powered pull request review
- Follow-up Review: Review changes since last review

Usage:
    # Review a specific PR
    python runner.py review-pr 123

    # Follow-up review after new commits
    python runner.py followup-review-pr 123
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

# Validate platform-specific dependencies BEFORE any imports that might
# trigger graphiti_core -> real_ladybug -> pywintypes import chain (ACS-253)
from core.dependency_validator import validate_platform_dependencies

validate_platform_dependencies()

# Load .env file with centralized error handling
from cli.utils import import_dotenv

load_dotenv = import_dotenv()

env_file = Path(__file__).parent.parent.parent / ".env"
if env_file.exists():
    load_dotenv(env_file)

# Add gitea runner directory to path for direct imports
sys.path.insert(0, str(Path(__file__).parent))

from core.io_utils import safe_print
from models import GiteaRunnerConfig
from orchestrator import GiteaOrchestrator, ProgressCallback


def print_progress(callback: ProgressCallback) -> None:
    """Print progress updates to console."""
    prefix = ""
    if callback.pr_index:
        prefix = f"[PR #{callback.pr_index}] "

    safe_print(f"{prefix}[{callback.progress:3d}%] {callback.message}")


def get_config(args) -> GiteaRunnerConfig:
    """Build config from CLI args and environment."""
    token = args.token or os.environ.get("GITEA_TOKEN", "")
    instance_url = args.instance or os.environ.get(
        "GITEA_INSTANCE_URL", "https://gitea.com"
    )

    # Repository detection priority:
    # 1. Explicit --repository flag (highest priority)
    # 2. Auto-detect from .auto-claude/gitea/config.json (primary for multi-repo setups)
    # 3. GITEA_REPOSITORY env var (fallback only)
    repository = args.repository  # Only use explicit CLI flag initially

    # Auto-detect from repo config (takes priority over env var)
    if not repository:
        config_path = Path(args.project_dir) / ".auto-claude" / "gitea" / "config.json"
        if config_path.exists():
            try:
                with open(config_path, encoding="utf-8") as f:
                    data = json.load(f)
                    repository = data.get("repository", "")
                    instance_url = data.get("instance_url", instance_url)
                    if not token:
                        token = data.get("token", "")
            except Exception as exc:
                print(f"Warning: Failed to read Gitea config: {exc}", file=sys.stderr)

    # Fall back to environment variable only if auto-detection failed
    if not repository:
        repository = os.environ.get("GITEA_REPOSITORY", "")

    if not token:
        print(
            "Error: No Gitea token found. Set GITEA_TOKEN or configure in project settings."
        )
        sys.exit(1)

    if not repository:
        print(
            "Error: No Gitea repository found. Set GITEA_REPOSITORY or configure in project settings."
        )
        sys.exit(1)

    return GiteaRunnerConfig(
        token=token,
        repository=repository,
        instance_url=instance_url,
        model=args.model,
        thinking_level=args.thinking_level,
    )


async def cmd_review_pr(args) -> int:
    """Review a pull request."""
    import sys

    # Force unbuffered output so Electron sees it in real-time
    sys.stdout.reconfigure(line_buffering=True)
    sys.stderr.reconfigure(line_buffering=True)

    safe_print(f"[DEBUG] Starting PR review for PR #{args.pr_index}")
    safe_print(f"[DEBUG] Project directory: {args.project_dir}")

    safe_print("[DEBUG] Building config...")
    config = get_config(args)
    safe_print(f"[DEBUG] Config built: repository={config.repository}, model={config.model}")

    safe_print("[DEBUG] Creating orchestrator...")
    orchestrator = GiteaOrchestrator(
        project_dir=args.project_dir,
        config=config,
        progress_callback=print_progress,
    )
    safe_print("[DEBUG] Orchestrator created")

    safe_print(f"[DEBUG] Calling orchestrator.review_pr({args.pr_index})...")
    result = await orchestrator.review_pr(args.pr_index)
    safe_print(f"[DEBUG] review_pr returned, success={result.success}")

    if result.success:
        print(f"\n{'=' * 60}")
        print(f"PR #{result.pr_index} Review Complete")
        print(f"{'=' * 60}")
        print(f"Status: {result.overall_status}")
        print(f"Verdict: {result.verdict.value}")
        print(f"Findings: {len(result.findings)}")

        if result.findings:
            print("\nFindings by severity:")
            for f in result.findings:
                emoji = {"critical": "!", "high": "*", "medium": "-", "low": "."}
                print(
                    f"  {emoji.get(f.severity.value, '?')} [{f.severity.value.upper()}] {f.title}"
                )
                print(f"    File: {f.file}:{f.line}")
        return 0
    else:
        print(f"\nReview failed: {result.error}")
        return 1


async def cmd_followup_review_pr(args) -> int:
    """Perform a follow-up review of a pull request."""
    import sys

    # Force unbuffered output
    sys.stdout.reconfigure(line_buffering=True)
    sys.stderr.reconfigure(line_buffering=True)

    safe_print(f"[DEBUG] Starting follow-up review for PR #{args.pr_index}")
    safe_print(f"[DEBUG] Project directory: {args.project_dir}")

    safe_print("[DEBUG] Building config...")
    config = get_config(args)
    safe_print(f"[DEBUG] Config built: repository={config.repository}, model={config.model}")

    safe_print("[DEBUG] Creating orchestrator...")
    orchestrator = GiteaOrchestrator(
        project_dir=args.project_dir,
        config=config,
        progress_callback=print_progress,
    )
    safe_print("[DEBUG] Orchestrator created")

    safe_print(f"[DEBUG] Calling orchestrator.followup_review_pr({args.pr_index})...")

    try:
        result = await orchestrator.followup_review_pr(args.pr_index)
    except ValueError as e:
        print(f"\nFollow-up review failed: {e}")
        return 1

    safe_print(f"[DEBUG] followup_review_pr returned, success={result.success}")

    if result.success:
        print(f"\n{'=' * 60}")
        print(f"PR #{result.pr_index} Follow-up Review Complete")
        print(f"{'=' * 60}")
        print(f"Status: {result.overall_status}")
        print(f"Is Follow-up: {result.is_followup_review}")

        if result.resolved_findings:
            print(f"Resolved: {len(result.resolved_findings)} finding(s)")
        if result.unresolved_findings:
            print(f"Still Open: {len(result.unresolved_findings)} finding(s)")
        if result.new_findings_since_last_review:
            print(
                f"New Issues: {len(result.new_findings_since_last_review)} finding(s)"
            )

        print(f"\nSummary:\n{result.summary[:500]}...")

        if result.findings:
            print("\nRemaining Findings:")
            for f in result.findings:
                emoji = {"critical": "!", "high": "*", "medium": "-", "low": "."}
                print(
                    f"  {emoji.get(f.severity.value, '?')} [{f.severity.value.upper()}] {f.title}"
                )
                print(f"    File: {f.file}:{f.line}")
        return 0
    else:
        print(f"\nFollow-up review failed: {result.error}")
        return 1


def main():
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Gitea automation CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    # Global options
    parser.add_argument(
        "--project-dir",
        type=Path,
        default=Path.cwd(),
        help="Project directory (default: current)",
    )
    parser.add_argument(
        "--token",
        type=str,
        help="Gitea token (or set GITEA_TOKEN)",
    )
    parser.add_argument(
        "--repository",
        type=str,
        help="Gitea repository (owner/repo) or auto-detect",
    )
    parser.add_argument(
        "--instance",
        type=str,
        default="https://gitea.com",
        help="Gitea instance URL (default: https://gitea.com)",
    )
    parser.add_argument(
        "--model",
        type=str,
        default="claude-sonnet-4-5-20250929",
        help="AI model to use",
    )
    parser.add_argument(
        "--thinking-level",
        type=str,
        default="medium",
        choices=["none", "low", "medium", "high"],
        help="Thinking level for extended reasoning",
    )

    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # review-pr command
    review_parser = subparsers.add_parser("review-pr", help="Review a pull request")
    review_parser.add_argument("pr_index", type=int, help="PR index to review")

    # followup-review-pr command
    followup_parser = subparsers.add_parser(
        "followup-review-pr",
        help="Follow-up review of a PR (after new commits)",
    )
    followup_parser.add_argument("pr_index", type=int, help="PR index to review")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    # Route to command handler
    commands = {
        "review-pr": cmd_review_pr,
        "followup-review-pr": cmd_followup_review_pr,
    }

    handler = commands.get(args.command)
    if not handler:
        print(f"Unknown command: {args.command}")
        sys.exit(1)

    try:
        exit_code = asyncio.run(handler(args))
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print("\nInterrupted.")
        sys.exit(1)
    except Exception as e:
        import traceback

        print(f"Error: {e}")
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
