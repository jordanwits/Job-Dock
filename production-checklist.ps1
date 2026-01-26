# Production Readiness Checklist for AWS
# Run each section as you prepare for launch

Write-Host "=== JobDock Production Readiness Checklist ===" -ForegroundColor Cyan

Write-Host "`n[ ] 1. BILLING & COST MANAGEMENT" -ForegroundColor Yellow
Write-Host "    - Set up billing alerts (>$50, >$100, >$200)"
Write-Host "    - Create monthly budget in AWS Console"
Write-Host "    - Enable Cost Anomaly Detection"
Write-Host "    - Add backup payment method"

Write-Host "`n[ ] 2. MONITORING & ALERTS" -ForegroundColor Yellow
Write-Host "    - CloudWatch alarms for Lambda errors (>10 in 5min)"
Write-Host "    - RDS CPU/Memory alerts (>80%)"
Write-Host "    - API Gateway 4xx/5xx error alerts"
Write-Host "    - Database connection count alert"

Write-Host "`n[ ] 3. BACKUP & DISASTER RECOVERY" -ForegroundColor Yellow
Write-Host "    - Verify RDS automated backups enabled (you have 1 day retention)"
Write-Host "    - Test database restore process"
Write-Host "    - Document recovery procedures"
Write-Host "    - Enable versioning on S3 buckets (done for frontend)"

Write-Host "`n[ ] 4. SECURITY HARDENING" -ForegroundColor Yellow
Write-Host "    - Enable AWS CloudTrail for audit logs"
Write-Host "    - Set up AWS Config for compliance"
Write-Host "    - Review IAM roles/permissions (principle of least privilege)"
Write-Host "    - Enable MFA on root account"
Write-Host "    - Rotate database credentials regularly"

Write-Host "`n[ ] 5. PERFORMANCE & SCALING" -ForegroundColor Yellow
Write-Host "    - Set Lambda reserved concurrency if needed"
Write-Host "    - Review API Gateway throttling limits (currently 1000 rps)"
Write-Host "    - Monitor RDS connection pool usage"
Write-Host "    - Consider RDS read replica for scaling (later)"

Write-Host "`n[ ] 6. COST OPTIMIZATION" -ForegroundColor Yellow
Write-Host "    - Review CloudWatch Logs retention (currently 1 week - good)"
Write-Host "    - Set up S3 lifecycle policies for old files"
Write-Host "    - Consider removing NAT Gateway (if not using external APIs)"
Write-Host "    - Use AWS Compute Optimizer recommendations"

Write-Host "`n=== Quick Actions ===" -ForegroundColor Green
Write-Host "Run: .\check-aws-costs.ps1  # Check current spend"
Write-Host "Visit: https://console.aws.amazon.com/billing/home#/budgets  # Set budget"
Write-Host "Visit: https://console.aws.amazon.com/cloudwatch/home  # Set up alarms"

Write-Host "`n=== Estimated Costs ===" -ForegroundColor Cyan
Write-Host "Month 1-3 (low traffic): `$50-80/month"
Write-Host "Month 4-6 (growing): `$100-200/month"
Write-Host "Scale (1000 users): `$300-500/month"
Write-Host ""
Write-Host "Note: Costs scale gradually with actual usage" -ForegroundColor Gray
