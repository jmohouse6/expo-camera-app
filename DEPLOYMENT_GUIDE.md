# Deployment & Infrastructure Guide - Photo Timekeeping Mobile App

## Overview

This guide provides comprehensive deployment and infrastructure requirements for the Photo Timekeeping Mobile App system, including both backend services and mobile application distribution.

---

## Infrastructure Architecture

### High-Level Architecture
```
┌─────────────────┐    ┌─────────────────┐
│  Employee App   │    │   Client App    │
│   (React Native)│    │  (React Native) │
└─────────┬───────┘    └─────────┬───────┘
          │                      │
          │      ┌───────────────┘
          │      │
          ▼      ▼
    ┌─────────────────┐
    │   Load Balancer │
    │     (ALB)       │
    └─────────┬───────┘
              │
    ┌─────────▼───────┐
    │   API Gateway   │
    │                 │
    └─────────┬───────┘
              │
    ┌─────────▼───────┐    ┌─────────────────┐
    │  API Server     │────│   Redis Cache   │
    │  (ECS Cluster)  │    │   (ElastiCache) │
    └─────────┬───────┘    └─────────────────┘
              │
    ┌─────────▼───────┐    ┌─────────────────┐
    │   MongoDB       │    │   S3 Storage    │
    │ (DocumentDB)    │    │   + CloudFront  │
    └─────────────────┘    └─────────────────┘
```

---

## AWS Infrastructure Requirements

### Compute Services

#### ECS Cluster Configuration
```yaml
# ECS Cluster Specification
Cluster:
  Type: AWS::ECS::Cluster
  Name: timeclock-production
  CapacityProviders:
    - EC2
    - FARGATE
  
Service:
  Type: AWS::ECS::Service
  TaskDefinition: timeclock-api
  DesiredCount: 3
  LaunchType: FARGATE
  Platform: 1.4.0
  
TaskDefinition:
  Family: timeclock-api
  CPU: 1024
  Memory: 2048
  NetworkMode: awsvpc
  RequiresCompatibilities:
    - FARGATE
  
Container:
  Name: api-server
  Image: timeclock/api-server:latest
  PortMappings:
    - ContainerPort: 3000
      Protocol: tcp
  Environment:
    - NODE_ENV=production
    - DB_CONNECTION_STRING=mongodb://production-cluster
    - REDIS_URL=redis://production-cache
    - S3_BUCKET=timeclock-photos-prod
```

#### Auto Scaling Configuration
```yaml
AutoScalingGroup:
  MinSize: 2
  MaxSize: 10
  DesiredCapacity: 3
  TargetGroupARNs:
    - !Ref ApplicationLoadBalancer
  
ScalingPolicies:
  - PolicyName: CPUScalingPolicy
    PolicyType: TargetTrackingScaling
    TargetValue: 70.0
    MetricType: CPUUtilization
  
  - PolicyName: MemoryScalingPolicy
    PolicyType: TargetTrackingScaling
    TargetValue: 80.0
    MetricType: MemoryUtilization
```

### Database Configuration

#### DocumentDB (MongoDB Compatible)
```yaml
DBCluster:
  Engine: docdb
  EngineVersion: 4.0.0
  MasterUsername: admin
  MasterUserPassword: !Ref DBPassword
  BackupRetentionPeriod: 7
  PreferredBackupWindow: "03:00-04:00"
  PreferredMaintenanceWindow: "sun:04:00-sun:05:00"
  StorageEncrypted: true
  
DBInstances:
  Primary:
    DBInstanceClass: db.r5.large
    Engine: docdb
    
  ReadReplica:
    DBInstanceClass: db.r5.large
    Engine: docdb
    SourceDBInstanceIdentifier: !Ref Primary
```

#### ElastiCache (Redis) Configuration
```yaml
CacheCluster:
  Engine: redis
  EngineVersion: 6.2
  CacheNodeType: cache.r6g.large
  NumCacheNodes: 1
  VpcSecurityGroupIds:
    - !Ref RedisSecurityGroup
  
ReplicationGroup:
  ReplicationGroupDescription: "Timeclock Redis Cluster"
  NumCacheClusters: 3
  Engine: redis
  CacheNodeType: cache.r6g.large
  AutomaticFailoverEnabled: true
  MultiAZEnabled: true
```

### Storage Services

