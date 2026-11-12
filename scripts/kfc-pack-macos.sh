#!/bin/sh
set -eu

wal_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
wal_version=
wal_target=
wal_skip_build=0
while [ "$#" -gt 0 ]; do
  case "$1" in
    --version|-Version) wal_version=${2:?missing version}; shift 2 ;;
    --target) wal_target=${2:?missing target}; shift 2 ;;
    --skip-build) wal_skip_build=1; shift ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done
[ -n "$wal_version" ] || { echo 'Usage: kfc-pack-macos.sh --version <version> [--target aarch64-apple-darwin|x86_64-apple-darwin] [--skip-build]' >&2; exit 2; }
case "$wal_version" in *[!0-9A-Za-z.+-]*|.*) echo 'Invalid version' >&2; exit 2 ;; esac
[ "$(uname -s)" = Darwin ] || { echo 'Run this script on macOS' >&2; exit 2; }
case "$wal_target" in
  '')
    case "$(uname -m)" in arm64) wal_platform=macos-arm64 ;; x86_64) wal_platform=macos-x64 ;; *) exit 2 ;; esac
    wal_release="$wal_root/src-tauri/target/release"
    ;;
  aarch64-apple-darwin) wal_platform=macos-arm64; wal_release="$wal_root/src-tauri/target/$wal_target/release" ;;
  x86_64-apple-darwin) wal_platform=macos-x64; wal_release="$wal_root/src-tauri/target/$wal_target/release" ;;
  *) echo 'Unsupported macOS target' >&2; exit 2 ;;
esac
cd "$wal_root"
if [ "$wal_skip_build" = 0 ]; then
  if [ -n "$wal_target" ]; then
    yarn tauri build --target "$wal_target" --bundles app
  else
    yarn tauri build --bundles app
  fi
fi
wal_bundle="$wal_release/bundle/macos/wal-assistant-lark.app"
[ -d "$wal_bundle" ] || { echo "Bundle not found: $wal_bundle" >&2; exit 1; }
wal_bundle_version=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$wal_bundle/Contents/Info.plist")
[ "$wal_bundle_version" = "$wal_version" ] || { echo "Bundle version $wal_bundle_version does not match $wal_version" >&2; exit 1; }
wal_stage=$(mktemp -d)
trap '/bin/rm -rf "$wal_stage"' EXIT
/usr/bin/ditto "$wal_bundle" "$wal_stage/wal-assistant-lark.app"
/bin/cp "$wal_root/scripts/kfc-launch-macos.sh" "$wal_stage/launch.command"
mkdir -p "$wal_root/dist-kfc"
wal_zip="$wal_root/dist-kfc/wal-assistant-lark_${wal_version}_${wal_platform}.zip"
/usr/bin/ditto -c -k --norsrc "$wal_stage" "$wal_zip"
echo "$wal_zip"
