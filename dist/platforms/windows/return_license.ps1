# Return the active Unity license

Write-Output ""
Write-Output "###########################"
Write-Output "#      Return License     #"
Write-Output "###########################"
Write-Output ""

& "$Env:UNITY_PATH\Editor\Unity.exe" -batchmode -quit -nographics `
                                     -username $Env:UNITY_EMAIL `
                                     -password $Env:UNITY_PASSWORD `
                                     -returnlicense `
                                     -projectPath "c:/BlankProject" `
                                     -logfile - | Out-Host
