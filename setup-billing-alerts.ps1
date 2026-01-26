# Setup AWS billing alerts and budgets
# Run this FIRST to avoid surprise costs

param(
    [Parameter(Mandatory=$true)]
    [string]$Email,
    
    [Parameter(Mandatory=$false)]
    [int]$MonthlyBudget = 100
)

Write-Host "=== Setting Up Billing Alerts ===" -ForegroundColor Cyan
Write-Host "Monthly Budget: `$$MonthlyBudget" -ForegroundColor Gray
Write-Host "Alert Email: $Email" -ForegroundColor Gray

# Get account ID
$accountId = aws sts get-caller-identity --query "Account" --output text

if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Error: Could not get AWS account ID. Check AWS credentials." -ForegroundColor Red
    exit 1
}

Write-Host "✓ Account ID: $accountId" -ForegroundColor Green

# Create SNS topic for billing alerts (must be in us-east-1 for billing)
Write-Host "`nCreating billing alerts SNS topic (us-east-1)..." -ForegroundColor Yellow
$billingTopicArn = aws sns create-topic `
    --name "jobdock-billing-alerts" `
    --region us-east-1 `
    --query "TopicArn" `
    --output text 2>$null

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Created SNS topic: $billingTopicArn" -ForegroundColor Green
} else {
    Write-Host "Topic may already exist, fetching..." -ForegroundColor Gray
    $billingTopicArn = aws sns list-topics `
        --region us-east-1 `
        --query "Topics[?contains(TopicArn, 'jobdock-billing-alerts')].TopicArn" `
        --output text
}

# Subscribe email
Write-Host "Subscribing email to billing alerts..." -ForegroundColor Yellow
aws sns subscribe `
    --topic-arn $billingTopicArn `
    --protocol email `
    --notification-endpoint $Email `
    --region us-east-1

Write-Host "✓ Check your email to confirm subscription!" -ForegroundColor Green

# Create budget configuration file
$budgetConfig = @{
    BudgetName = "jobdock-monthly-budget"
    BudgetType = "COST"
    TimeUnit = "MONTHLY"
    BudgetLimit = @{
        Amount = $MonthlyBudget.ToString()
        Unit = "USD"
    }
    CostFilters = @{}
    TimePeriod = @{
        Start = (Get-Date -Format "yyyy-MM-01")
        End = "2087-06-15T00:00:00Z"
    }
    CostTypes = @{
        IncludeTax = $true
        IncludeSubscription = $true
        UseBlended = $false
        IncludeRefund = $false
        IncludeCredit = $false
        IncludeUpfront = $true
        IncludeRecurring = $true
        IncludeOtherSubscription = $true
        IncludeSupport = $true
        IncludeDiscount = $true
        UseAmortized = $false
    }
}

$notificationsConfig = @(
    @{
        Notification = @{
            NotificationType = "ACTUAL"
            ComparisonOperator = "GREATER_THAN"
            Threshold = 80
            ThresholdType = "PERCENTAGE"
            NotificationState = "ALARM"
        }
        Subscribers = @(
            @{
                SubscriptionType = "EMAIL"
                Address = $Email
            }
        )
    },
    @{
        Notification = @{
            NotificationType = "ACTUAL"
            ComparisonOperator = "GREATER_THAN"
            Threshold = 100
            ThresholdType = "PERCENTAGE"
            NotificationState = "ALARM"
        }
        Subscribers = @(
            @{
                SubscriptionType = "EMAIL"
                Address = $Email
            }
        )
    },
    @{
        Notification = @{
            NotificationType = "FORECASTED"
            ComparisonOperator = "GREATER_THAN"
            Threshold = 100
            ThresholdType = "PERCENTAGE"
            NotificationState = "ALARM"
        }
        Subscribers = @(
            @{
                SubscriptionType = "EMAIL"
                Address = $Email
            }
        )
    }
)

# Save to temp files
$budgetConfig | ConvertTo-Json -Depth 10 | Out-File -FilePath "budget-config.json" -Encoding utf8
$notificationsConfig | ConvertTo-Json -Depth 10 | Out-File -FilePath "notifications-config.json" -Encoding utf8

# Create budget
Write-Host "`nCreating monthly budget..." -ForegroundColor Yellow
aws budgets create-budget `
    --account-id $accountId `
    --budget file://budget-config.json `
    --notifications-with-subscribers file://notifications-config.json 2>$null

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Budget created successfully!" -ForegroundColor Green
} else {
    Write-Host "Budget may already exist. Updating..." -ForegroundColor Gray
}

# Cleanup temp files
Remove-Item "budget-config.json" -ErrorAction SilentlyContinue
Remove-Item "notifications-config.json" -ErrorAction SilentlyContinue

# Create CloudWatch billing alarm (in us-east-1)
Write-Host "`nCreating CloudWatch billing alarm..." -ForegroundColor Yellow
aws cloudwatch put-metric-alarm `
    --alarm-name "jobdock-billing-alert-$($MonthlyBudget)USD" `
    --alarm-description "Alert when estimated charges exceed `$$MonthlyBudget" `
    --metric-name "EstimatedCharges" `
    --namespace "AWS/Billing" `
    --statistic Maximum `
    --period 21600 `
    --evaluation-periods 1 `
    --threshold $MonthlyBudget `
    --comparison-operator GreaterThanThreshold `
    --dimensions Name=Currency,Value=USD `
    --alarm-actions $billingTopicArn `
    --region us-east-1

Write-Host "`n✓ Billing alerts setup complete!" -ForegroundColor Green
Write-Host "`nYou will receive alerts at:" -ForegroundColor Cyan
Write-Host "  - 80% of budget (`$$($MonthlyBudget * 0.8))"
Write-Host "  - 100% of budget (`$$MonthlyBudget)"
Write-Host "  - 100% forecasted"
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "1. Confirm email subscription (check your inbox)"
Write-Host "2. Visit: https://console.aws.amazon.com/billing/home#/budgets"
Write-Host "3. Review: https://console.aws.amazon.com/cost-management/home"
