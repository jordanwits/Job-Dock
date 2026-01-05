# AWS MCP Quick Start

Get the JobDock AWS MCP server running in 5 minutes.

## Prerequisites

- ✅ Node.js 18+ installed
- ✅ AWS CLI configured with credentials
- ✅ JobDock deployed to AWS (or at least credentials with read permissions)

## Setup Steps

### 1. Install (Already Done!)

Dependencies are already installed. If you need to reinstall:

```bash
cd tools/aws-mcp
npm install
```

### 2. Configure AWS Credentials

Set up an AWS profile:

```bash
aws configure --profile jobdock-dev
```

Or if using AWS SSO:

```bash
aws configure sso --profile jobdock-dev
```

Test it works:

```bash
aws sts get-caller-identity --profile jobdock-dev
```

### 3. Update Resource Names

Edit `config.json` and replace placeholder names with your actual AWS resources:

```json
{
  "region": "us-east-1",
  "stackName": "JobDockStack-dev",
  "resources": {
    "dynamodb": {
      "aliases": {
        "jobs": "YOUR-ACTUAL-JOBS-TABLE-NAME",
        "customers": "YOUR-ACTUAL-CUSTOMERS-TABLE-NAME"
      }
    },
    "lambda": {
      "aliases": {
        "auth": "YOUR-ACTUAL-AUTH-FUNCTION-NAME",
        "data": "YOUR-ACTUAL-DATA-FUNCTION-NAME"
      }
    }
  }
}
```

**Find your resource names:**

```bash
# List your stacks
aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE --profile jobdock-dev

# List tables
aws dynamodb list-tables --profile jobdock-dev

# List functions
aws lambda list-functions --profile jobdock-dev
```

### 4. Build

```bash
npm run build
```

You should see a `dist/` folder created.

### 5. Test (Optional)

```bash
node test-server.js
```

You should see a list of available tools.

### 6. Configure Your Editor

#### For Cursor

Create or edit: `%APPDATA%\Cursor\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json`

Add:

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

**Important**: Change the path to match YOUR JobDock location!

#### For Claude Desktop

Edit: `%APPDATA%\Claude\claude_desktop_config.json`

Use the same config as above.

### 7. Restart & Test

1. **Restart your editor** completely
2. Ask the AI: "List the available AWS tools"
3. Try: "Describe the JobDock CloudFormation stack"

## You're Done! 🎉

Your AI assistant can now help debug JobDock by inspecting:
- Lambda logs
- DynamoDB data
- S3 files
- CloudFormation status
- And more!

## Troubleshooting

### Can't find config file?

On Windows, the path is usually:
```
C:\Users\[YourUsername]\AppData\Roaming\Cursor\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json
```

Create the directories if they don't exist.

### Server won't start?

Check:
1. AWS credentials work: `aws sts get-caller-identity --profile jobdock-dev`
2. Built successfully: Check if `dist/server.js` exists
3. Node version: `node --version` (should be 18+)

### Tools don't appear?

1. Restart editor completely
2. Check JSON syntax in config file
3. Verify the path is correct (use forward slashes on Mac/Linux)

## Next Steps

- See [MCP_AWS_SETUP.md](../../MCP_AWS_SETUP.md) for detailed configuration
- See [README.md](./README.md) for tool documentation
- Ask your AI to help debug any issues!

