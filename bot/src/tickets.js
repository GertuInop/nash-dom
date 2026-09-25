import { EMERGENCY_CATEGORIES, REGULAR_CATEGORIES, categoryTitle, typeTitle } from './catalog.js';
import { ensureUser } from './db.js';
import {
  clearFlow,
  createAnnouncement,
  createRequest,
  formatRequestCard,
  formatRequestCardHtml,
  getFlow,
  getRequestById,
  addRequestMessage,
  listRequestMessages,
  listCompanyRequests,
  listResidentMaxIdsByCompany,
  listResidentRequests,
  listUkManagerMaxIds,
  resolveDefaultAddress,
  setFlow,
  updateRequestStatus,
} from './tickets-db.js';
import {
  homeNavKeyboard,
  myUkEmptyKeyboard,
  requestAddressKeyboard,
  requestCategoriesKeyboard,
  requestConfirmKeyboard,
  requestDetailsKeyboard,
  requestStatusKeyboard,
  residentReplyKeyboard,
  broadcastConfirmKeyboard,
  ukMenuKeyboard,
} from './keyboards.js';
import { residentHomePayload } from './handlers.js';

function replyOpts(keyboard) {
  return { format: 'markdown', attachments: [keyboard] };
}

async function getUser(ctx) {
  if (!ctx.user) throw new Error('Нет пользователя');
  return ensureUser(ctx.user);
}

function requireUkCompany(user) {
  return user.role === 'uk' && user.uk_status === 'approved' && user.company_id;
}

function requireResidentReady(user) {
  return user.role === 'resident' && user.onboarding_step === 'done';
}

export async function startRequestFlow(ctx, type) {
  const user = await getUser(ctx);
  await ctx.answerOnCallback({ notification: type === 'emergency' ? 'Авария' : 'Заявка' });

  if (!requireResidentReady(user)) {
    return ctx.reply('Сначала завершите регистрацию жителя.');
  }
  if (!user.company_id) {
    return ctx.reply(
      'Чтобы отправить заявку, сначала выберите свою УК.',
      replyOpts(myUkEmptyKeyboard()),
    );
  }

  await setFlow(user.id, 'req_category', { type });
  const title = type === 'emergency' ? 'Что случилось?' : 'Выберите категорию заявки:';
  return ctx.reply(title, replyOpts(requestCategoriesKeyboard(type)));
}

export async function handleRequestCategory(ctx, categoryId) {
  const user = await getUser(ctx);
  const flow = await getFlow(user);
  if (user.flow_step !== 'req_category' || !flow.type) {
    await ctx.answerOnCallback({ notification: 'Начните заявку заново' });
    return ctx.reply('Откройте меню и создайте заявку снова.');
  }

  const list = flow.type === 'emergency' ? EMERGENCY_CATEGORIES : REGULAR_CATEGORIES;
  if (!list.some((c) => c.id === categoryId)) {
    await ctx.answerOnCallback({ notification: 'Неизвестная категория' });
    return ctx.reply('Выберите категорию из списка.');
  }

  await setFlow(user.id, 'req_address', { ...flow, category: categoryId });
  await ctx.answerOnCallback({ notification: 'Категория выбрана' });

  const defaultAddress = await resolveDefaultAddress(user);
  const hint = defaultAddress
    ? `\n\nМожно использовать ваш адрес:\n_${defaultAddress}_`
    : '';
  return ctx.reply(
    `Укажите адрес${flow.type === 'emergency' ? ' аварии' : ''} одним сообщением.${hint}`,
    replyOpts(requestAddressKeyboard(Boolean(defaultAddress))),
  );
}

export async function handleRequestUseMyAddress(ctx) {
  const user = await getUser(ctx);
  const flow = await getFlow(user);
  if (user.flow_step !== 'req_address') {
    await ctx.answerOnCallback({ notification: 'Сначала выберите категорию' });
    return;
  }
  const address = await resolveDefaultAddress(user);
  if (!address) {
    await ctx.answerOnCallback({ notification: 'Адрес не найден' });
    return ctx.reply('Адрес не сохранён. Введите его текстом.');
  }
  await ctx.answerOnCallback({ notification: 'Адрес подставлен' });
  return askRequestDetails(ctx, user, { ...flow, address });
}

async function askRequestDetails(ctx, user, flow) {
  await setFlow(user.id, 'req_details', flow);
  return ctx.reply(
    'Опишите подробности одним сообщением.\nМожете пропустить этот шаг.',
    replyOpts(requestDetailsKeyboard()),
  );
}

