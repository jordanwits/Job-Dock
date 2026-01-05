# JobDock AWS MCP Server

A Model Context Protocol (MCP) server that provides AI assistants with safe, read-only access to JobDock's AWS infrastructure for debugging and operational tasks.

## Features

### 🔍 Logs & Monitoring
- Fetch Lambda function logs from CloudWatch
- Search logs with filter patterns
- View recent log streams

### 📊 Database Operations (DynamoDB)
- Get single items by primary key
- Query items by partition key
- Sample scan for debugging

### 🗄️ Storage (S3)
- List objects in buckets
- Read text content from files
- Get object metadata

### 🔐 Configuration & Secrets
- List SSM Parameter Store parameters
- Get parameter values (sensitive values masked)
- List Secrets Manager secrets (metadata only)

### 🏗️ Infrastructure State
- Describe CloudFormation stacks
- List stack resources
- View stack events (deployment history)
- Inspect Lambda function configurations

## Installation

Dependencies are already installed if you followed the setup. If not:

```bash
cd tools/aws-mcp
npm install
```

## Configuration

### 1. AWS Credentials

The server uses standard AWS credential resolution:

- **Environment variables**: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`
- **AWS Profile**: Set `AWS_PROFILE` environment variable
- **AWS SSO**: Configure with `aws configure sso`
- **Shared credentials**: `~/.aws/credentials` and `~/.aws/config`

**Recommended for JobDock**: Create a dedicated AWS profile:

```bash
# Using AWS SSO (recommended)
aws configure sso --profile jobdock-dev

# Or using access keys
aws configure --profile jobdock-dev
```

### 2. Configuration File

Edit `tools/aws-mcp/config.json` to match your JobDock deployment:

```json
{
  "region": "us-east-1",
  "stackName": "JobDockStack-dev",
  "resources": {
    "dynamodb": {
      "aliases": {
        "jobs": "JobDockStack-dev-JobsTable",
        "customers": "JobDockStack-dev-CustomersTable",
        "invoices": "JobDockStack-dev-InvoicesTable",
        "quotes": "JobDockStack-dev-QuotesTable"
      }
    },
    "lambda": {
      "aliases": {
        "auth": "JobDockStack-dev-AuthFunction",
        "data": "JobDockStack-dev-DataFunction"
      }
    },
    "ssm": {
      "allowedPrefixes": ["/jobdock/"]
    }
  }
}
```

**Important**: Update table names and function names to match your actual CloudFormation stack resource names.

### 3. Environment Variables (Optional)

You can override configuration via environment variables:

```bash
export AWS_REGION=us-east-1
export AWS_PROFILE=jobdock-dev
export JOBDOCK_STACK_NAME=JobDockStack-dev
```

## Running the Server

### Development Mode (with auto-reload)

```bash
npm run dev
```

### Production Mode

```bash
npm run build
npm start
```

### Direct Execution

```bash
npm run mcp
```

## Editor Integration

### Cursor / VS Code

Add to your MCP settings file:

**For Cursor**: Edit `%APPDATA%\Cursor\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json` (Windows) or `~/.config/Cursor/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json` (Mac/Linux)

**For Claude Desktop**: Edit `%APPDATA%\Claude\claude_desktop_config.json` (Windows) or `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac)

Add this configuration:

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

**Note**: Adjust the path to match your system. Use forward slashes on Mac/Linux:
```
"/Users/username/JobDock/tools/aws-mcp/dist/server.js"
```

### Alternative: Using tsx for Development

If you want to run the TypeScript directly without building:

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

## Available Tools

### Logs & Monitoring

- `aws_get_lambda_logs` - Get recent CloudWatch logs for a Lambda
- `aws_search_logs` - Search logs with filter patterns
- `aws_get_stack_events` - View CloudFormation stack events

### Database

- `aws_dynamodb_get_item` - Get item by key
- `aws_dynamodb_query` - Query items by partition key
- `aws_dynamodb_scan` - Sample scan (limited results)

