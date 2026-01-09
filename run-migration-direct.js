// Direct database migration script
// This connects to RDS from a machine that has network access (like bastion or local if VPN)

const { Client } = require('pg');

async function runMigration() {
  console.log('\n🔄 Running Database Migration: Add Job Breaks Column');
  console.log('='.repeat(60));
  
  // Get credentials from AWS Secrets Manager
  const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
  const secretsClient = new SecretsManagerClient({ region: 'us-east-1' });
  
  console.log('\n🔐 Retrieving database credentials...');
  const secretResponse = await secretsClient.send(
    new GetSecretValueCommand({ SecretId: 'jobdock-db-credentials-dev' })
  );
  
  const dbCreds = JSON.parse(secretResponse.SecretString);
  console.log('✅ Credentials retrieved');
  console.log(`   Host: ${dbCreds.host}`);
  console.log(`   Database: ${dbCreds.dbname}`);
  
  const client = new Client({
    host: dbCreds.host,
    port: 5432,
    database: dbCreds.dbname,
    user: dbCreds.username,
    password: dbCreds.password,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('\n🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully');
    
    console.log('\n📝 Running migration SQL...');
    const migrationSql = 'ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "breaks" JSONB;';
    console.log(migrationSql);
    
    await client.query(migrationSql);
    console.log('✅ Migration executed successfully');
    
    console.log('\n🔍 Verifying column exists...');
    const verifyResult = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'jobs' AND column_name = 'breaks'
    `);
    
    if (verifyResult.rows.length > 0) {
      console.log('✅ Column verified:');
      console.log(`   Name: ${verifyResult.rows[0].column_name}`);
      console.log(`   Type: ${verifyResult.rows[0].data_type}`);
    } else {
      console.log('⚠️  Column not found - migration may have failed');
    }
    
    console.log('\n✨ Migration complete!');
    console.log('\n📊 Summary:');
    console.log('   • The "breaks" column has been added to the jobs table');
    console.log('   • Existing jobs will have breaks = NULL');
    console.log('   • New jobs can now include timeline breaks');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    if (error.code === 'ENOTFOUND') {
      console.log('\n💡 This database is in a private VPC.');
      console.log('   You need to run this script from:');
      console.log('   • A bastion host with database access');
      console.log('   • An EC2 instance in the same VPC');
      console.log('   • Via AWS Systems Manager Session Manager');
    }
    throw error;
  } finally {
    await client.end();
  }
}

runMigration().catch((error) => {
  console.error('Migration script failed:', error.message);
  process.exit(1);
});
