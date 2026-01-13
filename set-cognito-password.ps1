#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Set a permanent password for a Cognito user
.DESCRIPTION
    This script sets a permanent password for a user in AWS Cognito,
    bypassing the "FORCE_CHANGE_PASSWORD" challenge.
#>

param(
    [Parameter(Mandatory=$false)]
    [string]$UserPoolId = "us-east-1_3AMjEj02V",
    
    [Parameter(Mandatory=$false)]
    [string]$Username = "davewitbeck@gmail.com",
    
    [Parameter(Mandatory=$true)]
    [string]$Password
)

Write-Host "`nSetting permanent password for user..." -ForegroundColor Cyan
Write-Host "User Pool: $UserPoolId" -ForegroundColor Gray
Write-Host "Username: $Username" -ForegroundColor Gray

try {
    # Set the permanent password
    aws cognito-idp admin-set-user-password `
        --user-pool-id $UserPoolId `
        --username $Username `
        --password $Password `
        --permanent
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n[SUCCESS] Password set successfully!" -ForegroundColor Green
        Write-Host "The user can now log in with the new password." -ForegroundColor Green
        
        # Get updated user status
        Write-Host "`nFetching updated user status..." -ForegroundColor Cyan
        $userInfo = aws cognito-idp admin-get-user `
            --user-pool-id $UserPoolId `
            --username $Username | ConvertFrom-Json
        
        Write-Host "User Status: $($userInfo.UserStatus)" -ForegroundColor Yellow
    } else {
        Write-Host "`n[ERROR] Failed to set password" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "`n[ERROR] Error: $_" -ForegroundColor Red
    exit 1
}
