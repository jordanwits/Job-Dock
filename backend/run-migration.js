// Simple script to run database migrations
// This connects directly to the database and executes the SQL

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function runMigration() {
  try {
    console.log('🔄 Running migration: Add quote title field...');
    
    // Run the migration SQL
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "title" TEXT;
    `);
    
    console.log('✅ Migration completed successfully!');
    
    // Verify the column was added
    const result = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'quotes' 
      ORDER BY ordinal_position;
    `);
    
    console.log('\n📊 Current quotes table columns:');
    console.table(result);
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();
