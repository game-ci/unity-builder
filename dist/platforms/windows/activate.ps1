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

  $ACTIVATION_OUTPUT = Start-Process -FilePath "$Env:UNITY_PATH/Editor/Unity.exe" `
                                     -NoNewWindow `
                                     -PassThru `
                                     -ArgumentList  "-batchmode `
                                                     -quit `
                                                     -nographics `
                                                     -username $Env:UNITY_EMAIL `
                                                     -password $Env:UNITY_PASSWORD `
                                                     -serial $Env:UNITY_SERIAL `
                                                     -projectPath c:/BlankProject `
                                                     -logfile -"

  # Cache the handle so exit code works properly
  # https://stackoverflow.com/questions/10262231/obtaining-exitcode-using-start-process-and-waitforexit-instead-of-wait
  $unityHandle = $ACTIVATION_OUTPUT.Handle

  while ($true) {
      if ($ACTIVATION_OUTPUT.HasExited) {
        $ACTIVATION_EXIT_CODE = $ACTIVATION_OUTPUT.ExitCode

        # Display results
        if ($ACTIVATION_EXIT_CODE -eq 0)
        {
            Write-Output "Activation Succeeded"
        } else
        {
            Write-Output "Activation failed, with exit code $ACTIVATION_EXIT_CODE"
        }

        break
      }

      Start-Sleep -Seconds 3
  }
}
elseif( ($null -ne ${env:UNITY_LICENSING_SERVER}))
{
    #
    # Custom Unity License Server
    #

    Write-Output "Adding licensing server config"

    $ACTIVATION_OUTPUT = Start-Process -FilePath "$Env:UNITY_PATH\Editor\Data\Resources\Licensing\Client\Unity.Licensing.Client.exe" `
                                       -ArgumentList "--acquire-floating" `
                                       -NoNewWindow `
                                       -PassThru `
                                       -Wait `
                                       -RedirectStandardOutput "license.txt"

    $PARSEDFILE = (Get-Content "license.txt" | Select-String -AllMatches -Pattern '\".*?\"' | ForEach-Object { $_.Matches.Value }) -replace '"'

    $env:FLOATING_LICENSE = $PARSEDFILE[1]
    $FLOATING_LICENSE_TIMEOUT = $PARSEDFILE[3]

    Write-Output "Acquired floating license: ""$env:FLOATING_LICENSE"" with timeout $FLOATING_LICENSE_TIMEOUT"
    # Store the exit code from the verify command
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
or UNITY_LICENSE. See more info at https://game.ci/docs/github/activation"

    $ACTIVATION_EXIT_CODE = 1;
}
