# Calculate Per-User Cost for JobDock
# Queries database for user counts and calculates cost per user based on AWS billing
#
# Usage:
#   .\calculate-per-user-cost.ps1
#   .\calculate-per-user-cost.ps1 -MonthlyCost 142.93 -ForecastedCost 88.56
#   .\calculate-per-user-cost.ps1 -MonthToDateCost 52.02
#
# Environment Variables:
#   DATABASE_URL - PostgreSQL connection string (required)
#   AWS_MONTHLY_COST - Last month's total AWS cost (optional)
#   AWS_MTD_COST - Month-to-date AWS cost (optional)
#   AWS_FORECASTED_COST - Forecasted monthly AWS cost (optional)

Write-Host "=== JobDock Per-User Cost Calculator ===" -ForegroundColor Cyan
Write-Host ""

# Check if DATABASE_URL is set
if (-not $env:DATABASE_URL) {
    Write-Host "ERROR: DATABASE_URL environment variable is not set" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please set it using one of these methods:" -ForegroundColor Yellow
    Write-Host "1. Set DATABASE_URL in your environment" -ForegroundColor White
    Write-Host "2. Or set DATABASE_HOST, DATABASE_USER, DATABASE_PASSWORD, DATABASE_NAME" -ForegroundColor White
    Write-Host ""
    Write-Host "Example:" -ForegroundColor Yellow
    Write-Host '  $env:DATABASE_URL = "postgresql://user:pass@host:5432/jobdock?schema=public"' -ForegroundColor Gray
    exit 1
}

# Get AWS costs (can be provided as parameters or environment variables)
param(
    [double]$MonthlyCost = 0,
    [double]$MonthToDateCost = 0,
    [double]$ForecastedCost = 0
)

# If costs not provided, try to get from environment or prompt
if ($MonthlyCost -eq 0) {
    if ($env:AWS_MONTHLY_COST) {
        $MonthlyCost = [double]$env:AWS_MONTHLY_COST
    }
}

if ($MonthToDateCost -eq 0) {
    if ($env:AWS_MTD_COST) {
        $MonthToDateCost = [double]$env:AWS_MTD_COST
    }
}

if ($ForecastedCost -eq 0) {
    if ($env:AWS_FORECASTED_COST) {
        $ForecastedCost = [double]$env:AWS_FORECASTED_COST
    }
}

# If still no costs, use values from the AWS billing screenshot
if ($MonthlyCost -eq 0 -and $MonthToDateCost -eq 0 -and $ForecastedCost -eq 0) {
    Write-Host "No AWS costs provided. Using values from your billing screenshot:" -ForegroundColor Yellow
    Write-Host "  - Last month total: `$142.93" -ForegroundColor White
    Write-Host "  - Month-to-date: `$52.02" -ForegroundColor White
    Write-Host "  - Forecasted: `$88.56" -ForegroundColor White
    Write-Host ""
    
    $MonthlyCost = 142.93
    $MonthToDateCost = 52.02
    $ForecastedCost = 88.56
} else {
    Write-Host "Using provided AWS costs:" -ForegroundColor Green
    if ($MonthlyCost -gt 0) {
        Write-Host "  - Monthly cost: `$$([math]::Round($MonthlyCost, 2))" -ForegroundColor White
    }
    if ($MonthToDateCost -gt 0) {
        Write-Host "  - Month-to-date: `$$([math]::Round($MonthToDateCost, 2))" -ForegroundColor White
    }
    if ($ForecastedCost -gt 0) {
        Write-Host "  - Forecasted: `$$([math]::Round($ForecastedCost, 2))" -ForegroundColor White
    }
    Write-Host ""
}

