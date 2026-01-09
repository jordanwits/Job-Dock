# Multi-Tenancy Testing Guide

This guide provides step-by-step instructions for testing that each JobDock account has secure data isolation and cannot access other accounts' data.

## Prerequisites

- Backend deployed to AWS (dev or staging environment)
- Frontend accessible (local or deployed)
- Access to AWS Console for CloudWatch logs
- Two test email addresses for creating separate accounts

## Test Scenarios

### Test 1: Account Registration & Tenant Creation

**Objective**: Verify that each signup creates a unique tenant and user.

1. **Register Account A**
   - Navigate to `/auth/register`
   - Email: `test-tenant-a@example.com`
   - Password: `TestPass123!`
   - Name: `Test User A`
   - Company: `Company A`
   - Submit registration

2. **Verify Account A Created**
   - Should automatically log in after registration
   - Check browser localStorage:
     - `auth_token` should be set
     - `tenant_id` should be set
   - Note down the `tenant_id` value

3. **Register Account B**
   - Log out from Account A
   - Navigate to `/auth/register`
   - Email: `test-tenant-b@example.com`
   - Password: `TestPass123!`
   - Name: `Test User B`
   - Company: `Company B`
   - Submit registration

4. **Verify Account B Created**
   - Should automatically log in after registration
   - Check browser localStorage:
     - `auth_token` should be set (different from Account A)
     - `tenant_id` should be set (different from Account A)
   - Note down the `tenant_id` value

**Expected Result**: Each account should have a unique `tenant_id`.

---

### Test 2: Data Isolation - Contacts

**Objective**: Verify that contacts created by one tenant are not visible to another.

1. **Create Contacts in Account A**
   - Log in as `test-tenant-a@example.com`
   - Navigate to `/crm`
   - Create 2-3 contacts:
     - Contact 1: John Doe (john@company-a.com)
     - Contact 2: Jane Smith (jane@company-a.com)
   - Note down contact names/emails

2. **Verify Account A Sees Their Contacts**
   - Refresh the page
   - Should see only the contacts created by Account A

3. **Switch to Account B**
   - Log out
   - Log in as `test-tenant-b@example.com`
   - Navigate to `/crm`

4. **Create Contacts in Account B**
   - Create 1-2 different contacts:
     - Contact 1: Bob Wilson (bob@company-b.com)
   - Note down contact names/emails

5. **Verify Data Isolation**
   - Account B should see ONLY their own contacts (Bob Wilson)
   - Account B should NOT see Account A's contacts (John Doe, Jane Smith)

6. **Switch Back to Account A**
   - Log out
   - Log in as `test-tenant-a@example.com`
   - Navigate to `/crm`
   - Should see ONLY Account A's contacts

**Expected Result**: Each account sees only their own contacts.

---

### Test 3: Data Isolation - Jobs/Scheduling

**Objective**: Verify that jobs are isolated per tenant.

1. **Create Jobs in Account A**
   - Log in as Account A
   - Navigate to `/scheduling`
   - Create 1-2 jobs with Account A's contacts
   - Note job details

2. **Switch to Account B**
   - Log out and log in as Account B
   - Navigate to `/scheduling`

