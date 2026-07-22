import * as path from 'path';

import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';

/**
 * Static hosting for the Braggart Expo web build:
 *   private S3 bucket  ->  CloudFront (Origin Access Control)  ->  the internet
 * The bucket stays private; only CloudFront can read it via OAC.
 */
export class BraggartWebStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Bucket holding the built web assets. Locked down; destroyable so tearing
    // the stack down is clean (autoDeleteObjects empties it first).
    const bucket = new s3.Bucket(this, 'WebBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Optional custom domain. Supplied via CDK context (-c domainName=... -c
    // certArn=...) or cdk.json. The ACM cert is managed out-of-band because
    // timloughrist.com's DNS lives at WordPress.com, not Route 53 — so CDK
    // can't auto-create the validation record. We import the already-issued
    // cert by ARN and only wire it onto the distribution here. The cert MUST
    // be in us-east-1 (CloudFront requirement).
    const domainName = this.node.tryGetContext('domainName') as string | undefined;
    const certArn = this.node.tryGetContext('certArn') as string | undefined;
    const customDomain =
      domainName && certArn
        ? {
            domainNames: [domainName],
            certificate: acm.Certificate.fromCertificateArn(this, 'SiteCert', certArn),
          }
        : {};

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: 'Braggart web app',
      defaultRootObject: 'index.html',
      ...customDomain,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      // SPA fallback: serve index.html for unknown paths so expo-router's
      // client-side routing handles deep links.
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
      ],
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });

    // Upload the Expo web export (repo-root ./dist) and invalidate the cache.
    new s3deploy.BucketDeployment(this, 'DeployWeb', {
      sources: [s3deploy.Source.asset(path.join(__dirname, '..', '..', 'dist'))],
      destinationBucket: bucket,
      distribution,
      distributionPaths: ['/*'],
    });

    new cdk.CfnOutput(this, 'SiteUrl', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'CloudFront URL for the Braggart web app',
    });
    if (domainName) {
      new cdk.CfnOutput(this, 'CustomDomainUrl', {
        value: `https://${domainName}`,
        description: 'Custom-domain URL (add a CNAME to the CloudFront domain)',
      });
      new cdk.CfnOutput(this, 'CnameTarget', {
        value: distribution.distributionDomainName,
        description: `Point ${domainName} (CNAME) at this CloudFront domain`,
      });
    }
    new cdk.CfnOutput(this, 'BucketName', { value: bucket.bucketName });
  }
}
