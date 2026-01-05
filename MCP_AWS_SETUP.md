# AWS MCP Server Setup Guide

This guide walks you through setting up the AWS MCP (Model Context Protocol) server for JobDock, which allows AI assistants to safely inspect and debug your AWS infrastructure.

## Quick Start

### 1. Install Dependencies

Dependencies should already be installed. If not:

```bash
cd tools/aws-mcp
npm install
```

### 2. Configure AWS Credentials

Choose one of these methods:

#### Option A: AWS Profile (Recommended)

Create a dedicated profile for JobDock:

```bash
# For AWS SSO
aws configure sso --profile jobdock-dev

# Or for access keys
aws configure --profile jobdock-dev
```

Verify it works:

```bash
aws sts get-caller-identity --profile jobdock-dev
```

#### Option B: Environment Variables

```bash
# Windows PowerShell
$env:AWS_PROFILE="jobdock-dev"
$env:AWS_REGION="us-east-1"

# Mac/Linux
export AWS_PROFILE=jobdock-dev
export AWS_REGION=us-east-1
```

### 3. Update Configuration

Edit `tools/aws-mcp/config.json` with your actual AWS resource names:

```json
{
  "region": "us-east-1",
  "stackName": "JobDockStack-dev",
  "resources": {
    "dynamodb": {
      "aliases": {
        "jobs": "YourActualJobsTableName",
        "customers": "YourActualCustomersTableName"
      }
    },
    "lambda": {
      "aliases": {
        "auth": "YourActualAuthFunctionName",
        "data": "YourActualDataFunctionName"
      }
    }
  }
}
```

**Finding Your Resource Names:**

```bash
# Get CloudFormation stack name
aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE --profile jobdock-dev

# Get DynamoDB table names
aws dynamodb list-tables --profile jobdock-dev

# Get Lambda function names
aws lambda list-functions --profile jobdock-dev --query 'Functions[].FunctionName'
```

### 4. Build the Server

```bash
cd tools/aws-mcp
npm run build
```

### 5. Configure Your Editor

#### For Cursor

1. Find your Cursor MCP config file:
   - **Windows**: `%APPDATA%\Cursor\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json`
   - **Mac**: `~/Library/Application Support/Cursor/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`
   - **Linux**: `~/.config/Cursor/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`

