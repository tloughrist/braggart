import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

/**
 * CI/CD identity for GitHub Actions.
 *
 * Federates GitHub's OIDC provider to a least-privilege role that the deploy
 * workflow assumes, so no long-lived AWS keys ever live in GitHub. The role can
 * do exactly one thing: assume the CDK bootstrap roles, which is all
 * `cdk deploy` actually needs. It intentionally cannot manage IAM or itself.
 *
 * This lives in its own stack (separate from the web stack) so the CI plumbing
 * can be created without deploying any web content.
 */
export class BraggartCicdStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const githubOrg = 'tloughrist';
    const githubRepo = 'braggart';

    // Only one OIDC provider per URL is allowed per account. If the account
    // already has GitHub's provider, pass its ARN as context
    // (-c githubOidcProviderArn=...) to import it instead of creating a second.
    const existingProviderArn = this.node.tryGetContext('githubOidcProviderArn') as
      | string
      | undefined;
    const provider = existingProviderArn
      ? iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(
          this,
          'GitHubOidc',
          existingProviderArn,
        )
      : new iam.OpenIdConnectProvider(this, 'GitHubOidc', {
          url: 'https://token.actions.githubusercontent.com',
          clientIds: ['sts.amazonaws.com'],
        });

    const deployRole = new iam.Role(this, 'GitHubDeployRole', {
      roleName: 'braggart-github-deploy',
      description:
        'Assumed by GitHub Actions (main branch) to deploy the Braggart web stack via CDK',
      maxSessionDuration: cdk.Duration.hours(1),
      assumedBy: new iam.OpenIdConnectPrincipal(provider, {
        StringEquals: {
          'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
        },
        // Only the main branch of this specific repo may assume the role.
        StringLike: {
          'token.actions.githubusercontent.com:sub': `repo:${githubOrg}/${githubRepo}:ref:refs/heads/main`,
        },
      }),
    });

    // `cdk deploy` does all its real work by assuming the CDK bootstrap roles
    // (deploy / file-publishing / lookup). Granting only sts:AssumeRole on them
    // keeps this identity minimal — it holds no direct S3/CloudFront/CFN power.
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'AssumeCdkBootstrapRoles',
        actions: ['sts:AssumeRole'],
        resources: [`arn:aws:iam::${this.account}:role/cdk-hnb659fds-*-${this.account}-${this.region}`],
      }),
    );

    // The CDK CLI reads the bootstrap version parameter with the caller's own
    // credentials before assuming any role.
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'ReadCdkBootstrapVersion',
        actions: ['ssm:GetParameter'],
        resources: [`arn:aws:ssm:${this.region}:${this.account}:parameter/cdk-bootstrap/hnb659fds/version`],
      }),
    );

    new cdk.CfnOutput(this, 'DeployRoleArn', {
      value: deployRole.roleArn,
      description: 'Set this as the GitHub Actions variable AWS_DEPLOY_ROLE_ARN',
    });
    new cdk.CfnOutput(this, 'GitHubOidcProviderArn', {
      value: provider.openIdConnectProviderArn,
    });
  }
}
