$Private:repo = "mmozeiko/build-mesa"
$Private:downloadPath = "$Env:TEMP\mesa.zip"
$Private:extractPath = "$Env:TEMP\mesa"
$Private:destinationPath = "$Env:UNITY_PATH\Editor\"
$Private:version = "25.1.0"

$LLVMPIPE_INSTALLED = "false"

try {
    # Get the release info from GitHub API (version fixed to decrease probability of breakage)
    $releaseUrl = "https://api.github.com/repos/$repo/releases/tags/$version"
    $release = Invoke-RestMethod -Uri $releaseUrl -Headers @{ "User-Agent" = "PowerShell" }

    # Get the download URL for the zip asset
    $zipUrl = $release.assets | Where-Object { $_.name -like "mesa-llvmpipe-x64*.zip" } | Select-Object -First 1 -ExpandProperty browser_download_url

    if (-not $zipUrl) {
        throw "No zip file found in the latest release."
    }

    # Download the zip file
    Write-Host "Downloading $zipUrl..."
    Invoke-WebRequest -Uri $zipUrl -OutFile $downloadPath

    # Create extraction directory if it doesn't exist
    if (-not (Test-Path $extractPath)) {
        New-Item -ItemType Directory -Path $extractPath | Out-Null
    }

    # Extract the zip file
    Write-Host "Extracting $downloadPath to $extractPath..."
    Expand-Archive -Path $downloadPath -DestinationPath $extractPath -Force

    # Create destination directory if it doesn't exist
    if (-not (Test-Path $destinationPath)) {
        New-Item -ItemType Directory -Path $destinationPath | Out-Null
    }

    # Copy extracted files to destination
    Write-Host "Copying files to $destinationPath..."
    Copy-Item -Path "$extractPath\*" -Destination $destinationPath -Recurse -Force

    Write-Host "Successfully downloaded, extracted, and copied Mesa files to $destinationPath"

    $LLVMPIPE_INSTALLED = "true"
} catch {
    Write-Error "An error occurred: $_"
} finally {
    # Clean up temporary files
    if (Test-Path $downloadPath) {
        Remove-Item $downloadPath -Force
    }
    if (Test-Path $extractPath) {
        Remove-Item $extractPath -Recurse -Force
    }
}