export async function handleRequestSkipDetails(ctx) {
  const user = await getUser(ctx);
  const flow = await getFlow(user);
  if (user.flow_step !== 'req_details') {
    await ctx.answerOnCallback({ notification: 'Неактуально' });
    return;
  }
  await ctx.answerOnCallback({ notification: 'Пропущено' });
  return showRequestConfirm(ctx, user, { ...flow, description: null });
}

async function showRequestConfirm(ctx, user, flow) {
  await setFlow(user.id, 'req_confirm', flow);
  const text = `Сведения о заявке:

*Тип:* ${typeTitle(flow.type)}
*Категория:* ${categoryTitle(flow.type, flow.category)}
*Адрес:* ${flow.address}
*Подробности:* ${flow.description || '—'}

Отправить в УК?`;
  return ctx.reply(text, replyOpts(requestConfirmKeyboard()));
}

export async function handleRequestCancel(ctx) {
  const user = await getUser(ctx);
  await clearFlow(user.id);
  await ctx.answerOnCallback({ notification: 'Отменено' });
  const home = await residentHomePayload(user);
  return ctx.reply(`Заявка отменена.\n\n${home.text}`, replyOpts(home.keyboard));
}

export async function handleRequestSubmit(ctx) {
  const user = await getUser(ctx);
  const flow = await getFlow(user);
  if (user.flow_step !== 'req_confirm' || !flow.type || !flow.category || !flow.address) {
    await ctx.answerOnCallback({ notification: 'Черновик устарел' });
    return ctx.reply('Создайте заявку заново из меню.');
  }
  if (!user.company_id) {
    await ctx.answerOnCallback({ notification: 'Нет УК' });
    return ctx.reply('Сначала выберите УК.', replyOpts(myUkEmptyKeyboard()));
  }

  const request = await createRequest({
    userId: user.id,
    companyId: user.company_id,
    type: flow.type,
    category: flow.category,
    addressText: flow.address,
    description: flow.description,
  });
  await clearFlow(user.id);
  await ctx.answerOnCallback({ notification: 'Отправлено' });

  // Уведомить сотрудников УК
  const managers = await listUkManagerMaxIds(user.company_id);
  const full = await getRequestById(request.id);
  const cardHtml = formatRequestCardHtml(full);
  for (const maxId of managers) {
    try {
      await ctx.api.sendMessageToUser(
        maxId,
        `📥 Новая заявка от жителя\n\n${cardHtml}`,
        { format: 'html', attachments: [requestStatusKeyboard(request.id)] },
      );
    } catch (error) {
      console.error('Не удалось уведомить УК:', error.message);
    }
  }

  await ctx.reply(
    `Заявка *№${request.public_number}* отправлена.\n\n${formatRequestCard(request)}`,
    replyOpts(homeNavKeyboard()),
  );
  const home = await residentHomePayload(user);
  return ctx.reply(home.text, replyOpts(home.keyboard));
}

export async function handleMyRequests(ctx) {
  const user = await getUser(ctx);
  await ctx.answerOnCallback({ notification: 'Мои заявки' });
  if (!requireResidentReady(user)) {
    return ctx.reply('Сначала завершите регистрацию.');
  }

  const items = await listResidentRequests(user.id, 10);
  if (!items.length) {
    return ctx.reply('У вас пока нет заявок.', replyOpts(homeNavKeyboard()));
  }

  await ctx.reply(`📂 Ваши заявки (последние ${items.length}):`);
  for (const item of items) {
    await ctx.reply(formatRequestCard(item), { format: 'markdown' });
  }
  return ctx.reply('Главное меню:', replyOpts(homeNavKeyboard()));
}

export async function handleUkIncoming(ctx) {
  const user = await getUser(ctx);
  await ctx.answerOnCallback({ notification: 'Входящие заявки' });
  if (!requireUkCompany(user)) {
    return ctx.reply('Доступно только одобренной УК.');
  }

  const items = await listCompanyRequests(user.company_id, 12);
  if (!items.length) {
    return ctx.reply('Входящих заявок пока нет.', replyOpts(homeNavKeyboard()));
  }

  await ctx.reply(`📥 Входящие заявки (${items.length}):`);
  for (const item of items) {
    const messages = await listRequestMessages(item.id);
    await ctx.reply(
      formatRequestCardHtml(item, messages),
      {
        format: 'html',
        attachments: [requestStatusKeyboard(item.id)],
      },
    );
  }
}

