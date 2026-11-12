#!/bin/sh
set -eu

wal_directory=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
wal_binary="$wal_directory/wal-assistant-lark.app/Contents/MacOS/wal-assistant-lark"
# KFC's ZIP extractor writes plain files, without Unix executable permissions.
/bin/chmod u+x "$wal_binary"
exec "$wal_binary" "$@"
