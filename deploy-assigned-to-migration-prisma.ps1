# Deploy database migration: Change assignedTo to JSON array
# Uses Prisma migrate deploy with credentials from AWS Secrets Manager

Write-Host ""
Write-Host "Deploying Database Migration: Change assignedTo to JSON Array" -ForegroundColor Cyan
Write-Host ("=" * 70) -ForegroundColor Cyan

Write-Host ""
Write-Host "Retrieving database credentials..." -ForegroundColor Cyan
$dbSecret = aws secretsmanager get-secret-value --secret-id jobdock-db-credentials-dev --query SecretString --output text | ConvertFrom-Json

Write-Host "Credentials retrieved" -ForegroundColor Green
Write-Host "   Host: $($dbSecret.host)" -ForegroundColor Gray
Write-Host "   Database: $($dbSecret.dbname)" -ForegroundColor Gray

# Construct DATABASE_URL
$databaseUrl = "postgresql://$($dbSecret.username):$($dbSecret.password)@$($dbSecret.host):5432/$($dbSecret.dbname)?schema=public"

Write-Host ""
Write-Host "Running Prisma migration..." -ForegroundColor Cyan

# Set DATABASE_URL environment variable and run migration
$env:DATABASE_URL = $databaseUrl

try {
    Push-Location backend
    npx prisma migrate deploy
    $migrationSuccess = $LASTEXITCODE -eq 0
} finally {
    Pop-Location
    # Clear DATABASE_URL from environment
    Remove-Item Env:\DATABASE_URL
}

if ($migrationSuccess) {
    Write-Host ""
    Write-Host "Migration completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "The assignedTo columns are now JSONB arrays!" -ForegroundColor Green
    Write-Host "   - Existing single assignments have been converted to arrays" -ForegroundColor Gray
    Write-Host "   - You can now assign multiple team members to jobs/appointments" -ForegroundColor Gray
} else {
    Write-Host ""
    Write-Host "Migration failed! Please check the errors above." -ForegroundColor Red
    exit 1
}
