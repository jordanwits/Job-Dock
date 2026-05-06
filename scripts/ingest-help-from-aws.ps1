# Run help-knowledge ingestion against the DB described in backend\.env (from sync-aws-env).
# Requires: AWS CLI authenticated, Secrets Manager read permission, OPENAI_API_KEY in repo .env.local.
# RDS must be reachable from this machine (prod uses publicly reachable endpoint per stack config).

param(
    [string]$BackendEnv = "",
    [string]$EnvLocal = ""
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent
$backendEnvPath = if ($BackendEnv) { $BackendEnv } else { Join-Path $repoRoot "backend\.env" }
$envLocalPath = if ($EnvLocal) { $EnvLocal } else { Join-Path $repoRoot ".env.local" }

if (-not (Test-Path $backendEnvPath)) {
    Write-Host "Missing $backendEnvPath - run sync-aws-env or deploy-production first." -ForegroundColor Red
    exit 1
}

$content = Get-Content $backendEnvPath -Raw
if ($content -notmatch '(?m)^DATABASE_ENDPOINT=(.+)$') {
    Write-Host "DATABASE_ENDPOINT not found in backend .env." -ForegroundColor Red
    exit 1
}
$endpoint = $matches[1].Trim().Trim('"').Trim("'")
if ([string]::IsNullOrWhiteSpace($endpoint)) {
    Write-Host "DATABASE_ENDPOINT is empty." -ForegroundColor Red
    exit 1
}

if ($content -notmatch '(?m)^DATABASE_SECRET_ARN=(.+)$') {
    Write-Host "DATABASE_SECRET_ARN not found in backend .env." -ForegroundColor Red
    exit 1
}
$arn = $matches[1].Trim().Trim('"').Trim("'")
if ([string]::IsNullOrWhiteSpace($arn)) {
    Write-Host "DATABASE_SECRET_ARN is empty." -ForegroundColor Red
    exit 1
}

Write-Host "Fetching DB credentials from Secrets Manager..." -ForegroundColor Yellow
$secretStr = aws secretsmanager get-secret-value --secret-id $arn --query SecretString --output text
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$sec = $secretStr | ConvertFrom-Json
$user = $sec.username
$pass = $sec.password
if (-not $user -or (-not ($pass))) {
    Write-Host "Secret missing username/password." -ForegroundColor Red
    exit 1
}

$eu = [System.Uri]::EscapeDataString([string]$user)
$ep = [System.Uri]::EscapeDataString([string]$pass)
$ENV:DATABASE_URL = "postgresql://${eu}:${ep}@${endpoint}:5432/jobdock?schema=public"

if (Test-Path $envLocalPath) {
    $lc = Get-Content $envLocalPath -Raw
    if ($lc -match '(?m)^OPENAI_API_KEY\s*=\s*(.+)$' -and -not $ENV:OPENAI_API_KEY) {
        $ENV:OPENAI_API_KEY = $matches[1].Trim().Trim('"').Trim("'")
    }
}
if (-not $ENV:OPENAI_API_KEY) {
    Write-Host "Set OPENAI_API_KEY in environment or add to .env.local" -ForegroundColor Red
    exit 1
}

Write-Host "Running ingest-help (DATABASE_URL host: $endpoint)..." -ForegroundColor Cyan
Push-Location (Join-Path $repoRoot "backend")
npm run ingest-help
$code = $LASTEXITCODE
Pop-Location
exit $code
