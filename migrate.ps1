# PowerShell script to run database migrations via Migration Lambda

param(
    [string]$Action = "deploy",
    [string]$Env = "dev"
)

Write-Host ""
Write-Host "Running Database Migration" -ForegroundColor Cyan
Write-Host ("=" * 60) -ForegroundColor Cyan
Write-Host "Environment: $Env" -ForegroundColor Gray
Write-Host "Action: $Action" -ForegroundColor Gray
Write-Host ""

# Get the Migration Lambda function name from CDK outputs
Write-Host "Getting Migration Lambda name..." -ForegroundColor Yellow

$stackName = "JobDockStack-$Env"
$queryString = "Stacks[0].Outputs[?OutputKey=='MigrationLambdaName'].OutputValue"

$lambdaName = aws cloudformation describe-stacks --stack-name $stackName --query $queryString --output text

if ([string]::IsNullOrEmpty($lambdaName) -or $lambdaName -eq "None") {
    Write-Host "Could not find Migration Lambda. Did you deploy the infrastructure?" -ForegroundColor Red
    Write-Host "Run: cd infrastructure; npm run deploy:$Env" -ForegroundColor Yellow
    exit 1
}

Write-Host "Found Lambda: $lambdaName" -ForegroundColor Green

Write-Host ""
Write-Host "Invoking Migration Lambda..." -ForegroundColor Yellow
Write-Host "Action: $Action" -ForegroundColor Gray
Write-Host ""

# Invoke the Lambda with inline base64 payload
$payloadJson = "{`"action`":`"$Action`"}"
$payloadBytes = [System.Text.Encoding]::UTF8.GetBytes($payloadJson)
$payloadBase64 = [Convert]::ToBase64String($payloadBytes)

$responseFile = "migration-response.json"
aws lambda invoke --function-name $lambdaName --payload $payloadBase64 $responseFile

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to invoke Lambda" -ForegroundColor Red
    exit 1
}

# Read and display the response
if (Test-Path $responseFile) {
    $rawResponse = Get-Content $responseFile -Raw
    Write-Host ""
    Write-Host "Migration Result:" -ForegroundColor Cyan
    Write-Host ("=" * 60) -ForegroundColor Cyan
    Write-Host ""
    
    # Try to parse as JSON
    try {
        $responseObj = $rawResponse | ConvertFrom-Json
        
        # Check if body is a string (needs another parse)
        if ($responseObj.body -is [string]) {
            $body = $responseObj.body | ConvertFrom-Json
        } else {
            $body = $responseObj
        }
        
        if ($body.success) {
            Write-Host "Migration completed successfully!" -ForegroundColor Green
            Write-Host ""
            if ($body.output) {
                Write-Host "Output:" -ForegroundColor Yellow
                Write-Host $body.output -ForegroundColor White
            }
            if ($body.message) {
                Write-Host $body.message -ForegroundColor White
            }
        } else {
            Write-Host "Migration failed" -ForegroundColor Red
            Write-Host ""
            if ($body.error) {
                Write-Host "Error: $($body.error)" -ForegroundColor Red
            }
            if ($body.stderr) {
                Write-Host ""
                Write-Host "Details:" -ForegroundColor Yellow
                Write-Host $body.stderr -ForegroundColor Gray
            }
        }
    } catch {
        Write-Host "Raw response:" -ForegroundColor Yellow
        Write-Host $rawResponse -ForegroundColor White
    }
    
    Write-Host ""
} else {
    Write-Host "Failed to read response file" -ForegroundColor Red
    exit 1
}
