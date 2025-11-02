# For some reason, Unity is failing in github actions windows runners
# due to missing Visual C++ 2013 redistributables.
# This script downloads and installs the required redistributables.
Write-Output ""
Write-Output "#########################################################"
Write-Output "#     Installing Visual C++ Redistributables (2013)     #"
Write-Output "#########################################################"
Write-Output ""


choco install vcredist2013 -y --no-progress
