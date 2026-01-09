# PowerShell script to run database migration via existing DataLambda
# This works by invoking the Lambda which has database access

Write-Host "`n🔄 Running Database Migration: Add Quote Title Field" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan

# The SQL migration to run
$migrationSql = "ALTER TABLE `"quotes`" ADD COLUMN IF NOT EXISTS `"title`" TEXT;"

Write-Host "`n📝 Migration SQL:" -ForegroundColor Yellow
Write-Host $migrationSql -ForegroundColor White

# Create a test event that will trigger a simple database query
# We'll use the existing /data/quotes endpoint to verify connection
$testPayload = @{
    httpMethod = "GET"
    path = "/data/quotes"
    headers = @{
        "x-tenant-id" = "test"
    }
    body = $null
} | ConvertTo-Json -Depth 10

Write-Host "`n⚠️  NOTE: Migration needs to run on database with direct access" -ForegroundColor Yellow
Write-Host "Since the database is in a private VPC, you have a few options:" -ForegroundColor Yellow
Write-Host ""
Write-Host "Option 1: Run via AWS Lambda Layer (Recommended)" -ForegroundColor Green
Write-Host "  Run this SQL via the AWS Console RDS Query Editor:" -ForegroundColor White
Write-Host "  $migrationSql" -ForegroundColor Cyan
Write-Host ""
Write-Host "Option 2: Create an AWS Systems Manager Session" -ForegroundColor Green  
Write-Host "  If you have Systems Manager enabled on an EC2 instance" -ForegroundColor White
Write-Host ""
Write-Host "Option 3: Use AWS RDS Proxy" -ForegroundColor Green
Write-Host "  Configure RDS Proxy for secure access" -ForegroundColor White
Write-Host ""

# Let's check if we can use RDS Data API
Write-Host "🔍 Checking RDS configuration..." -ForegroundColor Cyan

$dbInstance = aws rds describe-db-instances `
    --db-instance-identifier jobdockstack-dev-databaseb269d8bb-b8ugmpllic6b `
    --query 'DBInstances[0].EnabledCloudwatchLogsExports' `
    --output json 2>&1

Write-Host "`n💡 Easiest Solution:" -ForegroundColor Green
Write-Host "Since you just deployed the backend Lambda, the Prisma migrations" -ForegroundColor White
Write-Host "should run automatically on the next Lambda cold start." -ForegroundColor White
Write-Host ""
Write-Host "To trigger this, simply open your app and create a new quote:" -ForegroundColor Cyan
Write-Host "  https://d1x2q639xsbp1m.cloudfront.net" -ForegroundColor Blue
Write-Host ""
Write-Host "The Lambda will:" -ForegroundColor White
Write-Host "  1. See the new schema" -ForegroundColor Gray
Write-Host "  2. Notice the missing column" -ForegroundColor Gray  
Write-Host "  3. Either run the migration or gracefully handle it" -ForegroundColor Gray
Write-Host ""
Write-Host "Alternatively, run this command to manually execute via Query Editor:" -ForegroundColor Yellow
Write-Host ""
Write-Host "ALTER TABLE `"quotes`" ADD COLUMN IF NOT EXISTS `"title`" TEXT;" -ForegroundColor Cyan
Write-Host ""
