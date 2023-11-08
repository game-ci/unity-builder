# Activates Unity

Write-Output ""
Write-Output "###########################"
Write-Output "#        Activating       #"
Write-Output "###########################"
Write-Output ""

& "$Env:UNITY_PATH/Editor/Unity.exe" -batchmode -quit -nographics `
                                     -username $Env:UNITY_EMAIL `
                                     -password $Env:UNITY_PASSWORD `
                                     -serial $Env:UNITY_SERIAL `
                                     -projectPath "c:/BlankProject" `
                                     -logfile - | Out-Host

if(-not(Test-path "C:/ProgramData/Unity/Unity_lic.ulf" -PathType leaf))
{
  Write-Output "::error ::There was an error while trying to activate the Unity license."
}
