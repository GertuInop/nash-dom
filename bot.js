import { startBot } from './src/bot.js';

startBot().catch((error) => {
  console.error('Не удалось запустить бота:', error);
  process.exit(1);
});
