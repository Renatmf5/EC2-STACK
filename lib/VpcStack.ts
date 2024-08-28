import { Construct } from 'constructs';
import {
  SecurityGroup,
  Peer,
  Port,
  SubnetType,
  Vpc,
} from 'aws-cdk-lib/aws-ec2';

export class VPCResources extends Construct {
  public sshSecurityGroup: SecurityGroup;
  public vpc: Vpc;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // Criação de uma VPC com sub-redes públicas em 2 AZs
    this.vpc = new Vpc(this, 'VPC-WS', {
      natGateways: 0,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'ServerPublic',
          subnetType: SubnetType.PUBLIC,
          mapPublicIpOnLaunch: true,
        },
      ],
      maxAzs: 2,
    });

    // Criação de um grupo de segurança para SSH
    this.sshSecurityGroup = new SecurityGroup(this, 'SSHSecurityGroup', {
      vpc: this.vpc,
      description: 'Security Group for SSH',
      allowAllOutbound: true,
    });

    // Cria permissão para trafego de entrada SSH na porta 22 TCP
    this.sshSecurityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(22));

  }
}
