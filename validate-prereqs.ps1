# Validate Production Deployment Prerequisites
# Run this before deploying to check if you're ready

$ErrorActionPreference = "Continue"
$allGood = $true

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Pre-Deployment Validation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check AWS CLI
Write-Host "Checking AWS CLI..." -ForegroundColor Yellow
try {
    $awsVersion = aws --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  OK AWS CLI installed: $($awsVersion)" -ForegroundColor Green
    } else {
        Write-Host "  ERROR AWS CLI not found" -ForegroundColor Red
        Write-Host "     Install from: https://aws.amazon.com/cli/" -ForegroundColor Yellow
        $allGood = $false
    }
} catch {
    Write-Host "  ERROR AWS CLI not installed" -ForegroundColor Red
    Write-Host "     Install from: https://aws.amazon.com/cli/" -ForegroundColor Yellow
    $allGood = $false
}
Write-Host ""

# Check AWS Credentials
Write-Host "Checking AWS credentials..." -ForegroundColor Yellow
try {
    $identity = aws sts get-caller-identity 2>&1 | ConvertFrom-Json
    if ($identity.Account) {
        Write-Host "  OK AWS credentials configured" -ForegroundColor Green
        Write-Host "     Account: $($identity.Account)" -ForegroundColor Gray
        Write-Host "     User/Role: $($identity.Arn)" -ForegroundColor Gray
    } else {
        throw "No identity found"
    }
} catch {
    Write-Host "  ERROR AWS credentials not configured" -ForegroundColor Red
    Write-Host "     Run: aws configure" -ForegroundColor Yellow
    $allGood = $false
}
Write-Host ""

# Check Node.js
Write-Host "Checking Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  OK Node.js installed: $nodeVersion" -ForegroundColor Green
    } else {
        Write-Host "  ERROR Node.js not found" -ForegroundColor Red
        Write-Host "     Install from: https://nodejs.org/" -ForegroundColor Yellow
        $allGood = $false
    }
} catch {
    Write-Host "  ERROR Node.js not installed" -ForegroundColor Red
    Write-Host "     Install from: https://nodejs.org/" -ForegroundColor Yellow
    $allGood = $false
}
Write-Host ""

# Check npm
Write-Host "Checking npm..." -ForegroundColor Yellow
try {
    $npmVersion = npm --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  OK npm installed: $npmVersion" -ForegroundColor Green
    } else {
        Write-Host "  ERROR npm not found" -ForegroundColor Red
        $allGood = $false
    }
} catch {
    Write-Host "  ERROR npm not installed" -ForegroundColor Red
    $allGood = $false
}
Write-Host ""

# Check dependencies
Write-Host "Checking project dependencies..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Write-Host "  OK Root dependencies installed" -ForegroundColor Green
} else {
    Write-Host "  WARNING Root dependencies not installed" -ForegroundColor Yellow
    Write-Host "     Run: npm install" -ForegroundColor White
    $allGood = $false
}

if (Test-Path "infrastructure\node_modules") {
    Write-Host "  OK Infrastructure dependencies installed" -ForegroundColor Green
} else {
    Write-Host "  WARNING Infrastructure dependencies not installed" -ForegroundColor Yellow
    Write-Host "     Run: cd infrastructure; npm install" -ForegroundColor White
    $allGood = $false
}
Write-Host ""

# Check configuration
Write-Host "Checking production configuration..." -ForegroundColor Yellow
$configContent = Get-Content "infrastructure\config.ts" -Raw

# Check if domain is configured
$hasDomain = $configContent -match "domain:\s*['""]([^'""]+)['""]" -and $configContent -notmatch "// domain:"
$hasCert = $configContent -match "cloudfrontCertificateArn:\s*['""]arn:aws:acm" -and $configContent -notmatch "// cloudfrontCertificateArn:"

if ($hasDomain -and $hasCert) {
    Write-Host "  OK Custom domain configured" -ForegroundColor Green
    Write-Host "     Domain: $($Matches[1])" -ForegroundColor Gray
} elseif ($hasDomain -or $hasCert) {
    Write-Host "  WARNING Partial domain configuration" -ForegroundColor Yellow
    if ($hasDomain) {
        Write-Host "     Domain is set, but certificate ARN is missing" -ForegroundColor Yellow
    } else {
        Write-Host "     Certificate ARN is set, but domain is missing" -ForegroundColor Yellow
    }
    Write-Host "     You can deploy without a custom domain (will use CloudFront URL)" -ForegroundColor Gray
} else {
    Write-Host "  INFO No custom domain configured (will use CloudFront URL)" -ForegroundColor Cyan
    Write-Host "     This is fine - you can add a custom domain later" -ForegroundColor Gray
}
Write-Host ""

# Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Validation Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($allGood) {
    Write-Host "OK All prerequisites met!" -ForegroundColor Green
    Write-Host ""
    Write-Host "You're ready to deploy. Run:" -ForegroundColor Cyan
    Write-Host "  npm run deploy:prod" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "WARNING Some prerequisites are missing" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please fix the issues above, then run this script again." -ForegroundColor Yellow
    Write-Host ""
}

# Optional recommendations
Write-Host "Recommendations before deploying:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  - Set up billing alerts in AWS Console" -ForegroundColor White
Write-Host "  - Verify your SES sending email" -ForegroundColor White
Write-Host "  - Request SES production access (if needed)" -ForegroundColor White
if (-not $hasDomain) {
    Write-Host "  - Create ACM certificate if using custom domain" -ForegroundColor White
}
Write-Host "  - Review infrastructure/config.ts settings" -ForegroundColor White
Write-Host ""
