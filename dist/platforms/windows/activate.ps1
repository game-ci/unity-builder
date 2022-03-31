# Activates Unity
& "C:\Program Files\Unity\Hub\Editor\$Env:UNITY_VERSION\Editor\Unity.exe" -batchmode -quit -nographics `
                                                                          -username $Env:UNITY_EMAIL `
                                                                          -password $Env:UNITY_PASSWORD `
                                                                          -serial $Env:UNITY_SERIAL `
                                                                          -projectPath "c:/BlankProject" `
                                                                          -logfile | Out-Host
