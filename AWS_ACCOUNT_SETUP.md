# AWS Account Setup - Step by Step

Since you just created your AWS account, you need to set up an IAM user with programmatic access before we can deploy infrastructure.

## Step 1: Create IAM User (5 minutes)

### Option A: Using AWS Console (Recommended)

1. **Log into AWS Console**
   - Go to: https://console.aws.amazon.com/
   - Sign in with your root account

2. **Navigate to IAM**
   - Search for "IAM" in the top search bar
   - Click on "IAM" service

3. **Create a New User**
   - Click "Users" in the left sidebar
   - Click "Create user" button
   - Username: `jobdock-admin` (or any name you prefer)
   - Click "Next"

4. **Set Permissions**
   - Select "Attach policies directly"
   - Search for and select: **`AdministratorAccess`**
   - ⚠️ **Note**: For production, use least-privilege policies. For now, AdministratorAccess is fine for development.
   - Click "Next"

5. **Review and Create**
   - Review the settings
   - Click "Create user"

6. **Create Access Key**
   - Click on the user you just created
   - Go to "Security credentials" tab
   - Scroll to "Access keys" section
   - Click "Create access key"
   - Select "Command Line Interface (CLI)" as use case
   - Check the confirmation box
   - Click "Next"
   - (Optional) Add description: "JobDock CDK deployment"
   - Click "Create access key"

7. **Save Your Credentials** ⚠️ IMPORTANT
   - **Access Key ID**: Copy this (starts with `AKIA...`)
   - **Secret Access Key**: Copy this (you can only see it once!)
   - Save these somewhere safe - you'll need them in the next step

### Option B: Using AWS CLI (If you prefer)

If you want to use the root account temporarily (not recommended for production):

```bash
# This will open a browser for authentication
aws configure sso
```

But I recommend creating an IAM user as described above.

## Step 2: Configure AWS CLI

Once you have your Access Key ID and Secret Access Key:

```bash
aws configure
```

Enter:
- **AWS Access Key ID**: [paste your Access Key ID]
- **AWS Secret Access Key**: [paste your Secret Access Key]
- **Default region name**: `us-east-1` (or your preferred region)
- **Default output format**: `json`

## Step 3: Verify Configuration

```bash
aws sts get-caller-identity
```

You should see your account ID and user ARN.

## Step 4: Run CDK Bootstrap

Once configured, we can run:

```bash
cd infrastructure
cdk bootstrap
```

## Security Best Practices

### For Development (Now)
- ✅ Using AdministratorAccess is fine for learning/development
- ✅ One IAM user for CDK deployments

### For Production (Later)
- ❌ Don't use AdministratorAccess
- ✅ Create specific IAM policies for:
  - CDK deployment permissions
  - Lambda execution permissions
  - Database access permissions
  - S3 bucket permissions
- ✅ Use IAM roles instead of users where possible
- ✅ Enable MFA for IAM users
- ✅ Rotate access keys regularly

## Troubleshooting

### "Access Denied" Errors
- Make sure you attached `AdministratorAccess` policy
- Verify your access key is correct
- Check if your account has any service control policies (SCPs)

### "Account Not Found"
- Make sure you're using the correct AWS account
- Verify your access key belongs to the right account

### Region Issues
- Make sure the region you choose supports all services:
  - Aurora Serverless v2: Most regions
  - Some newer services may not be in all regions
  - `us-east-1` (N. Virginia) has the most services

## Next Steps After Setup

1. ✅ Create IAM user
2. ✅ Configure AWS CLI
3. ✅ Run `cdk bootstrap`
4. ✅ Deploy infrastructure: `npm run deploy:dev`
5. ✅ Set up database
6. ✅ Connect frontend

## Need Help?

- AWS IAM Documentation: https://docs.aws.amazon.com/iam/
- AWS CDK Getting Started: https://docs.aws.amazon.com/cdk/
- AWS Free Tier: https://aws.amazon.com/free/

