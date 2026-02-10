# Check RDS Costs and Configuration
# Investigate why RDS costs increased 999%+

Write-Host "=== RDS Cost Investigation ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "Checking RDS instance details..." -ForegroundColor Yellow
Write-Host ""

# Get RDS instance details
$rdsInstances = aws rds describe-db-instances `
    --query "DBInstances[*].[DBInstanceIdentifier,DBInstanceClass,DBInstanceStatus,Engine,AllocatedStorage,StorageType,BackupRetentionPeriod,MultiAZ,PubliclyAccessible]" `
    --output table `
    --region us-east-1

if ($rdsInstances) {
    Write-Host $rdsInstances
} else {
    Write-Host "No RDS instances found" -ForegroundColor Gray
}

Write-Host ""
Write-Host "=== Cost Breakdown Analysis ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "RDS t3.micro costs typically include:" -ForegroundColor Yellow
Write-Host "1. Instance Hours: ~`$0.017/hour = ~`$12.24/month (24/7)" -ForegroundColor White
Write-Host "2. Storage (GB): ~`$0.115/GB/month" -ForegroundColor White
Write-Host "3. Backup Storage: ~`$0.095/GB/month (if backups enabled)" -ForegroundColor White
Write-Host "4. I/O Requests: Minimal for t3.micro" -ForegroundColor White
Write-Host ""

Write-Host "=== Why 999%+ Increase? ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Possible causes:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. NEW SERVICE (Most Likely)" -ForegroundColor Red
Write-Host "   - RDS was created in December/January" -ForegroundColor White
Write-Host "   - Before: `$0/month (no RDS)" -ForegroundColor White
Write-Host "   - After: ~`$15-20/month (RDS running)" -ForegroundColor White
Write-Host "   - This shows as 999%+ increase (from `$0 to `$17.61)" -ForegroundColor White
Write-Host "   - This is NORMAL for a new service!" -ForegroundColor Green
Write-Host ""
Write-Host "2. Storage Growth" -ForegroundColor Yellow
Write-Host "   - Database storage accumulating over time" -ForegroundColor White
Write-Host "   - Check: AllocatedStorage vs UsedStorage" -ForegroundColor White
Write-Host ""
Write-Host "3. Backup Storage" -ForegroundColor Yellow
Write-Host "   - Automated backups accumulating" -ForegroundColor White
Write-Host "   - Current retention: 1 day (should be minimal)" -ForegroundColor White
Write-Host ""
Write-Host "4. Multi-AZ (Unlikely)" -ForegroundColor Yellow
Write-Host "   - Multi-AZ doubles the cost" -ForegroundColor White
Write-Host "   - Check if MultiAZ is enabled" -ForegroundColor White
Write-Host ""

Write-Host "=== Checking Current Month RDS Costs ===" -ForegroundColor Cyan
Write-Host ""

$startDate = (Get-Date -Format "yyyy-MM-01")
$endDate = (Get-Date -Format "yyyy-MM-dd")

aws ce get-cost-and-usage `
    --time-period Start=$startDate,End=$endDate `
    --granularity DAILY `
    --metrics "UnblendedCost" `
    --filter file://<(echo '{"Dimensions":{"Key":"SERVICE","Values":["Amazon Relational Database Service"]}}') `
    --query "ResultsByTime[*].[TimePeriod.Start,Metrics.UnblendedCost.Amount]" `
    --output table `
    --region us-east-1 2>$null

if ($LASTEXITCODE -ne 0) {
    Write-Host "Could not fetch detailed cost data. Check AWS Console > Cost Explorer" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Recommendations ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "If RDS is NEW (created in Dec/Jan):" -ForegroundColor Yellow
Write-Host "- This is EXPECTED and NORMAL" -ForegroundColor Green
Write-Host "- The 999%+ is misleading - it's comparing `$0 to `$17.61" -ForegroundColor White
Write-Host "- `$15-20/month is normal for RDS t3.micro" -ForegroundColor Green
Write-Host ""
Write-Host "To optimize RDS costs:" -ForegroundColor Yellow
Write-Host "1. Check storage size - delete unused data if possible" -ForegroundColor White
Write-Host "2. Verify backup retention is 1 day (not longer)" -ForegroundColor White
Write-Host "3. Ensure Multi-AZ is disabled (for testing)" -ForegroundColor White
Write-Host "4. Consider stopping RDS when not testing (saves compute, but not storage)" -ForegroundColor White
Write-Host ""
Write-Host "Note: Stopping RDS still charges for storage (~`$1-2/month per 20GB)" -ForegroundColor Yellow
Write-Host ""
