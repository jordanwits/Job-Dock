# Optimize NAT Gateway Data Transfer Costs
# This script helps you reduce NAT Gateway costs by implementing VPC endpoints

Write-Host "=== NAT Gateway Cost Optimization ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "Current Situation:" -ForegroundColor Yellow
Write-Host "- Lambda functions are in VPC private subnet (needed for RDS access)" -ForegroundColor White
Write-Host "- Lambda needs internet access for: Cognito, Secrets Manager, SES, external APIs" -ForegroundColor White
Write-Host "- All this traffic goes through NAT Gateway (~`$32/month + `$0.045/GB)" -ForegroundColor White
Write-Host "- Your NAT Gateway data transfer is costing ~`$50-80/month extra" -ForegroundColor Red
Write-Host ""

Write-Host "Solution: VPC Endpoints" -ForegroundColor Green
Write-Host "- VPC Interface Endpoints for AWS services (Cognito, Secrets Manager, SES)" -ForegroundColor White
Write-Host "- Cost: ~`$7/month per endpoint (~`$21/month total)" -ForegroundColor White
Write-Host "- Benefit: Eliminates NAT Gateway data transfer for AWS services" -ForegroundColor White
Write-Host "- Savings: ~`$20-50/month (depending on usage)" -ForegroundColor Green
Write-Host ""

Write-Host "What Gets Created:" -ForegroundColor Cyan
Write-Host "1. Cognito VPC Endpoint (for authentication)" -ForegroundColor White
Write-Host "2. Secrets Manager VPC Endpoint (for database credentials)" -ForegroundColor White
Write-Host "3. SES VPC Endpoint (for email sending)" -ForegroundColor White
Write-Host "4. S3 Gateway Endpoint (free, already optimized)" -ForegroundColor White
Write-Host ""

Write-Host "Note: External APIs (Resend, Stripe) will still use NAT Gateway" -ForegroundColor Yellow
Write-Host "But AWS service calls (most of your traffic) will bypass NAT Gateway" -ForegroundColor White
Write-Host ""

$deploy = Read-Host "Deploy VPC endpoints now? (y/n)"

if ($deploy -eq "y" -or $deploy -eq "Y") {
    Write-Host "`nDeploying infrastructure changes..." -ForegroundColor Yellow
    Write-Host "This will add VPC endpoints to your production stack." -ForegroundColor White
    Write-Host ""
    
    Set-Location infrastructure
    npm run deploy:prod
    
    Write-Host "`n=== Deployment Complete ===" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Cyan
    Write-Host "1. Monitor your costs over the next few days" -ForegroundColor White
    Write-Host "2. Check AWS Cost Explorer to see NAT Gateway data transfer reduction" -ForegroundColor White
    Write-Host "3. Expected savings: `$20-50/month" -ForegroundColor Green
    Write-Host ""
    Write-Host "To monitor costs:" -ForegroundColor Cyan
    Write-Host "  .\analyze-aws-costs.ps1" -ForegroundColor White
    Write-Host "  Or check AWS Console > Cost Explorer" -ForegroundColor White
} else {
    Write-Host "`nDeployment cancelled." -ForegroundColor Gray
    Write-Host ""
    Write-Host "To deploy manually:" -ForegroundColor Cyan
    Write-Host "  cd infrastructure" -ForegroundColor White
    Write-Host "  npm run deploy:prod" -ForegroundColor White
}

Write-Host "`n=== Additional Cost Optimization Tips ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Review Lambda Memory:" -ForegroundColor Yellow
Write-Host "   Current: 1024MB" -ForegroundColor White
Write-Host "   Consider: Reduce to 512MB if functions don't need 1GB" -ForegroundColor White
Write-Host "   Savings: ~50% on Lambda compute costs" -ForegroundColor Green
Write-Host ""
Write-Host "2. Optimize External API Calls:" -ForegroundColor Yellow
Write-Host "   - Resend (email) and Stripe still use NAT Gateway" -ForegroundColor White
Write-Host "   - Consider caching/batching API calls" -ForegroundColor White
Write-Host "   - Review if all external calls are necessary" -ForegroundColor White
Write-Host ""
Write-Host "3. Monitor CloudWatch Metrics:" -ForegroundColor Yellow
Write-Host "   - Check Lambda invocations and duration" -ForegroundColor White
Write-Host "   - Review NAT Gateway data transfer metrics" -ForegroundColor White
Write-Host "   - Identify high-traffic functions" -ForegroundColor White
Write-Host ""
