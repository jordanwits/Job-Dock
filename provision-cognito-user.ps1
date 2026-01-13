#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Provision an existing Cognito user in the JobDock database
.DESCRIPTION
    Creates tenant and user records for a Cognito user that was manually created
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$Email,
    
    [Parameter(Mandatory=$true)]
    [string]$Name,
    
    [Parameter(Mandatory=$false)]
    [string]$CompanyName,
    
    [Parameter(Mandatory=$false)]
    [string]$UserPoolId = "us-east-1_3AMjEj02V",
    
    [Parameter(Mandatory=$false)]
    [string]$Environment = "prod"
)

Write-Host "`n=== Provisioning Cognito User in Database ===" -ForegroundColor Cyan
Write-Host "Email: $Email" -ForegroundColor Gray
Write-Host "Name: $Name" -ForegroundColor Gray
Write-Host "Company: $(if ($CompanyName) { $CompanyName } else { "$Name's Company" })" -ForegroundColor Gray

# Get Cognito user details to get the sub (cognitoId)
Write-Host "`nFetching Cognito user details..." -ForegroundColor Cyan
$cognitoUser = aws cognito-idp admin-get-user --user-pool-id $UserPoolId --username $Email | ConvertFrom-Json

if (-not $cognitoUser) {
    Write-Host "[ERROR] User not found in Cognito" -ForegroundColor Red
    exit 1
}

$cognitoId = ($cognitoUser.UserAttributes | Where-Object { $_.Name -eq "sub" }).Value
Write-Host "Cognito ID: $cognitoId" -ForegroundColor Yellow

# Generate IDs
$userId = [System.Guid]::NewGuid().ToString()
$tenantId = [System.Guid]::NewGuid().ToString()
$tenantName = if ($CompanyName) { $CompanyName } else { "$Name's Company" }
$subdomain = $tenantName.ToLower() -replace '[^a-z0-9]', '-' -replace '-+', '-' -replace '^-|-$', ''

Write-Host "`nGenerating records..." -ForegroundColor Cyan
Write-Host "User ID: $userId" -ForegroundColor Gray
Write-Host "Tenant ID: $tenantId" -ForegroundColor Gray
Write-Host "Subdomain: $subdomain" -ForegroundColor Gray

# Create SQL to insert records
$sql = @"
-- Create Tenant
INSERT INTO "Tenant" (id, name, subdomain, "createdAt", "updatedAt")
VALUES ('$tenantId', '$tenantName', '$subdomain', NOW(), NOW())
ON CONFLICT (subdomain) DO NOTHING;

-- Create User
INSERT INTO "User" (id, "cognitoId", email, name, "tenantId", role, "createdAt", "updatedAt")
VALUES ('$userId', '$cognitoId', '$Email', '$Name', '$tenantId', 'owner', NOW(), NOW())
ON CONFLICT ("cognitoId") DO NOTHING;

-- Verify
SELECT u.id, u.email, u.name, u.role, t.name as "tenantName"
FROM "User" u
JOIN "Tenant" t ON u."tenantId" = t.id
WHERE u."cognitoId" = '$cognitoId';
"@

Write-Host "`n=== SQL to Execute ===" -ForegroundColor Yellow
Write-Host $sql -ForegroundColor Gray

# Save SQL to temporary file
$sqlFile = "provision-user-$cognitoId.sql"
$sql | Out-File -FilePath $sqlFile -Encoding UTF8

Write-Host "`nSQL saved to: $sqlFile" -ForegroundColor Green

Write-Host "`n=== Next Steps ===" -ForegroundColor Cyan
Write-Host "Run this SQL against your database using one of these methods:`n" -ForegroundColor White
Write-Host "1. Use AWS RDS Query Editor (if available)" -ForegroundColor Yellow
Write-Host "2. Connect via bastion host and run: psql -f $sqlFile" -ForegroundColor Yellow
Write-Host "3. Use DBeaver/DataGrip and paste the SQL" -ForegroundColor Yellow
Write-Host "`nOr let me know if you want me to execute it via Lambda migration function.`n" -ForegroundColor White
