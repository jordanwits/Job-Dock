/**
 * Infrastructure Configuration
 * 
 * Configure your AWS infrastructure settings here
 */

export interface Config {
  env: 'dev' | 'staging' | 'prod'
  region: string
  domain?: string
  vercelDomain?: string // e.g. 'jobdock.vercel.app' or 'app.yourdomain.com'
  defaultTenantId?: string
  email?: string
  sesFromAddress?: string
  cloudfrontCertificateArn?: string
  database: {
    engine: 'aurora-postgresql' | 'rds-postgresql'
    minCapacity?: number // ACU (Aurora Capacity Units) - only for Aurora
    maxCapacity?: number // ACU - only for Aurora
    instanceClass?: string // e.g. 't3.micro' - only for RDS instance
    instanceSize?: string // e.g. 'MICRO' - only for RDS instance
  }
  lambda: {
    timeout: number // seconds
    memorySize: number // MB
  }
  cognito: {
    passwordPolicy: {
      minLength: number
      requireUppercase: boolean
      requireLowercase: boolean
      requireNumbers: boolean
      requireSymbols: boolean
    }
  }
}

export const configs: Record<string, Config> = {
  dev: {
    env: 'dev',
    region: 'us-east-1',
    defaultTenantId: 'demo-tenant',
    sesFromAddress: 'noreply@thejobdock.com',
    database: {
      engine: 'rds-postgresql',
      instanceClass: 't3',
      instanceSize: 'MICRO',
    },
    lambda: {
      timeout: 30,
      memorySize: 512,
    },
    cognito: {
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSymbols: false,
      },
    },
  },
  staging: {
    env: 'staging',
    region: 'us-east-1',
    sesFromAddress: 'noreply@thejobdock.com',
    database: {
      engine: 'aurora-postgresql',
      minCapacity: 1,
      maxCapacity: 4,
    },
    lambda: {
      timeout: 30,
      memorySize: 1024,
    },
    cognito: {
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSymbols: true,
      },
    },
  },
  prod: {
    env: 'prod',
    region: 'us-east-1',
    // Custom domain for Vercel deployment
    domain: 'thejobdock.com',
    sesFromAddress: 'noreply@thejobdock.com',
    database: {
      engine: 'rds-postgresql',
      instanceClass: 't3',
      instanceSize: 'MICRO', // Free tier eligible
    },
    lambda: {
      timeout: 30,
      memorySize: 1024,
    },
    cognito: {
      passwordPolicy: {
        minLength: 12,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSymbols: true,
      },
    },
  },
}

export function getConfig(env: string = 'dev'): Config {
  return configs[env] || configs.dev
}

