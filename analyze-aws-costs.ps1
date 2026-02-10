# Comprehensive AWS Cost Analysis for JobDock
# Identifies running resources and cost optimization opportunities

Write-Host "=== JobDock AWS Cost Analysis ===" -ForegroundColor Cyan
Write-Host ""

# Check running EC2 instances
Write-Host "1. Checking EC2 Instances..." -ForegroundColor Yellow
$instances = aws ec2 describe-instances `
    --filters "Name=instance-state-name,Values=running,stopped" `
    --query "Reservations[*].Instances[*].[InstanceId,State.Name,InstanceType,Tags[?Key=='Name'].Value|[0],LaunchTime]" `
    --output table `
    --region us-east-1

if ($instances) {
    Write-Host $instances
} else {
    Write-Host "No EC2 instances found" -ForegroundColor Gray
}

Write-Host ""

# Check NAT Gateways
Write-Host "2. Checking NAT Gateways..." -ForegroundColor Yellow
$natGateways = aws ec2 describe-nat-gateways `
    --filter "Name=state,Values=available,pending" `
    --query "NatGateways[*].[NatGatewayId,State,SubnetId,VpcId]" `
    --output table `
    --region us-east-1

if ($natGateways) {
    Write-Host $natGateways
    Write-Host "⚠️  NAT Gateway costs: ~`$32/month per gateway + data transfer" -ForegroundColor Yellow
} else {
    Write-Host "No NAT Gateways found" -ForegroundColor Gray
}

Write-Host ""

# Check RDS instances
Write-Host "3. Checking RDS Instances..." -ForegroundColor Yellow
$rdsInstances = aws rds describe-db-instances `
    --query "DBInstances[*].[DBInstanceIdentifier,DBInstanceClass,DBInstanceStatus,Engine,AllocatedStorage]" `
    --output table `
    --region us-east-1

if ($rdsInstances) {
    Write-Host $rdsInstances
    Write-Host "⚠️  RDS t3.micro costs: ~`$15-20/month (running 24/7)" -ForegroundColor Yellow
} else {
    Write-Host "No RDS instances found" -ForegroundColor Gray
}

Write-Host ""

# Check current month costs by service
Write-Host "4. Current Month Costs by Service..." -ForegroundColor Yellow
$startDate = (Get-Date -Format "yyyy-MM-01")
$endDate = (Get-Date -Format "yyyy-MM-dd")

aws ce get-cost-and-usage `
    --time-period Start=$startDate,End=$endDate `
    --granularity MONTHLY `
    --metrics "UnblendedCost" `
    --group-by Type=DIMENSION,Key=SERVICE `
    --query "ResultsByTime[0].Groups[*].[Keys[0],Metrics.UnblendedCost.Amount]" `
    --output table `
    --region us-east-1

Write-Host ""

# Cost optimization recommendations
Write-Host "=== Cost Optimization Recommendations ===" -ForegroundColor Green
Write-Host ""

Write-Host "Based on your infrastructure:" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. NAT GATEWAY (~`$32/month + data transfer)" -ForegroundColor Yellow
Write-Host "   Current: Production uses NAT Gateway for reliability" -ForegroundColor White
Write-Host "   Option A: Keep NAT Gateway (recommended for production)" -ForegroundColor Gray
Write-Host "   Option B: Switch to NAT Instance (~`$3/month) - less reliable" -ForegroundColor Gray
Write-Host "   Action: Review if you can optimize data transfer costs" -ForegroundColor White
Write-Host ""

Write-Host "2. RDS DATABASE (~`$15-20/month)" -ForegroundColor Yellow
Write-Host "   Current: t3.micro running 24/7" -ForegroundColor White
Write-Host "   Options:" -ForegroundColor Gray
Write-Host "   - Keep as-is (recommended for production)" -ForegroundColor Gray
Write-Host "   - Consider RDS Proxy to reduce connection overhead" -ForegroundColor Gray
Write-Host "   - Review backup retention (currently 1 day)" -ForegroundColor Gray
Write-Host ""

Write-Host "3. BASTION HOST (~`$7-10/month if running)" -ForegroundColor Yellow
Write-Host "   Check if you still need it for database access" -ForegroundColor White
Write-Host "   If not needed, stop or terminate it:" -ForegroundColor Gray
Write-Host "   .\manage-bastion.ps1" -ForegroundColor White
Write-Host ""

Write-Host "4. LAMBDA FUNCTIONS" -ForegroundColor Yellow
Write-Host "   Current: Multiple functions with 1024MB memory" -ForegroundColor White
Write-Host "   Consider: Reduce memory if functions don't need 1GB" -ForegroundColor Gray
Write-Host "   Memory directly affects cost: 512MB = ~50% cheaper" -ForegroundColor Gray
Write-Host ""

Write-Host "5. VPC DATA TRANSFER" -ForegroundColor Yellow
Write-Host "   NAT Gateway data transfer: `$0.045/GB" -ForegroundColor White
Write-Host "   Review Lambda internet usage (Cognito, external APIs)" -ForegroundColor Gray
Write-Host "   Consider: Connection pooling, caching" -ForegroundColor Gray
Write-Host ""

Write-Host "=== Expected Monthly Costs ===" -ForegroundColor Cyan
Write-Host "NAT Gateway:        ~`$32-40/month" -ForegroundColor White
Write-Host "RDS t3.micro:       ~`$15-20/month" -ForegroundColor White
Write-Host "Lambda (low usage): ~`$1-5/month" -ForegroundColor White
Write-Host "API Gateway:        ~`$1-3/month" -ForegroundColor White
Write-Host "CloudWatch Logs:    ~`$1-2/month" -ForegroundColor White
Write-Host "S3 Storage:         ~`$0.50/month" -ForegroundColor White
Write-Host "Secrets Manager:    ~`$0.40/month" -ForegroundColor White
Write-Host "VPC (data transfer): Variable" -ForegroundColor White
Write-Host "--------------------------------" -ForegroundColor Gray
Write-Host "Total Expected:     ~`$50-70/month" -ForegroundColor Yellow
Write-Host ""
Write-Host "Your current spend: `$142.93 (Jan) / `$157.72 forecast (Feb)" -ForegroundColor Red
Write-Host ""
Write-Host "⚠️  The difference suggests:" -ForegroundColor Yellow
Write-Host "   - High data transfer through NAT Gateway" -ForegroundColor White
Write-Host "   - Possible unused resources (bastion, old instances)" -ForegroundColor White
Write-Host "   - Lambda cold starts/invocations" -ForegroundColor White
Write-Host ""

Write-Host "=== Next Steps ===" -ForegroundColor Green
Write-Host "1. Run: .\manage-bastion.ps1 (check if bastion is running)" -ForegroundColor White
Write-Host "2. Review AWS Cost Explorer for detailed breakdown" -ForegroundColor White
Write-Host "3. Check CloudWatch metrics for Lambda invocations" -ForegroundColor White
Write-Host "4. Review NAT Gateway data transfer in VPC dashboard" -ForegroundColor White
Write-Host ""
