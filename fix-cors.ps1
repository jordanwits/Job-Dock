#!/usr/bin/env pwsh
# Script to fix CORS issues with Vercel deployment

param(
    [Parameter(Mandatory=$true)]
    [string]$VercelUrl
)

Write-Host "================================================" -ForegroundColor Cyan
Write-Host " Fixing CORS for Vercel Deployment" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Remove https:// if present
$vercelDomain = $VercelUrl -replace '^https?://', ''

Write-Host "Step 1: Updating infrastructure config with Vercel domain: $vercelDomain" -ForegroundColor Yellow

# Read the config file
$configPath = "infrastructure\config.ts"
$configContent = Get-Content $configPath -Raw

# Update the vercelDomain in the prod config
$configContent = $configContent -replace "vercelDomain: '[^']*'", "vercelDomain: '$vercelDomain'"

# Write back
Set-Content $configPath -Value $configContent

Write-Host "✓ Config updated" -ForegroundColor Green
Write-Host ""

Write-Host "Step 2: Deploying backend infrastructure..." -ForegroundColor Yellow
Set-Location infrastructure
npm run deploy:prod
Set-Location ..

Write-Host "✓ Backend deployed" -ForegroundColor Green
Write-Host ""

# Get the API URL
Write-Host "Step 3: Getting API URL..." -ForegroundColor Yellow
$outputs = aws cloudformation describe-stacks --stack-name JobDockStack-prod --query "Stacks[0].Outputs" --output json | ConvertFrom-Json
$apiUrl = ($outputs | Where-Object { $_.OutputKey -eq "ApiUrl" }).OutputValue
$userPoolId = ($outputs | Where-Object { $_.OutputKey -eq "UserPoolId" }).OutputValue
$clientId = ($outputs | Where-Object { $_.OutputKey -eq "UserPoolClientId" }).OutputValue
$filesBucket = ($outputs | Where-Object { $_.OutputKey -eq "FilesBucketName" }).OutputValue

Write-Host "✓ API URL: $apiUrl" -ForegroundColor Green
Write-Host ""

Write-Host "Step 4: Environment variables to set in Vercel:" -ForegroundColor Yellow
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "VITE_API_URL=$apiUrl"
Write-Host "VITE_AWS_REGION=us-east-1"
Write-Host "VITE_COGNITO_USER_POOL_ID=$userPoolId"
Write-Host "VITE_COGNITO_CLIENT_ID=$clientId"
Write-Host "VITE_S3_BUCKET=$filesBucket"
Write-Host "VITE_DEFAULT_TENANT_ID=demo-tenant"
Write-Host "VITE_USE_MOCK_DATA=false"
Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "NEXT STEPS:" -ForegroundColor Yellow
Write-Host "1. Go to your Vercel project settings" -ForegroundColor White
Write-Host "2. Navigate to Settings > Environment Variables" -ForegroundColor White
Write-Host "3. Add the environment variables shown above" -ForegroundColor White
Write-Host "4. Redeploy your frontend from Vercel dashboard" -ForegroundColor White
Write-Host ""
Write-Host "Or use the Vercel CLI:" -ForegroundColor Yellow
Write-Host "  vercel env add VITE_API_URL" -ForegroundColor White
Write-Host "  (paste: $apiUrl)" -ForegroundColor Gray
Write-Host ""
