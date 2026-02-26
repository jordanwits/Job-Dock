# JobDock Production Deployment Script
# This script guides you through deploying JobDock to production

param(
    [switch]$SkipDomainCheck,
    [switch]$SkipInfrastructure,
    [switch]$SkipMigrations,
    [switch]$SkipFrontend,
    [switch]$SkipSESCheck,
    [string]$Domain,
    [string]$CertificateArn
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   JobDock Production Deployment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check domain and certificate configuration
if (-not $SkipDomainCheck) {
    Write-Host "Step 1: Domain and Certificate Configuration" -ForegroundColor Yellow
    Write-Host "-------------------------------------------" -ForegroundColor Yellow
    Write-Host ""
    
    $configPath = "infrastructure\config.ts"
    $configContent = Get-Content $configPath -Raw
    
    # Check if domain is configured
    $domainConfigured = $configContent -match 'domain:\s*[''"]([^''"]+)[''"]'
    $certConfigured = $configContent -match 'cloudfrontCertificateArn:\s*[''"]arn:aws:acm'
    
    if (-not $domainConfigured -or -not $certConfigured) {
        Write-Host "❌ Production domain and/or certificate not configured yet." -ForegroundColor Red
        Write-Host ""
        Write-Host "You need to:" -ForegroundColor Yellow
        Write-Host "  1. Choose your production domain (e.g., app.yourdomain.com)" -ForegroundColor White
        Write-Host "  2. Create an ACM certificate in AWS Certificate Manager (us-east-1 region)" -ForegroundColor White
        Write-Host "  3. Add DNS validation records to your external DNS provider" -ForegroundColor White
        Write-Host "  4. Wait for certificate to be issued" -ForegroundColor White
        Write-Host "  5. Update infrastructure/config.ts with domain and certificate ARN" -ForegroundColor White
        Write-Host ""
        
        # Offer to open AWS Console
        Write-Host "To create the certificate:" -ForegroundColor Cyan
        Write-Host "  1. Go to: https://console.aws.amazon.com/acm/home?region=us-east-1" -ForegroundColor White
        Write-Host "  2. Click 'Request certificate' → 'Request a public certificate'" -ForegroundColor White
        Write-Host "  3. Enter your domain name(s) - e.g., app.yourdomain.com" -ForegroundColor White
        Write-Host "  4. Choose 'DNS validation'" -ForegroundColor White
        Write-Host "  5. Copy the CNAME records and add them to your DNS provider" -ForegroundColor White
        Write-Host "  6. Wait for status to show 'Issued' (usually 5-10 minutes)" -ForegroundColor White
        Write-Host ""
        
        # Skip interactive domain setup - use existing config or CloudFront URL
        Write-Host ""
        Write-Host "Proceeding without custom domain. App will use default CloudFront URL." -ForegroundColor Yellow
        Write-Host "(To configure a custom domain later, update infrastructure/config.ts manually)" -ForegroundColor Gray
        Write-Host ""
    } else {
        Write-Host "✅ Domain and certificate configured" -ForegroundColor Green
        Write-Host ""
    }
}

# Step 2: Check AWS credentials
Write-Host "Step 2: Checking AWS Credentials" -ForegroundColor Yellow
Write-Host "---------------------------------" -ForegroundColor Yellow
Write-Host ""

try {
    $identity = aws sts get-caller-identity 2>&1
    if ($LASTEXITCODE -eq 0) {
        $identityJson = $identity | ConvertFrom-Json
        Write-Host "✅ AWS credentials configured" -ForegroundColor Green
        Write-Host "   Account: $($identityJson.Account)" -ForegroundColor Gray
        Write-Host "   User/Role: $($identityJson.Arn)" -ForegroundColor Gray
        Write-Host ""
    } else {
        throw "AWS credentials not configured"
    }
} catch {
    Write-Host "❌ AWS credentials not configured or AWS CLI not installed" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please configure AWS CLI with credentials that have admin access." -ForegroundColor Yellow
    Write-Host "Run: aws configure" -ForegroundColor White
    Write-Host ""
    exit 1
}

# Step 3: Email configuration (Resend, not SES)
Write-Host "Step 3: Email Configuration (Resend)" -ForegroundColor Yellow
Write-Host "---------------------------------------" -ForegroundColor Yellow
Write-Host ""
Write-Host "Using Resend for email sending (RESEND_API_KEY from .env)" -ForegroundColor Cyan
Write-Host ""

# Step 4: Deploy infrastructure
if (-not $SkipInfrastructure) {
    Write-Host ""
    Write-Host "Step 4: Deploying AWS Infrastructure" -ForegroundColor Yellow
    Write-Host "-------------------------------------" -ForegroundColor Yellow
    Write-Host ""
    
    Write-Host "This will create:" -ForegroundColor Cyan
    Write-Host "  • VPC with public and private subnets" -ForegroundColor White
    Write-Host "  • RDS PostgreSQL instance (t3.micro - Free Tier eligible)" -ForegroundColor White
    Write-Host "  • Cognito User Pool for authentication" -ForegroundColor White
    Write-Host "  • Lambda functions for API" -ForegroundColor White
    Write-Host "  • API Gateway" -ForegroundColor White
    Write-Host "  • S3 buckets for frontend and files" -ForegroundColor White
    Write-Host "  • CloudFront distribution for frontend" -ForegroundColor White
    Write-Host ""
    
    Write-Host "[INFO] This will incur AWS charges beyond the free tier." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Proceeding with deployment..." -ForegroundColor Cyan
    Write-Host ""
    
    Write-Host ""
    Write-Host "Loading RESEND_API_KEY from .env.local or .env..." -ForegroundColor Yellow
    $envFileToRead = $null
    if (Test-Path ".env.local") {
        $envFileToRead = ".env.local"
    } elseif (Test-Path ".env") {
        $envFileToRead = ".env"
    }

    if ($envFileToRead) {
        $envContent = Get-Content $envFileToRead -Raw
        # Match RESEND_API_KEY=value (handles quoted and unquoted values, comments)
        if ($envContent -match '(?m)^\s*RESEND_API_KEY\s*=\s*([^\r\n#]+)') {
            $keyValue = $matches[1].Trim()
            # Remove quotes if present
            $keyValue = $keyValue -replace '^["'']|["'']$', ''
            $env:RESEND_API_KEY = $keyValue
            if ($keyValue -and $keyValue.Length -gt 0) {
                Write-Host "[SUCCESS] RESEND_API_KEY loaded from $envFileToRead (${keyValue.Length} chars)" -ForegroundColor Green
            } else {
                Write-Host "[WARNING] RESEND_API_KEY found but value is empty in $envFileToRead" -ForegroundColor Yellow
            }
        } else {
            Write-Host "[WARNING] RESEND_API_KEY not found in $envFileToRead" -ForegroundColor Yellow
        }
        # Load Twilio vars for SMS (optional)
        foreach ($twilioVar in @('TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER')) {
            if ($envContent -match "(?m)^\s*$twilioVar\s*=\s*([^\r\n#]+)") {
                $val = $matches[1].Trim() -replace '^["'']|["'']$', ''
                Set-Item -Path "Env:$twilioVar" -Value $val
            }
        }
        if ($env:TWILIO_ACCOUNT_SID -and $env:TWILIO_AUTH_TOKEN -and $env:TWILIO_PHONE_NUMBER) {
            Write-Host "[SUCCESS] Twilio SMS vars loaded from $envFileToRead" -ForegroundColor Green
        } else {
            Write-Host "[INFO] Twilio vars not set - SMS notifications will be skipped" -ForegroundColor Gray
        }
    } else {
        Write-Host "[WARNING] No .env.local or .env file found" -ForegroundColor Yellow
    }
    
    if (-not $env:RESEND_API_KEY) {
        Write-Host "[WARNING] RESEND_API_KEY is not set - emails will not send!" -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "Installing infrastructure dependencies..." -ForegroundColor Yellow
    Push-Location infrastructure
    npm install
    
    Write-Host ""
    Write-Host "Building infrastructure code..." -ForegroundColor Yellow
    npm run build
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Build failed" -ForegroundColor Red
        Pop-Location
        exit 1
    }
    
    Write-Host ""
    Write-Host "Deploying to AWS (this may take 10-15 minutes)..." -ForegroundColor Yellow
    $resendStatus = if ($env:RESEND_API_KEY) { 'SET' } else { 'NOT SET' }
    Write-Host "  (RESEND_API_KEY is $resendStatus)" -ForegroundColor Gray
    
    # Run CDK deploy (script already includes --context env=prod)
    npm run deploy:prod
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Deployment failed" -ForegroundColor Red
        Pop-Location
        exit 1
    }
    
    Pop-Location
    
    Write-Host ""
    Write-Host "Verifying API keys in production Data Lambda..." -ForegroundColor Yellow
    $query = "Stacks[0].Outputs[?OutputKey=='DataLambdaName'].OutputValue"
    $lambdaName = aws cloudformation describe-stacks --stack-name "JobDockStack-prod" --query $query --output text 2>$null
    if ($lambdaName) {
        $config = aws lambda get-function-configuration --function-name $lambdaName --query "Environment.Variables" --output json 2>$null | ConvertFrom-Json
        $resendKey = $config.RESEND_API_KEY
        if ($resendKey -and $resendKey -ne "null" -and $resendKey -ne "") {
            Write-Host "[SUCCESS] RESEND_API_KEY is set in production Lambda" -ForegroundColor Green
        } else {
            Write-Host "[ERROR] RESEND_API_KEY is NOT set in production Lambda!" -ForegroundColor Red
            Write-Host "   Emails will not send. Please redeploy with RESEND_API_KEY set." -ForegroundColor Yellow
        }
        $twilioSid = $config.TWILIO_ACCOUNT_SID
        $twilioToken = $config.TWILIO_AUTH_TOKEN
        $twilioPhone = $config.TWILIO_PHONE_NUMBER
        if ($twilioSid -and $twilioToken -and $twilioPhone -and $twilioSid -ne "null" -and $twilioToken -ne "null" -and $twilioPhone -ne "") {
            Write-Host "[SUCCESS] Twilio SMS vars are set in production Lambda" -ForegroundColor Green
        } else {
            Write-Host "[WARNING] Twilio SMS vars are NOT set in production Lambda - SMS will not send" -ForegroundColor Yellow
            Write-Host "   Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER to .env.local and redeploy" -ForegroundColor Gray
        }
    } else {
        Write-Host "[WARNING] Could not verify Lambda configuration (stack may still be deploying)" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "✅ Infrastructure deployed successfully!" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "Skipping infrastructure deployment (`--SkipInfrastructure flag)" -ForegroundColor Yellow
    Write-Host ""
}

# Step 5: Sync environment variables
Write-Host "Step 5: Syncing Environment Variables" -ForegroundColor Yellow
Write-Host "--------------------------------------" -ForegroundColor Yellow
Write-Host ""

Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm install

Write-Host ""
Write-Host "Pulling CloudFormation outputs to .env files..." -ForegroundColor Yellow
# NOTE: npm on Windows can treat "--env/--region" as npm CLI flags and NOT pass them to the script.
# Use npx directly so the arguments reliably reach scripts/sync-aws-env.ts.
npx --yes tsx scripts/sync-aws-env.ts --env=prod --region=us-east-1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Environment variables synced" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "❌ Failed to sync environment variables" -ForegroundColor Red
    exit 1
}

