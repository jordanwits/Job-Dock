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

// Check if .env.local exists
if (fs.existsSync(envLocalPath)) {
  console.log('✓ Loading environment variables from .env.local...')
  require('dotenv').config({ path: envLocalPath })

  // Show which variables were loaded (without showing values)
  const envVars = Object.keys(process.env).filter(
    key => key.includes('RESEND') || key.includes('STRIPE') || key.includes('EMAIL')
  )
  if (envVars.length > 0) {
    console.log(`✓ Loaded ${envVars.length} environment variable(s)`)
  }
} else {
  console.log('⚠ Warning: .env.local not found. Some environment variables may be missing.')
  console.log(`  Expected location: ${envLocalPath}`)
}

// Get the command arguments (everything after the script name)
const args = process.argv.slice(2)

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
