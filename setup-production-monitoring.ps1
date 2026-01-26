# Setup production monitoring and alerts for JobDock
# Run this to configure CloudWatch alarms

param(
    [Parameter(Mandatory=$false)]
    [string]$Email = "your-email@example.com",
    
    [Parameter(Mandatory=$false)]
    [string]$Environment = "prod"
)

Write-Host "=== Setting Up Production Monitoring ===" -ForegroundColor Cyan
Write-Host "Environment: $Environment" -ForegroundColor Gray
Write-Host "Alert Email: $Email" -ForegroundColor Gray

# Get stack outputs
Write-Host "`nFetching stack information..." -ForegroundColor Yellow
$stackName = "JobDockStack-$Environment"

try {
    $outputs = aws cloudformation describe-stacks --stack-name $stackName --query "Stacks[0].Outputs" | ConvertFrom-Json
    
    $apiName = ($outputs | Where-Object { $_.OutputKey -eq "ApiUrl" }).OutputValue -replace "https://", "" -replace "/.*", ""
    $dbIdentifier = ($outputs | Where-Object { $_.OutputKey -eq "DatabaseEndpoint" }).OutputValue -replace "\..*", ""
    
    Write-Host "✓ Found API: $apiName" -ForegroundColor Green
    Write-Host "✓ Found DB: $dbIdentifier" -ForegroundColor Green
} catch {
    Write-Host "✗ Error fetching stack info. Make sure stack is deployed." -ForegroundColor Red
    exit 1
}

# Create SNS topic for alerts
Write-Host "`nCreating SNS topic for alerts..." -ForegroundColor Yellow
$topicArn = aws sns create-topic --name "jobdock-$Environment-alerts" --query "TopicArn" --output text

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Created SNS topic: $topicArn" -ForegroundColor Green
    
    # Subscribe email
    Write-Host "Subscribing email: $Email..." -ForegroundColor Yellow
    aws sns subscribe --topic-arn $topicArn --protocol email --notification-endpoint $Email
    Write-Host "✓ Check your email to confirm subscription!" -ForegroundColor Green
} else {
    Write-Host "Topic may already exist, continuing..." -ForegroundColor Gray
    $topicArn = aws sns list-topics --query "Topics[?contains(TopicArn, 'jobdock-$Environment-alerts')].TopicArn" --output text
}

# Create CloudWatch Alarms
Write-Host "`nCreating CloudWatch alarms..." -ForegroundColor Yellow

# 1. API Gateway 5xx errors
Write-Host "  - API 5xx errors alarm..."
aws cloudwatch put-metric-alarm `
    --alarm-name "jobdock-$Environment-api-5xx-errors" `
    --alarm-description "Alert when API returns 5xx errors" `
    --metric-name "5XXError" `
    --namespace "AWS/ApiGateway" `
    --statistic Sum `
    --period 300 `
    --evaluation-periods 1 `
    --threshold 10 `
    --comparison-operator GreaterThanThreshold `
    --dimensions Name=ApiName,Value="jobdock-api-$Environment" `
    --alarm-actions $topicArn

# 2. Lambda errors
Write-Host "  - Lambda errors alarm..."
aws cloudwatch put-metric-alarm `
    --alarm-name "jobdock-$Environment-lambda-errors" `
    --alarm-description "Alert when Lambda functions error" `
    --metric-name "Errors" `
    --namespace "AWS/Lambda" `
    --statistic Sum `
    --period 300 `
    --evaluation-periods 1 `
    --threshold 10 `
    --comparison-operator GreaterThanThreshold `
    --alarm-actions $topicArn

# 3. RDS CPU utilization
Write-Host "  - RDS CPU alarm..."
aws cloudwatch put-metric-alarm `
    --alarm-name "jobdock-$Environment-rds-cpu-high" `
    --alarm-description "Alert when RDS CPU is high" `
    --metric-name "CPUUtilization" `
    --namespace "AWS/RDS" `
    --statistic Average `
    --period 300 `
    --evaluation-periods 2 `
    --threshold 80 `
    --comparison-operator GreaterThanThreshold `
    --alarm-actions $topicArn

# 4. RDS free storage space
Write-Host "  - RDS storage alarm..."
aws cloudwatch put-metric-alarm `
    --alarm-name "jobdock-$Environment-rds-storage-low" `
    --alarm-description "Alert when RDS storage is low" `
    --metric-name "FreeStorageSpace" `
    --namespace "AWS/RDS" `
    --statistic Average `
    --period 300 `
    --evaluation-periods 1 `
    --threshold 2000000000 `
    --comparison-operator LessThanThreshold `
    --alarm-actions $topicArn

# 5. RDS database connections
Write-Host "  - RDS connections alarm..."
aws cloudwatch put-metric-alarm `
    --alarm-name "jobdock-$Environment-rds-connections-high" `
    --alarm-description "Alert when RDS connections are high" `
    --metric-name "DatabaseConnections" `
    --namespace "AWS/RDS" `
    --statistic Average `
    --period 300 `
    --evaluation-periods 2 `
    --threshold 80 `
    --comparison-operator GreaterThanThreshold `
    --alarm-actions $topicArn

Write-Host "`n✓ Monitoring setup complete!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "1. Check your email ($Email) and confirm SNS subscription"
Write-Host "2. Visit CloudWatch console to view alarms"
Write-Host "3. Test alarms by triggering them intentionally"
Write-Host "`nConsole: https://console.aws.amazon.com/cloudwatch/home#alarmsV2:" -ForegroundColor Gray