3. **Verify Job Isolation**
   - Account B should see NO jobs from Account A
   - Calendar should be empty (or show only Account B's jobs if created)

4. **Create Jobs in Account B**
   - Create 1-2 jobs with Account B's contacts
   - Verify they appear in the calendar

5. **Verify Cross-Account Isolation**
   - Log back into Account A
   - Navigate to `/scheduling`
   - Should NOT see Account B's jobs

**Expected Result**: Each account sees only their own scheduled jobs.

---

### Test 4: Data Isolation - Quotes & Invoices

**Objective**: Verify quotes and invoices are isolated per tenant.

1. **Create Quote in Account A**
   - Log in as Account A
   - Navigate to `/quotes`
   - Create a quote for one of Account A's contacts
   - Note quote number

2. **Create Invoice in Account A**
   - Navigate to `/invoices`
   - Create an invoice for one of Account A's contacts
   - Note invoice number

3. **Switch to Account B**
   - Log out and log in as Account B
   - Navigate to `/quotes`
   - Verify empty or no Account A quotes visible

4. **Navigate to Invoices**
   - Navigate to `/invoices`
   - Verify no Account A invoices visible

5. **Create Quote & Invoice in Account B**
   - Create a quote and invoice for Account B's contacts
   - Note the numbers

6. **Verify Isolation**
   - Log back into Account A
   - Check `/quotes` and `/invoices`
   - Should NOT see Account B's quotes/invoices

**Expected Result**: Quotes and invoices are completely isolated between accounts.

---

### Test 5: Data Isolation - Services

**Objective**: Verify services are isolated per tenant.

1. **Create Services in Account A**
   - Log in as Account A
   - Navigate to `/scheduling` or services section
   - Create 1-2 services
   - Note service names

2. **Switch to Account B**
   - Log out and log in as Account B
   - Navigate to services section

3. **Verify Service Isolation**
   - Account B should NOT see Account A's services
   - Account B should be able to create their own services

**Expected Result**: Services are isolated between tenants.

---

### Test 6: Security - Token Tampering

**Objective**: Verify that tampering with tenant_id in browser doesn't expose other tenant's data.

1. **Log in as Account A**
   - Log in as `test-tenant-a@example.com`
   - Navigate to `/crm` (should see Account A's contacts)

2. **Open Browser DevTools**
   - Open Console
   - Get Account B's tenant_id from earlier notes

3. **Attempt to Change tenant_id**
   ```javascript
   // In browser console
   localStorage.setItem('tenant_id', 'ACCOUNT_B_TENANT_ID_HERE')
   ```

4. **Refresh Page**
   - Refresh `/crm`

5. **Verify Security**
   - Should STILL see only Account A's contacts
   - Backend should ignore the tampered `X-Tenant-ID` header
   - Backend should derive tenant from the JWT token instead

**Expected Result**: Tampering with `tenant_id` has no effect; data is still scoped to the authenticated user's tenant.

---

### Test 7: API Direct Testing (Optional)

**Objective**: Test API endpoints directly to verify tenant isolation.

1. **Get Account A Token**
   - Log in as Account A
   - Copy `auth_token` from localStorage

2. **Test API with Postman/cURL**
   ```bash
   # Replace with your API URL and Account A's token
   curl https://your-api-url.com/contacts \
     -H "Authorization: Bearer ACCOUNT_A_TOKEN" \
     -H "Content-Type: application/json"
   ```

3. **Attempt with Wrong Tenant Header**
   ```bash
   # Try to access with Account B's tenant_id in header
   curl https://your-api-url.com/contacts \
     -H "Authorization: Bearer ACCOUNT_A_TOKEN" \
     -H "X-Tenant-ID: ACCOUNT_B_TENANT_ID" \
     -H "Content-Type: application/json"
   ```

4. **Verify Response**
   - Should return ONLY Account A's contacts
   - Should ignore the `X-Tenant-ID` header when Authorization is present

**Expected Result**: API enforces tenant isolation based on JWT token, not client-provided headers.

---

## Checking Logs (AWS CloudWatch)

1. **Navigate to CloudWatch**
   - Go to AWS Console → CloudWatch → Log Groups
   - Find Lambda function logs (e.g., `/aws/lambda/jobdock-dev-dataFunction`)

2. **Search for Tenant Resolution**
   - Look for log entries showing tenant resolution
   - Should see: `Tenant ID resolved from token: <tenant-id>`

3. **Check for Errors**
   - Look for: `Failed to resolve tenant`
   - Look for: `User not found in JobDock database`
   - These indicate security issues that need investigation

---

## Database Verification (Optional)

If you have access to the PostgreSQL database:

```sql
-- View all tenants
SELECT id, name, subdomain, "createdAt" FROM tenants;

-- View users and their tenants
SELECT u.id, u.email, u.name, u."tenantId", t.name as tenant_name
FROM users u
JOIN tenants t ON u."tenantId" = t.id;

-- Verify contact isolation
SELECT c.id, c."firstName", c."lastName", c.email, c."tenantId", t.name
FROM contacts c
JOIN tenants t ON c."tenantId" = t.id
ORDER BY c."tenantId", c."createdAt";

-- Check for any contacts without tenantId (should be none)
SELECT COUNT(*) FROM contacts WHERE "tenantId" IS NULL;
```

**Expected Result**: 
- Each user should have a unique `tenantId`
- All business records (contacts, jobs, quotes, invoices) should have a valid `tenantId`
- No records should have NULL `tenantId`

---

## Rollback Plan

If testing reveals issues:

1. **Immediate Actions**
   - Do NOT deploy to production
   - Document the specific failure scenario
   - Check CloudWatch logs for error details

2. **Common Issues & Fixes**
   - **"User not found in JobDock database"**: User was created in Cognito but not in DB
     - Fix: Ensure registration creates both Cognito user AND DB user atomically
   
   - **Cross-tenant data visible**: Tenant resolution not working
     - Fix: Check that `getTenantIdFromToken` is properly looking up user by `cognitoId`
   
   - **"Authentication failed: Unable to determine tenant"**: Token verification failing
     - Fix: Verify `USER_POOL_ID` and `USER_POOL_CLIENT_ID` environment variables

3. **Revert Strategy**
   - Keep old version of Lambda functions available
   - Use Lambda versioning to roll back if needed

---

## Success Criteria

All tests must pass before promoting to production:

- ✅ Each signup creates a unique tenant
- ✅ Contacts are isolated between tenants
- ✅ Jobs are isolated between tenants
- ✅ Quotes are isolated between tenants
- ✅ Invoices are isolated between tenants
- ✅ Services are isolated between tenants
- ✅ Client-side tenant_id tampering has no effect
- ✅ API enforces tenant isolation via JWT token
- ✅ No NULL tenantId values in database
- ✅ CloudWatch logs show proper tenant resolution

---

## Next Steps After Successful Testing

1. **Deploy to Staging**
   - Run all tests again on staging environment
   - Verify with real-world-like data volumes

2. **Production Deployment**
   - Deploy during low-traffic window
   - Monitor CloudWatch logs closely
   - Have rollback plan ready

3. **Post-Deployment Monitoring**
   - Watch for "User not found" errors
   - Monitor for cross-tenant access attempts
   - Set up CloudWatch alarms for authentication failures

4. **Existing User Migration**
   - If you have existing users under `demo-tenant`:
     - Plan migration strategy
     - Create script to assign unique tenants
     - Migrate business records to new tenants
     - Test migration in staging first
