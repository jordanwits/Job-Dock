# Delete old NAT instance routes using AWS CLI
# This will remove them from CloudFormation stack

Write-Host "Deleting old NAT instance route resources from CloudFormation..." -ForegroundColor Cyan
Write-Host ""

$stackName = "JobDockStack-prod"

# The logical resource IDs for the old routes
$routeResources = @(
    "VPCPrivateSubnetNatRoute0",
    "VPCPrivateSubnetNatRoute1"
)

Write-Host "Attempting to delete route resources from stack: $stackName" -ForegroundColor Yellow
Write-Host ""

foreach ($resourceId in $routeResources) {
    Write-Host "Processing: $resourceId" -ForegroundColor Yellow
    
    # Check if resource exists in the stack
    $resource = aws cloudformation describe-stack-resources `
        --stack-name $stackName `
        --logical-resource-id $resourceId `
        --query "StackResources[0].PhysicalResourceId" `
        --output text 2>$null
    
    if ($resource -and $resource -ne "None" -and $resource -ne "") {
        Write-Host "  Found resource: $resource" -ForegroundColor Green
        
        # Extract route table ID and destination from physical ID
        # Format is: rtb-xxxxx|0.0.0.0/0
        $parts = $resource -split '\|'
        $routeTableId = $parts[0]
        $destination = $parts[1]
        
        Write-Host "  Route Table: $routeTableId" -ForegroundColor Gray
        Write-Host "  Destination: $destination" -ForegroundColor Gray
        
        # Delete the route from the route table
        Write-Host "  Deleting route from route table..." -ForegroundColor Yellow
        aws ec2 delete-route --route-table-id $routeTableId --destination-cidr-block $destination
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✓ Route deleted successfully" -ForegroundColor Green
        } else {
            Write-Host "  ✗ Failed to delete route" -ForegroundColor Red
        }
    } else {
        Write-Host "  Resource not found (may already be deleted)" -ForegroundColor Gray
    }
    
    Write-Host ""
}

Write-Host "Now deleting CloudFormation resources..." -ForegroundColor Yellow
Write-Host ""

# Delete from CloudFormation stack
foreach ($resourceId in $routeResources) {
    Write-Host "Deleting CloudFormation resource: $resourceId" -ForegroundColor Yellow
    
    # Use AWS CLI to delete the stack resource
    # Note: This requires the resource to be deletable
    aws cloudformation delete-stack-resource `
        --stack-name $stackName `
        --logical-resource-id $resourceId `
        --no-retain-resources 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ CloudFormation resource deletion initiated" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ Resource may need manual deletion from console" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Waiting 30 seconds for stack to update..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

Write-Host ""
Write-Host "✓ Done! You can now redeploy:" -ForegroundColor Green
Write-Host "  cd infrastructure" -ForegroundColor White
Write-Host "  npm run deploy:prod" -ForegroundColor White
