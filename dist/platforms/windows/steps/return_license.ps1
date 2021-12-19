# Returns the active Unity license
& "C:\Program Files\Unity\Hub\Editor\$Env:UNITY_VERSION\Editor\Unity.exe" -batchmode -quit -nographics `
                                                                          -username $Env:UNITY_USER `
                                                                          -password $Env:UNITY_PASS `
                                                                          -returnlicense `
                                                                          -logfile | Out-Host
