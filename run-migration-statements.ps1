# Run remaining migration statements individually

$lambdaName = "JobDockStack-dev-MigrationLambdaDC97547E-HhqwVmaTO1QZ"

$statements = @(
    'DROP INDEX IF EXISTS "jobs_assignedTo_idx"',
    'DROP INDEX IF EXISTS "job_logs_assignedTo_idx"',
    'UPDATE "jobs" SET "assignedTo" = jsonb_build_array("assignedTo"::text) WHERE "assignedTo" IS NOT NULL AND "assignedTo"::text != ''''',
    'UPDATE "job_logs" SET "assignedTo" = jsonb_build_array("assignedTo"::text) WHERE "assignedTo" IS NOT NULL AND "assignedTo"::text != ''''',
    'ALTER TABLE "jobs" ALTER COLUMN "assignedTo" TYPE jsonb USING "assignedTo"::jsonb',
    'ALTER TABLE "job_logs" ALTER COLUMN "assignedTo" TYPE jsonb USING "assignedTo"::jsonb'
)

foreach ($stmt in $statements) {
    Write-Host ""
    Write-Host "Running: $($stmt.Substring(0, [Math]::Min(70, $stmt.Length)))..." -ForegroundColor Yellow
    
    $payload = @{ action = "sql"; sql = $stmt } | ConvertTo-Json -Compress
    $payloadBytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
    $payloadBase64 = [Convert]::ToBase64String($payloadBytes)
    
    aws lambda invoke --function-name $lambdaName --payload $payloadBase64 migration-response.json | Out-Null
    
    $response = Get-Content migration-response.json | ConvertFrom-Json
    
    if ($response.success) {
        Write-Host "  Success" -ForegroundColor Green
    } else {
        Write-Host "  Failed" -ForegroundColor Red
        Write-Host "  Error: $($response.error)" -ForegroundColor Red
        break
    }
}

Write-Host ""
Write-Host "Migration statements completed!" -ForegroundColor Cyan
