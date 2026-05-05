param(
  [Parameter(Position = 0)]
  [string]$ResidentId = "",

  [string]$SourcePath = "",

  [switch]$Help
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$pngSignature = [byte[]](0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)

function Show-Help {
  Write-Host "Resident sprite source import helper"
  Write-Host ""
  Write-Host "Usage:"
  Write-Host "  tools\asset-pipeline\import-resident-sprite-source.bat ryo"
  Write-Host "  .\tools\asset-pipeline\import-resident-sprite-source.ps1 ryo"
  Write-Host ""
  Write-Host "This script copies the selected PNG into:"
  Write-Host "  assets/generated/residents/<id>/incoming/"
  Write-Host ""
  Write-Host "It does not copy to adopted assets, run the validator, or update manifests."
}

function Assert-ResidentId {
  param([string]$Value)

  if ([string]::IsNullOrWhiteSpace($Value)) {
    throw "Resident id is empty. Example: ryo"
  }

  if ($Value -notmatch "^[A-Za-z0-9_-]+$") {
    throw "Resident id '$Value' contains unsupported characters. Use letters, numbers, hyphen, or underscore."
  }
}

function Select-PngFile {
  try {
    Add-Type -AssemblyName System.Windows.Forms
  } catch {
    throw "Could not open a file picker. Use -SourcePath <png-file> instead."
  }

  $dialog = New-Object System.Windows.Forms.OpenFileDialog
  $dialog.Title = "Select a PNG file to import"
  $dialog.Filter = "PNG files (*.png)|*.png"
  $dialog.Multiselect = $false

  $result = $dialog.ShowDialog()
  if ($result -ne [System.Windows.Forms.DialogResult]::OK) {
    throw "PNG selection was cancelled."
  }

  return $dialog.FileName
}

function Assert-PngFile {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw "PNG file was not found."
  }

  if ([System.IO.Path]::GetExtension($Path).ToLowerInvariant() -ne ".png") {
    throw "Please select a PNG file."
  }

  $bytes = [System.IO.File]::ReadAllBytes($Path)
  if ($bytes.Length -lt $pngSignature.Length) {
    throw "The file could not be read as PNG. Please save it again."
  }

  for ($index = 0; $index -lt $pngSignature.Length; $index += 1) {
    if ($bytes[$index] -ne $pngSignature[$index]) {
      throw "This is not a PNG file. Please select an image saved as PNG."
    }
  }
}

function New-DirectoryIfMissing {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Path $Path | Out-Null
  }
}

function Get-UniqueDestinationPath {
  param(
    [string]$Directory,
    [string]$ResidentId
  )

  $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $baseName = "resident-$ResidentId-sprite-source-$timestamp"
  $candidate = Join-Path $Directory "$baseName.png"
  $suffix = 1

  while (Test-Path -LiteralPath $candidate) {
    $candidate = Join-Path $Directory "$baseName-$suffix.png"
    $suffix += 1
  }

  return $candidate
}

if ($Help) {
  Show-Help
  exit 0
}

if ([string]::IsNullOrWhiteSpace($ResidentId)) {
  $ResidentId = Read-Host "Enter resident id. Example: ryo"
}

Assert-ResidentId -Value $ResidentId
$normalizedId = $ResidentId.ToLowerInvariant()

if ([string]::IsNullOrWhiteSpace($SourcePath)) {
  $SourcePath = Select-PngFile
}

$resolvedSource = (Resolve-Path -LiteralPath $SourcePath).Path
Assert-PngFile -Path $resolvedSource

$incomingDirRelative = "assets/generated/residents/$normalizedId/incoming"
$incomingDir = Join-Path $repoRoot $incomingDirRelative
New-DirectoryIfMissing -Path $incomingDir

$destination = Get-UniqueDestinationPath -Directory $incomingDir -ResidentId $normalizedId
Copy-Item -LiteralPath $resolvedSource -Destination $destination

$destinationRelative = $destination.Substring($repoRoot.Length).TrimStart("\", "/").Replace("\", "/")
$sourceName = Split-Path -Leaf $resolvedSource

Write-Host "Imported PNG into incoming."
Write-Host "Selected file: $sourceName"
Write-Host "Import target: $destinationRelative"
Write-Host "This target is ignored by Git."
Write-Host "Next step: run the validator or processor before adoption."
