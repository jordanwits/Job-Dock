# Delete old NAT instance routes from CloudFormation stack
# This will allow the NAT Gateway routes to be created

Write-Host "Deleting old NAT instance route resources from CloudFormation..." -ForegroundColor Cyan
Write-Host ""

$stackName = "JobDockStack-prod"

# Get the logical resource IDs for the old routes
$routeResources = @(
    "VPCPrivateSubnetNatRoute0",
    "VPCPrivateSubnetNatRoute1"
)

foreach ($resourceId in $routeResources) {
    Write-Host "Attempting to delete resource: $resourceId" -ForegroundColor Yellow
    
    # Check if resource exists
    $resource = aws cloudformation describe-stack-resources --stack-name $stackName --logical-resource-id $resourceId --query "StackResources[0]" --output json 2>$null
    
    if ($resource -and $resource -ne "null") {
        Write-Host "Found resource: $resourceId" -ForegroundColor Green
        
        # Delete the route resource from CloudFormation
        Write-Host "Deleting route resource from CloudFormation..." -ForegroundColor Yellow
        aws cloudformation delete-stack-resource --stack-name $stackName --logical-resource-id $resourceId --no-retain-resources
        
        Write-Host "Deleted: $resourceId" -ForegroundColor Green
    } else {
        Write-Host "Resource $resourceId not found (may already be deleted)" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "Waiting for stack update to complete..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

Write-Host ""
Write-Host "Now you can redeploy with: cd infrastructure; npm run deploy:prod" -ForegroundColor Green
