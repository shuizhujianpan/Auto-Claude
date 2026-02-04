#!/usr/bin/env python3
"""
Gitea API Client Verification Script
=====================================

This script verifies that the Gitea API client can properly fetch issues and pull requests.

Usage:
    # Test with mock data (no API calls)
    python -m runners.gitea.verify_client --mock

    # Test with real Gitea instance (requires config)
    python -m runners.gitea.verify_client

    # Test with custom config
    python -m runners.gitea.verify_client --config /path/to/config.json
"""

import argparse
import json
import sys
from pathlib import Path
from unittest.mock import Mock, patch

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from runners.gitea.gitea_client import (
    GiteaClient,
    GiteaConfig,
    encode_repository_path,
    validate_endpoint,
    load_gitea_config,
)


class Colors:
    """ANSI color codes for terminal output."""
    GREEN = "\033[92m"
    RED = "\033[91m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    RESET = "\033[0m"
    BOLD = "\033[1m"


def print_success(msg: str) -> None:
    """Print success message in green."""
    print(f"{Colors.GREEN}✓ {msg}{Colors.RESET}")


def print_error(msg: str) -> None:
    """Print error message in red."""
    print(f"{Colors.RED}✗ {msg}{Colors.RESET}")


def print_info(msg: str) -> None:
    """Print info message in blue."""
    print(f"{Colors.BLUE}ℹ {msg}{Colors.RESET}")


def print_header(msg: str) -> None:
    """Print section header in bold."""
    print(f"\n{Colors.BOLD}{msg}{Colors.RESET}")


def test_encode_repository_path() -> bool:
    """Test repository path encoding."""
    print_header("Testing repository path encoding")

    # Note: encode_repository_path uses urllib.parse.quote with safe=""
    # which encodes forward slashes. This is correct for URL path components.
    test_cases = [
        ("owner/repo", "owner%2Frepo"),
        ("owner/my-repo", "owner%2Fmy-repo"),
        ("org/repo.name", "org%2Frepo.name"),
        ("user/repo_with_underscore", "user%2Frepo_with_underscore"),
        ("org/sub/group/repo", "org%2Fsub%2Fgroup%2Frepo"),
    ]

    all_passed = True
    for input_val, expected in test_cases:
        result = encode_repository_path(input_val)
        if result == expected:
            print_success(f"encode_repository_path('{input_val}') = '{result}'")
        else:
            print_error(f"encode_repository_path('{input_val}') = '{result}', expected '{expected}'")
            all_passed = False

    return all_passed


def test_endpoint_validation() -> bool:
    """Test endpoint validation security."""
    print_header("Testing endpoint validation")

    valid_endpoints = [
        "/repos/owner/repo/issues/1",
        "/repos/owner/repo/pulls/1",
        "/user",
        "/repos/owner/repo/issues/1/comments",
    ]

    invalid_endpoints = [
        "",  # Empty
        "repos/owner/repo",  # Missing leading slash
        "/../../../etc/passwd",  # Path traversal
        "/repos/owner/repo\x00",  # Null byte
        "/unknown/endpoint",  # Not in whitelist
    ]

    all_passed = True

    print_info("Testing valid endpoints...")
    for endpoint in valid_endpoints:
        try:
            validate_endpoint(endpoint)
            print_success(f"Valid endpoint accepted: {endpoint}")
        except ValueError as e:
            print_error(f"Valid endpoint rejected: {endpoint} - {e}")
            all_passed = False

    print_info("Testing invalid endpoints...")
    for endpoint in invalid_endpoints:
        try:
            validate_endpoint(endpoint)
            print_error(f"Invalid endpoint NOT rejected: {endpoint}")
            all_passed = False
        except ValueError:
            print_success(f"Invalid endpoint rejected: {repr(endpoint)}")

    return all_passed


def test_url_construction() -> bool:
    """Test API URL construction."""
    print_header("Testing API URL construction")

    config = GiteaConfig(
        token="test_token",
        repository="owner/repo",
        instance_url="https://gitea.com",
    )

    client = GiteaClient(project_dir=Path.cwd(), config=config)

    test_cases = [
        ("/repos/owner/repo/issues/1", "https://gitea.com/api/v1/repos/owner/repo/issues/1"),
        ("repos/owner/repo/pulls/1", "https://gitea.com/api/v1/repos/owner/repo/pulls/1"),
        ("/user", "https://gitea.com/api/v1/user"),
    ]

    all_passed = True
    for endpoint, expected in test_cases:
        result = client._api_url(endpoint)
        if result == expected:
            print_success(f"API URL: {endpoint} -> {result}")
        else:
            print_error(f"API URL mismatch: expected {expected}, got {result}")
            all_passed = False

    return all_passed


def test_client_methods_exist() -> bool:
    """Test that all required client methods exist."""
    print_header("Testing client methods exist")

    config = GiteaConfig(
        token="test_token",
        repository="owner/repo",
        instance_url="https://gitea.com",
    )

    client = GiteaClient(project_dir=Path.cwd(), config=config)

    required_methods = [
        # Issue methods
        "get_issue",
        "get_issues",
        "get_issue_comments",
        "post_issue_comment",
        # PR methods
        "get_pull_request",
        "get_pull_requests",
        "get_pr_diff",
        "get_pr_commits",
        "get_pr_files",
        "post_pr_comment",
        "approve_pr",
        "merge_pr",
        # Other methods
        "get_current_user",
        "create_release",
    ]

    all_passed = True
    for method_name in required_methods:
        if hasattr(client, method_name):
            method = getattr(client, method_name)
            if callable(method):
                print_success(f"Method exists: {method_name}")
            else:
                print_error(f"Not callable: {method_name}")
                all_passed = False
        else:
            print_error(f"Missing method: {method_name}")
            all_passed = False

    return all_passed


def test_mock_api_calls() -> bool:
    """Test API client methods with mocked responses."""
    print_header("Testing API calls with mock responses")

    config = GiteaConfig(
        token="test_token",
        repository="owner/repo",
        instance_url="https://gitea.com",
    )

    client = GiteaClient(project_dir=Path.cwd(), config=config)

    all_passed = True

    # Mock issue response
    mock_issue = {
        "id": 12345,
        "url": "https://gitea.com/api/v1/repos/owner/repo/issues/1",
        "html_url": "https://gitea.com/owner/repo/issues/1",
        "index": 1,
        "number": 1,
        "user": {"login": "testuser"},
        "title": "Test Issue",
        "body": "Test issue body",
        "labels": [],
        "state": "open",
    }

    # Mock PR response
    mock_pr = {
        "id": 12346,
        "url": "https://gitea.com/api/v1/repos/owner/repo/pulls/1",
        "html_url": "https://gitea.com/owner/repo/pulls/1",
        "index": 1,
        "number": 1,
        "user": {"login": "testuser"},
        "title": "Test PR",
        "body": "Test PR body",
        "labels": [],
        "state": "open",
        "merged": False,
        "mergeable": True,
    }

    # Test get_issue
    with patch.object(client, '_fetch', return_value=mock_issue) as mock_fetch:
        try:
            result = client.get_issue(1)
            mock_fetch.assert_called_once_with("/repos/owner%2Frepo/issues/1")
            if result["index"] == 1:
                print_success("get_issue(1) returns issue with index=1")
            else:
                print_error(f"get_issue(1) returned unexpected data: {result}")
                all_passed = False
        except Exception as e:
            print_error(f"get_issue(1) raised exception: {e}")
            all_passed = False

    # Test get_pull_request
    with patch.object(client, '_fetch', return_value=mock_pr) as mock_fetch:
        try:
            result = client.get_pull_request(1)
            mock_fetch.assert_called_once_with("/repos/owner%2Frepo/pulls/1")
            if result["index"] == 1:
                print_success("get_pull_request(1) returns PR with index=1")
            else:
                print_error(f"get_pull_request(1) returned unexpected data: {result}")
                all_passed = False
        except Exception as e:
            print_error(f"get_pull_request(1) raised exception: {e}")
            all_passed = False

    # Test get_issues list
    with patch.object(client, '_fetch', return_value=[mock_issue]) as mock_fetch:
        try:
            result = client.get_issues()
            mock_fetch.assert_called_once_with("/repos/owner%2Frepo/issues")
            if isinstance(result, list) and len(result) == 1:
                print_success("get_issues() returns list of issues")
            else:
                print_error(f"get_issues() returned unexpected data: {result}")
                all_passed = False
        except Exception as e:
            print_error(f"get_issues() raised exception: {e}")
            all_passed = False

    # Test get_pull_requests list
    with patch.object(client, '_fetch', return_value=[mock_pr]) as mock_fetch:
        try:
            result = client.get_pull_requests()
            mock_fetch.assert_called_once_with("/repos/owner%2Frepo/pulls")
            if isinstance(result, list) and len(result) == 1:
                print_success("get_pull_requests() returns list of PRs")
            else:
                print_error(f"get_pull_requests() returned unexpected data: {result}")
                all_passed = False
        except Exception as e:
            print_error(f"get_pull_requests() raised exception: {e}")
            all_passed = False

    return all_passed


def test_error_handling() -> bool:
    """Test error handling in the client."""
    print_header("Testing error handling")

    config = GiteaConfig(
        token="test_token",
        repository="owner/repo",
        instance_url="https://gitea.com",
    )

    client = GiteaClient(project_dir=Path.cwd(), config=config)

    all_passed = True

    # Test 404 error handling
    def mock_fetch_404(*args, **kwargs):
        from urllib.error import HTTPError
        raise HTTPError(
            url="https://gitea.com/api/v1/repos/owner/repo/issues/999",
            code=404,
            msg="Not Found",
            hdrs={},
            fp=None,
        )

    with patch.object(client, '_fetch', side_effect=mock_fetch_404):
        try:
            client.get_issue(999)
            print_error("get_issue(999) should raise exception for 404")
            all_passed = False
        except Exception as e:
            if "404" in str(e):
                print_success(f"get_issue(999) properly handles 404 error")
            else:
                print_error(f"get_issue(999) raised unexpected error: {e}")
                all_passed = False

    return all_passed


def test_with_real_config(config_path: Path | None = None) -> bool:
    """Test with real Gitea configuration if available."""
    print_header("Testing with real Gitea configuration")

    if config_path:
        config = load_gitea_config(config_path)
    else:
        # Try to load from current project
        config = load_gitea_config(Path.cwd())

        # If not found, try from parent directory
        if not config:
            config = load_gitea_config(Path.cwd().parent)

    if not config:
        print_info("No Gitea config found. Skipping real API tests.")
        print_info("To test with a real Gitea instance:")
        print_info("  1. Create .auto-claude/gitea/config.json")
        print_info('  2. Add: {"token": "your_token", "repository": "owner/repo", "instance_url": "https://gitea.com"}')
        return True

    print_info(f"Loaded config for repository: {config.repository}")
    print_info(f"Instance URL: {config.instance_url}")

    client = GiteaClient(project_dir=Path.cwd(), config=config)

    all_passed = True

    # Test get_current_user
    try:
        print_info("Testing get_current_user()...")
        user = client.get_current_user()
        if user and "login" in user:
            print_success(f"Authenticated as: {user['login']}")
        else:
            print_error("get_current_user() returned unexpected response")
            all_passed = False
    except Exception as e:
        print_error(f"get_current_user() failed: {e}")
        all_passed = False

    # Test get_issues
    try:
        print_info("Testing get_issues()...")
        issues = client.get_issues()
        if isinstance(issues, list):
            print_success(f"Retrieved {len(issues)} issues")
            # Show first issue details if available
            if issues:
                first_issue = issues[0]
                if "index" in first_issue:
                    print_info(f"First issue index: {first_issue['index']}, title: {first_issue.get('title', 'N/A')}")
        else:
            print_error("get_issues() returned unexpected response type")
            all_passed = False
    except Exception as e:
        print_error(f"get_issues() failed: {e}")
        all_passed = False

    # Test get_pull_requests
    try:
        print_info("Testing get_pull_requests()...")
        prs = client.get_pull_requests()
        if isinstance(prs, list):
            print_success(f"Retrieved {len(prs)} pull requests")
            # Show first PR details if available
            if prs:
                first_pr = prs[0]
                if "index" in first_pr:
                    print_info(f"First PR index: {first_pr['index']}, title: {first_pr.get('title', 'N/A')}")
        else:
            print_error("get_pull_requests() returned unexpected response type")
            all_passed = False
    except Exception as e:
        print_error(f"get_pull_requests() failed: {e}")
        all_passed = False

    # Test get_issue with first issue if available
    if all_passed:
        try:
            issues = client.get_issues()
            if issues and "index" in issues[0]:
                issue_index = issues[0]["index"]
                print_info(f"Testing get_issue({issue_index})...")
                issue = client.get_issue(issue_index)
                if issue and "index" in issue and issue["index"] == issue_index:
                    print_success(f"Retrieved issue {issue_index}: {issue.get('title', 'N/A')}")
                else:
                    print_error(f"get_issue({issue_index}) returned unexpected data")
                    all_passed = False
        except Exception as e:
            print_error(f"get_issue() failed: {e}")
            all_passed = False

    # Test get_pull_request with first PR if available
    if all_passed:
        try:
            prs = client.get_pull_requests()
            if prs and "index" in prs[0]:
                pr_index = prs[0]["index"]
                print_info(f"Testing get_pull_request({pr_index})...")
                pr = client.get_pull_request(pr_index)
                if pr and "index" in pr and pr["index"] == pr_index:
                    print_success(f"Retrieved PR {pr_index}: {pr.get('title', 'N/A')}")
                else:
                    print_error(f"get_pull_request({pr_index}) returned unexpected data")
                    all_passed = False
        except Exception as e:
            print_error(f"get_pull_request() failed: {e}")
            all_passed = False

    return all_passed


def main() -> int:
    """Run all verification tests."""
    parser = argparse.ArgumentParser(
        description="Verify Gitea API client functionality"
    )
    parser.add_argument(
        "--mock",
        action="store_true",
        help="Run mock tests only (skip real API calls)",
    )
    parser.add_argument(
        "--config",
        type=Path,
        help="Path to Gitea config JSON file",
    )

    args = parser.parse_args()

    print(f"\n{Colors.BOLD}{'=' * 60}")
    print(f"Gitea API Client Verification")
    print(f"{'=' * 60}{Colors.RESET}\n")

    results = {}

    # Run all tests
    results["Repository Path Encoding"] = test_encode_repository_path()
    results["Endpoint Validation"] = test_endpoint_validation()
    results["URL Construction"] = test_url_construction()
    results["Client Methods Exist"] = test_client_methods_exist()
    results["Mock API Calls"] = test_mock_api_calls()
    results["Error Handling"] = test_error_handling()

    if not args.mock:
        results["Real API Calls"] = test_with_real_config(args.config)

    # Print summary
    print(f"\n{Colors.BOLD}{'=' * 60}")
    print(f"Test Summary")
    print(f"{'=' * 60}{Colors.RESET}\n")

    all_passed = True
    for test_name, passed in results.items():
        status = f"{Colors.GREEN}PASSED{Colors.RESET}" if passed else f"{Colors.RED}FAILED{Colors.RESET}"
        print(f"{test_name:.<40} {status}")
        if not passed:
            all_passed = False

    print()
    if all_passed:
        print(f"{Colors.GREEN}{Colors.BOLD}All tests passed!{Colors.RESET}")
        return 0
    else:
        print(f"{Colors.RED}{Colors.BOLD}Some tests failed!{Colors.RESET}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
