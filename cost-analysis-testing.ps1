# Cost Analysis for Testing/Low-User Environment
# Determines if current costs are appropriate for testing use case

Write-Host "=== Cost Analysis: Testing Environment ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "Current Situation:" -ForegroundColor Yellow
Write-Host "- User Base: Testing users only (low traffic)" -ForegroundColor White
Write-Host "- January Cost: `$142.93 (peak, before optimizations)" -ForegroundColor Red
Write-Host "- February MTD: `$14.64 (after optimizations)" -ForegroundColor Green
Write-Host "- Forecast: `$157.72/month (based on old pattern)" -ForegroundColor Yellow
Write-Host ""

Write-Host "=== What You SHOULD Be Paying (Testing Environment) ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "Essential Services (Can't Avoid):" -ForegroundColor Yellow
Write-Host "1. RDS t3.micro:        ~`$15-20/month" -ForegroundColor White
Write-Host "   - Database running 24/7 (necessary)" -ForegroundColor Gray
Write-Host "   - Free tier eligible (first 12 months)" -ForegroundColor Gray
Write-Host ""
Write-Host "2. NAT Gateway:          ~`$32/month base" -ForegroundColor White
Write-Host "   - Needed for Lambda internet access" -ForegroundColor Gray
Write-Host "   - Can be optimized with VPC endpoints" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Lambda Functions:   ~`$1-5/month" -ForegroundColor White
Write-Host "   - Low invocations for testing" -ForegroundColor Gray
Write-Host "   - Current: 1024MB memory (can optimize)" -ForegroundColor Gray
Write-Host ""
Write-Host "4. API Gateway:         ~`$1-3/month" -ForegroundColor White
Write-Host "   - Low request volume" -ForegroundColor Gray
Write-Host ""
Write-Host "5. CloudWatch Logs:    ~`$1-2/month" -ForegroundColor White
Write-Host "   - Log retention: 1 week" -ForegroundColor Gray
Write-Host ""
Write-Host "6. S3 Storage:          ~`$0.50/month" -ForegroundColor White
Write-Host "   - Minimal storage for testing" -ForegroundColor Gray
Write-Host ""
Write-Host "7. Secrets Manager:    ~`$0.40/month" -ForegroundColor White
Write-Host "   - Database credentials" -ForegroundColor Gray
Write-Host ""
Write-Host "8. Cognito:            ~`$0/month" -ForegroundColor White
Write-Host "   - Free for < 50,000 MAU" -ForegroundColor Gray
Write-Host ""
Write-Host "--------------------------------" -ForegroundColor Gray
Write-Host "Expected Total:         ~`$50-65/month" -ForegroundColor Green
Write-Host ""

Write-Host "=== Cost Optimization Opportunities ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. VPC ENDPOINTS (Biggest Savings)" -ForegroundColor Yellow
Write-Host "   Current: NAT Gateway handles all AWS service calls" -ForegroundColor White
Write-Host "   Solution: Add VPC endpoints for Cognito, Secrets Manager, SES" -ForegroundColor White
Write-Host "   Cost: +`$21/month (endpoints)" -ForegroundColor Yellow
Write-Host "   Savings: -`$20-50/month (NAT Gateway data transfer)" -ForegroundColor Green
Write-Host "   Net Savings: ~`$20-30/month" -ForegroundColor Green
Write-Host "   Status: Ready to deploy (code updated)" -ForegroundColor Cyan
Write-Host ""

Write-Host "2. SWITCH TO NAT INSTANCE (For Testing Only)" -ForegroundColor Yellow
Write-Host "   Current: NAT Gateway (`$32/month + data transfer)" -ForegroundColor White
Write-Host "   Alternative: NAT Instance (`$3/month + data transfer)" -ForegroundColor White
Write-Host "   Savings: ~`$29/month base cost" -ForegroundColor Green
Write-Host "   Trade-off: Less reliable, requires management" -ForegroundColor Red
Write-Host "   Recommendation: OK for testing, NOT for production" -ForegroundColor Yellow
Write-Host ""

Write-Host "3. REDUCE LAMBDA MEMORY" -ForegroundColor Yellow
Write-Host "   Current: 1024MB per function" -ForegroundColor White
Write-Host "   Optimize: 512MB (if functions don't need 1GB)" -ForegroundColor White
Write-Host "   Savings: ~50% on Lambda compute (~`$2-5/month)" -ForegroundColor Green
Write-Host ""

Write-Host "4. REDUCE RDS INSTANCE SIZE (If Possible)" -ForegroundColor Yellow
Write-Host "   Current: t3.micro (already smallest free-tier size)" -ForegroundColor White
Write-Host "   Status: Already optimized" -ForegroundColor Green
Write-Host ""

Write-Host "5. STOP UNUSED RESOURCES" -ForegroundColor Yellow
Write-Host "   - Bastion host: Already stopped ✓" -ForegroundColor Green
Write-Host "   - Check for other stopped instances" -ForegroundColor White
Write-Host "   - Review CloudWatch alarms/logs retention" -ForegroundColor White
Write-Host ""

Write-Host "=== Recommended Action Plan ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "For Testing Environment (Low Users):" -ForegroundColor Yellow
Write-Host ""
Write-Host "Option A: Optimize Current Setup (Recommended)" -ForegroundColor Green
Write-Host "  1. Deploy VPC endpoints (saves `$20-30/month)" -ForegroundColor White
Write-Host "  2. Reduce Lambda memory to 512MB (saves `$2-5/month)" -ForegroundColor White
Write-Host "  3. Keep NAT Gateway (reliable for when you scale)" -ForegroundColor White
Write-Host "   Expected Cost: ~`$45-55/month" -ForegroundColor Green
Write-Host ""
Write-Host "Option B: Maximum Savings (Testing Only)" -ForegroundColor Yellow
Write-Host "  1. Switch to NAT Instance (saves `$29/month)" -ForegroundColor White
Write-Host "  2. Deploy VPC endpoints (saves `$20-30/month)" -ForegroundColor White
Write-Host "  3. Reduce Lambda memory (saves `$2-5/month)" -ForegroundColor White
Write-Host "   Expected Cost: ~`$20-30/month" -ForegroundColor Green
Write-Host "   Warning: NAT Instance less reliable - only for testing!" -ForegroundColor Red
Write-Host ""

Write-Host "=== Your February Costs (After Optimizations) ===" -ForegroundColor Cyan
Write-Host "MTD: `$14.64" -ForegroundColor Green
Write-Host "Projected Monthly: ~`$50-60 (if trend continues)" -ForegroundColor Green
Write-Host ""
Write-Host "This is MUCH better than January's $142.93!" -ForegroundColor Green
Write-Host ""

Write-Host "=== Next Steps ===" -ForegroundColor Cyan
Write-Host "1. Deploy VPC endpoints: .\optimize-nat-costs.ps1" -ForegroundColor White
Write-Host "2. Monitor costs for 1 week" -ForegroundColor White
Write-Host "3. If still too high, consider NAT Instance for testing" -ForegroundColor White
Write-Host "4. Review Lambda memory usage and optimize" -ForegroundColor White
Write-Host ""
