import * as cdk from 'aws-cdk-lib';
import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from "constructs";
import { ServerApplication, ServerDeploymentGroup, InstanceTagSet } from 'aws-cdk-lib/aws-codedeploy';
import { Pipeline, Artifact } from 'aws-cdk-lib/aws-codepipeline';
import { GitHubSourceAction, CodeDeployServerDeployAction } from "aws-cdk-lib/aws-codepipeline-actions";
import * as iam from "aws-cdk-lib/aws-iam";


export class CICDStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);


    // Definindo artefatos do pipeline
    const sourceArtifact = new Artifact();

    // Definindo a ação de origem do GitHub
    const sourceAction = new GitHubSourceAction({
      actionName: 'GitHub_Source',
      owner: process.env.YOUR_GITHUB_USERNAME || ' ',
      repo: process.env.YOUR_REPOSITORY_NAME || ' ',
      branch: 'master', // ou a branch que deseja monitorar
      oauthToken: cdk.SecretValue.secretsManager('github-token', {
        jsonField: 'token', // Campo chave dentro do segredo onde o token está armazenado
      }),
      output: sourceArtifact,
    });

    // Definindo a aplicação e grupo de deployment do CodeDeploy
    const application = new ServerApplication(this, 'MonitorCriptoApplication', {
      applicationName: 'MonitorCrptoNodeApp',
    });

    const deploymentGroup = new ServerDeploymentGroup(this, 'MyDeploymentGroup', {
      application: application,
      deploymentGroupName: 'MyNodeDeploymentGroup',
      ec2InstanceTags: new InstanceTagSet({
        'Grupo': ['InstanceOfMonitor'], // Referencia as tags da instância EC2
      }),
    });

    const deployStage = {
      stageName: 'Deploy',
      actions: [
        new CodeDeployServerDeployAction({
          actionName: 'CodeDeploy',
          input: sourceArtifact,
          deploymentGroup: deploymentGroup, // Referencia o grupo de deploy criado
        }),
      ],
    };

    // Criando o pipeline e integrando os estágios
    const pipeline = new Pipeline(this, 'MyPipeline', {
      pipelineName: 'MyNodejsPipeline',
      stages: [
        {
          stageName: 'Source',
          actions: [sourceAction],
        },
        deployStage,
      ],
    });

    // Permissões do Pipeline
    pipeline.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['codedeploy:*', 's3:*', 'iam:PassRole'],
        resources: ['*'],
      })
    );

  }
}