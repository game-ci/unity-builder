# Return the active Unity license
& "C:\Program Files\Unity\Hub\Editor\$Env:UNITY_VERSION\Editor\Unity.exe" -batchmode -quit -nographics `
                                                                          -username $Env:UNITY_EMAIL `
                                                                          -password $Env:UNITY_PASSWORD `
                                                                          -returnlicense `
                                                                          -projectPath "c:/BlankProject" `
                                                                          -logfile | Out-Host