2. Add this configuration (create the file if it doesn't exist):

```json
{
  "mcpServers": {
    "jobdock-aws": {
      "command": "node",
      "args": [
        "C:\\Users\\jorda\\OneDrive\\Documents\\JobDock\\tools\\aws-mcp\\dist\\server.js"
      ],
      "env": {
        "AWS_PROFILE": "jobdock-dev",
        "AWS_REGION": "us-east-1"
      }
    }
  }
}
```

**Important**: Update the path to match your actual JobDock location.

#### For Claude Desktop

1. Find your Claude Desktop config:
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
   - **Mac**: `~/Library/Application Support/Claude/claude_desktop_config.json`

2. Add the same configuration as above.

### 6. Restart Your Editor

Close and reopen Cursor or Claude Desktop to load the MCP server.

### 7. Verify It's Working

Ask your AI assistant:

> "List the available AWS tools for JobDock"

You should see a list of tools like `aws_get_lambda_logs`, `aws_dynamodb_get_item`, etc.

Try a test query:

> "Describe the JobDock CloudFormation stack"

## Common Issues

### "Cannot find module" Error

**Solution**: Make sure you ran `npm run build` in the `tools/aws-mcp` directory.

### "CredentialsProviderError" or "Unable to locate credentials"

**Solution**: 
1. Verify AWS credentials are configured: `aws sts get-caller-identity --profile jobdock-dev`
2. Ensure the `AWS_PROFILE` env var is set in your MCP config
3. Try setting credentials explicitly in the MCP config env section

### "Stack not found" or "Table not found"

**Solution**: Update the resource names in `tools/aws-mcp/config.json` to match your actual AWS resources.

### Tools Don't Appear in Editor

**Solution**:
1. Restart your editor completely
2. Check the MCP config file path is correct
3. Verify JSON syntax in the config file
4. Check editor console/logs for errors

### "AccessDenied" Errors

**Solution**: Your IAM user/role needs these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:FilterLogEvents",
        "logs:DescribeLogStreams",
        "dynamodb:GetItem",
        "dynamodb:Query",
        "dynamodb:Scan",
        "s3:ListBucket",
        "s3:GetObject",
        "ssm:GetParameter",
        "ssm:GetParametersByPath",
        "secretsmanager:ListSecrets",
        "secretsmanager:DescribeSecret",
        "cloudformation:DescribeStacks",
        "cloudformation:DescribeStackEvents",
        "cloudformation:ListStackResources",
        "lambda:GetFunction",
        "lambda:GetFunctionConfiguration",
        "lambda:ListFunctions"
      ],
      "Resource": "*"
    }
  ]
}
```

You can scope these down to specific resources for better security.

## What Can the AI Do?

With this MCP server, your AI assistant can:

### ✅ Safe Read Operations
- View Lambda logs to debug function errors
- Query DynamoDB tables to inspect data
- Check CloudFormation stack status
- Read SSM parameters (sensitive values masked)
- List S3 objects and read small files
- Inspect Lambda function configurations

### ❌ Prohibited Operations
- No writes to DynamoDB
- No file uploads to S3
- No Lambda deployments
- No CloudFormation changes
- No secret value reads (only metadata)
- No deletion of any resources

## Advanced Configuration

### Using Development Mode

For faster iteration during development, you can run the TypeScript directly:

```json
{
  "mcpServers": {
    "jobdock-aws": {
      "command": "npx",
      "args": [
        "tsx",
        "C:\\Users\\jorda\\OneDrive\\Documents\\JobDock\\tools\\aws-mcp\\src\\server.ts"
      ],
      "env": {
        "AWS_PROFILE": "jobdock-dev",
        "AWS_REGION": "us-east-1"
      }
    }
  }
}
```

### Multi-Environment Setup

To switch between dev/staging/prod:

1. Create separate profiles:
   ```bash
   aws configure sso --profile jobdock-dev
   aws configure sso --profile jobdock-prod
   ```

2. Create multiple MCP servers:
   ```json
   {
     "mcpServers": {
       "jobdock-aws-dev": {
         "command": "node",
         "args": ["...path.../server.js"],
         "env": {
           "AWS_PROFILE": "jobdock-dev",
           "JOBDOCK_STACK_NAME": "JobDockStack-dev"
         }
       },
       "jobdock-aws-prod": {
         "command": "node",
         "args": ["...path.../server.js"],
         "env": {
           "AWS_PROFILE": "jobdock-prod",
           "JOBDOCK_STACK_NAME": "JobDockStack-prod"
         }
       }
     }
   }
   ```

### S3 Bucket Whitelist

To restrict S3 access to specific buckets, update `config.json`:

```json
{
  "resources": {
    "s3": {
      "buckets": [
        "jobdock-dev-uploads",
        "jobdock-dev-backups"
      ]
    }
  }
}
```

## Next Steps

Once set up, you can ask your AI assistant things like:

- "Show me the recent logs for the auth Lambda function"
- "Query the customers table for tenant ABC123"
- "What's the status of the JobDock CloudFormation stack?"
- "List all Lambda functions in the account"
- "Get the SSM parameters under /jobdock/dev/"
- "What files are in the S3 bucket under the uploads/ prefix?"

The AI will use the MCP tools to safely fetch and present this information.

## Security Notes

- All operations are read-only by design
- Sensitive values (passwords, keys) are automatically masked
- SSM parameters are restricted to allowed paths
- Query limits prevent excessive data retrieval
- No deployment or write operations are possible

For questions or issues, see the main README in `tools/aws-mcp/README.md`.

