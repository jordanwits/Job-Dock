import * as cdk from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as rds from 'aws-cdk-lib/aws-rds'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs'
import * as apigateway from 'aws-cdk-lib/aws-apigateway'
import * as cognito from 'aws-cdk-lib/aws-cognito'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as cloudfrontOrigins from 'aws-cdk-lib/aws-cloudfront-origins'
import * as acm from 'aws-cdk-lib/aws-certificatemanager'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as events from 'aws-cdk-lib/aws-events'
import * as targets from 'aws-cdk-lib/aws-events-targets'
import * as path from 'path'
import { Construct } from 'constructs'
import { Config } from '../config'

export interface JobDockStackProps extends cdk.StackProps {
  config: Config
}

export class JobDockStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc
  public readonly database: rds.DatabaseInstance | rds.DatabaseCluster
  public readonly userPool: cognito.UserPool
  public readonly userPoolClient: cognito.UserPoolClient
  public readonly api: apigateway.RestApi
  public readonly frontendBucket: s3.Bucket
  public readonly filesBucket: s3.Bucket
  public readonly distribution: cloudfront.Distribution

  constructor(scope: Construct, id: string, props: JobDockStackProps) {
    super(scope, id, props)

    const { config } = props
    const backendDir = path.resolve(__dirname, '..', '..', 'backend')

    // ============================================
    // 1. VPC & Networking
    // ============================================
    const useNatInstance = config.network.natStrategy === 'instance'

    // IMPORTANT:
    // We must not create our own duplicate `0.0.0.0/0` routes for private subnets.
    // The `ec2.Vpc` construct already creates and owns the private subnet DefaultRoute
    // resources when using `PRIVATE_WITH_EGRESS`. Creating an additional `AWS::EC2::Route`
    // for the same route table + destination causes CloudFormation to fail with:
    // "The route identified by 0.0.0.0/0 already exists."
    //
    // To keep deployments stable, we use CDK's built-in NAT providers so the VPC construct
    // manages the NAT resources + routes consistently.

    const enableNat = config.env !== 'prod'
    // NOTE:
    // NAT Instance support in CDK v2 is deprecated and can fail to resolve a suitable AMI
    // (we hit: "No AMI found that matched the search criteria").
    // To keep deployments reliable, use NAT Gateway for non-prod.
    const natGatewayProvider = enableNat ? ec2.NatProvider.gateway() : undefined

    this.vpc = new ec2.Vpc(this, 'VPC', {
      maxAzs: 2, // Multi-AZ for high availability
      natGateways: enableNat ? 1 : 0,
      ...(enableNat && natGatewayProvider ? { natGatewayProvider } : {}),
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    })

    // Helper to select correct private subnet type
    const privateSubnetSelection = { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }

    // Security Group for Database
    const dbSecurityGroup = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for Aurora database',
      allowAllOutbound: false,
    })

    // Security Group for Lambda
    const lambdaSecurityGroup = new ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for Lambda functions',
      allowAllOutbound: true,
    })

    // Allow Lambda to access Database
    dbSecurityGroup.addIngressRule(
      lambdaSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow Lambda to access database'
    )

    // ============================================
    // 2. Database (RDS PostgreSQL or Aurora Serverless v2)
    // ============================================
    // For production: use public subnets to eliminate NAT Gateway costs
    // For dev/staging: keep private subnets
    // Create separate subnet groups to allow CloudFormation to transition properly
    const databaseSubnetGroup = config.env === 'prod'
      ? new rds.SubnetGroup(this, 'DatabaseSubnetGroupPublic', {
          vpc: this.vpc,
          description: 'Subnet group for database (public subnets for production)',
          vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
        })
      : new rds.SubnetGroup(this, 'DatabaseSubnetGroup', {
          vpc: this.vpc,
          description: 'Subnet group for database',
          vpcSubnets: privateSubnetSelection,
        })

    // Use regular RDS PostgreSQL for dev/prod (Free Tier eligible)
    // Use Aurora Serverless v2 for staging (auto-scaling)
    if (config.database.engine === 'rds-postgresql') {
      // Regular RDS PostgreSQL instance (Free Tier: db.t3.micro)
      const instanceClass = config.database.instanceClass || 't3'
      const instanceSize = config.database.instanceSize || 'MICRO'

      this.database = new rds.DatabaseInstance(this, 'Database', {
        engine: rds.DatabaseInstanceEngine.postgres({
          version: rds.PostgresEngineVersion.VER_16_3, // Use widely available Postgres 16.x build
        }),
        credentials: rds.Credentials.fromGeneratedSecret('dbadmin', {
          secretName: `jobdock-db-credentials-${config.env}`,
        }),
        instanceType: ec2.InstanceType.of(
          ec2.InstanceClass[instanceClass.toUpperCase() as keyof typeof ec2.InstanceClass],
          ec2.InstanceSize[instanceSize as keyof typeof ec2.InstanceSize]
        ),
        vpc: this.vpc,
        vpcSubnets: config.env === 'prod' 
          ? { subnetType: ec2.SubnetType.PUBLIC }
          : privateSubnetSelection,
        subnetGroup: databaseSubnetGroup,
        securityGroups: [dbSecurityGroup],
        publiclyAccessible: config.env === 'prod', // Enable public access for prod to eliminate NAT Gateway
        databaseName: 'jobdock',
        removalPolicy: config.env === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
        backupRetention: cdk.Duration.days(1), // Free tier limit
        deleteAutomatedBackups: config.env !== 'prod',
        storageEncrypted: true,
        monitoringInterval: cdk.Duration.seconds(60),
        enablePerformanceInsights: false, // Not available on t3.micro
      })
    } else {
      // Aurora Serverless v2 for staging
      this.database = new rds.DatabaseCluster(this, 'Database', {
        engine: rds.DatabaseClusterEngine.auroraPostgres({
          version: rds.AuroraPostgresEngineVersion.VER_15_3,
        }),
        credentials: rds.Credentials.fromGeneratedSecret('dbadmin', {
          secretName: `jobdock-db-credentials-${config.env}`,
        }),
        defaultDatabaseName: 'jobdock',
        vpc: this.vpc,
        vpcSubnets: privateSubnetSelection,
        subnetGroup: databaseSubnetGroup,
        securityGroups: [dbSecurityGroup],
        writer: rds.ClusterInstance.serverlessV2('writer', {
          scaleWithWriter: true,
        }),
        serverlessV2MinCapacity: config.database.minCapacity!,
        serverlessV2MaxCapacity: config.database.maxCapacity!,
        removalPolicy: config.env === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
        backup: {
          retention: cdk.Duration.days(7),
          preferredWindow: '03:00-04:00',
        },
        storageEncrypted: true,
        monitoringInterval: cdk.Duration.seconds(60),
        enablePerformanceInsights: config.env === 'prod',
      })
    }

    // ============================================
    // 3. Cognito User Pool (Authentication)
    // ============================================
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `jobdock-users-${config.env}`,
      selfSignUpEnabled: true, // Allow users to self-register
      signInAliases: {
        email: true,
      },
      // Removed autoVerify since we auto-confirm users in the backend
      // This prevents unnecessary verification emails from being sent
      passwordPolicy: {
        minLength: config.cognito.passwordPolicy.minLength,
        requireUppercase: config.cognito.passwordPolicy.requireUppercase,
        requireLowercase: config.cognito.passwordPolicy.requireLowercase,
        requireDigits: config.cognito.passwordPolicy.requireNumbers,
        requireSymbols: config.cognito.passwordPolicy.requireSymbols,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: config.env === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    })

    this.userPoolClient = this.userPool.addClient('WebClient', {
      userPoolClientName: `jobdock-web-client-${config.env}`,
      generateSecret: false, // For frontend use
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [cognito.OAuthScope.EMAIL, cognito.OAuthScope.OPENID, cognito.OAuthScope.PROFILE],
        callbackUrls: [
          'http://localhost:5173', // Local development
          ...(config.vercelDomain ? [`https://${config.vercelDomain}`] : []),
          ...(config.domain ? [`https://${config.domain}`, `https://www.${config.domain}`] : []),
        ].filter(Boolean),
      },
    })

    // ============================================
    // 4. S3 Buckets
    // ============================================
    // Frontend hosting bucket
    this.frontendBucket = new s3.Bucket(this, 'FrontendBucket', {
      bucketName: `jobdock-frontend-${config.env}-${this.account}`,
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: config.env === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: config.env !== 'prod',
      versioned: config.env === 'prod',
      encryption: s3.BucketEncryption.S3_MANAGED,
    })

    // Files storage bucket
    this.filesBucket = new s3.Bucket(this, 'FilesBucket', {
      bucketName: `jobdock-files-${config.env}-${this.account}`,
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: config.env === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      encryption: s3.BucketEncryption.S3_MANAGED,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
          allowedOrigins: ['*'], // Configure with your domain in production
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
    })

    // CloudFront Distribution for Frontend
    const distributionProps: cloudfront.DistributionProps = {
      defaultBehavior: {
        origin: cloudfrontOrigins.S3BucketOrigin.withOriginAccessControl(this.frontendBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.seconds(0),
        },
      ],
    }

    // Add custom domain and certificate if configured
    if (config.domain && config.cloudfrontCertificateArn) {
      const certificate = acm.Certificate.fromCertificateArn(
        this,
        'CloudFrontCertificate',
        config.cloudfrontCertificateArn
      )

      const domainNames = [config.domain]

      // Optionally add www subdomain if domain doesn't start with a subdomain
      if (!config.domain.includes('.') || config.domain.split('.').length === 2) {
        domainNames.push(`www.${config.domain}`)
      }

      this.distribution = new cloudfront.Distribution(this, 'FrontendDistribution', {
        ...distributionProps,
        domainNames,
        certificate,
      })
    } else {
      this.distribution = new cloudfront.Distribution(
        this,
        'FrontendDistribution',
        distributionProps
      )
    }

    // ============================================
    // 5. Lambda Execution Role
    // ============================================
    const lambdaRole = new iam.Role(this, 'LambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'),
      ],
    })

    // Grant Lambda access to database
    this.database.secret?.grantRead(lambdaRole)
    this.database.grantConnect(lambdaRole, 'jobdock')

    // Grant Lambda access to S3
    this.filesBucket.grantReadWrite(lambdaRole)

    // Grant Lambda access to Cognito
    this.userPool.grant(
      lambdaRole,
      'cognito-idp:AdminCreateUser',
      'cognito-idp:AdminGetUser',
      'cognito-idp:AdminUpdateUserAttributes',
      'cognito-idp:AdminDeleteUser',
      'cognito-idp:AdminConfirmSignUp'
    )

    // ============================================
    // 6. API Gateway
    // ============================================
    this.api = new apigateway.RestApi(this, 'Api', {
      restApiName: `jobdock-api-${config.env}`,
      description: `JobDock API - ${config.env} environment`,
      binaryMediaTypes: ['multipart/form-data', 'image/*', 'application/pdf'],
      defaultCorsPreflightOptions: {
        allowOrigins: [
          'http://localhost:5173', // Local dev
          'http://localhost:3000',
          ...(config.vercelDomain ? [`https://${config.vercelDomain}`] : []),
          ...(config.domain ? [`https://${config.domain}`, `https://www.${config.domain}`] : []),
        ].filter(Boolean),
        allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID'],
        maxAge: cdk.Duration.seconds(3600),
      },
      deployOptions: {
        stageName: config.env,
        throttlingRateLimit: 1000,
        throttlingBurstLimit: 2000,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: config.env !== 'prod',
        metricsEnabled: true,
      },
    })

    // Add Gateway Response for 504 errors (integration timeout) to include CORS headers
    this.api.addGatewayResponse('GatewayResponse504', {
      type: apigateway.ResponseType.INTEGRATION_TIMEOUT,
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
        'Access-Control-Allow-Headers': "'Content-Type,Authorization,X-Tenant-ID'",
        'Access-Control-Allow-Methods': "'GET,POST,PUT,DELETE,OPTIONS'",
      },
      templates: {
        'application/json': JSON.stringify({
          message: 'Gateway timeout. The request took too long to process.',
          statusCode: 504,
        }),
      },
    })

    // ============================================
    // 7. Lambda Functions (Placeholder - will be implemented separately)
    // ============================================
    // Authentication lambda
    const databaseHost =
      this.database instanceof rds.DatabaseInstance
        ? this.database.instanceEndpoint.hostname
        : this.database.clusterEndpoint.hostname
    const databaseSecret = this.database.secret
    const databaseUserSecret = databaseSecret
      ? databaseSecret.secretValueFromJson('username')
      : cdk.SecretValue.unsafePlainText('dbadmin')
    const databasePasswordSecret = databaseSecret
      ? databaseSecret.secretValueFromJson('password')
      : cdk.SecretValue.unsafePlainText('')

    const createCopyPrismaCmd = (outputDir: string) => {
      const targetDir = path.join(outputDir, 'node_modules').replace(/\\/g, '\\\\')
      const script = [
        "const fs=require('fs');",
        "const path=require('path');",
        'const target=process.argv[1];',
        'fs.mkdirSync(target,{recursive:true});',
        "fs.cpSync(path.join(process.cwd(),'node_modules','.prisma'), path.join(target,'.prisma'), {recursive:true});",
      ].join('')
      return [`node -e "${script}"`, `"${targetDir}"`].join(' ')
    }

    const commonBundlingOptions: lambdaNodejs.NodejsFunctionProps['bundling'] = {
      minify: true,
      sourceMap: true,
      externalModules: ['aws-sdk'],
      tsconfig: path.resolve(backendDir, 'tsconfig.json'),
      commandHooks: {
        beforeBundling(_inputDir: string, outputDir: string) {
          return [`cd ${backendDir}`, 'npx prisma generate', createCopyPrismaCmd(outputDir)]
        },
        beforeInstall() {
          return []
        },
        afterBundling() {
          return []
        },
      },
    }

    const authLambda = new lambdaNodejs.NodejsFunction(this, 'AuthLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.resolve(backendDir, 'src', 'functions', 'auth', 'handler.ts'),
      handler: 'handler',
      bundling: commonBundlingOptions,
      // Remove VPC for production - Lambda can access public RDS directly without NAT Gateway
      ...(config.env !== 'prod' && {
        vpc: this.vpc,
        vpcSubnets: privateSubnetSelection,
        securityGroups: [lambdaSecurityGroup],
      }),
      role: lambdaRole,
      timeout: cdk.Duration.seconds(config.lambda.timeout),
      memorySize: config.lambda.memorySize,
      environment: {
        DATABASE_SECRET_ARN: this.database.secret?.secretArn ?? '',
        DATABASE_ENDPOINT: databaseHost,
        DATABASE_NAME: 'jobdock',
        DATABASE_HOST: databaseHost,
        DATABASE_USER: databaseUserSecret.toString(),
        DATABASE_PASSWORD: databasePasswordSecret.toString(),
        DATABASE_PORT: '5432',
        DATABASE_OPTIONS: 'schema=public',
        USER_POOL_ID: this.userPool.userPoolId,
        USER_POOL_CLIENT_ID: this.userPoolClient.userPoolClientId,
        FILES_BUCKET: this.filesBucket.bucketName,
        ENVIRONMENT: config.env,
        PUBLIC_APP_URL: config.vercelDomain
          ? `https://${config.vercelDomain}`
          : config.domain
            ? `https://${config.domain}`
            : 'http://localhost:3000',
        DEFAULT_TENANT_ID: config.defaultTenantId ?? 'demo-tenant',
        // Email configuration (Resend)
        EMAIL_PROVIDER: 'resend',
        EMAIL_FROM_ADDRESS: config.emailFromAddress || 'noreply@thejobdock.com',
        RESEND_API_KEY: process.env.RESEND_API_KEY || '',
        // Twilio SMS configuration
        TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || '',
        TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || '',
        TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER || '',
        // Stripe billing configuration
        STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
        STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
        STRIPE_PRICE_ID: process.env.STRIPE_PRICE_ID || '',
        STRIPE_TEAM_PRICE_ID: process.env.STRIPE_TEAM_PRICE_ID || '',
        STRIPE_ENFORCE_SUBSCRIPTION: process.env.STRIPE_ENFORCE_SUBSCRIPTION || 'false',
        TEAM_TESTING_SKIP_STRIPE: process.env.TEAM_TESTING_SKIP_STRIPE || 'false',
        // Early access configuration
        EARLY_ACCESS_ENFORCE: config.env === 'prod' || config.env === 'staging' ? 'true' : 'false',
        EARLY_ACCESS_ADMIN_EMAILS:
          process.env.EARLY_ACCESS_ADMIN_EMAILS || 'jordan@westwavecreative.com',
      },
    })

    // Use an explicit API Gateway IAM role + direct AWS_PROXY integration URI
    // to avoid generating Lambda::Permission resources (which can create a
    // CloudFormation circular dependency with ApiDeployment/Stage).
    const apiGatewayInvokeRole = new iam.Role(this, 'ApiGatewayInvokeRole', {
      assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
    })

    const lambdaAwsProxyIntegration = (fn: lambda.IFunction) => {
      // Allow API Gateway role to invoke the function (same-account IAM auth)
      fn.grantInvoke(apiGatewayInvokeRole)
      return new apigateway.Integration({
        type: apigateway.IntegrationType.AWS_PROXY,
        integrationHttpMethod: 'POST',
        uri: `arn:aws:apigateway:${cdk.Stack.of(this).region}:lambda:path/2015-03-31/functions/${fn.functionArn}/invocations`,
        options: {
          credentialsRole: apiGatewayInvokeRole,
        },
      })
    }

    const authIntegration = lambdaAwsProxyIntegration(authLambda)

    // Data API lambda (temporary mock-backed implementation)
    const dataLambda = new lambdaNodejs.NodejsFunction(this, 'DataLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.resolve(backendDir, 'src', 'functions', 'data', 'handler.ts'),
      handler: 'handler',
      bundling: commonBundlingOptions,
      // Remove VPC for production - Lambda can access public RDS directly without NAT Gateway
      ...(config.env !== 'prod' && {
        vpc: this.vpc,
        vpcSubnets: privateSubnetSelection,
        securityGroups: [lambdaSecurityGroup],
      }),
      role: lambdaRole,
      timeout: cdk.Duration.seconds(config.lambda.timeout),
      memorySize: config.lambda.memorySize,
      environment: {
        DATABASE_SECRET_ARN: this.database.secret?.secretArn ?? '',
        DATABASE_ENDPOINT: databaseHost,
        DATABASE_NAME: 'jobdock',
        DATABASE_HOST: databaseHost,
        DATABASE_USER: databaseUserSecret.toString(),
        DATABASE_PASSWORD: databasePasswordSecret.toString(),
        DATABASE_PORT: '5432',
        DATABASE_OPTIONS: 'schema=public',
        USER_POOL_ID: this.userPool.userPoolId,
        USER_POOL_CLIENT_ID: this.userPoolClient.userPoolClientId,
        FILES_BUCKET: this.filesBucket.bucketName,
        ENVIRONMENT: config.env,
        // IMPORTANT: Do NOT use `this.api.url` here. It references the deployment stage and can
        // create a CloudFormation circular dependency (API deployment ↔ Lambda env).
        // Build the execute-api base URL from restApiId instead (no stage resource dependency).
        API_BASE_URL: `https://${this.api.restApiId}.execute-api.${cdk.Stack.of(this).region}.${cdk.Stack.of(this).urlSuffix}/${config.env}`,
        PUBLIC_APP_URL: config.vercelDomain
          ? `https://${config.vercelDomain}`
          : config.domain
            ? `https://${config.domain}`
            : 'http://localhost:3000',
        DEFAULT_TENANT_ID: config.defaultTenantId ?? 'demo-tenant',
        // Email configuration (Resend)
        EMAIL_PROVIDER: 'resend',
        EMAIL_FROM_ADDRESS: config.emailFromAddress || 'noreply@thejobdock.com',
        RESEND_API_KEY: process.env.RESEND_API_KEY || '',
        // Twilio SMS configuration
        TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || '',
        TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || '',
        TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER || '',
        // Stripe billing configuration
        STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
        STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
        STRIPE_PRICE_ID: process.env.STRIPE_PRICE_ID || '',
        STRIPE_TEAM_PRICE_ID: process.env.STRIPE_TEAM_PRICE_ID || '',
        STRIPE_ENFORCE_SUBSCRIPTION: process.env.STRIPE_ENFORCE_SUBSCRIPTION || 'false',
        TEAM_TESTING_SKIP_STRIPE: process.env.TEAM_TESTING_SKIP_STRIPE || 'false',
        // Early access configuration
        EARLY_ACCESS_ENFORCE: config.env === 'prod' || config.env === 'staging' ? 'true' : 'false',
        EARLY_ACCESS_ADMIN_EMAILS:
          process.env.EARLY_ACCESS_ADMIN_EMAILS || 'jordan@westwavecreative.com',
      },
    })

    const dataIntegration = lambdaAwsProxyIntegration(dataLambda)

    // Migration lambda for running database migrations
    const migrationLambda = new lambdaNodejs.NodejsFunction(this, 'MigrationLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.resolve(backendDir, 'src', 'functions', 'migrate', 'handler.ts'),
      handler: 'handler',
      bundling: commonBundlingOptions,
      // Remove VPC for production - Lambda can access public RDS directly without NAT Gateway
      ...(config.env !== 'prod' && {
        vpc: this.vpc,
        vpcSubnets: privateSubnetSelection,
        securityGroups: [lambdaSecurityGroup],
      }),
      timeout: cdk.Duration.seconds(300), // 5 minutes for migrations
      memorySize: 1024, // More memory for Prisma
      environment: {
        DATABASE_URL: `postgresql://${databaseUserSecret.unsafeUnwrap()}:${databasePasswordSecret.unsafeUnwrap()}@${databaseHost}:5432/jobdock?schema=public`,
        DATABASE_SECRET_ARN: this.database.secret?.secretArn ?? '',
        DATABASE_HOST: databaseHost,
        DATABASE_USER: databaseUserSecret.toString(),
        DATABASE_PASSWORD: databasePasswordSecret.toString(),
        DATABASE_PORT: '5432',
        DATABASE_NAME: 'jobdock',
        ENV: config.env,
        ENVIRONMENT: config.env,
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
      description: 'Runs Prisma database migrations',
    })

    // Grant migration lambda database access
    this.database.secret?.grantRead(migrationLambda)
    this.database.grantConnect(migrationLambda, 'jobdock')

    // Job Cleanup Lambda - Archives old jobs to S3
    const cleanupLambda = new lambdaNodejs.NodejsFunction(this, 'CleanupJobsLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.resolve(backendDir, 'src', 'functions', 'cleanup-jobs', 'handler.ts'),
      handler: 'handler',
      bundling: commonBundlingOptions,
      // Remove VPC for production - Lambda can access public RDS directly without NAT Gateway
      ...(config.env !== 'prod' && {
        vpc: this.vpc,
        vpcSubnets: privateSubnetSelection,
        securityGroups: [lambdaSecurityGroup],
      }),
      role: lambdaRole,
      timeout: cdk.Duration.minutes(5), // Allow time for processing many jobs
      memorySize: 512,
      environment: {
        DATABASE_SECRET_ARN: this.database.secret?.secretArn ?? '',
        DATABASE_ENDPOINT: databaseHost,
        DATABASE_NAME: 'jobdock',
        DATABASE_HOST: databaseHost,
        DATABASE_USER: databaseUserSecret.toString(),
        DATABASE_PASSWORD: databasePasswordSecret.toString(),
        DATABASE_PORT: '5432',
        DATABASE_OPTIONS: 'schema=public',
        FILES_BUCKET: this.filesBucket.bucketName,
        ENVIRONMENT: config.env,
      },
      logRetention: logs.RetentionDays.ONE_MONTH, // Keep logs longer for audit trail
      description: 'Archives jobs older than 1 year to S3 and cleans up database',
    })

    // Grant cleanup lambda necessary permissions
    this.database.secret?.grantRead(cleanupLambda)
    this.database.grantConnect(cleanupLambda, 'jobdock')
    this.filesBucket.grantWrite(cleanupLambda)

    // Schedule cleanup to run weekly on Sundays at 2 AM UTC
    const cleanupRule = new events.Rule(this, 'CleanupJobsSchedule', {
      schedule: events.Schedule.cron({
        minute: '0',
        hour: '2',
        weekDay: 'SUN',
      }),
      description: 'Triggers job cleanup weekly to archive old jobs',
    })

    cleanupRule.addTarget(new targets.LambdaFunction(cleanupLambda))

    const authResource = this.api.root.addResource('auth')
    authResource.addResource('register').addMethod('POST', authIntegration)
    authResource.addResource('login').addMethod('POST', authIntegration)
    authResource.addResource('respond-to-challenge').addMethod('POST', authIntegration)
    authResource.addResource('refresh').addMethod('POST', authIntegration)
    authResource.addResource('logout').addMethod('POST', authIntegration)

    const healthResource = this.api.root.addResource('health')
    healthResource.addMethod('GET', authIntegration)

    // Catch-all proxy for application data routes
    const proxyResource = this.api.root.addResource('{proxy+}')
    proxyResource.addMethod('ANY', dataIntegration)
    // NOTE: Do not add a root (/) method here. In some CDK/CloudFormation graphs,
    // combining root methods with {proxy+} can create circular dependencies.

    // ============================================
    // 8. Outputs
    // ============================================
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.api.url,
      description: 'API Gateway endpoint URL',
      exportName: `JobDock-${config.env}-ApiUrl`,
    })

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: `JobDock-${config.env}-UserPoolId`,
    })

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
      exportName: `JobDock-${config.env}-UserPoolClientId`,
    })

    new cdk.CfnOutput(this, 'DatabaseSecretArn', {
      value: this.database.secret!.secretArn,
      description: 'Database credentials secret ARN',
      exportName: `JobDock-${config.env}-DatabaseSecretArn`,
    })

    new cdk.CfnOutput(this, 'DatabaseEndpoint', {
      value:
        this.database instanceof rds.DatabaseInstance
          ? this.database.instanceEndpoint.hostname
          : this.database.clusterEndpoint.hostname,
      description: 'Database endpoint',
      exportName: `JobDock-${config.env}-DatabaseEndpoint`,
    })

    new cdk.CfnOutput(this, 'FrontendBucketName', {
      value: this.frontendBucket.bucketName,
      description: 'Frontend S3 bucket name',
      exportName: `JobDock-${config.env}-FrontendBucket`,
    })

    new cdk.CfnOutput(this, 'FilesBucketName', {
      value: this.filesBucket.bucketName,
      description: 'Files S3 bucket name',
      exportName: `JobDock-${config.env}-FilesBucket`,
    })

    new cdk.CfnOutput(this, 'CloudFrontUrl', {
      value: `https://${this.distribution.distributionDomainName}`,
      description: 'CloudFront distribution URL',
      exportName: `JobDock-${config.env}-CloudFrontUrl`,
    })

    new cdk.CfnOutput(this, 'MigrationLambdaName', {
      value: migrationLambda.functionName,
      description: 'Migration Lambda function name for running database migrations',
      exportName: `JobDock-${config.env}-MigrationLambdaName`,
    })

    new cdk.CfnOutput(this, 'CleanupJobsLambdaName', {
      value: cleanupLambda.functionName,
      description: 'Cleanup Lambda function name for archiving old jobs',
      exportName: `JobDock-${config.env}-CleanupJobsLambdaName`,
    })
  }
}
