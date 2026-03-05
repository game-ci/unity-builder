# game-ci CLI installer for Windows
# Usage: irm https://raw.githubusercontent.com/game-ci/unity-builder/main/install.ps1 | iex
#
# Environment variables:
#   GAME_CI_VERSION   - Install a specific version (e.g., v2.0.0). Defaults to latest.
#   GAME_CI_INSTALL   - Installation directory. Defaults to $HOME\.game-ci\bin.

$ErrorActionPreference = 'Stop'

$Repo = "game-ci/unity-builder"
$InstallDir = if ($env:GAME_CI_INSTALL) { $env:GAME_CI_INSTALL } else { Join-Path $env:USERPROFILE ".game-ci\bin" }
$AssetName = "game-ci-windows-x64.exe"
$BinaryName = "game-ci.exe"

function Write-Info($Message) {
    Write-Host "info: " -ForegroundColor Green -NoNewline
    Write-Host $Message
}

function Write-Warn($Message) {
    Write-Host "warn: " -ForegroundColor Yellow -NoNewline
    Write-Host $Message
}

# Determine version
if ($env:GAME_CI_VERSION) {
    $Version = $env:GAME_CI_VERSION
    Write-Info "Using specified version: $Version"
} else {
    Write-Info "Fetching latest release..."
    try {
        $Release = Invoke-RestMethod "https://api.github.com/repos/$Repo/releases/latest"
        $Version = $Release.tag_name
    } catch {
        Write-Host "error: Could not determine latest version. Check https://github.com/$Repo/releases" -ForegroundColor Red
        exit 1
    }
}

$DownloadUrl = "https://github.com/$Repo/releases/download/$Version/$AssetName"
$ChecksumUrl = "https://github.com/$Repo/releases/download/$Version/checksums.txt"
$BinaryPath = Join-Path $InstallDir $BinaryName

Write-Host ""
Write-Info "Installing game-ci $Version (windows-x64)"
Write-Info "  from: $DownloadUrl"
Write-Info "  to:   $BinaryPath"
Write-Host ""

# Create install directory
if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
}

# Download binary
try {
    Invoke-WebRequest -Uri $DownloadUrl -OutFile $BinaryPath -UseBasicParsing
} catch {
    if ($_.Exception.Response.StatusCode -eq 404) {
        Write-Host "error: Release asset not found: $AssetName ($Version)" -ForegroundColor Red
        Write-Host "       Check available assets at https://github.com/$Repo/releases/tag/$Version" -ForegroundColor Red
    } else {
        Write-Host "error: Download failed: $_" -ForegroundColor Red
    }
    exit 1
}

# Verify checksum
try {
    $Checksums = Invoke-WebRequest -Uri $ChecksumUrl -UseBasicParsing | Select-Object -ExpandProperty Content
    $ExpectedLine = $Checksums -split "`n" | Where-Object { $_ -match $AssetName } | Select-Object -First 1
    if ($ExpectedLine) {
        $ExpectedHash = ($ExpectedLine -split '\s+')[0]
        $ActualHash = (Get-FileHash -Path $BinaryPath -Algorithm SHA256).Hash.ToLower()
        if ($ExpectedHash -eq $ActualHash) {
            Write-Info "Checksum verified (SHA256)"
        } else {
            Write-Host "error: Checksum verification failed!" -ForegroundColor Red
            Write-Host "  Expected: $ExpectedHash" -ForegroundColor Red
            Write-Host "  Got:      $ActualHash" -ForegroundColor Red
            Remove-Item $BinaryPath -Force
            exit 1
        }
    }
} catch {
    # Checksums not available for this release; continue without verification
}

# Verify the binary works
try {
    $VersionOutput = & $BinaryPath version 2>&1
    Write-Info "Verified: $($VersionOutput | Select-Object -First 1)"
} catch {
    Write-Warn "Binary downloaded but could not verify. It may still work."
}

Write-Host ""
Write-Host "game-ci installed successfully!" -ForegroundColor Green -BackgroundColor Black
Write-Host ""

# Check PATH and offer to add
$UserPath = [Environment]::GetEnvironmentVariable('PATH', 'User')
if ($UserPath -notlike "*$InstallDir*") {
    Write-Warn "game-ci is not in your PATH."
    Write-Host ""
    Write-Host "To add it permanently, run:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  [Environment]::SetEnvironmentVariable('PATH', ""$InstallDir;"" + [Environment]::GetEnvironmentVariable('PATH', 'User'), 'User')"
    Write-Host ""
    Write-Info "Then restart your terminal."

    # Offer to add automatically
    Write-Host ""
    $AddToPath = Read-Host "Add to PATH now? (Y/n)"
    if ($AddToPath -ne 'n' -and $AddToPath -ne 'N') {
        [Environment]::SetEnvironmentVariable('PATH', "$InstallDir;$UserPath", 'User')
        $env:PATH = "$InstallDir;$env:PATH"
        Write-Info "Added to PATH. You can now run: game-ci --help"
    }
} else {
    Write-Info "game-ci is already in your PATH. Run: game-ci --help"
}
