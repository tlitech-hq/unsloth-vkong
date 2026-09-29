#!/bin/sh
# Disable inherited upstream Unsloth workflows on this fork; keep only vkong-ci.yml.
# They need Unsloth's secrets and runners, and scheduled ones would fail daily here.
# Rerun after merging upstream: GitHub enables newly added workflow files by default.
# Requires gh with write access to the repository. Does not modify workflow files.
set -eu
REPO="${1:-tlitech-hq/unsloth-vkong}"
gh workflow list -R "$REPO" --all --limit 500 --json id,path,state \
    --jq '.[] | select(.state == "active") | select(.path | endswith("/vkong-ci.yml") | not) | "\(.id) \(.path)"' |
while read -r id path; do
    gh workflow disable "$id" -R "$REPO" && echo "disabled $path"
done
