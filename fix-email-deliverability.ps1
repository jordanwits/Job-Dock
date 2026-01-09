# Email Deliverability Fix Script
# Run this AFTER adding DNS records

Write-Host "Checking domain verification status..." -ForegroundColor Cyan
$domainStatus = aws ses get-identity-verification-attributes --identities westwavecreative.com --region us-east-1 | ConvertFrom-Json

if ($domainStatus.VerificationAttributes.'westwavecreative.com'.VerificationStatus -eq "Success") {
    Write-Host "✓ Domain verified!" -ForegroundColor Green
    
    Write-Host "`nEnabling DKIM..." -ForegroundColor Cyan
    aws ses set-identity-dkim-enabled --identity westwavecreative.com --dkim-enabled --region us-east-1
    
    Write-Host "`nGetting DKIM tokens for DNS..." -ForegroundColor Cyan
    $dkimTokens = aws ses get-identity-dkim-attributes --identities westwavecreative.com --region us-east-1 | ConvertFrom-Json
    
    Write-Host "`n========================================" -ForegroundColor Yellow
    Write-Host "ADD THESE 3 CNAME RECORDS TO YOUR DNS:" -ForegroundColor Yellow
    Write-Host "========================================`n" -ForegroundColor Yellow
    
    $tokens = $dkimTokens.DkimAttributes.'westwavecreative.com'.DkimTokens
    $i = 1
    foreach ($token in $tokens) {
        Write-Host "DKIM Record ${i}:" -ForegroundColor Cyan
        Write-Host "  Type: CNAME"
        Write-Host "  Name: $token._domainkey.westwavecreative.com"
        Write-Host "  Value: $token.dkim.amazonses.com"
        Write-Host "  TTL: 1800"
        Write-Host ""
        $i++
    }
    
    Write-Host "After adding these CNAME records, wait 15-30 minutes for DNS propagation." -ForegroundColor Yellow
} else {
    Write-Host "✗ Domain not verified yet. Please add the DNS records first and wait 15-30 minutes." -ForegroundColor Red
    Write-Host "`nCurrent status: $($domainStatus.VerificationAttributes.'westwavecreative.com'.VerificationStatus)" -ForegroundColor Yellow
}

Write-Host "`nChecking SES production access..." -ForegroundColor Cyan
$prodAccess = aws sesv2 get-account --region us-east-1 --query ProductionAccessEnabled --output text

if ($prodAccess -eq "false") {
    Write-Host "✗ SES is still in SANDBOX mode" -ForegroundColor Red
    Write-Host ""
    Write-Host "You need to request production access to send to any email address." -ForegroundColor Yellow
    Write-Host "Visit: https://console.aws.amazon.com/ses/" -ForegroundColor Cyan
    Write-Host "Then: Account dashboard -> Request production access" -ForegroundColor Cyan
    Write-Host ""
} else {
    Write-Host "✓ SES production access enabled!" -ForegroundColor Green
}