# Step 6: Run database migrations
if (-not $SkipMigrations) {
    Write-Host "Step 6: Running Database Migrations" -ForegroundColor Yellow
    Write-Host "------------------------------------" -ForegroundColor Yellow
    Write-Host ""
    
    .\migrate.ps1 -Env prod -Action deploy
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Migrations completed" -ForegroundColor Green
        Write-Host ""
    } else {
        Write-Host "❌ Migrations failed" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Skipping migrations (`--SkipMigrations flag)" -ForegroundColor Yellow
    Write-Host ""
}

# Step 7: Build and deploy frontend
if (-not $SkipFrontend) {
    Write-Host "Step 7: Building and Deploying Frontend" -ForegroundColor Yellow
    Write-Host "----------------------------------------" -ForegroundColor Yellow
    Write-Host ""
    
    Write-Host "Building production frontend..." -ForegroundColor Yellow
    npm run build
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Frontend build failed" -ForegroundColor Red
        exit 1
    }
    
    Write-Host ""
    Write-Host "Getting S3 bucket name..." -ForegroundColor Yellow
    $stackName = "JobDockStack-prod"
    $bucketName = aws cloudformation describe-stacks --stack-name $stackName --query "Stacks[0].Outputs[?OutputKey=='FrontendBucketName'].OutputValue" --output text
    
    if ([string]::IsNullOrEmpty($bucketName) -or $bucketName -eq "None") {
        Write-Host "❌ Could not find frontend bucket" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "Deploying to S3 bucket: $bucketName" -ForegroundColor Yellow
    aws s3 sync dist/ "s3://$bucketName/" --delete
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Frontend deployed" -ForegroundColor Green
        Write-Host ""
    } else {
        Write-Host "❌ Frontend deployment failed" -ForegroundColor Red
        exit 1
    }
    
    # Invalidate CloudFront cache
    Write-Host "Invalidating CloudFront cache..." -ForegroundColor Yellow
    $distributionId = aws cloudfront list-distributions --query "DistributionList.Items[?Comment==''].Id" --output text | Select-Object -First 1
    
    if (-not [string]::IsNullOrEmpty($distributionId)) {
        aws cloudfront create-invalidation --distribution-id $distributionId --paths "/*"
        Write-Host "✅ CloudFront cache invalidated" -ForegroundColor Green
        Write-Host ""
    }
} else {
    Write-Host "Skipping frontend deployment (`--SkipFrontend flag)" -ForegroundColor Yellow
    Write-Host ""
}