export async function handleRequestSetStatus(ctx, requestId, status) {
  const user = await getUser(ctx);
  if (!requireUkCompany(user)) {
    await ctx.answerOnCallback({ notification: 'Нет доступа' });
    return ctx.reply('Доступно только одобренной УК.');
  }

  const existing = await getRequestById(requestId);
  if (!existing || existing.company_id !== user.company_id) {
    await ctx.answerOnCallback({ notification: 'Не найдено' });
    return ctx.reply('Заявка не найдена.');
  }

  if (status === 'comment') {
    await setFlow(user.id, 'req_uk_comment', { requestId });
    await ctx.answerOnCallback({ notification: 'Комментарий' });
    return ctx.reply('Напишите комментарий для жителя одним сообщением.');
  }

  const updated = await updateRequestStatus(requestId, status);
  await ctx.answerOnCallback({ notification: 'Статус обновлён' });
  const messages = await listRequestMessages(updated.id);

  if (updated.resident_max_user_id) {
    try {
      await ctx.api.sendMessageToUser(
        updated.resident_max_user_id,
        `Статус вашей заявки *№${updated.public_number}* изменён.\n\n${formatRequestCard(updated)}`,
        { format: 'markdown' },
      );
    } catch (error) {
      console.error('Не удалось уведомить жителя:', error.message);
    }
  }

  return ctx.reply(
    `Обновлено:\n\n${formatRequestCardHtml(updated, messages)}`,
    {
      format: 'html',
      attachments: [requestStatusKeyboard(updated.id)],
    },
  );
}

export async function handleResidentReplyStart(ctx, requestId) {
  const user = await getUser(ctx);
  await ctx.answerOnCallback({ notification: 'Ответ УК' });
  if (user.role !== 'resident') {
    return ctx.reply('Ответ доступен жителям.');
  }
  const request = await getRequestById(requestId);
  if (!request || request.user_id !== user.id) {
    return ctx.reply('Заявка не найдена.');
  }
  await setFlow(user.id, 'req_resident_reply', { requestId });
  return ctx.reply(
    `Напишите ответ УК по заявке №${request.public_number} одним сообщением.`,
    replyOpts(homeNavKeyboard()),
  );
}

export async function startBroadcast(ctx) {
  const user = await getUser(ctx);
  await ctx.answerOnCallback({ notification: 'Рассылка' });
  if (!requireUkCompany(user)) {
    return ctx.reply('Доступно только одобренной УК.');
  }
  await setFlow(user.id, 'bc_text', {});
  return ctx.reply(
    '📢 Напишите текст объявления одним сообщением.\nОно будет отправлено всем жильцам вашей УК.',
    replyOpts(homeNavKeyboard()),
  );
}

export async function handleBroadcastCancel(ctx) {
  const user = await getUser(ctx);
  await clearFlow(user.id);
  await ctx.answerOnCallback({ notification: 'Отменено' });
  return ctx.reply('Рассылка отменена.', replyOpts(ukMenuKeyboard(true)));
}

export async function handleBroadcastSend(ctx) {
  const user = await getUser(ctx);
  const flow = await getFlow(user);
  if (user.flow_step !== 'bc_confirm' || !flow.body) {
    await ctx.answerOnCallback({ notification: 'Нет текста' });
    return ctx.reply('Сначала напишите текст объявления.');
  }
  if (!requireUkCompany(user)) {
    await ctx.answerOnCallback({ notification: 'Нет доступа' });
    return;
  }

  const recipients = await listResidentMaxIdsByCompany(user.company_id);
  let sent = 0;
  for (const maxId of recipients) {
    try {
      await ctx.api.sendMessageToUser(
        maxId,
        `📢 *Объявление от вашей УК*\n\n${flow.body}`,
        { format: 'markdown' },
      );
      sent += 1;
    } catch (error) {
      console.error('Рассылка жителю не удалась:', error.message);
    }
  }

  await createAnnouncement({
    companyId: user.company_id,
    authorUserId: user.id,
    body: flow.body,
    recipientsCount: sent,
  });
  await clearFlow(user.id);
  await ctx.answerOnCallback({ notification: 'Отправлено' });
  return ctx.reply(
    `Объявление отправлено: *${sent}* из ${recipients.length} жильцов.`,
    replyOpts(ukMenuKeyboard(true)),
  );
}

