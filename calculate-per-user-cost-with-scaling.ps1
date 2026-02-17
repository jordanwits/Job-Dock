# Calculate Per-User Cost Accounting for Cost Growth
# Accounts for how costs increase as user count grows

param(
    [Parameter(Mandatory=$false)]
    [int]$UserCount = 0
)

Write-Host "=== Per-User Cost Analysis (With Cost Scaling) ===" -ForegroundColor Cyan
Write-Host ""

# Base costs from AWS billing screenshot (current state with few users)
$baseMonthlyCost = 142.93
$baseForecastedCost = 88.56

Write-Host "Current Costs (Few Users):" -ForegroundColor Yellow
Write-Host "  Last Month Total: `$$baseMonthlyCost" -ForegroundColor White
Write-Host "  Forecasted: `$$baseForecastedCost" -ForegroundColor White
Write-Host ""

# Fixed costs (don't change with users)
$fixedCosts = @{}
$fixedCosts["NAT Gateway Base"] = 32.00
$fixedCosts["RDS Instance"] = 18.00
$fixedCosts["VPC/Networking"] = 2.00
$fixedCosts["Secrets Manager"] = 0.72
$fixedCosts["S3 Storage (minimal)"] = 0.50

$totalFixed = 0
foreach ($value in $fixedCosts.Values) {
    $totalFixed += $value
}

Write-Host "=== Fixed Costs (Don't Scale with Users) ===" -ForegroundColor Cyan
Write-Host ""
foreach ($key in $fixedCosts.Keys) {
    $value = $fixedCosts[$key]
    $rounded = [math]::Round($value, 2)
    Write-Host "$key : `$$rounded" -ForegroundColor White
}
Write-Host "Total Fixed Costs: `$$([math]::Round($totalFixed, 2))" -ForegroundColor Green
Write-Host ""

# Variable costs that scale with users
function CalculateVariableCosts {
    param([int]$users)
    
    # Estimate API calls per user per month
    # Typical SaaS app: 1000-5000 API calls per user per month
    $apiCallsPerUser = 2000
    
    # Lambda costs
    $lambdaInvocations = $users * $apiCallsPerUser
    $lambdaCost = ($lambdaInvocations / 1000000) * 0.20
    
    # API Gateway costs
    $apiGatewayCost = ($lambdaInvocations / 1000000) * 3.50
    
    # NAT Gateway data transfer (each API call generates ~5KB data transfer)
    $dataTransferGB = ($lambdaInvocations * 5) / (1024 * 1024)
    $natDataTransferCost = $dataTransferGB * 0.045
    
    # RDS storage (grows slowly - ~1MB per user)
    $storageGB = ($users * 1) / 1024
    $rdsStorageCost = $storageGB * 0.115
    
    # CloudWatch Logs (~100KB per user per month)
    $logsGB = ($users * 100) / (1024 * 1024)
    $cloudWatchCost = $logsGB * 0.50
    
    $result = @{}
    $result["Lambda"] = [math]::Round($lambdaCost, 2)
    $result["APIGateway"] = [math]::Round($apiGatewayCost, 2)
    $result["NATDataTransfer"] = [math]::Round($natDataTransferCost, 2)
    $result["RDSStorage"] = [math]::Round($rdsStorageCost, 2)
    $result["CloudWatch"] = [math]::Round($cloudWatchCost, 2)
    $result["Total"] = [math]::Round($lambdaCost + $apiGatewayCost + $natDataTransferCost + $rdsStorageCost + $cloudWatchCost, 2)
    
    return $result
}

# Calculate costs for different user counts
$userCounts = @(10, 50, 100, 500, 1000)

Write-Host "=== Cost Projections by User Count ===" -ForegroundColor Cyan
Write-Host ""

$results = @()

foreach ($count in $userCounts) {
    $variable = CalculateVariableCosts -users $count
    $totalCost = $totalFixed + $variable["Total"]
    $costPerUser = [math]::Round($totalCost / $count, 4)
    
    $result = @{}
    $result["Users"] = $count
    $result["Fixed"] = $totalFixed
    $result["Variable"] = $variable["Total"]
    $result["Total"] = $totalCost
    $result["PerUser"] = $costPerUser
    $result["VariableBreakdown"] = $variable
    
    $results += $result
}

