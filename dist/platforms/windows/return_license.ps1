# Return the active Unity license

Write-Output ""
Write-Output "###########################"
Write-Output "#      Return License     #"
Write-Output "###########################"
Write-Output ""

if ($null -ne ${env:UNITY_SERIAL})
{
  #
  # SERIAL LICENSE MODE
  #
  # This will return the license that is currently in use.
  #
  $RETURN_OUTPUT = Start-Process -NoNewWindow -Wait -PassThru "$Env:UNITY_PATH/Editor/Unity.exe" `
                                 -ArgumentList `
                                 "-batchmode `
                                  -quit `
                                  -nographics `
                                  -username $Env:UNITY_EMAIL `
                                  -password $Env:UNITY_PASSWORD `
                                  -returnlicense `
                                  -projectPath c:/BlankProject `
                                  -logfile -"
}
