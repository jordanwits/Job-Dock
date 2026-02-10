# Check Auth Lambda logs for login timeout issues
# This will help identify where the Lambda is timing out

$logGroupName = "/aws/lambda/JobDockStack-prod-AuthLambda*"

Write-Host "Checking Auth Lambda logs for recent errors..." -ForegroundColor Cyan
Write-Host ""

# Get the log group name
$logGroups = aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/JobDockStack-prod-AuthLambda" --query "logGroups[*].logGroupName" --output text

if ($logGroups) {
    $logGroup = $logGroups.Split("`t")[0]
    Write-Host "Found log group: $logGroup" -ForegroundColor Green
    Write-Host ""
    
    # Get recent logs (last 10 minutes)
    Write-Host "Fetching logs from last 10 minutes..." -ForegroundColor Yellow
    aws logs tail $logGroup --since 10m --format short
    
    Write-Host ""
    Write-Host "Checking for timeout or error messages..." -ForegroundColor Yellow
    aws logs tail $logGroup --since 10m --filter-pattern "timeout|error|ERROR|Task timed out|504" --format short
} else {
    Write-Host "Could not find Auth Lambda log group. Trying to list all JobDock Lambda log groups..." -ForegroundColor Yellow
    aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/JobDockStack-prod" --query "logGroups[*].logGroupName" --output table
}
