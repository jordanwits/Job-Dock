# Deploy Frontend Only to Production
# Use this script for quick frontend updates without redeploying infrastructure

param(
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Frontend Production Deployment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Build frontend
if (-not $SkipBuild) {
    Write-Host "Building frontend..." -ForegroundColor Yellow
    npm run build
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Build failed" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✅ Build completed" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "Skipping build (--SkipBuild flag)" -ForegroundColor Yellow
    Write-Host ""
}

# Check if dist folder exists
if (-not (Test-Path "dist")) {
    Write-Host "❌ dist/ folder not found. Run without --SkipBuild flag." -ForegroundColor Red
    exit 1
}

# Get S3 bucket name from CloudFormation
Write-Host "Getting S3 bucket name..." -ForegroundColor Yellow
$stackName = "JobDockStack-prod"
$bucketName = aws cloudformation describe-stacks --stack-name $stackName --query "Stacks[0].Outputs[?OutputKey=='FrontendBucketName'].OutputValue" --output text

if ([string]::IsNullOrEmpty($bucketName) -or $bucketName -eq "None") {
    Write-Host "❌ Could not find frontend bucket. Has infrastructure been deployed?" -ForegroundColor Red
    Write-Host "Run: .\deploy-production.ps1" -ForegroundColor Yellow
    exit 1
}

Write-Host "Bucket: $bucketName" -ForegroundColor Gray
Write-Host ""

# Upload to S3
Write-Host "Uploading to S3..." -ForegroundColor Yellow
aws s3 sync dist/ "s3://$bucketName/" --delete

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Upload failed" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Upload completed" -ForegroundColor Green
Write-Host ""

# Invalidate CloudFront cache
Write-Host "Invalidating CloudFront cache..." -ForegroundColor Yellow

# Get CloudFront distribution ID from outputs
$cloudFrontUrl = aws cloudformation describe-stacks --stack-name $stackName --query "Stacks[0].Outputs[?OutputKey=='CloudFrontUrl'].OutputValue" --output text

if (-not [string]::IsNullOrEmpty($cloudFrontUrl)) {
    # Extract distribution domain from URL
    $distributionDomain = $cloudFrontUrl -replace 'https://', ''
    
    # Find distribution ID by domain
    $distributionId = aws cloudfront list-distributions --query "DistributionList.Items[?DomainName=='$distributionDomain'].Id" --output text
    
    if (-not [string]::IsNullOrEmpty($distributionId)) {
        $invalidationResult = aws cloudfront create-invalidation --distribution-id $distributionId --paths "/*" 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ CloudFront cache invalidated" -ForegroundColor Green
            Write-Host "   Cache will clear in 1-2 minutes" -ForegroundColor Gray
        } else {
            Write-Host "⚠️  Failed to invalidate cache, but deployment succeeded" -ForegroundColor Yellow
            Write-Host "   Changes may take up to 24 hours to propagate" -ForegroundColor Gray
        }
    } else {
        Write-Host "⚠️  Could not find CloudFront distribution" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠️  Could not find CloudFront URL" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "✅ Frontend deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Your app is live at: $cloudFrontUrl" -ForegroundColor Cyan
Write-Host ""
