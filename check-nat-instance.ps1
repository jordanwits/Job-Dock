# Check NAT Instance status for production stack
# This will help identify if the NAT instance is running

Write-Host "Checking NAT Instance status for JobDockStack-prod..." -ForegroundColor Cyan
Write-Host ""

# Get the NAT instance ID from CloudFormation outputs
$stackName = "JobDockStack-prod"
$output = aws cloudformation describe-stacks --stack-name $stackName --query "Stacks[0].Outputs[?OutputKey=='NatInstanceId'].OutputValue" --output text

if ($output) {
    Write-Host "Found NAT Instance ID: $output" -ForegroundColor Green
    Write-Host ""
    
    # Check instance status
    Write-Host "Checking instance status..." -ForegroundColor Yellow
    aws ec2 describe-instances --instance-ids $output --query "Reservations[0].Instances[0].{State:State.Name,InstanceId:InstanceId,InstanceType:InstanceType,PublicIp:PublicIpAddress,PrivateIp:PrivateIpAddress}" --output table
    
    Write-Host ""
    Write-Host "If the State is 'stopped', you need to start it:" -ForegroundColor Yellow
    Write-Host "aws ec2 start-instances --instance-ids $output" -ForegroundColor White
} else {
    Write-Host "Could not find NAT Instance ID in stack outputs." -ForegroundColor Red
    Write-Host "Trying to find it manually..." -ForegroundColor Yellow
    
    # Try to find NAT instance by tags
    aws ec2 describe-instances --filters "Name=tag:Name,Values=*NAT*" "Name=tag:aws:cloudformation:stack-name,Values=JobDockStack-prod" --query "Reservations[*].Instances[*].{InstanceId:InstanceId,State:State.Name,Name:Tags[?Key=='Name'].Value|[0]}" --output table
}