#### S3 Bucket Configuration
```yaml
PhotosBucket:
  Type: AWS::S3::Bucket
  Properties:
    BucketName: timeclock-photos-prod
    AccessControl: Private
    VersioningConfiguration:
      Status: Enabled
    LifecycleConfiguration:
      Rules:
        - Status: Enabled
          Transitions:
            - TransitionInDays: 30
              StorageClass: STANDARD_IA
            - TransitionInDays: 90
              StorageClass: GLACIER
    NotificationConfiguration:
      LambdaConfigurations:
        - Event: s3:ObjectCreated:*
          Function: !Ref PhotoProcessingFunction
    
CORS:
  CorsRules:
    - AllowedHeaders: ["*"]
      AllowedMethods: [GET, PUT, POST, DELETE, HEAD]
      AllowedOrigins: ["*"]
      MaxAge: 3000
```

#### CloudFront Distribution
```yaml
Distribution:
  Type: AWS::CloudFront::Distribution
  Properties:
    DistributionConfig:
      Origins:
        - DomainName: !GetAtt PhotosBucket.RegionalDomainName
          Id: S3Origin
          S3OriginConfig:
            OriginAccessIdentity: !Ref CloudFrontOAI
      DefaultCacheBehavior:
        TargetOriginId: S3Origin
        ViewerProtocolPolicy: redirect-to-https
        CachePolicyId: 4135ea2d-6df8-44a3-9df3-4b5a84be39ad # Managed caching optimized
        OriginRequestPolicyId: 2e54312d-136d-493c-8eb9-b001f22f67d2 # Managed CORS-S3Origin
      PriceClass: PriceClass_100
      Enabled: true
```

### Networking Configuration

#### VPC Setup
```yaml
VPC:
  Type: AWS::EC2::VPC
  Properties:
    CidrBlock: 10.0.0.0/16
    EnableDnsHostnames: true
    EnableDnsSupport: true
    
PublicSubnets:
  Subnet1:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.0.1.0/24
      AvailabilityZone: us-west-2a
      
  Subnet2:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.0.2.0/24
      AvailabilityZone: us-west-2b

PrivateSubnets:
  Subnet1:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.0.11.0/24
      AvailabilityZone: us-west-2a
      
  Subnet2:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.0.12.0/24
      AvailabilityZone: us-west-2b
```

#### Load Balancer Configuration
```yaml
ApplicationLoadBalancer:
  Type: AWS::ElasticLoadBalancingV2::LoadBalancer
  Properties:
    Scheme: internet-facing
    Type: application
    Subnets:
      - !Ref PublicSubnet1
      - !Ref PublicSubnet2
    SecurityGroups:
      - !Ref ALBSecurityGroup
      
TargetGroup:
  Type: AWS::ElasticLoadBalancingV2::TargetGroup
  Properties:
    Port: 3000
    Protocol: HTTP
    VpcId: !Ref VPC
    TargetType: ip
    HealthCheckPath: /health
    HealthCheckIntervalSeconds: 30
    HealthyThresholdCount: 2
    UnhealthyThresholdCount: 5
```

---

## Security Configuration

### Security Groups
```yaml
ALBSecurityGroup:
  Type: AWS::EC2::SecurityGroup
  Properties:
    GroupDescription: Security group for Application Load Balancer
    VpcId: !Ref VPC
    SecurityGroupIngress:
      - IpProtocol: tcp
        FromPort: 80
        ToPort: 80
        CidrIp: 0.0.0.0/0
      - IpProtocol: tcp
        FromPort: 443
        ToPort: 443
        CidrIp: 0.0.0.0/0

ECSSecurityGroup:
  Type: AWS::EC2::SecurityGroup
  Properties:
    GroupDescription: Security group for ECS tasks
    VpcId: !Ref VPC
    SecurityGroupIngress:
      - IpProtocol: tcp
        FromPort: 3000
        ToPort: 3000
        SourceSecurityGroupId: !Ref ALBSecurityGroup

DatabaseSecurityGroup:
  Type: AWS::EC2::SecurityGroup
  Properties:
    GroupDescription: Security group for DocumentDB
    VpcId: !Ref VPC
    SecurityGroupIngress:
      - IpProtocol: tcp
        FromPort: 27017
        ToPort: 27017
        SourceSecurityGroupId: !Ref ECSSecurityGroup
```

