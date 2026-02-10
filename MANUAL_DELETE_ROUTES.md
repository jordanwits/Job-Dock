# Manual Steps to Delete Old NAT Routes

The CloudFormation stack still has the old NAT instance route resources. You need to delete them manually.

## Option 1: AWS Console (Easiest)

1. Go to AWS Console → CloudFormation → Stacks
2. Click on `JobDockStack-prod`
3. Go to the "Resources" tab
4. Search for resources with names containing:
   - `PrivateSubnetNatRoute0`
   - `PrivateSubnetNatRoute1`
   - Or search for type `AWS::EC2::Route`
5. For each route resource pointing to an instance:
   - Click on the resource
   - Click "Delete"
   - Confirm deletion
6. Wait for the stack update to complete
7. Then redeploy: `cd infrastructure; npm run deploy:prod`

## Option 2: AWS CLI

Run this command to delete the old route resources:

```powershell
# Delete route 0
aws cloudformation delete-stack-resource --stack-name JobDockStack-prod --logical-resource-id VPCPrivateSubnetNatRoute0 --no-retain-resources

# Delete route 1
aws cloudformation delete-stack-resource --stack-name JobDockStack-prod --logical-resource-id VPCPrivateSubnetNatRoute1 --no-retain-resources

# Wait a minute for the stack to update
Start-Sleep -Seconds 60

# Then redeploy
cd infrastructure
npm run deploy:prod
```

## Option 3: Use the Script

```powershell
.\delete-old-routes.ps1
cd infrastructure
npm run deploy:prod
```

After deleting the old routes, the deployment should succeed and create NAT Gateways.
