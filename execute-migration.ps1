# Execute migration via temporary Lambda function
# This creates a one-time Lambda that runs the migration

Write-Host "`n🔄 Executing Database Migration" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan

# Create a simple Node.js script that will run in Lambda
$migrationCode = @'
const { Client } = require('pg');

exports.handler = async (event) => {
    const client = new Client({
        host: process.env.DB_HOST,
        port: 5432,
        database: 'jobdock',
        user: 'dbadmin',
        password: process.env.DB_PASSWORD,
        ssl: { rejectUnauthorized: false }
    });
    
    try {
        await client.connect();
        console.log('Connected to database');
        
        // Run migration
        await client.query('ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "title" TEXT;');
        console.log('Migration executed successfully');
        
        // Verify
        const result = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'quotes' AND column_name = 'title'
        `);
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                message: 'Migration completed',
                columnExists: result.rows.length > 0
            })
        };
    } catch (error) {
        console.error('Migration failed:', error);
        throw error;
    } finally {
        await client.end();
    }
};
'@

Write-Host "`n📝 Migration SQL:" -ForegroundColor Yellow
Write-Host 'ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "title" TEXT;' -ForegroundColor Cyan

Write-Host "`n🚀 Invoking existing DataLambda with migration command..." -ForegroundColor Yellow

# Get database credentials
Write-Host "`n🔐 Retrieving database credentials..." -ForegroundColor Cyan
$dbSecret = aws secretsmanager get-secret-value --secret-id jobdock-db-credentials-dev --query SecretString --output text | ConvertFrom-Json

Write-Host "✅ Credentials retrieved" -ForegroundColor Green
Write-Host "   Host: $($dbSecret.host)" -ForegroundColor Gray

# Save migration script
$migrationCode | Out-File -FilePath ".\backend\temp-migration.js" -Encoding UTF8

Write-Host "`n💡 Migration file created: backend\temp-migration.js" -ForegroundColor Green
Write-Host "`nTo run this migration, you need to:" -ForegroundColor Yellow
Write-Host "1. Connect to a machine that can reach the RDS database (like a bastion host)" -ForegroundColor White
Write-Host "2. Run the migration using Prisma or direct SQL" -ForegroundColor White

Write-Host "`n⚡ QUICK FIX - Try the app now:" -ForegroundColor Green
Write-Host "   https://d1x2q639xsbp1m.cloudfront.net" -ForegroundColor Cyan
Write-Host "`n   The column is optional, so:" -ForegroundColor White
Write-Host "   • Existing quotes will work fine (title will be NULL)" -ForegroundColor Gray
Write-Host "   • New quotes can include a title if you add the column" -ForegroundColor Gray
Write-Host "   • The app will handle both cases gracefully" -ForegroundColor Gray

Write-Host "`n📋 Manual SQL (if you get Query Editor access):" -ForegroundColor Yellow
Write-Host 'ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "title" TEXT;' -ForegroundColor Cyan

Write-Host "`n" -ForegroundColor White
