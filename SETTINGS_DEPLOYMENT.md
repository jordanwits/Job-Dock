# Settings Feature Deployment Guide

## Current Status
✅ Backend code written and compiled
✅ Frontend code complete
✅ Database migration file created
🔄 Deploying to AWS...

## What's Happening Now
The backend is being deployed to AWS which will:
- Deploy the updated Lambda functions with settings endpoints
- Update the API Gateway routes

## After Deployment Completes

### 1. Run the Database Migration
You'll need to apply the migration to create the `tenant_settings` table:

```bash
# Connect to your database and run the migration
# The migration file is at: backend/prisma/migrations/20250107000000_add_tenant_settings/migration.sql

# If using Prisma Migrate (recommended):
cd backend
npx prisma migrate deploy

# Or manually via SSH tunnel to database:
# (Follow your existing database access pattern from DATABASE_ACCESS.md)
```

### 2. Test the Settings Page
Once the migration is complete:
1. Navigate to `/settings` in your app
2. You should see the Settings page load successfully
3. Try updating company information
4. Try uploading a logo (PNG/JPEG/SVG, max 5MB)
5. Try customizing email templates

## Troubleshooting

### If you still get 404:
- **Check API URL**: Make sure your frontend is pointing to the correct API endpoint
- **Check deployment**: Ensure the CDK deployment completed successfully
- **Check migration**: Verify the database migration ran successfully
- **Clear cache**: Try hard refresh (Ctrl+Shift+R) in the browser

### If logo upload fails:
- Ensure the Lambda execution role has S3 write permissions (should already be configured)
- Check the browser console for detailed error messages
- Verify file size is under 5MB and type is PNG/JPEG/SVG

### If email template variables don't work:
- The backend email service will need to be updated to use the custom templates from settings
- Currently, the templates are stored but need to be integrated with the email sending functions

## Next Integration Steps

To fully integrate the custom templates with email sending:

1. **Update Email Service**: Modify `backend/src/lib/email.ts` to:
   - Fetch tenant settings when sending emails
   - Replace template variables with actual values
   - Use custom subject/body from settings

2. **Update PDF Generation**: When generating invoice/quote PDFs:
   - Check if custom PDF template exists
   - Use custom template as background/letterhead
   - Overlay dynamic content on the template

## Environment Variables

Make sure these are set in your AWS Lambda environment:
- `FILES_BUCKET` - S3 bucket for file storage ✅ (already configured)
- `DATABASE_URL` - PostgreSQL connection string ✅ (already configured)
- `AWS_REGION` - AWS region ✅ (already configured)

## Files Modified

**Backend:**
- `backend/prisma/schema.prisma` - Added TenantSettings model
- `backend/src/lib/dataService.ts` - Added settings CRUD operations
- `backend/src/lib/fileUpload.ts` - NEW: S3 file upload utilities
- `backend/src/functions/data/handler.ts` - Added settings endpoints
- `backend/package.json` - Added AWS SDK S3 dependencies

**Frontend:**
- `src/features/settings/` - NEW: Complete settings UI
- `src/lib/api/settings.ts` - NEW: Settings API client
- `src/components/ui/Textarea.tsx` - NEW: Textarea component
- `src/App.tsx` - Added settings route

## Security Notes

- All settings operations require authentication
- File uploads are validated for type and size
- Signed URLs expire after 1 hour
- Settings are tenant-isolated
- Old files are automatically cleaned up when replaced