# Step 8: Get deployment URLs
Write-Host "Step 8: Deployment Complete!" -ForegroundColor Green
Write-Host "=============================" -ForegroundColor Green
Write-Host ""

$stackName = "JobDockStack-prod"
$apiUrl = aws cloudformation describe-stacks --stack-name $stackName --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text
$cloudFrontUrl = aws cloudformation describe-stacks --stack-name $stackName --query "Stacks[0].Outputs[?OutputKey=='CloudFrontUrl'].OutputValue" --output text
$userPoolId = aws cloudformation describe-stacks --stack-name $stackName --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text

Write-Host "Your JobDock production environment is ready!" -ForegroundColor Green
Write-Host ""
Write-Host "Frontend URL: $cloudFrontUrl" -ForegroundColor Cyan
Write-Host "API URL: $apiUrl" -ForegroundColor Cyan
Write-Host "Cognito User Pool: $userPoolId" -ForegroundColor Cyan
Write-Host ""

Write-Host 'Next steps:' -ForegroundColor Yellow
Write-Host '  1. Visit the frontend URL to test your deployment' -ForegroundColor White
Write-Host '  2. Create your first user account' -ForegroundColor White
Write-Host '  3. Set up billing alerts in AWS Console' -ForegroundColor White
Write-Host '  4. Configure your DNS if using a custom domain' -ForegroundColor White
Write-Host ""
Write-Host 'For future deployments, use:' -ForegroundColor Cyan
Write-Host '  .\deploy-production.ps1 -SkipInfrastructure -SkipDomainCheck -SkipMigrations' -ForegroundColor White
Write-Host ""
