# Check Resend API Key Configuration in Production
Write-Host ""
Write-Host "Checking Resend API Key in Production Lambda..." -ForegroundColor Cyan
Write-Host ""

# Get Lambda function name from CloudFormation stack
$lambdaName = aws cloudformation describe-stacks `
    --stack-name "JobDockStack-prod" `
    --query "Stacks[0].Outputs[?OutputKey=='JobDock-prod-DataLambdaName'].OutputValue" `
    --output text 2>$null

if (-not $lambdaName) {
    Write-Host "❌ Could not find production Lambda function" -ForegroundColor Red
    Write-Host "   Make sure the stack is deployed: JobDockStack-prod" -ForegroundColor Yellow
    exit 1
}

Write-Host "Lambda Function: $lambdaName" -ForegroundColor Gray
Write-Host ""

# Get environment variables
$envVars = aws lambda get-function-configuration `
    --function-name $lambdaName `
    --query "Environment.Variables" `
    --output json 2>$null | ConvertFrom-Json

if ($envVars) {
    Write-Host "Email Configuration:" -ForegroundColor Yellow
    Write-Host "  EMAIL_PROVIDER: $($envVars.EMAIL_PROVIDER)" -ForegroundColor $(if ($envVars.EMAIL_PROVIDER -eq 'resend') { 'Green' } else { 'Red' })
    Write-Host "  EMAIL_FROM_ADDRESS: $($envVars.EMAIL_FROM_ADDRESS)" -ForegroundColor Gray
    
    $resendKey = $envVars.RESEND_API_KEY
    if ($resendKey -and $resendKey -ne "" -and $resendKey -ne "null") {
        $keyPreview = $resendKey.Substring(0, [Math]::Min(10, $resendKey.Length)) + "..."
        Write-Host "  RESEND_API_KEY: $keyPreview" -ForegroundColor Green
        Write-Host ""
        Write-Host "✅ Resend is configured correctly!" -ForegroundColor Green
    } else {
        Write-Host "  RESEND_API_KEY: NOT SET" -ForegroundColor Red
        Write-Host ""
        Write-Host "❌ RESEND_API_KEY is not set in production!" -ForegroundColor Red
        Write-Host "   Emails will not send. Run deploy-production.ps1 to fix." -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ Could not retrieve Lambda configuration" -ForegroundColor Red
}

Write-Host ""