### IAM Roles and Policies
```yaml
ECSTaskRole:
  Type: AWS::IAM::Role
  Properties:
    AssumeRolePolicyDocument:
      Version: '2012-10-17'
      Statement:
        - Effect: Allow
          Principal:
            Service: ecs-tasks.amazonaws.com
          Action: sts:AssumeRole
    Policies:
      - PolicyName: S3Access
        PolicyDocument:
          Version: '2012-10-17'
          Statement:
            - Effect: Allow
              Action:
                - s3:GetObject
                - s3:PutObject
                - s3:DeleteObject
                - s3:GetObjectVersion
              Resource:
                - !Sub "${PhotosBucket}/*"
            - Effect: Allow
              Action:
                - s3:ListBucket
              Resource:
                - !Ref PhotosBucket

LambdaExecutionRole:
  Type: AWS::IAM::Role
  Properties:
    AssumeRolePolicyDocument:
      Version: '2012-10-17'
      Statement:
        - Effect: Allow
          Principal:
            Service: lambda.amazonaws.com
          Action: sts:AssumeRole
    ManagedPolicyArns:
      - arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
    Policies:
      - PolicyName: PhotoProcessing
        PolicyDocument:
          Version: '2012-10-17'
          Statement:
            - Effect: Allow
              Action:
                - s3:GetObject
                - s3:PutObject
              Resource:
                - !Sub "${PhotosBucket}/*"
```

---

## Environment Configurations

### Production Environment
```bash
# Environment Variables
NODE_ENV=production
PORT=3000

# Database
DB_CONNECTION_STRING=mongodb://admin:password@production-cluster.cluster-xyz.us-west-2.docdb.amazonaws.com:27017/timeclock?ssl=true&retryWrites=false
DB_SSL_CA=/opt/rds-ca-2019-root.pem

# Redis Cache
REDIS_URL=redis://production-cache.xyz.cache.amazonaws.com:6379
REDIS_TTL=3600

# AWS Services
AWS_REGION=us-west-2
S3_BUCKET=timeclock-photos-prod
S3_REGION=us-west-2
CLOUDFRONT_DOMAIN=d123456789.cloudfront.net

# Authentication
JWT_SECRET=production-secret-key-very-long-and-random
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=30d

# Photo Processing
PHOTO_MAX_SIZE=10485760  # 10MB
PHOTO_ALLOWED_TYPES=image/jpeg,image/png,image/heic
PHOTO_QUALITY=85
THUMBNAIL_SIZE=300
MEDIUM_SIZE=800
LARGE_SIZE=1200

# Push Notifications
FCM_SERVER_KEY=production-firebase-server-key
FCM_PROJECT_ID=timeclock-production

# Monitoring
SENTRY_DSN=https://production-sentry-dsn
LOG_LEVEL=info
METRICS_ENABLED=true
```

### Staging Environment
```bash
# Environment Variables
NODE_ENV=staging
PORT=3000

# Database
DB_CONNECTION_STRING=mongodb://admin:password@staging-cluster.cluster-abc.us-west-2.docdb.amazonaws.com:27017/timeclock?ssl=true&retryWrites=false

# AWS Services
S3_BUCKET=timeclock-photos-staging
CLOUDFRONT_DOMAIN=d987654321.cloudfront.net

# Authentication
JWT_SECRET=staging-secret-key
JWT_EXPIRES_IN=1h

# Push Notifications
FCM_PROJECT_ID=timeclock-staging

# Monitoring
SENTRY_DSN=https://staging-sentry-dsn
LOG_LEVEL=debug
```

### Development Environment
```bash
# Environment Variables
NODE_ENV=development
PORT=3000

# Database
DB_CONNECTION_STRING=mongodb://localhost:27017/timeclock

# Redis Cache
REDIS_URL=redis://localhost:6379

# AWS Services (LocalStack for development)
AWS_ENDPOINT=http://localhost:4566
S3_BUCKET=timeclock-photos-dev
S3_REGION=us-east-1

# Authentication
JWT_SECRET=development-secret
JWT_EXPIRES_IN=24h

# Monitoring
LOG_LEVEL=debug
METRICS_ENABLED=false
```

---

## CI/CD Pipeline

