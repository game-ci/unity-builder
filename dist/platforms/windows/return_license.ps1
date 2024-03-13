# Return the active Unity license

Write-Output ""
Write-Output "###########################"
Write-Output "#      Return License     #"
Write-Output "###########################"
Write-Output ""

if (($null -ne ${env:UNITY_LICENSING_SERVER}))
{
  Write-Output "Returning floating license: ""$env:FLOATING_LICENSE"""
  Start-Process -FilePath "$Env:UNITY_PATH\Editor\Data\Resources\Licensing\Client\Unity.Licensing.Client.exe" `
                -ArgumentList "--return-floating ""$env:FLOATING_LICENSE"" " `
                -NoNewWindow `
                -Wait
}

elseif (($null -ne ${env:UNITY_SERIAL}) -and ($null -ne ${env:UNITY_EMAIL}) -and ($null -ne ${env:UNITY_PASSWORD}))
{
  #
  # SERIAL LICENSE MODE
  #
  # This will return the license that is currently in use.
  #
  $RETURN_LICENSE_OUTPUT = Start-Process -FilePath "$Env:UNITY_PATH/Editor/Unity.exe" `
                                         -NoNewWindow `
                                         -PassThru `
                                         -ArgumentList "-batchmode `
                                                         -quit `
                                                         -nographics `
                                                         -username $Env:UNITY_EMAIL `
                                                         -password $Env:UNITY_PASSWORD `
                                                         -returnlicense `
                                                         -projectPath c:/BlankProject `
                                                         -logfile -"

  # Cache the handle so exit code works properly
  # https://stackoverflow.com/questions/10262231/obtaining-exitcode-using-start-process-and-waitforexit-instead-of-wait
  $unityHandle = $RETURN_LICENSE_OUTPUT.Handle

  while ($true) {
      if ($RETURN_LICENSE_OUTPUT.HasExited) {
        $RETURN_LICENSE_EXIT_CODE = $RETURN_LICENSE_OUTPUT.ExitCode

        # Display results
        if ($RETURN_LICENSE_EXIT_CODE -eq 0)
        {
            Write-Output "License Return Succeeded"
        } else
        {
            Write-Output "License Return failed, with exit code $RETURN_LICENSE_EXIT_CODE"
            Write-Output "::warning ::License Return failed! If this is a Pro License you might need to manually `
free the seat in your Unity admin panel or you might run out of seats to activate with."
        }

        break
      }

      Start-Sleep -Seconds 3
  }
}
