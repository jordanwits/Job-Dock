#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'
import { JobDockStack } from '../lib/jobdock-stack'
import { getConfig } from '../config'

const app = new cdk.App()

// Get environment from context or default to dev
const env = app.node.tryGetContext('env') || 'dev'
const config = getConfig(env)

// AWS Account and Region
// CDK will automatically resolve account/region from AWS credentials if not provided
const account = process.env.CDK_DEFAULT_ACCOUNT
const region = config.region || process.env.CDK_DEFAULT_REGION

// If account/region not provided, CDK will resolve from AWS credentials
const envConfig: cdk.Environment | undefined = account && region
  ? { account, region }
  : undefined

// Create stack
new JobDockStack(app, `JobDockStack-${config.env}`, {
  env: envConfig,
  config,
  description: `JobDock Infrastructure - ${config.env} environment`,
})

app.synth()

