#!/bin/bash
# Sync with upstream OpenClaw and rebase our security patches
git remote add upstream https://github.com/openclaw/openclaw.git 2>/dev/null
git fetch upstream
git rebase upstream/main
echo "Sync complete."
