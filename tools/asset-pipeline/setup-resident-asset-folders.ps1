param(
  [string[]]$ResidentIds = @("eve", "garan", "ryo", "suzu")
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$manifestDir = Join-Path $repoRoot "manifests"
$manifestPath = Join-Path $manifestDir "residents.json"

function Assert-ResidentId {
  param([string]$ResidentId)

  if ($ResidentId -notmatch "^[A-Za-z0-9_-]+$") {
    throw "Resident id '$ResidentId' contains unsupported characters. Use letters, numbers, hyphen, or underscore."
  }
}

function New-DirectoryIfMissing {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Path $Path | Out-Null
  }
}

foreach ($residentId in $ResidentIds) {
  Assert-ResidentId -ResidentId $residentId
  $normalizedId = $residentId.ToLowerInvariant()

  $incomingDir = "assets/generated/residents/$normalizedId/incoming"
  $tmpDir = "assets/generated/residents/$normalizedId/tmp"
  $rejectedDir = "assets/generated/residents/$normalizedId/rejected"
  $spritesDir = "assets/residents/$normalizedId/sprites"

  New-DirectoryIfMissing -Path (Join-Path $repoRoot $incomingDir)
  New-DirectoryIfMissing -Path (Join-Path $repoRoot $tmpDir)
  New-DirectoryIfMissing -Path (Join-Path $repoRoot $rejectedDir)
  New-DirectoryIfMissing -Path (Join-Path $repoRoot $spritesDir)
}

New-DirectoryIfMissing -Path $manifestDir

if (-not (Test-Path -LiteralPath $manifestPath)) {
  $manifest = [ordered]@{
    note = "Local placeholder only. Line 2 owns the manifest schema. Do not put secrets, personal paths, or user-uploaded images into Git."
  }

  $manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifestPath -Encoding UTF8
}

Write-Host "Created local resident asset folders."
Write-Host "Input folders: assets/generated/residents/<id>/incoming"
Write-Host "Working folders: assets/generated/residents/<id>/tmp"
Write-Host "Rejected folders: assets/generated/residents/<id>/rejected"
Write-Host "Sprite output folders: assets/residents/<id>/sprites"
Write-Host "Local manifest: manifests/residents.json"
Write-Host "These folders are ignored by Git."
