# Activates Unity

Write-Output ""
Write-Output "###########################"
Write-Output "#        Activating       #"
Write-Output "###########################"
Write-Output ""

if ( ($null -ne ${env:UNITY_SERIAL}) -and ($null -ne ${env:UNITY_EMAIL}) -and ($null -ne ${env:UNITY_PASSWORD}) )
{
  #
  # SERIAL LICENSE MODE
  #
  # This will activate unity, using the serial activation process.
  #
  Write-Output "Requesting activation"

  $ACTIVATION_OUTPUT = Start-Process -NoNewWindow -Wait -PassThru "$Env:UNITY_PATH/Editor/Unity.exe" `
                                      -ArgumentList `
                                      "-batchmode `
                                       -quit `
                                       -nographics `
                                       -username $Env:UNITY_EMAIL `
                                       -password $Env:UNITY_PASSWORD `
                                       -serial $Env:UNITY_SERIAL `
                                       -projectPath c:/BlankProject `
                                       -logfile -"

  $ACTIVATION_EXIT_CODE = $ACTIVATION_OUTPUT.ExitCode
}
else
{
    #
    # NO LICENSE ACTIVATION STRATEGY MATCHED
    #
    # This will exit since no activation strategies could be matched.
    #
    Write-Output "License activation strategy could not be determined."
    Write-Output ""
    Write-Output "Visit https://game.ci/docs/github/activation for more"
    Write-Output "details on how to set up one of the possible activation strategies."

    Write-Output "::error ::No valid license activation strategy could be determined. Make sure to provide UNITY_EMAIL, UNITY_PASSWORD, and either a UNITY_SERIAL \
or UNITY_LICENSE. Otherwise please use UNITY_LICENSING_SERVER. See more info at https://game.ci/docs/github/activation"

    $ACTIVATION_EXIT_CODE = 1;
}
