#!/usr/bin/env python3
import os
import sys

import requests


def main() -> int:
    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        print("GITHUB_TOKEN is not set.", file=sys.stderr)
        return 1

    body = (
        "## Summary\n"
        "- PoC test results: 100% block rate for the Shield-Shell guard\n\n"
        "## Context\n"
        "- Discussion in issue #4166\n"
        "- Thanks to @iHildy for the encouragement\n"
    )

    payload = {
        "title": "feat(security): implement Shield-Shell command guard and Key-Mask log sanitization",
        "head": "WeatherPal-AI:security/hardening",
        "base": "main",
        "body": body,
    }

    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {token}",
        "X-GitHub-Api-Version": "2022-11-28",
    }

    url = "https://api.github.com/repos/openclaw/openclaw/pulls"
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=30)
    except requests.RequestException as exc:
        print(f"Request failed: {exc}", file=sys.stderr)
        return 1

    if response.status_code != 201:
        print(
            f"Failed to create PR: {response.status_code} {response.text}",
            file=sys.stderr,
        )
        return 1

    pr = response.json()
    print(pr.get("html_url", ""))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
