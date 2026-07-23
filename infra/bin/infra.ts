#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';

import { BraggartCicdStack } from '../lib/braggart-cicd-stack';
import { BraggartWebStack } from '../lib/braggart-web-stack';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

new BraggartWebStack(app, 'BraggartWebStack', {
  env,
  description: 'Braggart web app static hosting (S3 + CloudFront)',
});

new BraggartCicdStack(app, 'BraggartCicdStack', {
  env,
  description: 'GitHub Actions OIDC deploy identity for Braggart',
});
