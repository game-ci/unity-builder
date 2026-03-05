# delete-me-update-this-integration-branch.ps1
# Run this script from the repo root while on the release/lts-infrastructure branch.
# It merges the latest from each component branch to keep this integration branch current.
# After running, review any conflicts, then commit and push.

$ErrorActionPreference = 'Stop'

$branchName = git rev-parse --abbrev-ref HEAD
if ($branchName -ne 'release/lts-infrastructure') {
    Write-Error "Must be on release/lts-infrastructure branch. Currently on: $branchName"
    exit 1
}

# Component branches for this integration branch (infrastructure only, no next-gen)
$branches = @(
    'feature/orchestrator-enterprise-support'
    'feature/cloud-run-azure-providers'
    'feature/provider-load-balancing'
    'feature/orchestrator-unit-tests'
    'fix/secure-git-token-usage'
    'feature/premade-secret-sources'
    'feature/ci-platform-providers'
    'feature/build-reliability'
    'ci/orchestrator-integrity-speedup'
)

Write-Host "Fetching latest from origin..." -ForegroundColor Cyan
git fetch origin

$failed = @()
foreach ($branch in $branches) {
    Write-Host "`nMerging origin/$branch..." -ForegroundColor Yellow
    $result = git merge "origin/$branch" --no-edit 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  CONFLICT merging $branch - resolve manually" -ForegroundColor Red
        $failed += $branch
        # Abort this merge so we can continue with others
        git merge --abort
    } else {
        Write-Host "  Merged successfully" -ForegroundColor Green
    }
}

if ($failed.Count -gt 0) {
    Write-Host "`nThe following branches had conflicts and were skipped:" -ForegroundColor Red
    $failed | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    Write-Host "`nRe-run after resolving, or merge them manually:" -ForegroundColor Yellow
    $failed | ForEach-Object { Write-Host "  git merge origin/$_" -ForegroundColor Yellow }
} else {
    Write-Host "`nAll branches merged successfully!" -ForegroundColor Green
    Write-Host "Run 'git push origin release/lts-infrastructure' to update the remote." -ForegroundColor Cyan
}
