import { readFileSync } from 'node:fs';
import path from 'node:path';
import tls from 'node:tls';
import { fileURLToPath } from 'node:url';
import { Bot } from '@maxhub/max-bot-api';
import { Agent, fetch as undiciFetch } from 'undici';
import { config } from './config.js';
import { ensureSchema, pingDb } from './db.js';
import { startApiServer } from './api/server.js';
import { setBotApi } from './notify.js';
import {
  handleAbout,
  handleAdminDecision,
  handleAdminPendingUk,
  handleBotStarted,
  handleCityConfirm,
  handleCityRetry,
  handleConsentAccept,
  handleConsentDecline,
  handleConsentRead,
  handleMyUk,
  handleNavHome,
  handleResidentJoinCancel,
  handleResidentJoinDecision,
  handleResidentJoinStatus,
  handleRoleResident,
  handleRoleUk,
  handleSettings,
  handleSettingsAddress,
  handleSettingsChangeUk,
  handleSettingsCity,
  handleSettingsProfile,
  handleStub,
  handleTextMessage,
  handleUkPick,
  handleUkResidentJoins,
  handleUkSearchAgain,
  handleUkSearchSkip,
  handleUkSearchStart,
  handleUkStatus,
  handleUnlinkCancel,
  handleUnlinkConfirm,
  getOrCreateUser,
  showHome,
} from './handlers.js';
import {
  handleBroadcastCancel,
  handleBroadcastSend,
  handleMyRequests,
  handleRequestCancel,
  handleRequestCategory,
  handleRequestSetStatus,
  handleRequestSkipDetails,
  handleRequestSubmit,
  handleRequestUseMyAddress,
  handleResidentReplyStart,
  handleUkIncoming,
  startBroadcast,
  startRequestFlow,
} from './tickets.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const caBundlePath = path.resolve(__dirname, '../certs/russian_trusted_ca_bundle.pem');
const russianCa = readFileSync(caBundlePath, 'utf8');

const dispatcher = new Agent({
  connect: {
    ca: [...tls.rootCertificates, russianCa],
  },
});

function maxFetch(input, init) {
  return undiciFetch(input, { ...init, dispatcher });
}

const bot = new Bot(config.botToken, {
  clientOptions: {
    fetch: maxFetch,
  },
});

setBotApi(bot.api);

bot.catch((error) => {
  console.error('Bot error:', error);
});

bot.api.setMyCommands([
  { name: 'start', description: 'Запустить / перезапустить бота' },
  { name: 'menu', description: 'Открыть главное меню' },
]).catch((error) => {
  console.warn('Не удалось установить команды бота:', error.message);
});

bot.on('bot_started', async (ctx) => {
  await handleBotStarted(ctx);
});

bot.command('start', async (ctx) => {
  await handleBotStarted(ctx);
});

bot.command('menu', async (ctx) => {
  const user = await getOrCreateUser(ctx);
  await showHome(ctx, user);
});

bot.action('consent:accept', handleConsentAccept);
bot.action('consent:decline', handleConsentDecline);
bot.action('consent:read', handleConsentRead);
bot.action('role:resident', handleRoleResident);
bot.action('role:uk', handleRoleUk);
bot.action('city:confirm', handleCityConfirm);
bot.action('city:retry', handleCityRetry);
bot.action('uksearch:start', handleUkSearchStart);
bot.action('uksearch:again', handleUkSearchAgain);
bot.action('uksearch:skip', handleUkSearchSkip);
bot.action(/^ukpick:(\d+)$/, async (ctx) => {
  await handleUkPick(ctx, Number(ctx.match[1]));
});
bot.action('nav:home', handleNavHome);

bot.action('menu:emergency', (ctx) => startRequestFlow(ctx, 'emergency'));
bot.action('menu:request', (ctx) => startRequestFlow(ctx, 'regular'));
bot.action('menu:my_requests', handleMyRequests);
bot.action('menu:parking', (ctx) => handleStub(ctx, '🅿️ Мониторинг парковки'));
bot.action('menu:water', (ctx) => handleStub(ctx, '💧 Отключения воды'));
bot.action('menu:my_uk', handleMyUk);
bot.action('menu:settings', handleSettings);
bot.action('menu:about', handleAbout);

