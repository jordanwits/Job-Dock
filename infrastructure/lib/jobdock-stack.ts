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

    this.vpc = new ec2.Vpc(this, 'VPC', {
      maxAzs: 2, // Multi-AZ for high availability
      // IMPORTANT: we manage egress routing ourselves (NAT instance OR NAT gateways)
      // to avoid CloudFormation route conflicts when switching strategies.
      natGateways: 0,
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

    // --- Egress strategy ---
    //
    // We always create the "0.0.0.0/0" routes with stable logical IDs:
    // - PrivateSubnetNatRoute0
    // - PrivateSubnetNatRoute1
    //
    // This allows switching between NAT instance and NAT gateway without
    // conflicting routes being created.

    // Create NAT Instance if using instance strategy (cheaper, but requires management)
    let natInstanceId: string | undefined
    if (useNatInstance) {
      // Use Amazon Linux 2023 with NAT configured
      const natInstanceSecurityGroup = new ec2.SecurityGroup(this, 'NatInstanceSecurityGroup', {
        vpc: this.vpc,
        description: 'Security group for NAT instance',
        allowAllOutbound: true,
      })

      // Allow traffic from private subnets
      natInstanceSecurityGroup.addIngressRule(
        ec2.Peer.ipv4(this.vpc.vpcCidrBlock),
        ec2.Port.allTraffic(),
        'Allow traffic from VPC'
      )

      // Use t4g.nano for cost optimization (~$3/mo)
      const natInstance = new ec2.Instance(this, 'NatInstance', {
        vpc: this.vpc,
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.NANO),
        machineImage: ec2.MachineImage.latestAmazonLinux2023({
          cpuType: ec2.AmazonLinuxCpuType.ARM_64,
        }),
        vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
        securityGroup: natInstanceSecurityGroup,
        sourceDestCheck: false, // Required for NAT
        userData: ec2.UserData.custom(`#!/bin/bash
# Enable IP forwarding
echo "net.ipv4.ip_forward = 1" >> /etc/sysctl.conf
sysctl -p

# Configure NAT
iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
iptables -A FORWARD -i eth0 -o eth0 -m state --state RELATED,ESTABLISHED -j ACCEPT
iptables -A FORWARD -i eth0 -o eth0 -j ACCEPT

# Persist iptables rules
mkdir -p /etc/iptables
iptables-save > /etc/iptables/rules.v4

# Restore on boot
cat > /etc/systemd/system/iptables-restore.service <<EOF
[Unit]
Description=Restore iptables rules
After=network.target

[Service]
Type=oneshot
ExecStart=/sbin/iptables-restore /etc/iptables/rules.v4

[Install]
WantedBy=multi-user.target
EOF

systemctl enable iptables-restore.service
`),
      })
      natInstanceId = natInstance.instanceId

      new cdk.CfnOutput(this, 'NatInstanceId', {
        value: natInstance.instanceId,
        description: 'NAT Instance ID (change to NAT Gateway when scaling)',
        exportName: `JobDock-${config.env}-NatInstanceId`,
      })
    }

    // Create NAT Gateways if using gateway strategy (reliable, managed, costs more)
    // Skip NAT Gateway for production - Lambda and RDS don't need it (Lambda outside VPC, RDS public)
    const natGatewayIds: string[] = []
    if (!useNatInstance && config.env !== 'prod') {
      const publicSubnets = this.vpc.publicSubnets

      // Create one NAT gateway per AZ (or per public subnet)
      publicSubnets.forEach((subnet, index) => {
        const eip = new ec2.CfnEIP(this, `NatEip${index}`, {
          domain: 'vpc',
        })

        const natGateway = new ec2.CfnNatGateway(this, `NatGateway${index}`, {
          subnetId: subnet.subnetId,
          allocationId: eip.attrAllocationId,
        })
        natGateway.node.addDependency(eip)

        natGatewayIds[index] = natGateway.ref
      })
    }

    // Create/maintain the private subnet default routes with stable logical IDs.
    // In instance mode: route → NAT instance
    // In gateway mode:  route → NAT gateway (same AZ index if available, else first)
    // Skip NAT routes for production - Lambda outside VPC and RDS in public subnet don't need NAT
    if (config.env !== 'prod') {
      this.vpc.privateSubnets.forEach((subnet, index) => {
        const natGatewayId = natGatewayIds[index] ?? natGatewayIds[0]

        if (useNatInstance) {
          if (!natInstanceId) {
            throw new Error('NAT instance ID was not set (unexpected)')
          }
          new ec2.CfnRoute(this, `PrivateSubnetNatRoute${index}`, {
            routeTableId: subnet.routeTable.routeTableId,
            destinationCidrBlock: '0.0.0.0/0',
            instanceId: natInstanceId,
          })
        } else {
          if (!natGatewayId) {
            throw new Error('NAT gateway ID was not set (unexpected)')
          }
          new ec2.CfnRoute(this, `PrivateSubnetNatRoute${index}`, {
            routeTableId: subnet.routeTable.routeTableId,
            destinationCidrBlock: '0.0.0.0/0',
            natGatewayId: natGatewayId,
          })
        }
      })
    }

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
        // Stripe billing configuration
        STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
        STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
        STRIPE_PRICE_ID: process.env.STRIPE_PRICE_ID || '',
        STRIPE_ENFORCE_SUBSCRIPTION: process.env.STRIPE_ENFORCE_SUBSCRIPTION || 'false',
        // Early access configuration
        EARLY_ACCESS_ENFORCE: config.env === 'prod' || config.env === 'staging' ? 'true' : 'false',
        EARLY_ACCESS_ADMIN_EMAILS:
          process.env.EARLY_ACCESS_ADMIN_EMAILS || 'jordan@westwavecreative.com',
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
        // Stripe billing configuration
        STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
        STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
        STRIPE_PRICE_ID: process.env.STRIPE_PRICE_ID || '',
        STRIPE_ENFORCE_SUBSCRIPTION: process.env.STRIPE_ENFORCE_SUBSCRIPTION || 'false',
        // Early access configuration
        EARLY_ACCESS_ENFORCE: config.env === 'prod' || config.env === 'staging' ? 'true' : 'false',
        EARLY_ACCESS_ADMIN_EMAILS:
          process.env.EARLY_ACCESS_ADMIN_EMAILS || 'jordan@westwavecreative.com',
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

    new cdk.CfnOutput(this, 'CleanupJobsLambdaName', {
      value: cleanupLambda.functionName,
      description: 'Cleanup Lambda function name for archiving old jobs',
      exportName: `JobDock-${config.env}-CleanupJobsLambdaName`,
    })
  }
}
