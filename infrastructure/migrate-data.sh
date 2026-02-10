# Data Migration Script
# This will copy all data from old RDS to new RDS

OLD_DB_URL="postgresql://:@jobdockstack-prod-databaseb269d8bb-h8v9d1teswhq.c4pys8gu6bf4.us-east-1.rds.amazonaws.com:5432/jobdock"
NEW_DB_URL="postgresql://:@jobdockstack-prod-databaseb269d8bb-v8h3c82r6rv6.c4pys8gu6bf4.us-east-1.rds.amazonaws.com:5432/jobdock"

# Export data from old database (data only, no schema)
pg_dump $OLD_DB_URL --data-only --no-owner --no-acl --column-inserts > data_export.sql

# Import into new database
psql $NEW_DB_URL -f data_export.sql

echo "Migration complete!"
