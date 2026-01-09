#!/bin/bash
export PGPASSWORD='-b6gv,LdF17FrSYTXL2yvYGh5qnqQt'
psql -h jobdockstack-dev-databaseb269d8bb-b8ugmpllic6b.c4pys8gu6bf4.us-east-1.rds.amazonaws.com -U dbadmin -d jobdock -c "ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "breaks" JSONB;"
if [ $? -eq 0 ]; then
    echo "âœ… Migration completed successfully!"
    echo ""
    echo "Verifying column exists..."
    psql -h jobdockstack-dev-databaseb269d8bb-b8ugmpllic6b.c4pys8gu6bf4.us-east-1.rds.amazonaws.com -U dbadmin -d jobdock -c "\d jobs" | grep breaks
else
    echo "âŒ Migration failed!"
    exit 1
fi