### GitHub Actions Workflow
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
        
      - name: Run tests
        run: npm test
        
      - name: Run ESLint
        run: npm run lint
        
      - name: Run security audit
        run: npm audit
  
  build:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-west-2
      
      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v1
      
      - name: Build, tag, and push image to Amazon ECR
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          ECR_REPOSITORY: timeclock-api
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
          docker tag $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG $ECR_REGISTRY/$ECR_REPOSITORY:latest
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest
  
  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-west-2
      
      - name: Deploy to ECS
        run: |
          aws ecs update-service \
            --cluster timeclock-production \
            --service timeclock-api-service \
            --force-new-deployment
      
      - name: Wait for deployment
        run: |
          aws ecs wait services-stable \
            --cluster timeclock-production \
            --services timeclock-api-service
```

### Docker Configuration
```dockerfile
# Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS runtime

RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs . .

USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "server.js"]
```

---

## Mobile App Distribution

### iOS App Store Configuration
```yaml
# ios/timeclock/Info.plist
App Store Connect:
  Bundle ID: com.yourcompany.timeclock
  App Name: Timeclock Pro
  SKU: timeclock-ios-001
  Primary Language: English
  
Categories:
  Primary: Business
  Secondary: Productivity
  
App Privacy:
  Data Collection:
    - Location Data
    - Photos
    - Contact Information
    - Usage Data
  
  Data Usage:
    - App Functionality
    - Analytics
    - Product Personalization
    
Screenshots Required:
  - iPhone 6.7" Display
  - iPhone 6.5" Display
  - iPhone 5.5" Display
  - iPad Pro (6th Gen) 12.9"
  - iPad Pro (2nd Gen) 12.9"
```

### Android Play Store Configuration
```yaml
# android/app/build.gradle
Play Console:
  Package Name: com.yourcompany.timeclock
  App Name: Timeclock Pro
  
Store Listing:
  Short Description: "Professional time tracking with photo verification"
  Full Description: "Complete time tracking solution for field workers..."
  
App Category: Business
Content Rating: Everyone
  
Privacy Policy: https://yourcompany.com/privacy
Terms of Service: https://yourcompany.com/terms

Permissions:
  - CAMERA
  - ACCESS_FINE_LOCATION
  - ACCESS_COARSE_LOCATION
  - WRITE_EXTERNAL_STORAGE
  - READ_EXTERNAL_STORAGE
  - INTERNET
  - ACCESS_NETWORK_STATE
```

---

## Monitoring & Observability

### CloudWatch Configuration
```yaml
LogGroups:
  - LogGroupName: /aws/ecs/timeclock-api
    RetentionInDays: 30
  
  - LogGroupName: /aws/lambda/photo-processing
    RetentionInDays: 14

Alarms:
  - AlarmName: HighCPUUtilization
    MetricName: CPUUtilization
    Namespace: AWS/ECS
    Statistic: Average
    Period: 300
    EvaluationPeriods: 2
    Threshold: 80
    ComparisonOperator: GreaterThanThreshold
    
  - AlarmName: HighMemoryUtilization
    MetricName: MemoryUtilization
    Namespace: AWS/ECS
    Statistic: Average
    Period: 300
    EvaluationPeriods: 2
    Threshold: 85
    ComparisonOperator: GreaterThanThreshold
    
  - AlarmName: DatabaseConnections
    MetricName: DatabaseConnections
    Namespace: AWS/DocDB
    Statistic: Average
    Period: 300
    EvaluationPeriods: 2
    Threshold: 80
    ComparisonOperator: GreaterThanThreshold
```

### Application Monitoring
```javascript
// monitoring/metrics.js
const { CloudWatchMetrics } = require('aws-cloudwatch-metrics');

const metrics = new CloudWatchMetrics({
  namespace: 'Timeclock/API',
  region: process.env.AWS_REGION
});

// Custom metrics
const trackPhotoUpload = (success, fileSize) => {
  metrics.putMetric('PhotoUploads', 1, 'Count', {
    Success: success.toString(),
    FileSizeRange: getFileSizeRange(fileSize)
  });
};

const trackTimecardCreation = (userId, projectId) => {
  metrics.putMetric('TimecardCreations', 1, 'Count', {
    ProjectId: projectId
  });
};

