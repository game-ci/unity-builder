if ($null -eq ${env:GIT_PRIVATE_TOKEN}) {
    Write-Host "GIT_PRIVATE_TOKEN unset skipping"
}
else {
    Write-Host "GIT_PRIVATE_TOKEN is set configuring git credentials"

    git config --global credential.helper store
    git config --global --replace-all url."https://token:$env:GIT_PRIVATE_TOKEN@github.com/".insteadOf "ssh://git@github.com/"
    git config --global --add url."https://token:$env:GIT_PRIVATE_TOKEN@github.com/".insteadOf "git@github.com"
    git config --global --add url."https://token:$env:GIT_PRIVATE_TOKEN@github.com/".insteadOf "https://github.com/"

    git config --global url."https://ssh:$env:GIT_PRIVATE_TOKEN@github.com/".insteadOf "ssh://git@github.com/"
    git config --global url."https://git:$env:GIT_PRIVATE_TOKEN@github.com/".insteadOf "git@github.com:"
}

Write-Host "---------- git config --list -------------"
git config --list

Write-Host "---------- git config --list --show-origin -------------"
git config --list --show-origin
