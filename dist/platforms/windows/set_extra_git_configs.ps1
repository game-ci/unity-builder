if ([string]::IsNullOrEmpty($env:GIT_CONFIG_EXTENSIONS)) {
    Write-Host "GIT_CONFIG_EXTENSIONS unset skipping"
}
else {
    Write-Host "GIT_CONFIG_EXTENSIONS is set configuring git extra configs"

    $configs = $env:GIT_CONFIG_EXTENSIONS -split "`n"
    foreach ($config in $configs) {
        $config = $config.Trim()
        if ([string]::IsNullOrEmpty($config)) {
            continue
        }

        if ($config -match '"([^"]+)" "([^"]+)"') {
            $key = $matches[1]
            $value = $matches[2]

            Write-Output "Adding extra git config: ""$key"" = ""$value"""
            git config --global --add $key $value
        }
        else {
            Write-Output "Invalid extra git config: $config"
            exit 1
        }
    }
}

Write-Host "---------- git config --list -------------"
git config --list

Write-Host "---------- git config --list --show-origin -------------"
git config --list --show-origin