bot.action(/^reqcat:(.+)$/, async (ctx) => {
  await handleRequestCategory(ctx, ctx.match[1]);
});
bot.action('req:my_address', handleRequestUseMyAddress);
bot.action('req:skip_details', handleRequestSkipDetails);
bot.action('req:submit', handleRequestSubmit);
bot.action('req:cancel', handleRequestCancel);
bot.action(/^reqst:(\d+):(in_progress|done|rejected|comment)$/, async (ctx) => {
  await handleRequestSetStatus(ctx, Number(ctx.match[1]), ctx.match[2]);
});
bot.action(/^reqreply:(\d+)$/, async (ctx) => {
  await handleResidentReplyStart(ctx, Number(ctx.match[1]));
});

bot.action('settings:address', handleSettingsAddress);
bot.action('settings:city', handleSettingsCity);
bot.action('settings:profile', handleSettingsProfile);
bot.action('settings:change_uk', handleSettingsChangeUk);
bot.action(/^unlink:confirm:(address|city|uk)$/, async (ctx) => {
  await handleUnlinkConfirm(ctx, ctx.match[1]);
});
bot.action('unlink:cancel', handleUnlinkCancel);

bot.action('resident:join_status', handleResidentJoinStatus);
bot.action('resident:join_cancel', handleResidentJoinCancel);

bot.action('uk:status', handleUkStatus);
bot.action('uk:incoming', handleUkIncoming);
bot.action('uk:resident_joins', handleUkResidentJoins);
bot.action(/^rjoin:(approve|reject):(\d+)$/, async (ctx) => {
  await handleResidentJoinDecision(ctx, Number(ctx.match[2]), ctx.match[1]);
});
bot.action('uk:broadcast', startBroadcast);
bot.action('bc:send', handleBroadcastSend);
bot.action('bc:cancel', handleBroadcastCancel);
bot.action('uk:water', (ctx) => handleStub(ctx, '💧 Отключения воды'));
bot.action('uk:parking', (ctx) => handleStub(ctx, '🅿️ Парковка'));
bot.action('uk:profile', (ctx) => handleStub(ctx, '⚙️ Профиль УК'));

bot.action('admin:pending_uk', handleAdminPendingUk);
bot.action(/^admin:(approve|reject):(\d+)$/, async (ctx) => {
  const [, decision, id] = ctx.match;
  await handleAdminDecision(ctx, Number(id), decision);
});

bot.on('message_created', async (ctx) => {
  await handleTextMessage(ctx);
});

async function startViaWebhook() {
  const webhookOptions = {
    domain: config.domain,
    path: config.webhookPath,
    ...(config.webhookSecret ? { secret: config.webhookSecret } : {}),
  };

  let webhookHandler = null;
  await startApiServer({
    webhookHandler: (req, res) => {
      if (!webhookHandler) {
        res.writeHead(503, { 'Content-Type': 'text/plain' });
        res.end('Starting');
        return;
      }
      // Express может менять req.url — библиотека сверяет его с path
      req.url = config.webhookPath;
      webhookHandler(req, res);
    },
  });

  console.log(`✅ Webhook: https://${config.domain}${config.webhookPath}`);
  webhookHandler = await bot.createWebhook(webhookOptions);
  console.log('✅ Подписка webhook зарегистрирована в MAX');
}

async function startViaPolling() {
  await startApiServer();

  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      console.log('✅ Бот «Наш дом» (long polling)...');
      await bot.start({ mode: 'polling' });
      return;
    } catch (error) {
      const reason = error?.cause?.code || error?.message || error;
      console.error(`Попытка ${attempt}/${maxAttempts} не удалась:`, reason);
      if (attempt === maxAttempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
    }
  }
}

export async function startBot() {
  await pingDb();
  console.log('✅ MySQL подключен');
  await ensureSchema();
  console.log('✅ Схема БД проверена');

  if (config.botMode === 'webhook') {
    await startViaWebhook();
    return;
  }

  await startViaPolling();
}

export { bot };
