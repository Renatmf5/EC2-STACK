#!/usr/bin/env node
import 'source-map-support/register';
import { App, Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { config } from 'dotenv';
import { VPCResources } from '../lib/VpcStack';

config();

export class VPCExample extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    // Create VPC and Security Group
    const vpcResources = new VPCResources(this, 'VPC');

  }


}
const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: 'us-east-1',
};

const app = new App();

new VPCExample(app, 'VPCExample', {
  env: devEnv,
});

app.synth();