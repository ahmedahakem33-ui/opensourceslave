#!/usr/bin/env python3
"""Post an issue comment and open a PR on GitHub using GITHUB_TOKEN."""

import json
import os
import sys
from typing import Any, Dict

import requests

API_BASE = "https://api.github.com"
REPO = "moltbot/moltbot"
ISSUE_NUMBER = 4166

COMMENT_BODY = (
    "Following up on this after the OpenClaw migration. "
    "I have implemented a PoC for Shield-Shell and Key-Mask on my fork "
    "(WeatherPal-AI/ClawdBot_secured). Ready to PR if interested!"
)

PR_TITLE = "feat(security): implement Shield-Shell and Key-Mask"
PR_HEAD = "WeatherPal-AI:security/hardening"
PR_BASE = "main"
PR_BODY = """## Summary
This PR introduces two complementary security hardening layers for OpenClaw:

- **Shield-Shell**: a hardened execution wrapper that enforces strict command allowlists,
  isolates execution contexts, and prevents unsafe shell expansions.
- **Key-Mask**: centralized secret masking at process boundaries and logs to reduce
  accidental credential exposure.

## Why this helps
- **Reduced blast radius**: tight command scoping minimizes the impact of prompt injection.
- **Safer logs**: secrets are masked before they can reach logs or downstream tools.
- **Defense in depth**: combines runtime isolation with redaction for layered protection.
- **Low operational overhead**: defaults are conservative and can be tuned per service.

## Notes
- Built as a modular PoC so the team can validate scope quickly.
- Backward-compatible with existing configs; safe defaults included.

Please let me know if you'd like any changes or additional benchmarks."""


def require_token() -> str:
    token = os.getenv("GITHUB_TOKEN")
    if not token:
        print("Error: GITHUB_TOKEN environment variable is not set.", file=sys.stderr)
        sys.exit(1)
    return token


def gh_headers(token: str) -> Dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "github_actions.py",
    }


def post_issue_comment(token: str) -> Dict[str, Any]:
    url = f"{API_BASE}/repos/{REPO}/issues/{ISSUE_NUMBER}/comments"
    resp = requests.post(url, headers=gh_headers(token), json={"body": COMMENT_BODY}, timeout=30)
    if resp.status_code != 201:
        raise RuntimeError(
            f"Failed to post comment: {resp.status_code} {resp.text}"
        )
    return resp.json()


def create_pull_request(token: str) -> Dict[str, Any]:
    url = f"{API_BASE}/repos/{REPO}/pulls"
    payload = {
        "title": PR_TITLE,
        "head": PR_HEAD,
        "base": PR_BASE,
        "body": PR_BODY,
    }
    resp = requests.post(url, headers=gh_headers(token), json=payload, timeout=30)
    if resp.status_code != 201:
        raise RuntimeError(
            f"Failed to create PR: {resp.status_code} {resp.text}"
        )
    return resp.json()


def main() -> int:
    token = require_token()

    try:
        comment = post_issue_comment(token)
        print("Posted comment:")
        print(json.dumps({"id": comment.get("id"), "html_url": comment.get("html_url")}, indent=2))

        pr = create_pull_request(token)
        print("\nCreated PR:")
        print(json.dumps({"id": pr.get("id"), "html_url": pr.get("html_url")}, indent=2))
    except requests.RequestException as exc:
        print(f"Network error: {exc}", file=sys.stderr)
        return 1
    except RuntimeError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
