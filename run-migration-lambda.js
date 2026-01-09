// Temporary Lambda function to run the migration
// This will be invoked once to add the title column

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

exports.handler = async (event) => {
    try {
        console.log('Starting migration: Add title column to quotes table');
        
        // Run the migration
        await prisma.$executeRawUnsafe(`
            ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "title" TEXT;
        `);
        
        console.log('✅ Migration completed successfully');
        
        // Verify the column exists
        const columns = await prisma.$queryRawUnsafe(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'quotes'
            ORDER BY ordinal_position;
        `);
        
        console.log('Current quotes table structure:', JSON.stringify(columns, null, 2));
        
        const titleColumn = columns.find(col => col.column_name === 'title');
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                message: 'Migration completed successfully',
                titleColumnExists: !!titleColumn,
                tableStructure: columns
            })
        };
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                success: false,
                error: error.message,
                stack: error.stack
            })
        };
    } finally {
        await prisma.$disconnect();
    }
};
