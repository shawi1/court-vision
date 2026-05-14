# scripts/build-web.ps1
#
# Build the web bundle AND copy the CanvasKit WASM into dist/ so the app can
# render Skia content in the browser. Expo's web export doesn't bundle the
# CanvasKit WASM by default, so a fresh `expo export --platform web` produces
# a dist/ that 404s on canvaskit.wasm until this script runs.
#
# Usage: .\scripts\build-web.ps1

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
$app = Join-Path $repo "app"

Write-Host "Exporting web bundle..." -ForegroundColor Cyan
Push-Location $app
try {
    $env:CI = "1"
    if (Test-Path dist) { Remove-Item dist -Recurse -Force }
    npx --yes expo export --platform web --output-dir dist
}
finally {
    Pop-Location
}

Write-Host "Copying canvaskit.wasm into dist/..." -ForegroundColor Cyan
$wasmSrc = Join-Path $app "node_modules\canvaskit-wasm\bin\canvaskit.wasm"
$wasmDst = Join-Path $app "dist\_expo\static\js\web"
New-Item -ItemType Directory -Force -Path $wasmDst | Out-Null
Copy-Item $wasmSrc $wasmDst -Force

$bytes = (Get-Item (Join-Path $wasmDst "canvaskit.wasm")).Length
$mb = [math]::Round($bytes / 1MB, 1)
Write-Host "  Done. canvaskit.wasm copied ($mb MB)" -ForegroundColor Green
Write-Host ""
Write-Host "Now serve dist/ on http://127.0.0.1:5173/:" -ForegroundColor Yellow
Write-Host "  python -m http.server 5173 --directory app\dist" -ForegroundColor White
