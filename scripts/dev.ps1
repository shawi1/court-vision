# scripts/dev.ps1
#
# One-command Court Vision dev startup (Windows / PowerShell).
# Starts:
#   - backend FastAPI on :8765 (mock mode unless backend/.env has keys)
#   - Expo dev server on :8081 (--web for browser, or scan QR with Expo Go)
#
# Usage:
#   .\scripts\dev.ps1                # starts both, web browser opens
#   .\scripts\dev.ps1 -BackendOnly   # just the backend
#   .\scripts\dev.ps1 -AppOnly       # just the Expo dev server

param(
    [switch]$BackendOnly,
    [switch]$AppOnly
)

$repo = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $repo "backend"
$app = Join-Path $repo "app"

if (-not $AppOnly) {
    Write-Host "Starting backend on http://127.0.0.1:8765 ..." -ForegroundColor Cyan
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "
        Set-Location '$backend';
        & .\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8765 --reload --log-level info
    "
}

if (-not $BackendOnly) {
    Write-Host "Starting Expo dev server (web) ..." -ForegroundColor Cyan
    Set-Location $app
    npx expo start --web
}
