#
# Set project path
#
$Env:UNITY_PROJECT_PATH="$Env:GITHUB_WORKSPACE\$Env:PROJECT_PATH"
Write-Output "$('Using project path "')$($Env:UNITY_PROJECT_PATH)$('".')"

#
# Display the name for the build, doubles as the output name
#

Write-Output "$('Using build name "')$($Env:BUILD_NAME)$('".')"

#
# Display the build's target platform;
#

Write-Output "$('Using build target "')$($Env:BUILD_TARGET)$('".')"

#
# Display build path and file
#

Write-Output "$('Using build path "')$($Env:BUILD_PATH)$('" to save file "')$($Env:BUILD_FILE)$('".')"
$Env:BUILD_PATH_FULL="$Env:GITHUB_WORKSPACE\$Env:BUILD_PATH"
$Env:CUSTOM_BUILD_PATH="$Env:BUILD_PATH_FULL\$Env:BUILD_FILE"

#
# Set the build method, must reference one of:
#
#   - <NamespaceName.ClassName.MethodName>
#   - <ClassName.MethodName>
#
# For example: `BuildCommand.PerformBuild`
#
# The method must be declared static and placed in project/Assets/Editor
#
if ($Env:BUILD_METHOD)
{
    # User has provided their own build method.
    # Assume they also bring their own script.
    Write-Output "$('Using build method "')$($Env:BUILD_METHOD)$('".')"
}
else
{
    # User has not provided their own build command.
    #
    # Use the script from this action which builds the scenes that are enabled in
    # the project.
    #
    Write-Output "Using built-in build method."

    # Create Editor directory if it does not exist
    if(-Not (Test-Path -Path $Env:UNITY_PROJECT_PATH\Assets\Editor))
    {
        # We use -Force to suppress output, doesn't overwrite anything
        New-Item -ItemType Directory -Force -Path $Env:UNITY_PROJECT_PATH\Assets\Editor
    }

    # Copy the build script of Unity Builder action
    Copy-Item -Path "c:\UnityBuilderAction" -Destination $Env:UNITY_PROJECT_PATH\Assets\Editor -Recurse

    # Set the Build method to that of UnityBuilder Action
    $Env:BUILD_METHOD="UnityBuilderAction.Builder.BuildProject"

    # Verify recursive paths
    Get-ChildItem -Path $Env:UNITY_PROJECT_PATH\Assets\Editor -Recurse
}

if ( "$Env:BUILD_TARGET" -eq "Android" -and -not ([string]::IsNullOrEmpty("$Env:ANDROID_KEYSTORE_BASE64")) )
{
    Write-Output "Creating Android keystore."

    # Write to consistent location as Windows Unity seems to have issues with pwd and can't find the keystore
    $keystorePath = "C:/android.keystore"
    [System.IO.File]::WriteAllBytes($keystorePath, [System.Convert]::FromBase64String($Env:ANDROID_KEYSTORE_BASE64))

    # Ensure the project settings are pointed at the correct path
    $unitySettingsPath = "$Env:UNITY_PROJECT_PATH\ProjectSettings\ProjectSettings.asset"
    $fileContent = Get-Content -Path "$unitySettingsPath"
    $fileContent = $fileContent -replace "AndroidKeystoreName:\s+.*", "AndroidKeystoreName: $keystorePath"
    $fileContent | Set-Content -Path "$unitySettingsPath"

    Write-Output "Created Android keystore."
}
else {
    Write-Output "Not creating Android keystore."
}

#
# Pre-build debug information
#

Write-Output ""
Write-Output "###########################"
Write-Output "#    Custom parameters    #"
Write-Output "###########################"
Write-Output ""

Write-Output "$('"')$($Env:CUSTOM_PARAMETERS)$('"')"

Write-Output ""
Write-Output "###########################"
Write-Output "#    Current build dir    #"
Write-Output "###########################"
Write-Output ""

Write-Output "$('Creating "')$($Env:BUILD_PATH_FULL)$('" if it does not exist.')"
if (-Not (Test-Path -Path $Env:BUILD_PATH_FULL))
{
    mkdir "$Env:BUILD_PATH_FULL"
}
Get-ChildItem $Env:BUILD_PATH_FULL

Write-Output ""
Write-Output "###########################"
Write-Output "#    Project directory    #"
Write-Output "###########################"
Write-Output ""

Get-ChildItem $Env:UNITY_PROJECT_PATH

#
# Build
#

Write-Output ""
Write-Output "###########################"
Write-Output "#    Building project     #"
Write-Output "###########################"
Write-Output ""

# If $Env:CUSTOM_PARAMETERS contains spaces and is passed directly on the command line to Unity, powershell will wrap it
# in double quotes.  To avoid this, parse $Env:CUSTOM_PARAMETERS into an array, while respecting any quotations within the string.
$_, $customParametersArray = Invoke-Expression('Write-Output -- "" ' + $Env:CUSTOM_PARAMETERS)
$unityArgs = @(
    "-quit",
    "-batchmode",
    "-nographics",
    "-silent-crashes",
    "-customBuildName", "`"$Env:BUILD_NAME`"",
    "-projectPath", "`"$Env:UNITY_PROJECT_PATH`"",
    "-executeMethod", "`"$Env:BUILD_METHOD`"",
    "-buildTarget", "`"$Env:BUILD_TARGET`"",
    "-customBuildTarget", "`"$Env:BUILD_TARGET`"",
    "-customBuildPath", "`"$Env:CUSTOM_BUILD_PATH`"",
    "-buildVersion", "`"$Env:VERSION`"",
    "-androidVersionCode", "`"$Env:ANDROID_VERSION_CODE`"",
    "-androidKeystorePass", "`"$Env:ANDROID_KEYSTORE_PASS`"",
    "-androidKeyaliasName", "`"$Env:ANDROID_KEYALIAS_NAME`"",
    "-androidKeyaliasPass", "`"$Env:ANDROID_KEYALIAS_PASS`"",
    "-androidTargetSdkVersion", "`"$Env:ANDROID_TARGET_SDK_VERSION`"",
    "-androidExportType", "`"$Env:ANDROID_EXPORT_TYPE`"",
    "-androidSymbolType", "`"$Env:ANDROID_SYMBOL_TYPE`"",
    "-logfile", "-"
) + $customParametersArray

# Remove null items as that will fail the Start-Process call
$unityArgs = $unityArgs | Where-Object { $_ -ne $null }

$unityProcess = Start-Process -FilePath "$Env:UNITY_PATH/Editor/Unity.exe" `
                              -ArgumentList $unityArgs `
                              -PassThru `
                              -NoNewWindow

# Cache the handle so exit code works properly
# https://stackoverflow.com/questions/10262231/obtaining-exitcode-using-start-process-and-waitforexit-instead-of-wait
$unityHandle = $unityProcess.Handle

while ($true) {
    if ($unityProcess.HasExited) {
      Start-Sleep -Seconds 3
      Get-Process

      $BUILD_EXIT_CODE = $unityProcess.ExitCode

      # Display results
      if ($BUILD_EXIT_CODE -eq 0)
      {
          Write-Output "Build Succeeded!!"
      } else
      {
          Write-Output "Build failed, with exit code $BUILD_EXIT_CODE"
      }

      Write-Output ""
      Write-Output "###########################"
      Write-Output "#       Build output      #"
      Write-Output "###########################"
      Write-Output ""

      Get-ChildItem $Env:BUILD_PATH_FULL
      Write-Output ""

      break
    }

    Start-Sleep -Seconds 3
}
