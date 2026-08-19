import { resolve } from "node:path";
import { App, CfnOutput, Fn, RemovalPolicy, Stack } from "aws-cdk-lib";
import type { StackProps } from "aws-cdk-lib";
import { Certificate, CertificateValidation } from "aws-cdk-lib/aws-certificatemanager";
import { Distribution, ResponseHeadersPolicy, ViewerProtocolPolicy } from "aws-cdk-lib/aws-cloudfront";
import { S3BucketOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import { ARecord, HostedZone, RecordTarget } from "aws-cdk-lib/aws-route53";
import { CloudFrontTarget } from "aws-cdk-lib/aws-route53-targets";
import { BlockPublicAccess, Bucket, BucketEncryption } from "aws-cdk-lib/aws-s3";
import { BucketDeployment, Source } from "aws-cdk-lib/aws-s3-deployment";
import type { Construct } from "constructs";

const domainName = "planefacts.flightofstairs.org";

export class Infrastructure extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const websiteBucket = new Bucket(this, "WebsiteBucket", {
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
    });

    // Delegated from the flightofstairs.org zone; NS records must be added
    // there (see README) using the nameserver output below.
    const zone = new HostedZone(this, "HostedZone", {
      zoneName: domainName,
    });

    const certificate = new Certificate(this, "Certificate", {
      domainName,
      validation: CertificateValidation.fromDns(zone),
    });

    const responseHeadersPolicy = new ResponseHeadersPolicy(this, "ClacksPolicy", {
      customHeadersBehavior: {
        customHeaders: [
          {
            header: "X-Clacks-Overhead",
            value: "GNU Terry Pratchett",
            override: true,
          },
        ],
      },
    });

    const distribution = new Distribution(this, "CloudFrontDistribution", {
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(websiteBucket),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        responseHeadersPolicy,
      },
      certificate,
      domainNames: [domainName],
      defaultRootObject: "index.html",
    });

    new BucketDeployment(this, "BucketDeployment", {
      destinationBucket: websiteBucket,
      sources: [Source.asset(resolve(import.meta.dirname, "../../website/dist"))],
      distribution,
    });

    new ARecord(this, "ApexRecord", {
      zone,
      target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
    });

    new CfnOutput(this, "NameServers", {
      description: `NS records to add for ${domainName} in the parent zone`,
      value: Fn.join(", ", zone.hostedZoneNameServers ?? []),
    });
  }
}

const app = new App();
new Infrastructure(app, "PlaneFacts", {
  env: {
    region: "us-east-1", // CloudFront certificates must live in us-east-1
  },
});
