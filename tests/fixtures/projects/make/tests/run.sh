#!/usr/bin/env bash
set -euo pipefail

# shellcheck source=../src/app.sh
source "$(dirname "$0")/../src/app.sh"

mkdir -p .ci
cases=()
failures=0

check() {
  local name="$1" expected="$2" actual="$3"
  if [[ "$actual" == "$expected" ]]; then
    cases+=("<testcase classname=\"app\" name=\"${name}\" />")
  else
    cases+=("<testcase classname=\"app\" name=\"${name}\"><failure message=\"expected ${expected}, got ${actual}\"/></testcase>")
    failures=$((failures + 1))
    echo "FAIL: ${name} — expected ${expected}, got ${actual}" >&2
  fi
}

check "add sums two numbers" "5" "$(add 2 3)"
check "greet formats a greeting" "Hello, world!" "$(greet world)"

{
  echo '<?xml version="1.0" encoding="UTF-8"?>'
  echo "<testsuites><testsuite name=\"app\" tests=\"${#cases[@]}\" failures=\"${failures}\">"
  printf '%s\n' "${cases[@]}"
  echo "</testsuite></testsuites>"
} > .ci/junit.xml

[[ "$failures" -eq 0 ]]
