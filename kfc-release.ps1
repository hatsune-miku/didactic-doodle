# kfc-release.ps1 — build + publish wal-assistant-lark to a KFC Hub in one step.
# Author: gz
#
# Usage:  powershell -ExecutionPolicy Bypass -File kfc-release.ps1 -Version 0.1.7
#         (optionally pass -Hub / -Token, forwarded to kfc-publish.mjs)

param(
  [Parameter(Mandatory = $true)]
  [string]$Version,
  [string]$Hub,
  [string]$Token
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

# 1. Build the zip-portable artifact.
& powershell -ExecutionPolicy Bypass -File (Join-Path $root "kfc-pack.ps1") -Version $Version
if ($LASTEXITCODE -ne 0) { throw "kfc-pack.ps1 failed (exit $LASTEXITCODE)" }

# 2. Publish (artifacts auto-derived from the manifest under dist-kfc/).
$publishArgs = @(
  (Join-Path $root "kfc-publish.mjs"),
  "--version", $Version
)
if ($Hub) { $publishArgs += @("--hub", $Hub) }
if ($Token) { $publishArgs += @("--token", $Token) }

Push-Location $root
try {
  & node @publishArgs
  if ($LASTEXITCODE -ne 0) { throw "kfc-publish.mjs failed (exit $LASTEXITCODE)" }
}
finally {
  Pop-Location
}

Write-Host "[kfc-release] published wal-assistant-lark $Version."
