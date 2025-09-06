echo "installing game-ci cli"
if exist %UserProfile%\AppData\LocalLow\game-ci\ (
  echo Installed Updating
  git -C %UserProfile%\AppData\LocalLow\game-ci\ fetch
  git -C %UserProfile%\AppData\LocalLow\game-ci\ reset --hard
  git -C %UserProfile%\AppData\LocalLow\game-ci\ pull
  git -C %UserProfile%\AppData\LocalLow\game-ci\ branch
) else (
  echo Not Installed Downloading...
  mkdir %UserProfile%\AppData\LocalLow\game-ci\
  git clone https://github.com/game-ci/unity-builder %UserProfile%\AppData\LocalLow\game-ci\
)

call yarn --cwd %UserProfile%\AppData\LocalLow\game-ci\ install
call yarn --cwd %UserProfile%\AppData\LocalLow\game-ci\ run gcp-secrets-cli %* --projectPath %cd% --awsStackName game-ci-cli

REM Ensure GitHub Actions runner service is installed and running
if exist "%UserProfile%\actions-runner\svc.bat" (
  call "%UserProfile%\actions-runner\svc.bat" status >nul 2>&1
  if errorlevel 1 (
    echo Installing and starting GitHub Actions runner service
    call "%UserProfile%\actions-runner\svc.bat" install
    call "%UserProfile%\actions-runner\svc.bat" start
  )
)
