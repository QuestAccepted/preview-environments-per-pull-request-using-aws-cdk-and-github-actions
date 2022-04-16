import * as cloudfront from "@aws-cdk/aws-cloudfront";
import * as cloudfrontOrigins from "@aws-cdk/aws-cloudfront-origins";
import * as s3 from "@aws-cdk/aws-s3";
import * as s3Deployment from "@aws-cdk/aws-s3-deployment";
import * as cdk from "@aws-cdk/core";
import { Code, Runtime, Permission } from '@aws-cdk/aws-lambda';
import { LambdaEdgeEventType, } from "@aws-cdk/aws-cloudfront";
import * as lambda from '@aws-cdk/aws-lambda';
import * as iam from '@aws-cdk/aws-iam';
// import { AllowedMethods, CacheHeaderBehavior, CachePolicy, Distribution, experimental, HttpVersion, LambdaEdgeEventType, OriginProtocolPolicy, PriceClass, SecurityPolicyProtocol, ViewerProtocolPolicy } from '@aws-cdk/aws-cloudfront';

/**
 * The CloudFormation stack holding all our resources
 */
export default class AwesomeStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    /**
     * The S3 Bucket hosting our build
     */
    const bucket = new s3.Bucket(this, "Bucket", {
      autoDeleteObjects: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const edgeAuth = new cloudfront.experimental.EdgeFunction(this, 'edgeAuthFn', {
      runtime: Runtime.NODEJS_14_X,
      handler: 'index.handler',
      code: Code.fromAsset(`${__dirname}/../lambda-fns/basic-auth`),
      memorySize: 128,
    })

    // 👇 create a policy statement
    const getSecretsPolicy = new iam.PolicyStatement({
      actions: ['secretsmanager:GetSecretValue'],
      resources: ['arn:aws:secretsmanager:us-east-1:780892829273:secret:github/preview-RDCV5i'],
    });

    // 👇 add the policy to the Function's role
    edgeAuth.role?.attachInlinePolicy(
      new iam.Policy(this, 'get-secrets', {
        statements: [getSecretsPolicy],
      }),
    );

    /**
     * The CloudFront distribution caching and proxying our requests to our bucket
     */
    const distribution = new cloudfront.Distribution(this, "Distribution", {
      defaultBehavior: {
        origin: new cloudfrontOrigins.S3Origin(bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        edgeLambdas: [{
          functionVersion: edgeAuth.currentVersion,
          eventType: LambdaEdgeEventType.VIEWER_REQUEST
        }],
      },
      defaultRootObject: "index.html",
    });

    /**
     * Output the distribution's url so we can pass it to external systems
     */
    new cdk.CfnOutput(this, "DeploymentUrl", {
      value: "https://" + distribution.distributionDomainName
    });

    /**
     * Upload our build to the bucket and invalidate the distribution's cache
     */
    new s3Deployment.BucketDeployment(this, "BucketDeployment", {
      destinationBucket: bucket,
      distribution,
      distributionPaths: ["/", "/index.html"],
      sources: [s3Deployment.Source.asset('./website')],
    });
  }
}
