import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { config } from 'dotenv';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';

config();

export class MyParameterStoreStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Cria o parâmetro para STREAM_URL_MEXC
    new StringParameter(this, 'StreamUrlMexcParameter', {
      parameterName: '/monitor-app/STREAM_URL_MEXC',
      stringValue: process.env.STREAM_URL_MEXC || ' ',
    });

    // Cria o parâmetro para TELEGRAM_BOT_TOKEN
    new StringParameter(this, 'TelegramBotTokenParameter', {
      parameterName: '/monitor-app/TELEGRAM_BOT_TOKEN',
      stringValue: process.env.TELEGRAM_BOT_TOKEN || ' ',
    });

    // Cria o parâmetro para TELEGRAM_CHAT_ID
    new StringParameter(this, 'TelegramChatIdParameter', {
      parameterName: '/monitor-app/TELEGRAM_CHAT_ID',
      stringValue: process.env.TELEGRAM_CHAT_ID || ' ',
    });
  }
}