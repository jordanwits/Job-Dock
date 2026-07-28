#!/usr/bin/env node

/**
 * Deployment script that loads .env.local before running CDK
 * This ensures environment variables like RESEND_API_KEY are available
 */

const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

// Path to .env.local file (in parent directory)
const envLocalPath = path.resolve(__dirname, '..', '.env.local')
const envPath = path.resolve(__dirname, '..', '.env')

// Load .env first, then .env.local with override so .env.local always wins
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath })
}
if (fs.existsSync(envLocalPath)) {
  console.log('✓ Loading environment variables from .env.local...')
  require('dotenv').config({ path: envLocalPath, override: true })
} else {
  console.log('⚠ .env.local not found. RESEND_API_KEY must be set in environment for prod.')
}

// Show which variables were loaded. Names and lengths only — never any part of the value.
// These lines land in terminal scrollback and CI logs, so even a leading fragment of a live
// Stripe or Twilio key is a leak. Length is enough to spot a truncated or empty paste.
const envVars = Object.keys(process.env).filter(
  key => key.includes('RESEND') || key.includes('STRIPE') || key.includes('EMAIL') || key.includes('TEAM_TESTING') || key.includes('TWILIO')
)
if (envVars.length > 0) {
  console.log(`✓ Loaded ${envVars.length} environment variable(s) for deploy`)
  envVars.forEach(key => {
    const value = process.env[key]
    const displayValue = value && value.length > 0 ? `set (${value.length} chars)` : '(empty)'
    console.log(`   ${key}: ${displayValue}`)
  })
} else {
  console.log('⚠ No email/stripe environment variables found')
}

// Block prod deploy if RESEND_API_KEY is missing (prevents overwriting with empty)
const args = process.argv.slice(2)
const isProdDeploy = args.some(a => a.includes('prod') || a.includes('JobDockStack-prod'))
if (isProdDeploy && (!process.env.RESEND_API_KEY || !String(process.env.RESEND_API_KEY).trim())) {
  console.error('')
  console.error('❌ RESEND_API_KEY must be set before deploying to prod.')
  console.error('   Add RESEND_API_KEY to .env.local and try again.')
  console.error('   Emails (bookings, assignments, invites) will not send without it.')
  process.exit(1)
}
if (isProdDeploy) {
  const keyValue = process.env.RESEND_API_KEY || ''
  if (keyValue && keyValue.trim().length > 0) {
    console.log(`✓ RESEND_API_KEY is set (${keyValue.length} chars, emails will send in prod)`)
  } else {
    console.error('❌ RESEND_API_KEY is empty or not set!')
    console.error('   Check that .env.local exists and contains RESEND_API_KEY=re_...')
    console.error(`   Current value: ${keyValue.length === 0 ? '(undefined or empty)' : `(${keyValue.length} chars of whitespace)`}`)
  }
}

// Build the CDK command
const cdkCommand = `npx aws-cdk ${args.join(' ')}`

console.log('')
console.log('Running:', cdkCommand)
console.log('')

// Execute the CDK command with environment variables
try {
  execSync(cdkCommand, {
    stdio: 'inherit',
    env: {
      ...process.env, // Include all current environment variables (including loaded ones)
    },
  })
} catch (error) {
  process.exit(error.status || 1)
}
