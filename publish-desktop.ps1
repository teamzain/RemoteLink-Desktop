$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$desktopDir = Join-Path $repoRoot "apps\desktop"
$releaseDir = Join-Path $desktopDir "release4"
$serverTarget = "root@159.65.84.190:/var/www/downloads/desktop/"

try {
    Write-Host "Building Connect-X desktop app..." -ForegroundColor Cyan
    Push-Location $desktopDir
    npm.cmd run build

    if (-not (Test-Path $releaseDir)) {
        throw "Release folder was not created: $releaseDir"
    }

    Write-Host "Uploading desktop release files to server..." -ForegroundColor Yellow
    scp -r "$releaseDir\*" $serverTarget

    Write-Host "Done. The desktop update files are now on the server." -ForegroundColor Green
}
finally {
    Pop-Location -ErrorAction SilentlyContinue
}
