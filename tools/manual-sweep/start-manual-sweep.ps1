$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $repoRoot

$runtimeDir = Join-Path $repoRoot ".local\manual-sweep"
New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null

Write-Host "GodSandbox manual sweep mode"
Write-Host "Runtime files may be written under .local/manual-sweep."
Write-Host "The browser will open /sandbox?mode=manual-sweep."
Write-Host "Press Ctrl+C in this window to stop the dev server."
Write-Host ""

npm run app:manual-sweep
