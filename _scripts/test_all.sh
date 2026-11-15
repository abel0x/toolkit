#!/bin/bash
# Run every test suite the CI runs, in the same order, against the working tree.
#
#   _scripts/test_all.sh            all suites
#   _scripts/test_all.sh site-audit tool-vectors    only these
#
# Needs Node, Python, Firefox, zbar-tools and librsvg2-bin (for the QR suite).
# axe-core is taken from AXE_CORE_PATH, else node_modules, else installed there
# the way CI does it. Each suite's full output goes to $LOGS (default
# ${TMPDIR:-/tmp}/toolkit-tests); failures are printed and the exit status is 1.
# Do not edit the tree while it runs: the tests read the files live.
set -u
cd "$(dirname "$0")/.."
LOGS="${LOGS:-${TMPDIR:-/tmp}/toolkit-tests}"
mkdir -p "$LOGS"
if [ -z "${AXE_CORE_PATH:-}" ]; then
  if [ ! -f node_modules/axe-core/axe.min.js ]; then
    timeout 180 npm install --no-save --no-package-lock axe-core@4.14.0 >/dev/null 2>&1 || echo "Could not install axe-core; the axe suite will fail."
  fi
  export AXE_CORE_PATH="$PWD/node_modules/axe-core/axe.min.js"
fi
export AXE_DETAIL=1
SUITES=(site-audit tool-dom-audit words-audit i18n-audit turkish-seo-audit conversion-regressions accessibility-audit axe-audit
  tool-pages-e2e shortcuts-share-e2e tool-io-e2e expansion-e2e typing-regressions audit-regressions tool-vectors turkish-pages-e2e
  qr-generator-e2e offline)
[ $# -gt 0 ] && SUITES=("$@")
FAILED=0
python3 build.py --check | tail -1 || FAILED=1
for suite in "${SUITES[@]}"; do
  echo "== $suite"
  if [ "$suite" = offline ]; then
    python3 build.py --site >/dev/null 2>&1
    TOOLKIT_SITE_ROOT="$PWD/_site" timeout 600 node tests/offline-e2e.mjs > "$LOGS/offline.log" 2>&1
  else
    timeout 1500 node "tests/$suite.mjs" > "$LOGS/$suite.log" 2>&1
  fi
  status=$?
  if [ $status -ne 0 ]; then
    FAILED=1
    echo "FAILED $suite (exit $status); log: $LOGS/$suite.log"
    grep -v "^    at " "$LOGS/$suite.log" | head -20 | cut -c1-260
  else
    tail -1 "$LOGS/$suite.log" | cut -c1-200
  fi
done
[ $FAILED -eq 0 ] && echo "ALL PASSED" || echo "SOME SUITES FAILED"
exit $FAILED
