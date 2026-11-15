#!/bin/bash
# Publish a release whose CHANGELOG and README notes are already written
# (_scripts/release_notes.py) and whose full test run has passed
# (_scripts/test_all.sh). Run it only when the maintainer has agreed to publish.
#
#   _scripts/release.sh VERSION commit-message.txt tag-message.txt
#
# It commits the work (everything except CHANGELOG.md and README.md), then
# "chore(release): Toolkit vVERSION" with those two, both signed; refuses
# Co-Authored-By lines; pushes main; waits for every CI run of that commit;
# checks that GitHub shows both commits as verified; then pushes a signed tag
# vVERSION and creates the GitHub release VERSION from its CHANGELOG section.
set -euo pipefail
cd "$(dirname "$0")/.."
VERSION=$1; COMMIT_MESSAGE=$2; TAG_MESSAGE=$3
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
grep -q "^## \[$VERSION\]" CHANGELOG.md || { echo "CHANGELOG.md has no section for $VERSION."; exit 1; }
python3 build.py --check | tail -1
git add -A
git reset -q CHANGELOG.md README.md
git commit -q -S -F "$COMMIT_MESSAGE"
git add CHANGELOG.md README.md
printf 'chore(release): Toolkit v%s\n' "$VERSION" > "$WORK/release-message.txt"
git commit -q -S -F "$WORK/release-message.txt"
if git log origin/main..HEAD --format='%B' | grep -qi '^co-authored-by:'; then echo "A commit carries a Co-Authored-By line; fix it before pushing."; exit 1; fi
git push -q origin main
HEAD=$(git rev-parse HEAD)
sleep 10
RUNS=$(gh run list --limit 10 --json databaseId,headSha --jq ".[] | select(.headSha == \"$HEAD\") | .databaseId")
[ -n "$RUNS" ] || { echo "No CI run found for $HEAD."; exit 2; }
for run in $RUNS; do gh run watch "$run" --exit-status >/dev/null 2>&1 || { echo "CI failed: run $run"; exit 2; }; done
echo "CI green for ${HEAD:0:7}"
for commit in "$(git rev-parse HEAD~1)" "$HEAD"; do
  echo "verified ${commit:0:7}: $(gh api "repos/abel0x/toolkit/commits/$commit" --jq .commit.verification.verified)"
done
git tag -s "v$VERSION" -F "$TAG_MESSAGE" "$HEAD"
git push -q origin "v$VERSION"
awk -v v="$VERSION" '$0 ~ "^## \\[" v "\\]" {found=1; next} /^## \[/ {if (found) exit} found' CHANGELOG.md | sed -e '1{/^$/d}' > "$WORK/notes.md"
gh release create "v$VERSION" --title "$VERSION" --notes-file "$WORK/notes.md" --verify-tag --latest >/dev/null
gh release list --limit 1
gh api "repos/abel0x/toolkit/git/refs/tags/v$VERSION" --jq .object.sha | xargs -I{} gh api "repos/abel0x/toolkit/git/tags/{}" --jq '"tag verified: " + (.verification.verified | tostring)'
