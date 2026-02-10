# Delete old NAT instance routes directly from route tables
# This bypasses CloudFormation and allows us to switch to NAT Gateway

Write-Host "Deleting old NAT instance routes..." -ForegroundColor Cyan
Write-Host ""

# Production private subnet route table IDs (from the route tables screenshot)
$routeTable1 = "rtb-0b93231bb4f304666"  # privateSubnet1
$routeTable2 = "rtb-00d38dad26392c85a"  # privateSubnet2

Write-Host "Deleting route from route table 1: $routeTable1" -ForegroundColor Yellow
aws ec2 delete-route --route-table-id $routeTable1 --destination-cidr-block 0.0.0.0/0

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Deleted route from route table 1" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to delete route from route table 1 (may already be deleted)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Deleting route from route table 2: $routeTable2" -ForegroundColor Yellow
aws ec2 delete-route --route-table-id $routeTable2 --destination-cidr-block 0.0.0.0/0

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Deleted route from route table 2" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to delete route from route table 2 (may already be deleted)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Routes deleted! Now you can redeploy:" -ForegroundColor Green
Write-Host "cd infrastructure" -ForegroundColor White
Write-Host "npm run deploy:prod" -ForegroundColor White
