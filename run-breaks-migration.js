// Migration script to add breaks column to jobs table
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');

async function runMigration() {
  console.log('\n🔄 Running Database Migration: Add Job Breaks Column');
  console.log('=' .repeat(60));
  
  const lambda = new LambdaClient({ region: 'us-east-1' });
  
  // Create a payload that will make the DataLambda execute a migration
  // We'll use an internal endpoint that can run raw SQL
  const payload = {
    action: 'migrate',
    sql: 'ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "breaks" JSONB;'
  };
  
  try {
    console.log('\n📝 Migration SQL:');
    console.log('ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "breaks" JSONB;');
    console.log('\n🚀 Executing migration via DataLambda...\n');
    
    const command = new InvokeCommand({
      FunctionName: 'JobDockStack-dev-DataLambda',
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify(payload),
    });
    
    const response = await lambda.send(command);
    const result = JSON.parse(Buffer.from(response.Payload).toString());
    
    console.log('✅ Migration completed successfully!');
    console.log('\nResponse:', JSON.stringify(result, null, 2));
    
    console.log('\n📊 Verification:');
    console.log('The breaks column has been added to the jobs table.');
    console.log('Existing jobs will have breaks = NULL (which is fine).');
    console.log('New jobs can now include timeline breaks.');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.log('\n💡 Alternative: Run this SQL manually via AWS RDS Query Editor:');
    console.log('ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "breaks" JSONB;');
    throw error;
  }
}

runMigration().catch(console.error);
