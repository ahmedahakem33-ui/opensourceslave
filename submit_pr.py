#!/usr/bin/env python3
import os
import sys
import textwrap

import requests

API_URL = "https://api.github.com/repos/openclaw/openclaw/pulls"

TITLE = "feat(security): implement Shield-Shell command guard and Key-Mask log sanitization"
HEAD = "WeatherPal-AI:security/hardening"
BASE = "main"
BODY = textwrap.dedent(
    """
    Summary:
    - PoC tests: 100% block rate.
    - Discussion: issue #4166.
    - Thanks to @iHildy for the encouragement.
    """
).strip()


def main() -> int:
    token = os.getenv("GITHUB_TOKEN")
    if not token:
        print("GITHUB_TOKEN is not set.", file=sys.stderr)
        return 1

    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "User-Agent": "openclaw-submit-pr-script",
        "X-GitHub-Api-Version": "2022-11-28",
    }

    payload = {
        "title": TITLE,
        "head": HEAD,
        "base": BASE,
        "body": BODY,
    }

    response = requests.post(API_URL, headers=headers, json=payload, timeout=30)
    if response.status_code != 201:
        print(f"Failed to create PR: {response.status_code}", file=sys.stderr)
        try:
            print(response.json(), file=sys.stderr)
        except ValueError:
            print(response.text, file=sys.stderr)
        return 1

    data = response.json()
    print(data.get("html_url", "PR created"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
