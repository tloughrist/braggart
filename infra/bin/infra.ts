#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';

import { BraggartWebStack } from '../lib/braggart-web-stack';

const app = new cdk.App();

new BraggartWebStack(app, 'BraggartWebStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  description: 'Braggart web app static hosting (S3 + CloudFront)',
});
