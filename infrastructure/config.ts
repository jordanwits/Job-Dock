/**
 * Infrastructure Configuration
 * 
 * Configure your AWS infrastructure settings here
 */

export interface Config {
  env: 'dev' | 'staging' | 'prod'
  region: string
  domain?: string
  defaultTenantId?: string
  email?: string
  database: {
    engine: 'aurora-postgresql'
    minCapacity: number // ACU (Aurora Capacity Units)
    maxCapacity: number // ACU
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
    database: {
      engine: 'aurora-postgresql',
      minCapacity: 0.5, // Minimum for cost savings
      maxCapacity: 2, // Small for dev
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
    // Add your domain here when ready
    // domain: 'jobdock.com',
    database: {
      engine: 'aurora-postgresql',
      minCapacity: 2, // Start higher for production
      maxCapacity: 16, // Auto-scales up to 16 ACU
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

