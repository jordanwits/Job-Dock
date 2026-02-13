# Deploy database migration: Change assignedTo to JSON array
# This script connects directly to RDS and runs the migration

Write-Host "`n🔄 Deploying Database Migration: Change assignedTo to JSON Array" -ForegroundColor Cyan
Write-Host "=" * 70 -ForegroundColor Cyan

Write-Host "`n🔐 Retrieving database credentials..." -ForegroundColor Cyan
$dbSecret = aws secretsmanager get-secret-value --secret-id jobdock-db-credentials-dev --query SecretString --output text | ConvertFrom-Json

Write-Host "✅ Credentials retrieved" -ForegroundColor Green
Write-Host "   Host: $($dbSecret.host)" -ForegroundColor Gray
Write-Host "   Database: $($dbSecret.dbname)" -ForegroundColor Gray

# Read the migration SQL file
$migrationPath = ".\backend\prisma\migrations\20260217000000_change_assigned_to_to_json_array\migration.sql"
if (-not (Test-Path $migrationPath)) {
    Write-Host "`n❌ Migration file not found: $migrationPath" -ForegroundColor Red
    exit 1
}

$migrationSql = Get-Content $migrationPath -Raw

Write-Host "`n📝 Migration SQL loaded from: $migrationPath" -ForegroundColor Yellow
Write-Host "`n⚠️  This migration will:" -ForegroundColor Yellow
Write-Host "   1. Remove foreign key constraints" -ForegroundColor White
Write-Host "   2. Remove indexes" -ForegroundColor White
Write-Host "   3. Convert existing single IDs to JSON arrays" -ForegroundColor White
Write-Host "   4. Change column types from TEXT to JSONB" -ForegroundColor White

Write-Host "`n🚀 Running migration..." -ForegroundColor Cyan

# Set PGPASSWORD environment variable
$env:PGPASSWORD = $dbSecret.password

# Run the migration using psql
$connectionString = "-h $($dbSecret.host) -U $($dbSecret.username) -d $($dbSecret.dbname)"

# Split migration SQL by semicolons and execute each statement
$statements = $migrationSql -split ';' | Where-Object { $_.Trim() -ne '' -and $_ -notmatch '^--' }

$success = $true
foreach ($statement in $statements) {
    $cleanStatement = $statement.Trim()
    if ($cleanStatement -eq '') { continue }
    
    Write-Host "`n   Executing: $($cleanStatement.Substring(0, [Math]::Min(60, $cleanStatement.Length)))..." -ForegroundColor Gray
    
    $result = $cleanStatement | & psql $connectionString 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   ❌ Failed!" -ForegroundColor Red
        Write-Host $result -ForegroundColor Red
        $success = $false
    } else {
        Write-Host "   ✅ Success" -ForegroundColor Green
    }
}

# Clear password from environment
$env:PGPASSWORD = $null

if ($success) {
    Write-Host "`n✅ Migration completed successfully!" -ForegroundColor Green
    
    Write-Host "`n🔍 Verifying changes..." -ForegroundColor Cyan
    $verifySql = @"
SELECT 
    column_name, 
    data_type,
    udt_name
FROM information_schema.columns 
WHERE table_name IN ('jobs', 'job_logs') 
  AND column_name = 'assignedTo'
ORDER BY table_name;
"@
    
    $verifyResult = $verifySql | & psql $connectionString -t
    Write-Host $verifyResult -ForegroundColor White
    
    Write-Host "`n✨ Migration deployment complete!" -ForegroundColor Green
} else {
    Write-Host "`n❌ Migration failed! Please check the errors above." -ForegroundColor Red
    exit 1
}
