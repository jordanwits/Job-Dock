# Get DKIM Records for thejobdock.com
Write-Host "`nChecking DKIM status for thejobdock.com..." -ForegroundColor Yellow

# Try to enable DKIM
Write-Host "Enabling DKIM..." -ForegroundColor Cyan
aws ses set-identity-dkim-enabled --identity thejobdock.com --dkim-enabled --region us-east-1 2>&1 | Out-Null

# Get DKIM attributes
$result = aws ses get-identity-dkim-attributes --identities thejobdock.com --region us-east-1 | ConvertFrom-Json

$dkimStatus = $result.DkimAttributes.'thejobdock.com'

Write-Host "`nDKIM Status: $($dkimStatus.DkimVerificationStatus)" -ForegroundColor $(if ($dkimStatus.DkimVerificationStatus -eq "Success") { "Green" } else { "Yellow" })

if ($dkimStatus.DkimTokens) {
    Write-Host "`n✅ DKIM Tokens Available!" -ForegroundColor Green
    Write-Host "`nAdd these 3 CNAME records to your DNS:" -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    
    $i = 1
    foreach ($token in $dkimStatus.DkimTokens) {
        Write-Host "`nRecord ${i}:" -ForegroundColor Yellow
        Write-Host "  Type: CNAME" -ForegroundColor White
        Write-Host "  Name: $token._domainkey" -ForegroundColor White
        Write-Host "  Value: $token.dkim.amazonses.com" -ForegroundColor White
        $i++
    }
    
    Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host "`n✅ After adding these records, your emails will have:" -ForegroundColor Green
    Write-Host "   - DKIM signature verification" -ForegroundColor White
    Write-Host "   - Better deliverability (less spam)" -ForegroundColor White
    Write-Host "   - Professional email authentication" -ForegroundColor White
} else {
    Write-Host "`n⚠️  DKIM tokens not available yet." -ForegroundColor Yellow
    Write-Host "This usually means the TXT record hasn't propagated yet." -ForegroundColor White
    Write-Host "`nPlease:" -ForegroundColor Cyan
    Write-Host "  1. Make sure you added the TXT record to your DNS" -ForegroundColor White
    Write-Host "  2. Wait 15-30 minutes for DNS propagation" -ForegroundColor White
    Write-Host "  3. Run this script again" -ForegroundColor White
}
