require('dotenv').config();
const WebSocket = require('ws');
const TelegramBot = require('node-telegram-bot-api');
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

let ws_mexc;
let listPrice = [];
let reconnectInterval = 5000; // 5 segundos
let mexcPriceORAIBuffer = undefined;
let mexcPriceOCHBuffer = undefined;
let config = require('./config.json');

let minLimit = config.minLimit;
let maxLimit = config.maxLimit;

function resetPriceBuffers() {
  mexcPriceORAIBuffer = undefined;
  mexcPriceOCHBuffer = undefined;
}

// Função para adicionar e logar preços de forma assíncrona
async function addPrice(datetime) {
  const cof = mexcPriceORAIBuffer / mexcPriceOCHBuffer;
  listPrice.push({ datetime, ORAI: mexcPriceORAIBuffer, OCH: mexcPriceOCHBuffer, Cof: cof });
  console.log(`[${datetime}] Preço atual de ORAI: ${mexcPriceORAIBuffer} e OCH: ${mexcPriceOCHBuffer} e Cof: ${cof}` );
  //console.log(listPrice);
  //fs.writeFileSync('prices.json', JSON.stringify(listPrice, null, 2));
  checkCofLimits(cof);
}
function checkCofLimits(cof) {
  if (cof < minLimit || cof > maxLimit) {
    bot.sendMessage(process.env.TELEGRAM_CHAT_ID, `⚠️ Alerta: Cof fora dos limites! Valor atual: ${cof}`);
  }
}

// Funções para alterar limites via Telegram
bot.onText(/\/setminlimit (\d+(\.\d+)?)/, (msg, match) => {
  minLimit = parseFloat(match[1]);
  config.minLimit = minLimit;
  bot.sendMessage(msg.chat.id, `Novo limite mínimo definido: ${minLimit}`);
});

bot.onText(/\/setmaxlimit (\d+(\.\d+)?)/, (msg, match) => {
  maxLimit = parseFloat(match[1]);
  config.maxLimit = maxLimit;
  bot.sendMessage(msg.chat.id, `Novo limite máximo definido: ${maxLimit}`);
});

// Função para processar mensagens de um par específico
function processMessage(symbol, priceBuffer, newPrice) {
  const now = new Date();
  const datetime = now.toISOString().replace('T', ' ').substr(0, 19); 

  if (newPrice !== priceBuffer) {
    if (symbol === 'ORAIUSDT') {
      mexcPriceORAIBuffer = newPrice;
      if (mexcPriceOCHBuffer !== undefined && mexcPriceORAIBuffer !== undefined) {
        addPrice(datetime);
        resetPriceBuffers();
      }
    } else if (symbol === 'OCHUSDT') {
      mexcPriceOCHBuffer = newPrice;
      if (mexcPriceORAIBuffer !== undefined && mexcPriceOCHBuffer !== undefined) {
        addPrice(datetime);
        resetPriceBuffers();
      }
    }  
  }
}

// Função para conectar ao WebSocket
function connect() {
  ws_mexc = new WebSocket(`${process.env.STREAM_URL_MEXC}`);

  // Enviar a requisição para se inscrever nos streams de ORAI/USDT e OCH/USDT
  ws_mexc.on('open', () => {
    console.log('Conexão aberta com o WebSocket');
    ws_mexc.send(JSON.stringify({
      method: "SUBSCRIPTION",
      params: [
        "spot@public.deals.v3.api@ORAIUSDT",
        "spot@public.deals.v3.api@OCHUSDT"
      ]
    }));
  });

  // Receber e processar as mensagens do WebSocket
  ws_mexc.on('message', data => {
    try {
      const msg = JSON.parse(data);

      if (msg.c === 'spot@public.deals.v3.api@ORAIUSDT' && msg.d.deals && msg.d.deals.length > 0) {
        const newPrice = parseFloat(msg.d.deals[0].p);
        processMessage('ORAIUSDT', mexcPriceORAIBuffer, newPrice);
      }

      if (msg.c === 'spot@public.deals.v3.api@OCHUSDT' && msg.d.deals && msg.d.deals.length > 0) {
        const newPrice = parseFloat(msg.d.deals[0].p);
        processMessage('OCHUSDT', mexcPriceOCHBuffer, newPrice);
      }
    } catch (error) {
      console.error('Erro ao processar mensagem:', error.message);
    }
  });

  // Tratamento de erros
  ws_mexc.on('error', err => {
    console.error('Erro no MEXC:', err.message);
  });

  // Reconectar automaticamente em caso de fechamento
  ws_mexc.on('close', () => {
    console.log('Conexão fechada. Tentando reconectar em 5 segundos...');
    setTimeout(connect, reconnectInterval);
  });
}

// Iniciar conexão
connect();