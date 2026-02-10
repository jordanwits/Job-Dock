# Fix NAT Route Conflict

## Problem

Deployment failed because routes to the old NAT instance still exist. When switching from NAT Instance to NAT Gateway, we need to remove the old routes first.

## Solution: Manual Route Cleanup

### Step 1: Delete Old NAT Instance Routes

1. Go to AWS Console → VPC → Route Tables
2. Find route tables for private subnets (they'll have routes to `0.0.0.0/0` pointing to an instance)
3. For each private subnet route table:
   - Click on the route table
   - Find the route with destination `0.0.0.0/0` that points to an instance (not a NAT Gateway)
   - Click "Edit routes"
   - Delete the route to `0.0.0.0/0` pointing to the instance
   - Save changes

### Step 2: Optionally Stop/Delete NAT Instance

1. Go to AWS Console → EC2 → Instances
2. Find the NAT instance (look for name containing "NAT" or "JobDockStack-prod")
3. Stop or terminate it (we won't need it anymore)

### Step 3: Redeploy

After cleaning up the routes, redeploy:

```powershell
cd infrastructure
npm run deploy:prod
```

## Alternative: Quick Fix Script

If you have AWS CLI configured, you can run:

```powershell
# Get the NAT instance ID from CloudFormation
$natInstanceId = aws cloudformation describe-stacks --stack-name JobDockStack-prod --query "Stacks[0].Outputs[?OutputKey=='NatInstanceId'].OutputValue" --output text

# Get route tables for private subnets
$routeTables = aws ec2 describe-route-tables --filters "Name=tag:aws:cloudformation:stack-name,Values=JobDockStack-prod" --query "RouteTables[?Routes[?DestinationCidrBlock=='0.0.0.0/0' && InstanceId=='$natInstanceId']].RouteTableId" --output text

# Delete routes pointing to NAT instance
foreach ($rtb in $routeTables.Split("`t")) {
    if ($rtb) {
        Write-Host "Deleting route from $rtb"
        aws ec2 delete-route --route-table-id $rtb --destination-cidr-block 0.0.0.0/0
    }
}
```

Then redeploy.
