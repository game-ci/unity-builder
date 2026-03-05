# delete-me-update-all-integration-branches.ps1
# Updates ALL integration branches from their component branches.
# Run from any branch -- it will stash changes, update each integration branch, then return.

$ErrorActionPreference = 'Stop'

$originalBranch = git rev-parse --abbrev-ref HEAD
$stashed = $false

# Stash any uncommitted changes
$status = git status --porcelain
if ($status) {
    Write-Host "Stashing uncommitted changes..." -ForegroundColor Cyan
    git stash push -m "auto-stash before integration branch update"
    $stashed = $true
}

Write-Host "Fetching all branches from origin..." -ForegroundColor Cyan
git fetch origin

$integrationBranches = @(
    @{
        Name = 'release/next-gen'
        Branches = @(
            'feature/test-workflow-engine'
            'feature/hot-runner-protocol'
            'feature/generic-artifact-system'
            'feature/incremental-sync-protocol'
            'feature/community-plugin-validation'
            'feature/cli-support'
        )
    }
    @{
        Name = 'release/lts-2.0.0'
        Branches = @(
            # Infrastructure
            'feature/orchestrator-enterprise-support'
            'feature/cloud-run-azure-providers'
            'feature/provider-load-balancing'
            'feature/orchestrator-unit-tests'
            'fix/secure-git-token-usage'
            'feature/premade-secret-sources'
            'feature/ci-platform-providers'
            'feature/build-reliability'
            'ci/orchestrator-integrity-speedup'
            # Next-gen
            'feature/test-workflow-engine'
            'feature/hot-runner-protocol'
            'feature/generic-artifact-system'
            'feature/incremental-sync-protocol'
            'feature/community-plugin-validation'
            'feature/cli-support'
        )
    }
)

foreach ($integration in $integrationBranches) {
    $name = $integration.Name
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "Updating $name" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan

    # Check if branch exists locally
    $exists = git branch --list $name
    if (-not $exists) {
        Write-Host "Creating local branch from origin/$name..." -ForegroundColor Yellow
        git checkout -b $name "origin/$name"
    } else {
        git checkout $name
        git pull origin $name --ff-only 2>$null
        if ($LASTEXITCODE -ne 0) {
            git pull origin $name --no-edit
        }
    }

    $failed = @()
    foreach ($branch in $integration.Branches) {
        $remoteBranch = "origin/$branch"
        # Check if remote branch exists
        $refExists = git rev-parse --verify $remoteBranch 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  Skipping $branch (not found on remote)" -ForegroundColor DarkGray
            continue
        }

        # Check if already merged
        $mergeBase = git merge-base HEAD $remoteBranch 2>$null
        $remoteHead = git rev-parse $remoteBranch 2>$null
        if ($mergeBase -eq $remoteHead) {
            Write-Host "  $branch - already up to date" -ForegroundColor DarkGray
            continue
        }

        Write-Host "  Merging $branch..." -ForegroundColor Yellow
        $result = git merge $remoteBranch --no-edit 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Host "    CONFLICT - skipped (resolve manually)" -ForegroundColor Red
            $failed += $branch
            git merge --abort
        } else {
            Write-Host "    OK" -ForegroundColor Green
        }
    }

    if ($failed.Count -gt 0) {
        Write-Host "`n  Conflicts in:" -ForegroundColor Red
        $failed | ForEach-Object { Write-Host "    - $_" -ForegroundColor Red }
    }

    # Push
    Write-Host "  Pushing $name to origin..." -ForegroundColor Cyan
    git push origin $name
}

# Return to original branch
Write-Host "`nReturning to $originalBranch..." -ForegroundColor Cyan
git checkout $originalBranch

if ($stashed) {
    Write-Host "Restoring stashed changes..." -ForegroundColor Cyan
    git stash pop
}

Write-Host "`nDone!" -ForegroundColor Green
