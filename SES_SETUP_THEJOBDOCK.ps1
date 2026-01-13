# AWS SES Setup for thejobdock.com
# This script helps you verify your new email domain and move out of SES sandbox

Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "AWS SES Setup for JobDock" -ForegroundColor Cyan
Write-Host "============================================`n" -ForegroundColor Cyan

$region = "us-east-1"
$email = "noreply@thejobdock.com"
$domain = "thejobdock.com"

# Step 1: Verify the email address (quick method)
Write-Host "Step 1: Verifying email address: $email" -ForegroundColor Yellow
Write-Host "This will send a verification email to $email" -ForegroundColor White
$verifyEmail = Read-Host "Do you want to verify this email address? (y/n)"

if ($verifyEmail -eq "y") {
    Write-Host "`nSending verification email..." -ForegroundColor Green
    aws ses verify-email-identity --email-address $email --region $region
    
    Write-Host "`n✅ Verification email sent!" -ForegroundColor Green
    Write-Host "⚠️  ACTION REQUIRED:" -ForegroundColor Yellow
    Write-Host "   1. Check the inbox for $email" -ForegroundColor White
    Write-Host "   2. Find the email from 'Amazon SES'" -ForegroundColor White
    Write-Host "   3. Click the verification link" -ForegroundColor White
    Write-Host "   4. Wait for confirmation (usually instant)" -ForegroundColor White
}

# Step 2: Check verification status
Write-Host "`n`nStep 2: Checking verification status..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

$status = aws ses get-identity-verification-attributes --identities $email --region $region | ConvertFrom-Json
$verificationStatus = $status.VerificationAttributes.$email.VerificationStatus

Write-Host "Current status: $verificationStatus" -ForegroundColor $(if ($verificationStatus -eq "Success") { "Green" } else { "Yellow" })

if ($verificationStatus -ne "Success") {
    Write-Host "`n⚠️  Email not verified yet." -ForegroundColor Yellow
    Write-Host "   Please click the verification link in the email sent to $email" -ForegroundColor White
    Write-Host "   Then run this script again to continue." -ForegroundColor White
    Write-Host "`nTo check status later, run:" -ForegroundColor Cyan
    Write-Host "aws ses get-identity-verification-attributes --identities $email --region $region" -ForegroundColor White
    exit
}

# Step 3: Optional - Verify entire domain (recommended for production)
Write-Host "`n`nStep 3: Domain Verification (Optional but Recommended)" -ForegroundColor Yellow
Write-Host "Verifying the entire domain ($domain) allows you to send from any email address" -ForegroundColor White
Write-Host "at that domain (e.g., support@thejobdock.com, info@thejobdock.com, etc.)" -ForegroundColor White

$verifyDomain = Read-Host "`nDo you want to verify the entire domain? (y/n)"

if ($verifyDomain -eq "y") {
    Write-Host "`nInitiating domain verification..." -ForegroundColor Green
    $domainResult = aws ses verify-domain-identity --domain $domain --region $region | ConvertFrom-Json
    $verificationToken = $domainResult.VerificationToken
    
    Write-Host "`n✅ Domain verification initiated!" -ForegroundColor Green
    Write-Host "`n⚠️  ACTION REQUIRED: Add this TXT record to your DNS:" -ForegroundColor Yellow
    Write-Host "   Name/Host: _amazonses.$domain" -ForegroundColor White
    Write-Host "   Type: TXT" -ForegroundColor White
    Write-Host "   Value: $verificationToken" -ForegroundColor White
    Write-Host "`n   Go to your domain registrar (GoDaddy, Namecheap, etc.)" -ForegroundColor Cyan
    Write-Host "   Add the TXT record above" -ForegroundColor Cyan
    Write-Host "   Wait 24-48 hours for DNS propagation" -ForegroundColor Cyan
    
    # Enable DKIM for better deliverability
    Write-Host "`n`nEnabling DKIM (improves email deliverability)..." -ForegroundColor Green
    aws ses set-identity-dkim-enabled --identity $domain --dkim-enabled --region $region
    
    Start-Sleep -Seconds 2
    $dkimResult = aws ses get-identity-dkim-attributes --identities $domain --region $region | ConvertFrom-Json
    $dkimTokens = $dkimResult.DkimAttributes.$domain.DkimTokens
    
    Write-Host "`n⚠️  ALSO ADD THESE CNAME RECORDS for DKIM:" -ForegroundColor Yellow
    foreach ($token in $dkimTokens) {
        Write-Host "   Name: ${token}._domainkey.$domain" -ForegroundColor White
        Write-Host "   Type: CNAME" -ForegroundColor White
        Write-Host "   Value: ${token}.dkim.amazonses.com" -ForegroundColor White
        Write-Host "" -ForegroundColor White
    }
}