const trackAPIResponse = (endpoint, statusCode, responseTime) => {
  metrics.putMetric('APIResponseTime', responseTime, 'Milliseconds', {
    Endpoint: endpoint,
    StatusCode: statusCode.toString()
  });
};
```

---

## Backup & Disaster Recovery

### Database Backup Strategy
```yaml
DocumentDB:
  BackupRetentionPeriod: 7 days
  PreferredBackupWindow: "03:00-04:00" UTC
  EnableCloudwatchLogsExports:
    - audit
    - profiler
  DeletionProtection: true

CrossRegionBackup:
  ReplicationSource: us-west-2
  ReplicationTarget: us-east-1
  BackupRetentionPeriod: 30 days
```

### S3 Backup Configuration
```yaml
S3BackupBucket:
  Type: AWS::S3::Bucket
  Properties:
    BucketName: timeclock-backups-prod
    VersioningConfiguration:
      Status: Enabled
    ReplicationConfiguration:
      Role: !GetAtt ReplicationRole.Arn
      Rules:
        - Status: Enabled
          Prefix: photos/
          Destination:
            Bucket: arn:aws:s3:::timeclock-backups-dr
            StorageClass: STANDARD_IA
```

### Disaster Recovery Plan
```yaml
Recovery Procedures:
  RTO: 4 hours  # Recovery Time Objective
  RPO: 1 hour   # Recovery Point Objective
  
Primary Region: us-west-2
DR Region: us-east-1

Automated Failover:
  - Route 53 health checks monitor primary region
  - Automatic DNS failover to DR region
  - ECS services in DR region remain in standby
  - Database cross-region replica promotion
  
Manual Procedures:
  1. Verify primary region outage
  2. Promote DocumentDB replica in DR region
  3. Update ECS services to active state
  4. Update environment variables for new endpoints
  5. Verify application functionality
  6. Communicate status to stakeholders
```

---

## Cost Optimization

### Monthly Cost Estimates (Production)
```yaml
Compute Services:
  ECS Fargate (3 tasks):
    CPU: 3 vCPU × $0.04048/hour = $87.60/month
    Memory: 6 GB × $0.004445/hour = $19.20/month
    Total ECS: $106.80/month

Database Services:
  DocumentDB (db.r5.large):
    Primary Instance: $151.20/month
    Read Replica: $151.20/month
    Total DocumentDB: $302.40/month
    
  ElastiCache (cache.r6g.large):
    Single Instance: $124.56/month

Storage Services:
  S3 Storage (500 GB):
    Standard: $11.50/month
    Requests: $5.00/month
    Total S3: $16.50/month
    
  CloudFront (100 GB transfer):
    Data Transfer: $8.50/month

Network Services:
  Application Load Balancer: $16.20/month
  Data Transfer: $9.00/month

Total Monthly Cost: ~$583/month
```

### Cost Optimization Strategies
1. **Right-sizing Resources**
   - Monitor CPU/memory utilization
   - Adjust instance sizes based on actual usage
   - Use Spot instances for non-critical workloads

2. **Storage Optimization**
   - Implement S3 lifecycle policies
   - Use Intelligent Tiering for varying access patterns
   - Compress images before storage

3. **Reserved Instances**
   - Purchase 1-year reserved instances for stable workloads
   - Use Savings Plans for ECS Fargate

4. **Auto-scaling**
   - Scale down during off-hours
   - Use predictive scaling for known patterns
   - Implement application-level caching

---

## Security Best Practices

### API Security
```yaml
Security Headers:
  Helmet: 
    - contentSecurityPolicy
    - hsts
    - noSniff
    - frameguard
    - xssFilter
    
Rate Limiting:
  Window: 15 minutes
  Max Requests: 100 per IP
  Skip Successful Requests: false
  
CORS Configuration:
  Origin: 
    - https://app.yourcompany.com
    - https://client.yourcompany.com
  Methods: [GET, POST, PUT, DELETE]
  Credentials: true
```

### Data Encryption
```yaml
At Rest:
  DocumentDB: Encrypted with AWS KMS
  S3: SSE-S3 with AWS managed keys
  EBS: Encrypted volumes
  
In Transit:
  API: TLS 1.3 minimum
  Database: SSL/TLS connections required
  Internal: VPC private subnets
  
Application Level:
  Sensitive Fields: AES-256 encryption
  JWT Tokens: RS256 signing
  Passwords: bcrypt hashing (cost: 12)
```

This deployment guide provides comprehensive infrastructure requirements and deployment procedures for successfully launching and maintaining the Photo Timekeeping Mobile App system in production.