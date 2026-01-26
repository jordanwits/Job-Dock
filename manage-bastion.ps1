# Manage JobDock Bastion Host
# Bastion was used for database migrations but is no longer needed in production

Write-Host "=== JobDock Bastion Host Management ===" -ForegroundColor Cyan

# Get bastion instance
Write-Host "`nSearching for bastion instance..." -ForegroundColor Yellow
$instances = aws ec2 describe-instances `
    --filters "Name=tag:Name,Values=*bastion*" "Name=instance-state-name,Values=running,stopped" `
    --query "Reservations[*].Instances[*].[InstanceId,State.Name,InstanceType,PublicIpAddress,LaunchTime,Tags[?Key=='Name'].Value|[0]]" `
    --output text `
    --region us-east-1

if (-not $instances) {
    Write-Host "No bastion instances found." -ForegroundColor Gray
    Write-Host "The bastion may have already been terminated." -ForegroundColor Gray
    exit 0
}

Write-Host "`n=== Found Bastion Instance ===" -ForegroundColor Green
$lines = $instances -split "`n"
foreach ($line in $lines) {
    $parts = $line -split "`t"
    $instanceId = $parts[0]
    $state = $parts[1]
    $type = $parts[2]
    $publicIp = $parts[3]
    $launchTime = $parts[4]
    $name = $parts[5]
    
    Write-Host "Instance ID: $instanceId" -ForegroundColor White
    Write-Host "State: $state" -ForegroundColor $(if ($state -eq "running") { "Yellow" } else { "Gray" })
    Write-Host "Type: $type" -ForegroundColor White
    Write-Host "Public IP: $publicIp" -ForegroundColor White
    Write-Host "Name: $name" -ForegroundColor White
}

Write-Host "`n=== Cost Information ===" -ForegroundColor Cyan
Write-Host "Running (t3.micro): ~`$7-10/month" -ForegroundColor Yellow
Write-Host "Stopped: ~`$0.80/month (EBS storage only)" -ForegroundColor Gray
Write-Host "Terminated: `$0/month" -ForegroundColor Green

Write-Host "`n=== Why You Probably Don't Need It ===" -ForegroundColor Cyan
Write-Host "✓ You have a Migration Lambda function for running migrations"
Write-Host "✓ Your production database is already set up"
Write-Host "✓ You can run future migrations via Lambda"
Write-Host ""
Write-Host "The bastion was only needed for initial setup and troubleshooting."

Write-Host "`n=== Options ===" -ForegroundColor Yellow
Write-Host "1. STOP the bastion (saves cost, can restart later)"
Write-Host "2. TERMINATE the bastion (completely remove, saves most cost)"
Write-Host "3. KEEP running (useful for database troubleshooting)"
Write-Host ""

$choice = Read-Host "What would you like to do? (1=Stop, 2=Terminate, 3=Keep, or press Enter to cancel)"

switch ($choice) {
    "1" {
        Write-Host "`nStopping bastion instance..." -ForegroundColor Yellow
        aws ec2 stop-instances --instance-ids $instanceId --region us-east-1
        Write-Host "✓ Bastion stopped. Cost reduced to ~`$0.80/month for EBS storage." -ForegroundColor Green
        Write-Host ""
        Write-Host "To restart later:" -ForegroundColor Cyan
        Write-Host "  aws ec2 start-instances --instance-ids $instanceId --region us-east-1"
        Write-Host "  (Note: Public IP will change after restart)"
    }
    "2" {
        Write-Host "`nWARNING: This will permanently delete the bastion instance!" -ForegroundColor Red
        $confirm = Read-Host "Are you sure? Type 'yes' to confirm"
        if ($confirm -eq "yes") {
            Write-Host "`nTerminating bastion instance..." -ForegroundColor Yellow
            aws ec2 terminate-instances --instance-ids $instanceId --region us-east-1
            Write-Host "✓ Bastion terminated. No more costs!" -ForegroundColor Green
            Write-Host ""
            Write-Host "Note: If you need to access the database in the future, you can:" -ForegroundColor Cyan
            Write-Host "  1. Use the Migration Lambda for migrations"
            Write-Host "  2. Use AWS Systems Manager Session Manager"
            Write-Host "  3. Create a new temporary bastion when needed"
        } else {
            Write-Host "Cancelled." -ForegroundColor Gray
        }
    }
    "3" {
        Write-Host "`nKeeping bastion running." -ForegroundColor Gray
        Write-Host "Cost: ~`$7-10/month" -ForegroundColor Yellow
    }
    default {
        Write-Host "`nNo changes made." -ForegroundColor Gray
    }
}

Write-Host "`n=== Alternative: Use Migration Lambda ===" -ForegroundColor Cyan
Write-Host "To run migrations without bastion, use:"
Write-Host "  .\deploy-migration.ps1"
Write-Host ""
Write-Host "This invokes the Migration Lambda function already deployed in your stack."
