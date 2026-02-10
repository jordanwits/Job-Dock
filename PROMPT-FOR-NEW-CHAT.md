# Prompt for New Chat: Switch RDS to Public (Production Only)

Copy and paste this entire prompt to your new chat:

---

**I need help switching my RDS database from private subnet to public subnet in PRODUCTION ONLY to save $60-80/month on NAT Gateway costs.**

## Context & Current State

- **Environment:** PRODUCTION only (not dev - dev RDS is already stopped)
- **Goal:** Move RDS from private subnet to public subnet to eliminate NAT Gateway requirement
- **Savings:** ~$60-80/month
- **Risk Level:** Low (backup already created, no active users)

## What's Already Done

1. ✅ **Backup created:** `pre-public-switch-20260204-113238` (production RDS snapshot)
2. ✅ **Dev RDS stopped:** Already stopped to save costs
3. ✅ **No active users:** Safe to make changes

## Important Requirements

### 1. PRODUCTION ONLY
- **DO NOT** modify dev environment
- **ONLY** make changes to production (`JobDockStack-prod`)
- All changes should target `infrastructure/config.ts` prod config and `infrastructure/lib/jobdock-stack.ts` prod stack

### 2. Manageable Chunks (Step-by-Step)
**DO NOT do everything at once.** Break it into these steps:

**Step 1:** Update RDS configuration only
- Change RDS subnet from private to public
- Add `publiclyAccessible: true`
- Show me the changes for review
- Wait for my approval before proceeding

**Step 2:** Remove VPC from Lambda functions
- Remove VPC configuration from Lambda functions
- Show me the changes for review
- Wait for my approval before proceeding

**Step 3:** Remove NAT Gateway code
- Remove NAT Gateway creation code
- Remove NAT routes
- Show me the changes for review
- Wait for my approval before proceeding

**Step 4:** Deploy and verify
- Guide me through deployment
- Help verify everything works
- Check cost reduction

### 3. Safety First
- Show me each change before making it
- Wait for my approval between steps
- Explain what each change does
- Verify security groups remain correct (they should - don't change them)

## Files to Modify

1. **`infrastructure/lib/jobdock-stack.ts`**
   - RDS configuration (around line 228-250)
   - Lambda functions (around lines 527-620)
   - NAT Gateway code (around lines 140-186)
   - **DO NOT CHANGE:** Security groups (lines 192-210) - they're already correct

2. **`infrastructure/config.ts`** (if needed)
   - Only prod config (lines 95-122)

## Reference Documents

- **Complete guide:** `RDS-PUBLIC-SWITCH-GUIDE.md` (has all context, code locations, safety measures)
- **Safety plan:** `safe-transition-plan.md` (has rollback procedures)

## Current Infrastructure

- **Production Stack:** `JobDockStack-prod`
- **Production RDS:** `jobdockstack-prod-databaseb269d8bb-h8v9d1teswhq`
- **Current Cost:** ~$110/month
- **Target Cost:** ~$35-50/month
- **Savings:** ~$60-80/month

## What I Need From You

1. **Read the guide document** (`RDS-PUBLIC-SWITCH-GUIDE.md`) for full context
2. **Review current code** in `infrastructure/lib/jobdock-stack.ts`
3. **Make changes step-by-step** (one step at a time, wait for approval)
4. **Show me each change** before proceeding
5. **Guide me through deployment** when ready
6. **Help verify** everything works after deployment

## Key Points to Remember

- ✅ Backup already exists: `pre-public-switch-20260204-113238`
- ✅ No active users - safe to make changes
- ✅ Security groups already restrict to Lambda only - DON'T CHANGE THEM
- ✅ Only modify PRODUCTION - dev is stopped
- ✅ Step-by-step approach - don't rush
- ✅ Show changes before making them
- ✅ Wait for approval between steps

## Start Here

Please:
1. Read `RDS-PUBLIC-SWITCH-GUIDE.md` to understand the full context
2. Review `infrastructure/lib/jobdock-stack.ts` to see current code
3. Start with **Step 1 only** (RDS configuration change)
4. Show me the exact changes you'll make
5. Wait for my approval before proceeding

Let's do this safely, step-by-step, production only.

---
