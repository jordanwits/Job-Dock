# Deploy database migration for job breaks column
# This script connects to the bastion host and runs the migration

Write-Host "`n🔄 Deploying Database Migration: Add Job Breaks Column" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan

# Migration SQL
$migrationSql = "ALTER TABLE `"jobs`" ADD COLUMN IF NOT EXISTS `"breaks`" JSONB;"

Write-Host "`n📝 Migration to run:" -ForegroundColor Yellow
Write-Host $migrationSql -ForegroundColor White

Write-Host "`n🔐 Retrieving database credentials..." -ForegroundColor Cyan
$dbSecret = aws secretsmanager get-secret-value --secret-id jobdock-db-credentials-dev --query SecretString --output text | ConvertFrom-Json

Write-Host "✅ Credentials retrieved" -ForegroundColor Green
Write-Host "   Host: $($dbSecret.host)" -ForegroundColor Gray
Write-Host "   Database: $($dbSecret.dbname)" -ForegroundColor Gray

# Create a migration script that can run on bastion
$bastionScript = @"
#!/bin/bash
export PGPASSWORD='$($dbSecret.password)'
psql -h $($dbSecret.host) -U $($dbSecret.username) -d $($dbSecret.dbname) -c "$migrationSql"
if [ `$? -eq 0 ]; then
    echo "✅ Migration completed successfully!"
    echo ""
    echo "Verifying column exists..."
    psql -h $($dbSecret.host) -U $($dbSecret.username) -d $($dbSecret.dbname) -c "\d jobs" | grep breaks
else
    echo "❌ Migration failed!"
    exit 1
fi
"@

# Save the script
$bastionScript | Out-File -FilePath ".\run-migration-on-bastion.sh" -Encoding UTF8 -NoNewline

Write-Host "`n📄 Created migration script: run-migration-on-bastion.sh" -ForegroundColor Green

Write-Host "`n🚀 To run the migration:" -ForegroundColor Yellow
Write-Host ""
Write-Host "Option 1: Via Bastion Host (Recommended)" -ForegroundColor Green
Write-Host "  1. Copy the script to bastion:" -ForegroundColor White
Write-Host "     scp -i jobdock-bastion.pem run-migration-on-bastion.sh ec2-user@98.84.121.11:~/" -ForegroundColor Cyan
Write-Host "  2. Connect to bastion:" -ForegroundColor White
Write-Host "     ssh -i jobdock-bastion.pem ec2-user@98.84.121.11" -ForegroundColor Cyan
Write-Host "  3. Run the migration:" -ForegroundColor White
Write-Host "     chmod +x run-migration-on-bastion.sh && ./run-migration-on-bastion.sh" -ForegroundColor Cyan
Write-Host ""
Write-Host "Option 2: Manual SQL via AWS RDS Query Editor" -ForegroundColor Green
Write-Host "  Run this in the AWS Console RDS Query Editor:" -ForegroundColor White
Write-Host "  $migrationSql" -ForegroundColor Cyan
Write-Host ""
Write-Host "Option 3: Wait for Prisma Auto-Migration" -ForegroundColor Green
Write-Host "  The Lambda functions have the new schema." -ForegroundColor White
Write-Host "  On next cold start, Prisma will detect the schema change." -ForegroundColor White
Write-Host "  However, this is NOT recommended for production." -ForegroundColor Gray
Write-Host ""

Write-Host "💡 Recommended: Use Option 1 (Bastion Host)" -ForegroundColor Yellow
Write-Host ""
