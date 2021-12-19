# Activates Unity
& "C:\Program Files\Unity\Hub\Editor\$Env:UNITY_VERSION\Editor\Unity.exe" -batchmode -quit -nographics `
                                                                          -username $Env:UNITY_USER `
                                                                          -password $Env:UNITY_PASS `
                                                                          -serial $Env:UNITY_SERIAL `
                                                                          -logfile | Out-Host