# Create a temporary TypeScript script to query the database
$queryScript = @"
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function getUserStats() {
  try {
    // Total users
    const totalUsers = await prisma.user.count();
    
    // Users by tenant
    const usersByTenant = await prisma.user.groupBy({
      by: ['tenantId'],
      _count: {
        id: true
      }
    });
    
    // Get tenant names
    const tenantIds = usersByTenant.map(u => u.tenantId);
    const tenants = await prisma.tenant.findMany({
      where: {
        id: { in: tenantIds }
      },
      select: {
        id: true,
        name: true,
        subdomain: true
      }
    });
    
    const tenantMap: Record<string, { name: string; subdomain: string }> = {};
    tenants.forEach(t => {
      tenantMap[t.id] = { name: t.name, subdomain: t.subdomain };
    });
    
    // Active users (created in last 90 days or updated recently)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    const activeUsers = await prisma.user.count({
      where: {
        OR: [
          { createdAt: { gte: ninetyDaysAgo } },
          { updatedAt: { gte: ninetyDaysAgo } }
        ]
      }
    });
    
    // Total tenants
    const totalTenants = await prisma.tenant.count();
    
    const result = {
      totalUsers,
      activeUsers,
      totalTenants,
      usersByTenant: usersByTenant.map(u => ({
        tenantId: u.tenantId,
        tenantName: tenantMap[u.tenantId]?.name || 'Unknown',
        tenantSubdomain: tenantMap[u.tenantId]?.subdomain || 'unknown',
        userCount: u._count.id
      }))
    };
    
    console.log(JSON.stringify(result));
  } catch (error: any) {
    console.error(JSON.stringify({ error: error.message, stack: error.stack }));
    process.exit(1);
  } finally {
    await prisma.`$disconnect();
  }
}

getUserStats();
"@

# Write the script to a temp file
$tempScript = Join-Path $env:TEMP "jobdock-cost-query-$(Get-Random).ts"
$queryScript | Out-File -FilePath $tempScript -Encoding UTF8

try {
    # Change to backend directory where Prisma and tsx are installed
    # Try script directory first, then current directory
    $scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
    $backendDir = Join-Path $scriptDir "backend"
    
    # If not found, try current directory
    if (-not (Test-Path $backendDir)) {
        $backendDir = Join-Path (Get-Location).Path "backend"
    }
    
    # If still not found, try parent directory
    if (-not (Test-Path $backendDir)) {
        $backendDir = Join-Path (Split-Path -Parent (Get-Location).Path) "backend"
    }
    
    if (-not (Test-Path $backendDir)) {
        Write-Host "ERROR: backend directory not found. Please run this script from the project root." -ForegroundColor Red
        Write-Host "Searched in:" -ForegroundColor Yellow
        Write-Host "  - $scriptDir\backend" -ForegroundColor Gray
        Write-Host "  - $(Get-Location)\backend" -ForegroundColor Gray
        exit 1
    }
    
    Push-Location $backendDir
    
    # Check if node_modules exists (dependencies installed)
    if (-not (Test-Path "node_modules")) {
        Write-Host "Installing dependencies..." -ForegroundColor Yellow
        npm install
        if ($LASTEXITCODE -ne 0) {
            Write-Host "ERROR: Failed to install dependencies" -ForegroundColor Red
            exit 1
        }
    }
    
    # Generate Prisma client if needed
    if (-not (Test-Path "node_modules/.prisma")) {
        Write-Host "Generating Prisma client..." -ForegroundColor Yellow
        npm run prisma:generate
        if ($LASTEXITCODE -ne 0) {
            Write-Host "ERROR: Failed to generate Prisma client" -ForegroundColor Red
            exit 1
        }
    }
    
    # Run the query script using tsx
    Write-Host "Querying database for user statistics..." -ForegroundColor Yellow
    $userStatsJson = npx tsx $tempScript 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to query database" -ForegroundColor Red
        Write-Host $userStatsJson -ForegroundColor Red
        exit 1
    }
    
    $userStats = $userStatsJson | ConvertFrom-Json
    
    if ($userStats.error) {
        Write-Host "ERROR: $($userStats.error)" -ForegroundColor Red
        if ($userStats.stack) {
            Write-Host "Stack trace:" -ForegroundColor Gray
            Write-Host $userStats.stack -ForegroundColor Gray
        }
        exit 1
    }
    
    Write-Host "Database query successful!" -ForegroundColor Green
    Write-Host ""
    
} finally {
    Pop-Location
    # Clean up temp file
    if (Test-Path $tempScript) {
        Remove-Item $tempScript -Force
    }
}

# Display user statistics
Write-Host "=== User Statistics ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Total Users:        $($userStats.totalUsers)" -ForegroundColor White
Write-Host "Active Users:       $($userStats.activeUsers) (created/updated in last 90 days)" -ForegroundColor White
Write-Host "Total Tenants:      $($userStats.totalTenants)" -ForegroundColor White
Write-Host ""

if ($userStats.usersByTenant.Count -gt 0) {
    Write-Host "Users by Tenant:" -ForegroundColor Yellow
    foreach ($tenant in $userStats.usersByTenant) {
        Write-Host "  - $($tenant.tenantName) ($($tenant.tenantSubdomain)): $($tenant.userCount) users" -ForegroundColor Gray
    }
    Write-Host ""
}

# Calculate per-user costs
Write-Host "=== Per-User Cost Analysis ===" -ForegroundColor Cyan
Write-Host ""

if ($userStats.totalUsers -eq 0) {
    Write-Host "WARNING: No users found in database!" -ForegroundColor Red
    Write-Host "Cannot calculate per-user cost." -ForegroundColor Yellow
    exit 0
}

# Calculate using different cost metrics
$costs = @()

if ($MonthlyCost -gt 0) {
    $costPerUser = [math]::Round($MonthlyCost / $userStats.totalUsers, 4)
    $costs += @{
        Label = "Last Month Total"
        Cost = $MonthlyCost
        PerUser = $costPerUser
        PerUserFormatted = "`$$([math]::Round($costPerUser, 2))"
    }
}

