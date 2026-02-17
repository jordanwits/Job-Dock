# Simple Per-User Cost Calculator
# Manual calculation when you know your user count and AWS costs

param(
    [Parameter(Mandatory=$true)]
    [int]$UserCount,
    
    [Parameter(Mandatory=$false)]
    [double]$MonthlyCost = 0,
    
    [Parameter(Mandatory=$false)]
    [double]$MonthToDateCost = 0,
    
    [Parameter(Mandatory=$false)]
    [double]$ForecastedCost = 0
)

Write-Host "=== Simple Per-User Cost Calculator ===" -ForegroundColor Cyan
Write-Host ""

if ($UserCount -le 0) {
    Write-Host "ERROR: User count must be greater than 0" -ForegroundColor Red
    exit 1
}

Write-Host "User Count: $UserCount" -ForegroundColor White
Write-Host ""

# If no costs provided, use default from AWS billing screenshot
if ($MonthlyCost -eq 0 -and $MonthToDateCost -eq 0 -and $ForecastedCost -eq 0) {
    Write-Host "No costs provided. Using values from AWS billing screenshot:" -ForegroundColor Yellow
    Write-Host "  - Last month total: `$142.93" -ForegroundColor White
    Write-Host "  - Month-to-date: `$52.02" -ForegroundColor White
    Write-Host "  - Forecasted: `$88.56" -ForegroundColor White
    Write-Host ""
    
    $MonthlyCost = 142.93
    $MonthToDateCost = 52.02
    $ForecastedCost = 88.56
}

Write-Host "=== Per-User Cost Analysis ===" -ForegroundColor Cyan
Write-Host ""

$costs = @()

if ($MonthlyCost -gt 0) {
    $costPerUser = [math]::Round($MonthlyCost / $UserCount, 4)
    Write-Host "Last Month Total:" -ForegroundColor Yellow
    Write-Host "  Total Cost:      `$$([math]::Round($MonthlyCost, 2))" -ForegroundColor White
    Write-Host "  Per User:        `$$([math]::Round($costPerUser, 2))" -ForegroundColor Green
    Write-Host ""
    $costs += $costPerUser
}

if ($ForecastedCost -gt 0) {
    $costPerUser = [math]::Round($ForecastedCost / $UserCount, 4)
    Write-Host "Current Month Forecasted:" -ForegroundColor Yellow
    Write-Host "  Total Cost:      `$$([math]::Round($ForecastedCost, 2))" -ForegroundColor White
    Write-Host "  Per User:        `$$([math]::Round($costPerUser, 2))" -ForegroundColor Green
    Write-Host ""
    $costs += $costPerUser
}

if ($MonthToDateCost -gt 0) {
    # Calculate daily average and project to monthly
    $daysInMonth = (Get-Date).Day
    $dailyAverage = $MonthToDateCost / $daysInMonth
    $projectedMonthly = $dailyAverage * 30
    $costPerUser = [math]::Round($projectedMonthly / $UserCount, 4)
    
    Write-Host "Month-to-Date (Projected):" -ForegroundColor Yellow
    Write-Host "  MTD Cost:        `$$([math]::Round($MonthToDateCost, 2))" -ForegroundColor White
    Write-Host "  Projected Month: `$$([math]::Round($projectedMonthly, 2))" -ForegroundColor White
    Write-Host "  Per User:        `$$([math]::Round($costPerUser, 2))" -ForegroundColor Green
    Write-Host ""
    $costs += $costPerUser
}

if ($costs.Count -gt 0) {
    $avgCostPerUser = [math]::Round(($costs | Measure-Object -Average).Average, 2)
    Write-Host "Average Per-User Cost: `$$avgCostPerUser" -ForegroundColor Cyan
    Write-Host ""
}

Write-Host "=== Cost Breakdown from AWS Billing ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Based on your AWS billing screenshot:" -ForegroundColor Yellow
Write-Host "  EC2 - Other:              `$84.19 (59%)" -ForegroundColor White
Write-Host "  RDS:                      `$43.38 (30%)" -ForegroundColor White
Write-Host "  VPC:                      `$10.94 (8%)" -ForegroundColor White
Write-Host "  Secrets Manager:          `$0.72 (0.5%)" -ForegroundColor White
Write-Host "  S3:                       `$0.06 (0.04%)" -ForegroundColor White
Write-Host "  Others:                   `$3.65 (2.5%)" -ForegroundColor White
Write-Host "  ──────────────────────────────────────" -ForegroundColor Gray
Write-Host "  Total:                    `$142.93" -ForegroundColor Green
Write-Host ""

Write-Host "=== Key Insights ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. EC2 costs (`$84.19) are likely NAT Gateway + data transfer" -ForegroundColor Yellow
Write-Host "   - NAT Gateway: `$32/month base + `$0.045/GB data transfer" -ForegroundColor White
Write-Host "   - This is your biggest cost driver" -ForegroundColor White
Write-Host ""
Write-Host "2. RDS costs (`$43.38) are database instance + storage" -ForegroundColor Yellow
Write-Host "   - Instance: ~`$15-20/month (t3.micro running 24/7)" -ForegroundColor White
Write-Host "   - Storage: ~`$0.115/GB/month" -ForegroundColor White
Write-Host ""
Write-Host "3. Most costs are FIXED and don't scale with users" -ForegroundColor Green
Write-Host "   - NAT Gateway: Fixed `$32/month" -ForegroundColor White
Write-Host "   - RDS Instance: Fixed ~`$15-20/month" -ForegroundColor White
Write-Host "   - Only Lambda/API Gateway scale with usage" -ForegroundColor White
Write-Host ""
Write-Host "4. Per-user cost DECREASES as you add more users" -ForegroundColor Green
Write-Host "   - Fixed costs spread across more users" -ForegroundColor White
Write-Host "   - Variable costs grow slowly" -ForegroundColor White
Write-Host ""
