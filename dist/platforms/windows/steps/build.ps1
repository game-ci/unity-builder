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

& "C:\Program Files\Unity\Hub\Editor\$Env:UNITY_VERSION\Editor\Unity.exe" -quit -batchmode -nographics `
                                                                          -projectPath $Env:UNITY_PROJECT_PATH `
                                                                          -executeMethod $Env:BUILD_METHOD `
                                                                          -buildTarget $Env:BUILD_TARGET `
                                                                          -customBuildTarget $Env:BUILD_TARGET `
                                                                          -customBuildPath $Env:CUSTOM_BUILD_PATH `
                                                                          -buildVersion $Env:VERSION `
                                                                          $Env:CUSTOM_PARAMETERS `
                                                                          -logfile | Out-Host

# Catch exit code
$Env:BUILD_EXIT_CODE=$?

# Display results
if ($Env:BUILD_EXIT_CODE -eq 0)
{
    Write-Output "Build Succeeded!"
} else
{
    Write-Output "$('Build failed, with exit code ')$($Env:BUILD_EXIT_CODE)$('"')"
}

# TODO: Determine if we need to set permissions on any files

#
# Results
#

Write-Output ""
Write-Output "###########################"
Write-Output "#       Build output      #"
Write-Output "###########################"
Write-Output ""

Get-ChildItem $Env:BUILD_PATH_FULL
Write-Output ""
