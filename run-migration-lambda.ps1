# Run database migrations using the Migration Lambda (no bastion needed!)
# This is the preferred method for production

param(
    [Parameter(Mandatory=$false)]
    [string]$Environment = "prod"
)

Write-Host "=== Running Database Migration via Lambda ===" -ForegroundColor Cyan
Write-Host "Environment: $Environment" -ForegroundColor Gray

# Get the Migration Lambda function name from stack outputs
Write-Host "`nFetching Lambda function name..." -ForegroundColor Yellow
$stackName = "JobDockStack-$Environment"

try {
    $outputs = aws cloudformation describe-stacks `
        --stack-name $stackName `
        --query "Stacks[0].Outputs" `
        --region us-east-1 | ConvertFrom-Json
    
    $lambdaName = ($outputs | Where-Object { $_.OutputKey -eq "MigrationLambdaName" }).OutputValue
    
    if (-not $lambdaName) {
        Write-Host "✗ Could not find Migration Lambda. Check stack deployment." -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✓ Found Lambda: $lambdaName" -ForegroundColor Green
} catch {
    Write-Host "✗ Error fetching stack info: $_" -ForegroundColor Red
    exit 1
}

# Invoke the migration Lambda
Write-Host "`nInvoking migration Lambda..." -ForegroundColor Yellow
Write-Host "This may take up to 5 minutes for complex migrations..." -ForegroundColor Gray

$result = aws lambda invoke `
    --function-name $lambdaName `
    --region us-east-1 `
    --log-type Tail `
    --query 'LogResult' `
    --output text `
    migration-response.json

if ($LASTEXITCODE -eq 0) {
    # Decode base64 logs
    $logBytes = [Convert]::FromBase64String($result)
    $logs = [System.Text.Encoding]::UTF8.GetString($logBytes)
    
    Write-Host "`n=== Migration Lambda Logs ===" -ForegroundColor Cyan
    Write-Host $logs -ForegroundColor Gray
    
    # Check response
    if (Test-Path "migration-response.json") {
        $response = Get-Content "migration-response.json" | ConvertFrom-Json
        
        Write-Host "`n=== Migration Response ===" -ForegroundColor Cyan
        $response | ConvertTo-Json -Depth 5 | Write-Host
        
        if ($response.statusCode -eq 200) {
            Write-Host "`n✓ Migration completed successfully!" -ForegroundColor Green
        } else {
            Write-Host "`n✗ Migration failed. Check logs above." -ForegroundColor Red
            exit 1
        }
    }
} else {
    Write-Host "✗ Failed to invoke Lambda" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== Next Steps ===" -ForegroundColor Cyan
Write-Host "1. Verify migration in CloudWatch Logs"
Write-Host "2. Test your application"
Write-Host "3. No bastion host needed! 🎉"
Write-Host ""
Write-Host "CloudWatch Logs: https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/`$252Faws`$252Flambda`$252F$lambdaName" -ForegroundColor Gray
