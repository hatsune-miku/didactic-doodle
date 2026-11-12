#!/bin/bash
set -euo pipefail
script_dir="$(cd "$(dirname "$0")" && pwd)"
exec /usr/bin/python3 -I "$script_dir/macos_probe.py" "$@"
