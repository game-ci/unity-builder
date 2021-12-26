# First we activate Unity
& "c:\steps\activate.ps1"

# Next we import any necessary registry keys, ie: location of windows 10 sdk
# No guarantee that there will be any necessary registry keys, ie: tvOS
Get-ChildItem -Path c:\regkeys -File | Foreach {reg import $_.fullname}

# Now we register the visual studio installation so Unity can find it
regsvr32 C:\ProgramData\Microsoft\VisualStudio\Setup\x64\Microsoft.VisualStudio.Setup.Configuration.Native.dll

# Now we can build our project
& "c:\steps\build.ps1"

# Finally free the seat for the activated license
& "c:\steps\return_license.ps1"
