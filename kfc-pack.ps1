# kfc-pack.ps1 — build wal-assistant-lark and produce a KFC zip-portable archive.
# Author: gz
#
# Produces:
#   dist-kfc/wal-assistant-lark_<version>_windows-x64.zip   (entry wal-assistant-lark.exe)
#
# This script RUNS the build. Do not run it during authoring.

param(
  [Parameter(Mandatory = $true)]
  [string]$Version
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$release = Join-Path $root "src-tauri\target\release"
$distKfc = Join-Path $root "dist-kfc"

Write-Host "[kfc-pack] wal-assistant-lark version $Version"

# --- 1. Build the Tauri app (productName "wal-assistant-lark"). ---
Write-Host "[kfc-pack] building (npm run tauri build) ..."
Push-Location $root
try {
  & npm run tauri build
  if ($LASTEXITCODE -ne 0) { throw "build failed (exit $LASTEXITCODE)" }
}
finally {
  Pop-Location
}

$exe = Join-Path $release "wal-assistant-lark.exe"
if (-not (Test-Path $exe)) { throw "release exe not found at $exe" }

# --- 2. Stage the exe + sibling DLLs + resources folder (if any). ---
$stage = Join-Path $env:TEMP ("kfc-wal-" + [System.Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $stage | Out-Null

Copy-Item $exe (Join-Path $stage "wal-assistant-lark.exe") -Force

Get-ChildItem -Path $release -Filter "*.dll" -File -ErrorAction SilentlyContinue |
  ForEach-Object { Copy-Item $_.FullName $stage -Force }

$resourcesDir = Join-Path $release "resources"
if (Test-Path $resourcesDir) {
  Copy-Item $resourcesDir (Join-Path $stage "resources") -Recurse -Force
}

# --- 3. Zip into dist-kfc/. ---
New-Item -ItemType Directory -Force -Path $distKfc | Out-Null

$zip = Join-Path $distKfc ("wal-assistant-lark_{0}_windows-x64.zip" -f $Version)
if (Test-Path $zip) { Remove-Item $zip -Force }

Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $zip -Force
Remove-Item $stage -Recurse -Force

Write-Host "[kfc-pack] produced:"
Write-Host "  $zip"