### Storage

- `aws_s3_list_objects` - List S3 objects
- `aws_s3_get_object` - Read text files from S3

### Configuration

- `aws_ssm_list_parameters` - List SSM parameters
- `aws_ssm_get_parameter` - Get parameter value (masked if sensitive)
- `aws_secrets_list` - List secrets (metadata only)

### Infrastructure

- `aws_describe_stack` - Describe CloudFormation stack
- `aws_list_stack_resources` - List stack resources
- `aws_describe_lambda` - Inspect Lambda configuration
- `aws_list_lambdas` - List all Lambda functions

## Security Features

### Read-Only by Design
- All operations are read-only
- No write, update, or delete operations
- No deployment or infrastructure changes

### Sensitive Data Protection
- Environment variables masked in Lambda configs
- SSM parameters with sensitive names automatically masked
- Secrets Manager values never returned (metadata only)
- S3 reads limited to 1MB to prevent abuse

### Resource Scoping
- DynamoDB limited to configured table aliases
- SSM limited to allowed path prefixes (`/jobdock/`)
- S3 optional bucket whitelist
- CloudFormation scoped to JobDock stacks

### Rate Limiting
- Query/scan limits enforced (max 100 items)
- Log fetch limits (max 100 events)
- Time-bounded queries (default 1 hour window)

## Troubleshooting

### Server Won't Start

1. **Check AWS credentials**:
   ```bash
   aws sts get-caller-identity --profile jobdock-dev
   ```

2. **Verify region**:
   ```bash
   echo $AWS_REGION  # Mac/Linux
   echo %AWS_REGION%  # Windows
   ```

3. **Check Node.js version** (requires Node 18+):
   ```bash
   node --version
   ```

### Tools Not Appearing in Editor

1. Restart your editor after adding MCP config
2. Check editor logs for MCP connection errors
3. Verify the path in your MCP config is correct
4. Ensure the server builds successfully: `npm run build`

### Permission Errors

If you get AWS permission errors:

1. Verify your IAM user/role has required permissions:
   - CloudWatch Logs: `logs:FilterLogEvents`, `logs:DescribeLogStreams`
   - DynamoDB: `dynamodb:GetItem`, `dynamodb:Query`, `dynamodb:Scan`
   - S3: `s3:ListBucket`, `s3:GetObject`
   - SSM: `ssm:GetParameter`, `ssm:GetParametersByPath`
   - CloudFormation: `cloudformation:DescribeStacks`, `cloudformation:DescribeStackEvents`
   - Lambda: `lambda:GetFunction`, `lambda:GetFunctionConfiguration`

2. Ensure you're using the correct AWS profile

### Wrong Stack/Resources

Update `config.json` with correct resource names:

```bash
# Get actual stack name
aws cloudformation describe-stacks --profile jobdock-dev

# Get table names
aws dynamodb list-tables --profile jobdock-dev

# Get Lambda functions
aws lambda list-functions --profile jobdock-dev
```

## Development

### Project Structure

```
tools/aws-mcp/
├── src/
│   ├── server.ts      # Main MCP server
│   ├── config.ts      # Configuration loader
│   ├── types.ts       # TypeScript types
│   ├── logs.ts        # CloudWatch Logs operations
│   ├── db.ts          # DynamoDB operations
│   ├── storage.ts     # S3 operations
│   ├── secrets.ts     # SSM/Secrets Manager
│   └── infra.ts       # CloudFormation/Lambda
├── config.json        # Server configuration
├── package.json
└── tsconfig.json
```

### Adding New Tools

1. Add the operation function in the appropriate module (e.g., `logs.ts`)
2. Register the tool in `server.ts` tools array
3. Add the tool handler in the switch statement
4. Update this README

### Testing

Test the server manually:

```bash
npm run dev
# In another terminal, test MCP communication
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | npm run mcp
```

## License

Part of JobDock project.

