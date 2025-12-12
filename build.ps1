Write-Host "Building..."
Write-Host "Enter build password:"
$password = Read-Host

$env:TAURI_SIGNING_PRIVATE_KEY = "$env:USERPROFILE/.tauri/wal.key"
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = $password

pnpm tauri build

Write-Host "Build complete!"
