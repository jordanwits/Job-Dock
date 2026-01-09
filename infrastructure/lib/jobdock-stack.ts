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
    this.vpc = new ec2.Vpc(this, 'VPC', {
      maxAzs: 2, // Multi-AZ for high availability
      natGateways: config.env === 'prod' ? 2 : 1, // Redundant NAT for prod
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
    const databaseSubnetGroup = new rds.SubnetGroup(this, 'DatabaseSubnetGroup', {
      vpc: this.vpc,
      description: 'Subnet group for database',
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
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
        vpcSubnets: {
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        subnetGroup: databaseSubnetGroup,
        securityGroups: [dbSecurityGroup],
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
        vpcSubnets: {
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
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
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
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
      'cognito-idp:AdminDeleteUser'
    )

    // Grant Lambda access to SES for sending emails
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['ses:SendEmail', 'ses:SendRawEmail'],
        resources: ['*'], // Can be restricted to specific verified identities if needed
      })
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
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
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
      vpc: this.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [lambdaSecurityGroup],
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
        PUBLIC_APP_URL: config.vercelDomain ? `https://${config.vercelDomain}` : config.domain ? `https://${config.domain}` : 'http://localhost:3000',
        DEFAULT_TENANT_ID: config.defaultTenantId ?? 'demo-tenant',
        // SES Email configuration
        SES_ENABLED: 'true', // Enable for all environments to send real emails
        SES_REGION: this.region,
        SES_FROM_ADDRESS: config.sesFromAddress || 'jordan@westwavecreative.com',
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
    })

    const authIntegration = new apigateway.LambdaIntegration(authLambda)

    // Data API lambda (temporary mock-backed implementation)
    const dataLambda = new lambdaNodejs.NodejsFunction(this, 'DataLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.resolve(backendDir, 'src', 'functions', 'data', 'handler.ts'),
      handler: 'handler',
      bundling: commonBundlingOptions,
      vpc: this.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [lambdaSecurityGroup],
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
        PUBLIC_APP_URL: config.vercelDomain ? `https://${config.vercelDomain}` : config.domain ? `https://${config.domain}` : 'http://localhost:3000',
        DEFAULT_TENANT_ID: config.defaultTenantId ?? 'demo-tenant',
        // SES Email configuration
        SES_ENABLED: 'true', // Enable for all environments to send real emails
        SES_REGION: this.region,
        SES_FROM_ADDRESS: config.sesFromAddress || 'jordan@westwavecreative.com',
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
    })

    const dataIntegration = new apigateway.LambdaIntegration(dataLambda)

    // Migration lambda for running database migrations
    const migrationLambda = new lambdaNodejs.NodejsFunction(this, 'MigrationLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.resolve(backendDir, 'src', 'functions', 'migrate', 'handler.ts'),
      handler: 'handler',
      bundling: commonBundlingOptions,
      vpc: this.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [lambdaSecurityGroup],
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

    const authResource = this.api.root.addResource('auth')
    authResource.addResource('register').addMethod('POST', authIntegration)
    authResource.addResource('login').addMethod('POST', authIntegration)
    authResource.addResource('refresh').addMethod('POST', authIntegration)
    authResource.addResource('logout').addMethod('POST', authIntegration)

    const healthResource = this.api.root.addResource('health')
    healthResource.addMethod('GET', authIntegration)

    // Catch-all proxy for application data routes
    const proxyResource = this.api.root.addResource('{proxy+}')
    proxyResource.addMethod('ANY', dataIntegration)
    this.api.root.addMethod('ANY', dataIntegration)

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
  }
}