/** Обработка текстовых шагов заявок/рассылки. Возвращает true, если сообщение обработано. */
export async function handleTicketsText(ctx, user, text) {
  if (user.flow_step === 'req_address') {
    const flow = await getFlow(user);
    if (text.length < 5) {
      await ctx.reply('Адрес слишком короткий. Укажите подробнее.');
      return true;
    }
    await askRequestDetails(ctx, user, { ...flow, address: text });
    return true;
  }

  if (user.flow_step === 'req_details') {
    const flow = await getFlow(user);
    await showRequestConfirm(ctx, user, { ...flow, description: text });
    return true;
  }

  if (user.flow_step === 'req_uk_comment') {
    if (!requireUkCompany(user)) {
      await clearFlow(user.id);
      await ctx.reply('Нет доступа.');
      return true;
    }
    const flow = await getFlow(user);
    const existing = await getRequestById(flow.requestId);
    if (!existing || existing.company_id !== user.company_id) {
      await clearFlow(user.id);
      await ctx.reply('Заявка не найдена.');
      return true;
    }

    const messages = await addRequestMessage({
      requestId: flow.requestId,
      authorUserId: user.id,
      authorRole: 'uk',
      body: text,
    });
    const updated = await getRequestById(flow.requestId);
    await clearFlow(user.id);

    if (updated.resident_max_user_id) {
      try {
        await ctx.api.sendMessageToUser(
          updated.resident_max_user_id,
          `💬 Комментарий УК по заявке *№${updated.public_number}*:\n\n${text}\n\nМожете ответить кнопкой ниже.`,
          {
            format: 'markdown',
            attachments: [residentReplyKeyboard(updated.id)],
          },
        );
      } catch (error) {
        console.error('Не удалось отправить комментарий жителю:', error.message);
      }
    }

    await ctx.reply(
      `Комментарий отправлен жителю.\n\n${formatRequestCardHtml(updated, messages)}`,
      {
        format: 'html',
        attachments: [requestStatusKeyboard(updated.id)],
      },
    );
    return true;
  }

  if (user.flow_step === 'req_resident_reply') {
    if (user.role !== 'resident') {
      await clearFlow(user.id);
      await ctx.reply('Нет доступа.');
      return true;
    }
    const flow = await getFlow(user);
    const existing = await getRequestById(flow.requestId);
    if (!existing || existing.user_id !== user.id) {
      await clearFlow(user.id);
      await ctx.reply('Заявка не найдена.');
      return true;
    }
    if (text.length < 2) {
      await ctx.reply('Ответ слишком короткий.');
      return true;
    }

    const messages = await addRequestMessage({
      requestId: flow.requestId,
      authorUserId: user.id,
      authorRole: 'resident',
      body: text,
    });
    const updated = await getRequestById(flow.requestId);
    await clearFlow(user.id);

    const managers = await listUkManagerMaxIds(updated.company_id);
    for (const maxId of managers) {
      try {
        await ctx.api.sendMessageToUser(
          maxId,
          `💬 Ответ жителя по заявке №${updated.public_number}\n\n${formatRequestCardHtml(updated, messages)}`,
          {
            format: 'html',
            attachments: [requestStatusKeyboard(updated.id)],
          },
        );
      } catch (error) {
        console.error('Не удалось уведомить УК об ответе:', error.message);
      }
    }

    const home = await residentHomePayload(user);
    await ctx.reply('Ответ отправлен в УК.');
    await ctx.reply(home.text, replyOpts(home.keyboard));
    return true;
  }

  if (user.flow_step === 'bc_text') {
    if (text.length < 3) {
      await ctx.reply('Текст слишком короткий.');
      return true;
    }
    await setFlow(user.id, 'bc_confirm', { body: text });
    const recipients = await listResidentMaxIdsByCompany(user.company_id);
    await ctx.reply(
      `Проверьте объявление:\n\n${text}\n\nПолучателей: *${recipients.length}*\nОтправить?`,
      replyOpts(broadcastConfirmKeyboard()),
    );
    return true;
  }

  if (user.flow_step === 'bc_confirm' || user.flow_step === 'req_confirm' || user.flow_step === 'req_category') {
    await ctx.reply('Используйте кнопки под сообщением.');
    return true;
  }

  return false;
}

export async function cancelFlowAndHome(ctx) {
  const user = await getUser(ctx);
  await clearFlow(user.id);
  await ctx.answerOnCallback({ notification: 'Главная' });
  if (user.role === 'uk') {
    return ctx.reply('Меню УК:', replyOpts(ukMenuKeyboard(user.uk_status === 'approved')));
  }
  const home = await residentHomePayload(user);
  return ctx.reply(home.text, replyOpts(home.keyboard));
}
