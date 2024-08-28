import { RemovalPolicy, Duration, Stack } from 'aws-cdk-lib';
import {
  Vpc,
  SecurityGroup,
  Instance,
  InstanceType,
  InstanceClass,
  InstanceSize,
  CloudFormationInit,
  InitConfig,
  InitFile,
  InitCommand,
  UserData,
  MachineImage,
  AmazonLinuxCpuType,
} from 'aws-cdk-lib/aws-ec2';

import {
  Role,
  ServicePrincipal,
  ManagedPolicy,
  PolicyDocument,
  PolicyStatement,
} from 'aws-cdk-lib/aws-iam';

import { Bucket, ObjectOwnership } from 'aws-cdk-lib/aws-s3';
import { Source, BucketDeployment } from 'aws-cdk-lib/aws-s3-deployment';

import { Construct } from 'constructs';

interface ServerProps {
  vpc: Vpc;
  sshSecurityGroup: SecurityGroup;
  logLevel: string;
  sshPubKey: string;
  cpuType: string;
  instanceSize: string;
}

let cpuType: AmazonLinuxCpuType;
let instanceClass: InstanceClass;
let instanceSize: InstanceSize;

export class ServerResources extends Construct {
  public instance: Instance;

  constructor(scope: Construct, id: string, props: ServerProps) {
    super(scope, id);

    //Um bucket S3 é criado para armazenar assets que serão utilizados pela instância EC2. Configurações como removalPolicy e objectOwnership definem a política de remoção e a propriedade dos objetos.
    const assetBucket = new Bucket(this, 'assetBucket', {
      publicReadAccess: false,
      removalPolicy: RemovalPolicy.DESTROY,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_PREFERRED,
      autoDeleteObjects: true,
    });

    //Usa BucketDeployment para enviar arquivos locais para o bucket S3, como scripts e configurações necessárias para a instância.
    new BucketDeployment(this, 'assetBucketDeployment', {
      sources: [Source.asset('src/resources/server/assets')],
      destinationBucket: assetBucket,
      retainOnDelete: false,
      exclude: ['**/node_modules/**', '**/dist/**'],
      memoryLimit: 512,
    });

    //criação de uma Role para EC2 para definir permissões específicas que a instância EC2 usará para acessar outros serviços da AWS de forma segura.
    const serverRole = new Role(this, 'serverEc2Role', {
      assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
      inlinePolicies: {
        ['RetentionPolicy']: new PolicyDocument({
          statements: [
            new PolicyStatement({
              resources: ['*'],
              actions: ['logs:PutRetentionPolicy'],
            }),
          ],
        }),
      },
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
        ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy'),
      ],
    });

    // Concede à role do EC2 permissões de leitura e escrita no bucket S3
    assetBucket.grantReadWrite(serverRole);

    const userData = UserData.forLinux();

    // script de user data que configura a instância EC2 ao inicializar, como instalar pacotes, configurar docker e copiar arquivos do S3.
    userData.addCommands(
      'yum update -y',
      'curl -sL https://dl.yarnpkg.com/rpm/yarn.repo | sudo tee /etc/yum.repos.d/yarn.repo',
      'curl -sL https://rpm.nodesource.com/setup_18.x | sudo -E bash - ',
      'yum install -y amazon-cloudwatch-agent nodejs python3-pip zip unzip docker yarn',
      'sudo systemctl enable docker',
      'sudo systemctl start docker',
      'mkdir -p /home/ec2-user/sample',
      'aws s3 cp s3://' +
      assetBucket.bucketName +
      '/sample /home/ec2-user/sample --recursive',
    );

    //Um grupo de segurança é criado para a instância EC2, permitindo o tráfego SSH.
    const ec2InstanceSecurityGroup = new SecurityGroup(
      this,
      'ec2InstanceSecurityGroup',
      { vpc: props.vpc, allowAllOutbound: true },
    );

    // Determine the correct CPUType and Instance Class based on the props passed in
    if (props.cpuType == 'X86_64') {
      cpuType = AmazonLinuxCpuType.X86_64;
      //cpuType = AmazonLinuxCpuType.ARM_64;
      instanceClass = InstanceClass.T2;
    } else {
      cpuType = AmazonLinuxCpuType.X86_64;
      instanceClass = InstanceClass.T2;
    }

    // Determine the correct InstanceSize based on the props passed in
    switch (props.instanceSize) {
      case 'micro':
        instanceSize = InstanceSize.MICRO;
        break;
      case 'large':
        instanceSize = InstanceSize.LARGE;
        break;
      default:
        instanceSize = InstanceSize.MICRO;
    }

    this.instance = new Instance(this, 'Instance', {
      vpc: props.vpc,
      instanceType: InstanceType.of(instanceClass, instanceSize),
      machineImage: MachineImage.latestAmazonLinux2023({
        cachedInContext: false,
        cpuType: cpuType,
      }),
      userData: userData,
      securityGroup: ec2InstanceSecurityGroup,
      init: CloudFormationInit.fromConfigSets({
        configSets: {
          default: ['config'],
        },
        configs: {
          config: new InitConfig([
            InitFile.fromObject('/etc/config.json', {
              // Cria um arquivo /etc/config.json com um objeto JSON contendo o ID da stack.
              STACK_ID: Stack.of(this).artifactId,
            }),
            InitFile.fromFileInline(
              // Copia um arquivo local para a instância EC2.
              '/tmp/amazon-cloudwatch-agent.json',
              './src/resources/server/config/amazon-cloudwatch-agent.json',
            ),
            InitFile.fromFileInline(
              '/etc/config.sh',
              'src/resources/server/config/config.sh',
            ),
            InitFile.fromString(
              // Adiciona uma chave SSH ao arquivo authorized_keys do usuário EC2 para permitir login SSH com a chave fornecida.
              '/home/ec2-user/.ssh/authorized_keys',
              props.sshPubKey + '\n',
            ),
            InitCommand.shellCommand('chmod +x /etc/config.sh'), // Executa um comando shell para dar permissão de execução ao script /etc/config.sh.e
            InitCommand.shellCommand('/etc/config.sh'), // Executa o script /etc/config.sh para configuração adicional.
          ]),
        },
      }),

      initOptions: {
        timeout: Duration.minutes(10),
        includeUrl: true,
        includeRole: true,
        printLog: true,
      },
      role: serverRole,
    });

    // Add the SSH Security Group to the EC2 instance
    this.instance.addSecurityGroup(props.sshSecurityGroup);
  }
}