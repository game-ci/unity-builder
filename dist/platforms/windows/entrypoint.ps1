Get-Process

# 🔥 List all files under C:\Users
Write-Host "📂 Listing contents of C:\Users"
Get-ChildItem -Recurse "C:\Users" | ForEach-Object {
  Write-Host $_.FullName
}

# Copy .upmconfig.toml if it exists
if (Test-Path "C:\githubhome\.upmconfig.toml") {
  Write-Host "Copying .upmconfig.toml to C:\Users\runneradmin"
  # Copy-Item -Path "C:\githubhome\.upmconfig.toml" -Destination "C:\Users\runneradmin\" -Force
  Copy-Item -Path "C:\githubhome\.upmconfig.toml" -Destination "C:\ProgramData\Unity\config\upmconfig.toml" -Force
} else {
  Write-Host "No .upmconfig.toml found at C:\githubhome"
}

# Import any necessary registry keys, ie: location of windows 10 sdk
# No guarantee that there will be any necessary registry keys, ie: tvOS
Get-ChildItem -Path c:\regkeys -File | ForEach-Object { reg import $_.fullname }

# Register the Visual Studio installation so Unity can find it
regsvr32 C:\ProgramData\Microsoft\VisualStudio\Setup\x64\Microsoft.VisualStudio.Setup.Configuration.Native.dll

# Kill the regsvr process
Get-Process -Name regsvr32 | ForEach-Object { Stop-Process -Id $_.Id -Force }

# Setup Git Credentials
. "c:\steps\set_gitcredential.ps1"

# Activate Unity
if ($env:SKIP_ACTIVATION -ne "true") {
  . "c:\steps\activate.ps1"

  # If we didn't activate successfully, exit with the exit code from the activation step.
  if ($ACTIVATION_EXIT_CODE -ne 0) {
    exit $ACTIVATION_EXIT_CODE
  }
}
else {
  Write-Host "Skipping activation"
}

# Build the project
. "c:\steps\build.ps1"

# Free the seat for the activated license
if ($env:SKIP_ACTIVATION -ne "true") {
  . "c:\steps\return_license.ps1"
}

Get-Process

exit $BUILD_EXIT_CODE