if ($ForecastedCost -gt 0) {
    $costPerUser = [math]::Round($ForecastedCost / $userStats.totalUsers, 4)
    $costs += @{
        Label = "Current Month Forecasted"
        Cost = $ForecastedCost
        PerUser = $costPerUser
        PerUserFormatted = "`$$([math]::Round($costPerUser, 2))"
    }
}

if ($MonthToDateCost -gt 0) {
    # Calculate daily average and project to monthly
    $daysInMonth = (Get-Date).Day
    $dailyAverage = $MonthToDateCost / $daysInMonth
    $projectedMonthly = $dailyAverage * 30
    $costPerUser = [math]::Round($projectedMonthly / $userStats.totalUsers, 4)
    
    $costs += @{
        Label = "Month-to-Date (Projected)"
        Cost = $projectedMonthly
        PerUser = $costPerUser
        PerUserFormatted = "`$$([math]::Round($costPerUser, 2))"
    }
}

# Display results
foreach ($cost in $costs) {
    Write-Host "$($cost.Label):" -ForegroundColor Yellow
    Write-Host "  Total Cost:      `$$([math]::Round($cost.Cost, 2))" -ForegroundColor White
    Write-Host "  Per User:        $($cost.PerUserFormatted)" -ForegroundColor Green
    Write-Host ""
}

# Calculate per-tenant cost
if ($userStats.totalTenants -gt 0) {
    Write-Host "=== Per-Tenant Cost Analysis ===" -ForegroundColor Cyan
    Write-Host ""
    
    if ($ForecastedCost -gt 0) {
        $costPerTenant = [math]::Round($ForecastedCost / $userStats.totalTenants, 2)
        Write-Host "Forecasted Cost per Tenant: `$$costPerTenant" -ForegroundColor Green
    }
    
    if ($MonthlyCost -gt 0) {
        $costPerTenant = [math]::Round($MonthlyCost / $userStats.totalTenants, 2)
        Write-Host "Last Month Cost per Tenant: `$$costPerTenant" -ForegroundColor Green
    }
    Write-Host ""
}

# Active vs Total comparison
if ($userStats.activeUsers -lt $userStats.totalUsers) {
    Write-Host "=== Active vs Total Users ===" -ForegroundColor Cyan
    Write-Host ""
    
    if ($ForecastedCost -gt 0) {
        $costPerActiveUser = [math]::Round($ForecastedCost / $userStats.activeUsers, 2)
        Write-Host "Forecasted Cost per Active User: `$$costPerActiveUser" -ForegroundColor Yellow
        Write-Host "  (Based on $($userStats.activeUsers) active users)" -ForegroundColor Gray
    }
    Write-Host ""
}

# Recommendations
Write-Host "=== Recommendations ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Set up AWS Cost Allocation Tags:" -ForegroundColor Yellow
Write-Host "   - Tag resources with tenant_id or user_id" -ForegroundColor White
Write-Host "   - This allows per-tenant/user cost tracking in AWS Cost Explorer" -ForegroundColor White
Write-Host ""
Write-Host "2. Monitor Cost Trends:" -ForegroundColor Yellow
Write-Host "   - Track costs as user count grows" -ForegroundColor White
Write-Host "   - Identify cost drivers (RDS, Lambda, NAT Gateway, etc.)" -ForegroundColor White
Write-Host ""
Write-Host "3. Cost Optimization Opportunities:" -ForegroundColor Yellow
Write-Host "   - NAT Gateway is likely your biggest cost (`$32/month + data transfer)" -ForegroundColor White
Write-Host "   - Consider VPC endpoints for S3/DynamoDB to reduce NAT costs" -ForegroundColor White
Write-Host "   - Monitor RDS instance size - scale down if possible" -ForegroundColor White
Write-Host ""
Write-Host "4. Pricing Strategy:" -ForegroundColor Yellow
Write-Host "   - Current per-user cost: ~`$$([math]::Round($costs[0].PerUser, 2))" -ForegroundColor White
Write-Host "   - Consider pricing tiers based on usage patterns" -ForegroundColor White
Write-Host "   - Factor in infrastructure costs when setting subscription prices" -ForegroundColor White
Write-Host ""
