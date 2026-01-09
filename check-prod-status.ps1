# Check Production Deployment Status
# Use this script to verify your production deployment

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Production Status Check" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$stackName = "JobDockStack-prod"

# Check if stack exists
Write-Host "Checking CloudFormation stack..." -ForegroundColor Yellow
$stackStatus = aws cloudformation describe-stacks --stack-name $stackName --query "Stacks[0].StackStatus" --output text 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Production stack not found" -ForegroundColor Red
    Write-Host ""
    Write-Host "The production environment has not been deployed yet." -ForegroundColor Yellow
    Write-Host "Run: .\deploy-production.ps1" -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host "✅ Stack Status: $stackStatus" -ForegroundColor Green
Write-Host ""

# Get all outputs
Write-Host "Getting deployment details..." -ForegroundColor Yellow
Write-Host ""

$outputs = aws cloudformation describe-stacks --stack-name $stackName --query "Stacks[0].Outputs" | ConvertFrom-Json

Write-Host "📋 Stack Outputs:" -ForegroundColor Cyan
Write-Host "=================" -ForegroundColor Cyan
Write-Host ""

foreach ($output in $outputs) {
    Write-Host "  $($output.OutputKey):" -ForegroundColor White
    Write-Host "    $($output.OutputValue)" -ForegroundColor Gray
    Write-Host ""
}

# Check frontend deployment
Write-Host "🌐 Frontend Status:" -ForegroundColor Cyan
Write-Host "===================" -ForegroundColor Cyan
Write-Host ""

$bucketName = ($outputs | Where-Object { $_.OutputKey -eq "FrontendBucketName" }).OutputValue
if ($bucketName) {
    $objectCount = aws s3 ls "s3://$bucketName/" --recursive | Measure-Object -Line | Select-Object -ExpandProperty Lines
    
    if ($objectCount -gt 0) {
        Write-Host "  ✅ Frontend deployed ($objectCount files in S3)" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  Frontend bucket is empty" -ForegroundColor Yellow
        Write-Host "     Run: .\deploy-frontend-prod.ps1" -ForegroundColor White
    }
} else {
    Write-Host "  ❌ Could not find frontend bucket" -ForegroundColor Red
}
Write-Host ""

# Check database
Write-Host "🗄️  Database Status:" -ForegroundColor Cyan
Write-Host "====================" -ForegroundColor Cyan
Write-Host ""

$dbEndpoint = ($outputs | Where-Object { $_.OutputKey -eq "DatabaseEndpoint" }).OutputValue
if ($dbEndpoint) {
    Write-Host "  ✅ Database endpoint: $dbEndpoint" -ForegroundColor Green
    Write-Host ""
    
    # Check migrations
    Write-Host "  Checking migration status..." -ForegroundColor Yellow
    $migrationLambda = ($outputs | Where-Object { $_.OutputKey -eq "MigrationLambdaName" }).OutputValue
    
    if ($migrationLambda) {
        $payloadJson = '{"action":"status"}'
        $payloadBytes = [System.Text.Encoding]::UTF8.GetBytes($payloadJson)
        $payloadBase64 = [Convert]::ToBase64String($payloadBytes)
        
        $responseFile = "migration-status-check.json"
        aws lambda invoke --function-name $migrationLambda --payload $payloadBase64 $responseFile | Out-Null
        
        if (Test-Path $responseFile) {
            $response = Get-Content $responseFile -Raw | ConvertFrom-Json
            
            if ($response.body) {
                $body = $response.body | ConvertFrom-Json
                
                if ($body.success) {
                    Write-Host "  ✅ Migration status retrieved" -ForegroundColor Green
                    if ($body.output) {
                        Write-Host ""
                        Write-Host $body.output -ForegroundColor Gray
                    }
                }
            }
            
            Remove-Item $responseFile -Force
        }
    }
} else {
    Write-Host "  ❌ Could not find database endpoint" -ForegroundColor Red
}
Write-Host ""

# Check Cognito
Write-Host "🔐 Authentication Status:" -ForegroundColor Cyan
Write-Host "==========================" -ForegroundColor Cyan
Write-Host ""

$userPoolId = ($outputs | Where-Object { $_.OutputKey -eq "UserPoolId" }).OutputValue
if ($userPoolId) {
    $userCount = aws cognito-idp list-users --user-pool-id $userPoolId --query "Users" 2>&1 | ConvertFrom-Json | Measure-Object | Select-Object -ExpandProperty Count
    
    Write-Host "  ✅ User Pool ID: $userPoolId" -ForegroundColor Green
    Write-Host "  👥 Users: $userCount" -ForegroundColor Gray
} else {
    Write-Host "  ❌ Could not find user pool" -ForegroundColor Red
}
Write-Host ""

# Check custom domain configuration
Write-Host "🌐 Domain Configuration:" -ForegroundColor Cyan
Write-Host "=========================" -ForegroundColor Cyan
Write-Host ""

$configContent = Get-Content "infrastructure\config.ts" -Raw
if ($configContent -match "domain:\s*['""]([^'""]+)['""]") {
    $customDomain = $Matches[1]
    Write-Host "  📝 Custom domain configured: $customDomain" -ForegroundColor Green
    Write-Host ""
    
    # Check if DNS is pointing correctly
    Write-Host "  Checking DNS..." -ForegroundColor Yellow
    $cloudFrontUrl = ($outputs | Where-Object { $_.OutputKey -eq "CloudFrontUrl" }).OutputValue
    $cloudFrontDomain = $cloudFrontUrl -replace 'https://', ''
    
    try {
        $dnsResult = Resolve-DnsName $customDomain -Type CNAME -ErrorAction SilentlyContinue
        
        if ($dnsResult -and $dnsResult.NameHost -like "*cloudfront.net") {
            Write-Host "  ✅ DNS is configured correctly" -ForegroundColor Green
            Write-Host "     CNAME points to: $($dnsResult.NameHost)" -ForegroundColor Gray
        } else {
            Write-Host "  ⚠️  DNS may not be configured yet" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "  Add this CNAME record to your DNS:" -ForegroundColor White
            Write-Host "     Type: CNAME" -ForegroundColor Gray
            Write-Host "     Name: $customDomain" -ForegroundColor Gray
            Write-Host "     Value: $cloudFrontDomain" -ForegroundColor Gray
        }
    } catch {
        Write-Host "  ⚠️  Could not resolve DNS for $customDomain" -ForegroundColor Yellow
    }
} else {
    Write-Host "  📝 No custom domain configured (using CloudFront URL)" -ForegroundColor Gray
}
Write-Host ""

# Summary
Write-Host "📊 Summary:" -ForegroundColor Cyan
Write-Host "============" -ForegroundColor Cyan
Write-Host ""

$cloudFrontUrl = ($outputs | Where-Object { $_.OutputKey -eq "CloudFrontUrl" }).OutputValue
$apiUrl = ($outputs | Where-Object { $_.OutputKey -eq "ApiUrl" }).OutputValue

Write-Host "  Frontend: $cloudFrontUrl" -ForegroundColor White
Write-Host "  API: $apiUrl" -ForegroundColor White

if ($customDomain) {
    Write-Host "  Custom Domain: https://$customDomain" -ForegroundColor White
}
Write-Host ""
