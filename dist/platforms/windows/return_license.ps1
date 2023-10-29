# Return the active Unity license
& "$Env:UNITY_PATH\Editor\Unity.exe" -batchmode -quit -nographics `
                                     -username $Env:UNITY_EMAIL `
                                     -password $Env:UNITY_PASSWORD `
                                     -returnlicense `
                                     -projectPath "c:/BlankProject" `
                                     -logfile
