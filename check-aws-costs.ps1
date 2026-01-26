# Check current AWS costs and set up budget alerts
# Run this to understand your spend

Write-Host "=== AWS Cost Analysis ===" -ForegroundColor Cyan

# Get current month costs
Write-Host "`n1. Fetching current month costs..." -ForegroundColor Yellow
aws ce get-cost-and-usage `
    --time-period Start=$(Get-Date -Format "yyyy-MM-01"),End=$(Get-Date -Format "yyyy-MM-dd") `
    --granularity MONTHLY `
    --metrics "UnblendedCost" `
    --group-by Type=DIMENSION,Key=SERVICE

# Get forecast for end of month
Write-Host "`n2. Getting cost forecast..." -ForegroundColor Yellow
$endOfMonth = (Get-Date).AddMonths(1).ToString("yyyy-MM-01")
aws ce get-cost-forecast `
    --time-period Start=$(Get-Date -Format "yyyy-MM-dd"),End=$endOfMonth `
    --metric UNBLENDED_COST `
    --granularity MONTHLY

# Check free tier usage
Write-Host "`n3. Checking free tier usage..." -ForegroundColor Yellow
aws ce get-cost-and-usage `
    --time-period Start=$(Get-Date -Format "yyyy-MM-01"),End=$(Get-Date -Format "yyyy-MM-dd") `
    --granularity MONTHLY `
    --metrics "UsageQuantity" `
    --filter file://free-tier-filter.json 2>$null

Write-Host "`n=== Recommendations ===" -ForegroundColor Green
Write-Host "1. Set up billing alerts in AWS Console > Billing > Budgets"
Write-Host "2. Create a budget for `$50-100/month initially"
Write-Host "3. Enable Cost Anomaly Detection"
Write-Host "`nFor detailed analysis, visit: https://console.aws.amazon.com/cost-management/home"
