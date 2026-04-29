# 1. Build the Desktop App
Write-Host "🏗️  Building Connect-X Desktop App..." -ForegroundColor Cyan
Set-Location -Path "apps/desktop"
npm run build

# 2. Upload to DigitalOcean
Write-Host "📤 Uploading to DigitalOcean Server..." -ForegroundColor Yellow
scp -r ./release3/* root@159.65.84.190:/var/www/downloads/desktop/

Write-Host "✅ Done! Your app is now updated on the server and website." -ForegroundColor Green
Set-Location -Path "../.."
