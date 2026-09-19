#!/usr/bin/env bash
set -euo pipefail

add() {
  echo $(( "$1" + "$2" ))
}

greet() {
  # Deliberate fixture suppression, exercised by the ratchet's suppression count.
  # shellcheck disable=SC2034
  local unused="not read anywhere"
  echo "Hello, $1!"
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  greet "world"
fi