# Step 4: Check SES Sandbox Status
Write-Host "`n`nStep 4: Checking SES Sandbox Status..." -ForegroundColor Yellow
$accountDetails = aws ses get-account-sending-enabled --region $region | ConvertFrom-Json

Write-Host "`nSES Sandbox Status:" -ForegroundColor Cyan
Write-Host "In Sandbox Mode: " -NoNewline
$sandboxStatus = aws sesv2 get-account --region $region 2>$null
if ($sandboxStatus) {
    $account = $sandboxStatus | ConvertFrom-Json
    if ($account.ProductionAccessEnabled -eq $true) {
        Write-Host "NO (Production Access Enabled) ✅" -ForegroundColor Green
    } else {
        Write-Host "YES (Limited to verified emails only) ⚠️" -ForegroundColor Yellow
    }
} else {
    Write-Host "Unable to determine (likely IN SANDBOX)" -ForegroundColor Yellow
}

# Step 5: Request Production Access
Write-Host "`n`nStep 5: Moving Out of SES Sandbox" -ForegroundColor Yellow
Write-Host "To send emails to ANY email address (not just verified ones)," -ForegroundColor White
Write-Host "you need to request production access." -ForegroundColor White

Write-Host "`n📋 Use this information for your request:" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "Use Case: Transactional emails for contractor management platform" -ForegroundColor White
Write-Host "Website: https://thejobdock.com" -ForegroundColor White
Write-Host "Email Types: Booking confirmations, quotes, invoices, notifications" -ForegroundColor White
Write-Host "Expected Volume: 50-200 emails per day initially" -ForegroundColor White
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan

Write-Host "`n🌐 To request production access:" -ForegroundColor Yellow
Write-Host "   1. Go to: https://console.aws.amazon.com/ses/" -ForegroundColor White
Write-Host "   2. Click 'Account dashboard' in left sidebar" -ForegroundColor White
Write-Host "   3. Find 'Production access' section" -ForegroundColor White
Write-Host "   4. Click 'Request production access'" -ForegroundColor White
Write-Host "   5. Fill in the form with the information above" -ForegroundColor White
Write-Host "   6. Usually approved within 24 hours" -ForegroundColor White

Write-Host "`n`n✅ Summary:" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "✅ Configuration updated to use: $email" -ForegroundColor Green

if ($verificationStatus -eq "Success") {
    Write-Host "✅ Email address verified" -ForegroundColor Green
} else {
    Write-Host "⏳ Email verification pending - check your inbox!" -ForegroundColor Yellow
}

Write-Host "`n📋 Next Steps:" -ForegroundColor Cyan
Write-Host "   1. Verify your email by clicking the link sent to $email" -ForegroundColor White
Write-Host "   2. Request production access via AWS Console" -ForegroundColor White
Write-Host "   3. Deploy updated infrastructure:" -ForegroundColor White
Write-Host "      cd infrastructure" -ForegroundColor Gray
Write-Host "      npm run deploy:prod" -ForegroundColor Gray
Write-Host "`n============================================`n" -ForegroundColor Cyan
