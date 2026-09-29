/** Ленивая ссылка на Bot API — выставляется из bot.js после создания Bot */
let botApi = null;

export function setBotApi(api) {
  botApi = api;
}

export async function notifyMaxUser(maxUserId, text, options = {}) {
  if (!botApi || !maxUserId) return false;
  try {
    await botApi.sendMessageToUser(Number(maxUserId), text, {
      format: options.format || 'markdown',
      ...options,
    });
    return true;
  } catch (error) {
    console.warn('[notify] failed for', maxUserId, error?.message || error);
    return false;
  }
}

export async function notifyMany(maxUserIds, text, options = {}) {
  const ids = [...new Set((maxUserIds || []).filter(Boolean).map(Number))];
  let ok = 0;
  for (const id of ids) {
    if (await notifyMaxUser(id, text, options)) ok += 1;
  }
  return ok;
}