# Display results
foreach ($result in $results) {
    Write-Host "$($result["Users"]) Users:" -ForegroundColor Yellow
    Write-Host "  Fixed Costs:        `$$([math]::Round($result["Fixed"], 2))" -ForegroundColor White
    Write-Host "  Variable Costs:     `$$([math]::Round($result["Variable"], 2))" -ForegroundColor White
    Write-Host "    - Lambda:         `$$([math]::Round($result["VariableBreakdown"]["Lambda"], 2))" -ForegroundColor Gray
    Write-Host "    - API Gateway:    `$$([math]::Round($result["VariableBreakdown"]["APIGateway"], 2))" -ForegroundColor Gray
    Write-Host "    - NAT Data:       `$$([math]::Round($result["VariableBreakdown"]["NATDataTransfer"], 2))" -ForegroundColor Gray
    Write-Host "    - RDS Storage:    `$$([math]::Round($result["VariableBreakdown"]["RDSStorage"], 2))" -ForegroundColor Gray
    Write-Host "    - CloudWatch:     `$$([math]::Round($result["VariableBreakdown"]["CloudWatch"], 2))" -ForegroundColor Gray
    Write-Host "  Total Monthly Cost: `$$([math]::Round($result["Total"], 2))" -ForegroundColor Green
    Write-Host "  Per User Cost:      `$$([math]::Round($result["PerUser"], 2))" -ForegroundColor Cyan
    Write-Host ""
}

# Highlight specific user counts if requested
if ($UserCount -gt 0) {
    $variable = CalculateVariableCosts -users $UserCount
    $totalCost = $totalFixed + $variable["Total"]
    $costPerUser = [math]::Round($totalCost / $UserCount, 4)
    
    Write-Host "=== Detailed Analysis for $UserCount Users ===" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Fixed Costs:          `$$([math]::Round($totalFixed, 2))" -ForegroundColor White
    Write-Host "Variable Costs:       `$$([math]::Round($variable["Total"], 2))" -ForegroundColor White
    Write-Host "  - Lambda:           `$$([math]::Round($variable["Lambda"], 2))" -ForegroundColor Gray
    Write-Host "  - API Gateway:      `$$([math]::Round($variable["APIGateway"], 2))" -ForegroundColor Gray
    Write-Host "  - NAT Data Transfer:`$$([math]::Round($variable["NATDataTransfer"], 2))" -ForegroundColor Gray
    Write-Host "  - RDS Storage:      `$$([math]::Round($variable["RDSStorage"], 2))" -ForegroundColor Gray
    Write-Host "  - CloudWatch Logs:  `$$([math]::Round($variable["CloudWatch"], 2))" -ForegroundColor Gray
    Write-Host "Total Monthly Cost:   `$$([math]::Round($totalCost, 2))" -ForegroundColor Green
    Write-Host "Per User Cost:         `$$([math]::Round($costPerUser, 2))" -ForegroundColor Cyan
    Write-Host ""
}

Write-Host "=== Key Insights ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. COSTS DO INCREASE with more users" -ForegroundColor Yellow
Write-Host "   - But variable costs grow slowly (mostly API calls)" -ForegroundColor White
Write-Host "   - Fixed costs (`$$([math]::Round($totalFixed, 2))/month) stay the same" -ForegroundColor White
Write-Host ""
Write-Host "2. PER-USER COST DECREASES as you scale" -ForegroundColor Green
Write-Host "   - Fixed costs spread across more users" -ForegroundColor White
Write-Host "   - Variable costs are relatively small per user" -ForegroundColor White
Write-Host ""
Write-Host "3. BIGGEST COST DRIVERS:" -ForegroundColor Yellow
Write-Host "   - NAT Gateway base cost (`$32/month) - FIXED" -ForegroundColor White
Write-Host "   - RDS Instance (`$18/month) - FIXED" -ForegroundColor White
Write-Host "   - NAT Data Transfer - GROWS with usage" -ForegroundColor White
Write-Host ""

# Comparison table
Write-Host "=== Cost Comparison ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "User Count | Total Cost | Per User | vs Current" -ForegroundColor Yellow
foreach ($result in $results) {
    $vsCurrent = [math]::Round($result["Total"] - $baseForecastedCost, 2)
    $vsCurrentStr = if ($vsCurrent -ge 0) { "+`$$vsCurrent" } else { "`$$vsCurrent" }
    $usersStr = $result["Users"].ToString().PadLeft(9)
    $totalStr = [math]::Round($result["Total"], 2).ToString().PadLeft(10)
    $perUserStr = [math]::Round($result["PerUser"], 2).ToString().PadLeft(8)
    Write-Host "$usersStr | `$$totalStr | `$$perUserStr | $vsCurrentStr" -ForegroundColor White
}
Write-Host ""
