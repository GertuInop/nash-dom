import { findBestCityMatch, isValidEmail, normalizePhone } from './cities.js';
import {
  acceptConsent,
  activateUkCompany,
  cancelPendingResidentUkRequest,
  changeResidentCity,
  clearPendingCity,
  confirmCityForResident,
  confirmCityForUk,
  decideResidentUkRequest,
  ensureUser,
  getCompanyById,
  getPendingResidentUkRequest,
  getPrimaryAddress,
  getResidentUkRequestById,
  joinResidentToCompany,
  listCities,
  listCompanyUsers,
  listPendingUkRequests,
  listUkManagerMaxIds,
  saveResidentAddress,
  saveResidentAddressOnly,
  saveResidentPersonalAccount,
  saveResidentPhone,
  saveUkAddress,
  saveUkEmail,
  saveUkName,
  saveUkPhone,
  searchCompaniesInCity,
  setPendingCity,
  setRoleResident,
  setRoleUk,
  setUkRequestStatus,
  skipResidentUkSearch,
  startResidentUkSearch,
  unlinkResidentCompany,
  updateUser,
} from './db.js';
import {
  aboutKeyboard,
  adminMenuKeyboard,
  cityConfirmKeyboard,
  consentKeyboard,
  disableUrlButtons,
  homeNavKeyboard,
  isMaxLinkNotFoundError,
  myUkEmptyKeyboard,
  pendingUkKeyboard,
  residentJoinKeyboard,
  residentLimitedMenuKeyboard,
  residentMenuKeyboard,
  residentPendingMenuKeyboard,
  roleKeyboard,
  settingsKeyboard,
  ukMenuKeyboard,
  ukSearchPromptKeyboard,
  ukSearchResultsKeyboard,
  unlinkConfirmKeyboard,
} from './keyboards.js';
import {
  cityConfirmText,
  formatCompanyCard,
  texts,
  ukSearchResultsText,
} from './texts.js';
import { config } from './config.js';

function replyOpts(keyboard) {
  return {
    format: 'markdown',
    attachments: [keyboard],
  };
}

/** Отправка с клавиатурой: при Link not found убираем openApp/link и повторяем */
async function replySafe(ctx, text, keyboardBuilder) {
  const build = typeof keyboardBuilder === 'function' ? keyboardBuilder : () => keyboardBuilder;
  try {
    return await ctx.reply(text, replyOpts(build()));
  } catch (error) {
    if (!isMaxLinkNotFoundError(error)) throw error;
    disableUrlButtons(error?.response?.message || error?.message);
    const hint = config.miniappUrl
      ? `\n\n📱 Откройте мини-приложение: ${config.miniappUrl}`
      : '';
    return ctx.reply(`${text}${hint}`, replyOpts(build()));
  }
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function getOrCreateUser(ctx) {
  if (!ctx.user) {
    throw new Error('Не удалось определить пользователя MAX');
  }
  return ensureUser(ctx.user);
}

export async function residentHomePayload(user) {
  if (user.company_id) {
    return {
      text: 'Главное меню жителя. Выберите действие:',
      keyboard: residentMenuKeyboard(),
      keyboardType: 'full',
    };
  }
  const pending = await getPendingResidentUkRequest(user.id);
  if (pending) {
    return {
      text: `Заявка в УК «${pending.company_name}» ожидает одобрения руководителя.\nПока доступны только настройки и справка.`,
      keyboard: residentPendingMenuKeyboard(),
      keyboardType: 'pending',
    };
  }
  return {
    text: 'УК ещё не подключена.\nДоступны настройки, справка и поиск управляющей компании.',
    keyboard: residentLimitedMenuKeyboard(),
    keyboardType: 'limited',
  };
}

export async function showHome(ctx, user) {
  if (user.role === 'admin') {
    return replySafe(ctx, texts.adminReady, adminMenuKeyboard);
  }

  if (user.onboarding_step !== 'done') {
    return startOnboarding(ctx, user);
  }

  if (user.role === 'resident') {
    const home = await residentHomePayload(user);
    return replySafe(ctx, home.text, () => {
      if (home.keyboardType === 'pending') return residentPendingMenuKeyboard();
      if (home.keyboardType === 'limited') return residentLimitedMenuKeyboard();
      return residentMenuKeyboard();
    });
  }

  if (user.role === 'uk') {
    const approved = user.uk_status === 'approved';
    const text = approved
      ? 'Кабинет управляющей компании. Выберите действие:'
      : texts.ukWaitingMenu;
    return replySafe(ctx, text, () => ukMenuKeyboard(approved));
  }

  return startOnboarding(ctx, user);
}

function askCityPrompt(user) {
  return user.role === 'uk' ? texts.askCityUk : texts.askCityResident;
}

export async function startOnboarding(ctx, user) {
  if (!user.consent_accepted) {
    await updateUser(user.id, { onboarding_step: 'consent' });
    return replySafe(ctx, texts.welcome, consentKeyboard);
  }

  if (!user.role) {
    await updateUser(user.id, { onboarding_step: 'role' });
    return replySafe(ctx, texts.chooseRole, roleKeyboard);
  }

  switch (user.onboarding_step) {
    case 'city':
      return ctx.reply(askCityPrompt(user));
    case 'city_confirm':
      return replySafe(ctx, cityConfirmText(user.pending_city_display), cityConfirmKeyboard);
    case 'phone':
      return ctx.reply(texts.askPhone);
    case 'personal_account':
      return ctx.reply(texts.askPersonalAccount);
    case 'address':
      return ctx.reply(texts.askAddress);
    case 'uk_search':
      return replySafe(ctx, texts.askUkSearch, ukSearchPromptKeyboard);
    case 'uk_name':
      return ctx.reply(texts.askUkName);
    case 'uk_phone':
      return ctx.reply(texts.askUkPhone);
    case 'uk_email':
      return ctx.reply(texts.askUkEmail);
    case 'uk_address':
      return ctx.reply(texts.askUkAddress);
    default:
      return showHome(ctx, { ...user, onboarding_step: 'done' });
  }
}

export async function handleBotStarted(ctx) {
  const user = await getOrCreateUser(ctx);
  return showHome(ctx, user);
}

export async function handleConsentAccept(ctx) {
  const user = await getOrCreateUser(ctx);
  await acceptConsent(user.id);
  await ctx.answerOnCallback({ notification: 'Согласие принято' });
  return ctx.reply(texts.chooseRole, replyOpts(roleKeyboard()));
}

export async function handleConsentDecline(ctx) {
  await ctx.answerOnCallback({ notification: 'Согласие отклонено' });
  return ctx.reply(texts.consentDeclined);
}

export async function handleConsentRead(ctx) {
  await ctx.answerOnCallback({ notification: 'Соглашение' });
  const url = config.consentUrl;
  const short = [
    '📜 *Пользовательское соглашение «Наш Дом»*',
    '',
    'Используя сервис, вы принимаете условия соглашения и даёте согласие на обработку персональных данных (152-ФЗ).',
    'Приложение носит справочный характер и не заменяет юрконсультацию.',
    '',
    url
      ? `📄 Полный текст (PDF):\n${url}`
      : 'Полный текст доступен в мини-приложении на экране согласия.',
  ].join('\n');
  return replySafe(ctx, short, consentKeyboard);
}

export async function handleRoleResident(ctx) {
  const user = await getOrCreateUser(ctx);
  await setRoleResident(user.id);
  await ctx.answerOnCallback({ notification: 'Роль: житель' });
  return ctx.reply(texts.askCityResident);
}

export async function handleRoleUk(ctx) {
  const user = await getOrCreateUser(ctx);
  await setRoleUk(user.id);
  await ctx.answerOnCallback({ notification: 'Роль: УК' });
  return ctx.reply(texts.askCityUk);
}

async function handleCityInput(ctx, user, text) {
  const cities = await listCities();
  const match = findBestCityMatch(text, cities);
  if (!match) {
    return ctx.reply(texts.cityNotFound);
  }

  await setPendingCity(user.id, match.slug, match.display_name);
  return ctx.reply(
    cityConfirmText(match.display_name),
    replyOpts(cityConfirmKeyboard()),
  );
}

export async function handleCityConfirm(ctx) {
  const user = await getOrCreateUser(ctx);

  // Смена города из настроек
  if (user.flow_step === 'settings_city_confirm' && user.pending_city_slug) {
    const cities = await listCities();
    const exists = cities.some((c) => c.slug === user.pending_city_slug);
    if (!exists) {
      await clearPendingCity(user.id, 'done');
      await updateUser(user.id, { flow_step: null, flow_json: null, onboarding_step: 'done' });
      await ctx.answerOnCallback({ notification: 'Город не найден' });
      return ctx.reply(texts.cityNotFound);
    }
    await changeResidentCity(user.id, user.pending_city_slug);
    await updateUser(user.id, {
      flow_step: null,
      flow_json: null,
      onboarding_step: 'done',
      pending_city_slug: null,
      pending_city_display: null,
    });
    await ctx.answerOnCallback({ notification: 'Город обновлён' });
    await ctx.reply(`Город изменён на *${user.pending_city_display}*. Вы отвязаны от УК.`, {
      format: 'markdown',
    });
    return showHome(ctx, {
      ...user,
      city_slug: user.pending_city_slug,
      company_id: null,
      flow_step: null,
      onboarding_step: 'done',
    });
  }

  if (user.onboarding_step !== 'city_confirm' || !user.pending_city_slug) {
    await ctx.answerOnCallback({ notification: 'Сначала укажите город' });
    return startOnboarding(ctx, user);
  }

  // Город обязан быть из справочника
  const cities = await listCities();
  const exists = cities.some((c) => c.slug === user.pending_city_slug);
  if (!exists) {
    await clearPendingCity(user.id, 'city');
    await ctx.answerOnCallback({ notification: 'Город не найден' });
    return ctx.reply(texts.cityNotFound);
  }

  if (user.role === 'resident') {
    await confirmCityForResident(user.id, user.pending_city_slug);
    await ctx.answerOnCallback({ notification: 'Город подтверждён' });
    return ctx.reply(texts.askPhone);
  }

  if (user.role === 'uk') {
    await confirmCityForUk(user.id, user.pending_city_slug);
    await ctx.answerOnCallback({ notification: 'Город подтверждён' });
    return ctx.reply(texts.askUkName);
  }

  await ctx.answerOnCallback({ notification: 'Ошибка роли' });
  return ctx.reply('Нажмите /start, чтобы начать заново.');
}

export async function handleCityRetry(ctx) {
  const user = await getOrCreateUser(ctx);

  if (user.flow_step === 'settings_city_confirm') {
    await clearPendingCity(user.id, 'done');
    await updateUser(user.id, {
      onboarding_step: 'done',
      flow_step: 'settings_city',
      flow_json: null,
    });
    await ctx.answerOnCallback({ notification: 'Введите город ещё раз' });
    return ctx.reply(texts.askCityResident);
  }

  await clearPendingCity(user.id, 'city');
  await ctx.answerOnCallback({ notification: 'Введите город ещё раз' });
  return ctx.reply(askCityPrompt(user));
}

async function replyUkSearchResults(ctx, user, query) {
  if (!user.city_slug) {
    return ctx.reply('Сначала укажите город. Нажмите /start.');
  }

  if (String(query || '').trim().length < 2) {
    return ctx.reply(texts.ukSearchShort, replyOpts(ukSearchPromptKeyboard()));
  }

  const { total, items } = await searchCompaniesInCity(user.city_slug, query, 8);
  if (!total) {
    return ctx.reply(texts.ukSearchEmpty, replyOpts(ukSearchPromptKeyboard()));
  }

  return ctx.reply(
    ukSearchResultsText(total, items.length),
    replyOpts(ukSearchResultsKeyboard(items)),
  );
}

export async function handleUkSearchStart(ctx) {
  const user = await getOrCreateUser(ctx);
  if (user.role !== 'resident') {
    await ctx.answerOnCallback({ notification: 'Только для жителей' });
    return ctx.reply('Поиск УК доступен жителям.');
  }
  if (!user.city_slug) {
    await ctx.answerOnCallback({ notification: 'Нет города' });
    return ctx.reply('Сначала укажите город в регистрации.');
  }

  const duringOnboarding = user.onboarding_step !== 'done';
  await startResidentUkSearch(user.id, { duringOnboarding });
  await ctx.answerOnCallback({ notification: 'Поиск УК' });
  return ctx.reply(texts.askUkSearch, replyOpts(ukSearchPromptKeyboard()));
}

export async function handleUkSearchAgain(ctx) {
  const user = await getOrCreateUser(ctx);
  const duringOnboarding = user.onboarding_step !== 'done';
  await startResidentUkSearch(user.id, { duringOnboarding });
  await ctx.answerOnCallback({ notification: 'Новый поиск' });
  return ctx.reply(texts.askUkSearch, replyOpts(ukSearchPromptKeyboard()));
}

export async function handleUkSearchSkip(ctx) {
  const user = await getOrCreateUser(ctx);
  await skipResidentUkSearch(user.id);
  await ctx.answerOnCallback({ notification: 'Пропущено' });
  await ctx.reply(texts.residentReady);
  return showHome(ctx, { ...user, onboarding_step: 'done' });
}

export async function handleUkPick(ctx, companyId) {
  const user = await getOrCreateUser(ctx);
  if (user.role !== 'resident') {
    await ctx.answerOnCallback({ notification: 'Только для жителей' });
    return ctx.reply('Выбор УК доступен жителям.');
  }

  const company = await getCompanyById(companyId);
  if (!company || company.city_slug !== user.city_slug || company.status !== 'approved') {
    await ctx.answerOnCallback({ notification: 'УК не найдена' });
    return ctx.reply('Эта УК недоступна для вашего города. Попробуйте поиск ещё раз.');
  }

  await joinResidentToCompany(user.id, company.id);
  await ctx.answerOnCallback({ notification: 'УК подключена' });

  const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Житель';
  const safeName = escapeHtml(name);
  const profileLink = user.max_user_id
    ? `<a href="max://user/${user.max_user_id}">${safeName}</a>`
    : safeName;

  const managers = await listUkManagerMaxIds(company.id);
  for (const maxId of managers) {
    try {
      await ctx.api.sendMessageToUser(
        maxId,
        `👥 <b>К вашей УК присоединился житель</b>\n\n`
        + `<b>УК:</b> ${escapeHtml(company.name)}\n`
        + `<b>Город:</b> ${escapeHtml(user.city_slug || '—')}\n`
        + `<b>Адрес:</b> ${escapeHtml(user.registration_address || '—')}\n`
        + `<b>Телефон:</b> ${escapeHtml(user.phone || '—')}\n`
        + `<b>Л/с:</b> ${escapeHtml(user.personal_account || '—')}\n\n`
        + profileLink,
        { format: 'html' },
      );
    } catch (error) {
      console.error('Не удалось уведомить УК о жильце:', error.message);
    }
  }

  await ctx.reply(
    `Вы подключены к УК «${company.name}». Доступны все функции жителя.`,
    { format: 'markdown' },
  );
  return showHome(ctx, { ...user, company_id: company.id, onboarding_step: 'done' });
}

export async function handleResidentJoinStatus(ctx) {
  const user = await getOrCreateUser(ctx);
  await ctx.answerOnCallback({ notification: 'Статус' });
  const pending = await getPendingResidentUkRequest(user.id);
  if (!pending) {
    return showHome(ctx, user);
  }
  return ctx.reply(
    `⏳ Заявка в УК «${pending.company_name}» всё ещё ожидает решения руководителя.`,
    replyOpts(residentPendingMenuKeyboard()),
  );
}

export async function handleResidentJoinCancel(ctx) {
  const user = await getOrCreateUser(ctx);
  await cancelPendingResidentUkRequest(user.id);
  await ctx.answerOnCallback({ notification: 'Заявка отменена' });
  await ctx.reply('Заявка на подключение к УК отменена.');
  return showHome(ctx, { ...user, company_id: null });
}

export async function handleUkResidentJoins(ctx) {
  const user = await getOrCreateUser(ctx);
  await ctx.answerOnCallback({ notification: 'Жильцы' });
  if (user.role !== 'uk' || user.uk_status !== 'approved' || !user.company_id) {
    return ctx.reply('Доступно только одобренной УК.');
  }

  const items = await listCompanyUsers(user.company_id);
  const residents = items.filter((item) => item.role !== 'uk');
  if (!residents.length) {
    return ctx.reply(
      'Пока никто не подключился к вашей УК.\nКогда житель выберет вас в боте или мини-приложении — он появится здесь.',
      replyOpts(homeNavKeyboard()),
    );
  }

  await ctx.reply(`👥 Жители вашей УК: *${residents.length}*`, {
    format: 'markdown',
    ...replyOpts(homeNavKeyboard()),
  });

  for (const item of residents) {
    const name = [item.first_name, item.last_name].filter(Boolean).join(' ') || 'Житель';
    const safeName = escapeHtml(name);
    const profileLink = item.max_user_id
      ? `<a href="max://user/${item.max_user_id}">${safeName}</a>`
      : safeName;

    await ctx.reply(
      `👤 ${profileLink}\n`
      + `<b>Телефон:</b> ${escapeHtml(item.phone || '—')}\n`
      + `<b>Адрес:</b> ${escapeHtml(item.registration_address || '—')}\n`
      + `<b>Л/с:</b> ${escapeHtml(item.personal_account || '—')}`,
      { format: 'html' },
    );
  }
}

export async function handleResidentJoinDecision(ctx, requestId, decision) {
  const user = await getOrCreateUser(ctx);
  if (user.role !== 'uk' || user.uk_status !== 'approved' || !user.company_id) {
    await ctx.answerOnCallback({ notification: 'Нет доступа' });
    return ctx.reply('Доступно только одобренной УК.');
  }

  const status = decision === 'approve' ? 'approved' : 'rejected';
  const updated = await decideResidentUkRequest(requestId, status, user.company_id);
  if (!updated) {
    await ctx.answerOnCallback({ notification: 'Не найдено' });
    return ctx.reply('Заявка уже обработана или не найдена.');
  }

  await ctx.answerOnCallback({
    notification: status === 'approved' ? 'Жилец принят' : 'Отклонено',
  });

  if (updated.max_user_id) {
    try {
      if (status === 'approved') {
        await ctx.api.sendMessageToUser(
          updated.max_user_id,
          `✅ Ваша заявка в УК «${updated.company_name}» одобрена. Доступны все функции жителя.`,
        );
        await ctx.api.sendMessageToUser(
          updated.max_user_id,
          'Главное меню жителя. Выберите действие:',
          { attachments: [residentMenuKeyboard()] },
        );
      } else {
        await ctx.api.sendMessageToUser(
          updated.max_user_id,
          `❌ Ваша заявка в УК «${updated.company_name}» отклонена. Вы можете выбрать другую УК в настройках.`,
          { attachments: [residentLimitedMenuKeyboard()] },
        );
      }
    } catch (error) {
      console.error('Не удалось уведомить жильца:', error.message);
    }
  }

  return ctx.reply(
    status === 'approved'
      ? `Жилец принят в УК «${updated.company_name}».`
      : 'Заявка жильца отклонена.',
    replyOpts(homeNavKeyboard()),
  );
}

export async function handleTextMessage(ctx) {
  const text = ctx.message?.body?.text?.trim();
  if (!text || text.startsWith('/')) return;

  const user = await getOrCreateUser(ctx);

  if (user.onboarding_step === 'city') {
    return handleCityInput(ctx, user, text);
  }

  if (user.onboarding_step === 'city_confirm') {
    return ctx.reply(
      'Подтвердите город кнопками ниже или нажмите «Ввести ещё раз».',
      replyOpts(cityConfirmKeyboard()),
    );
  }

  if (user.onboarding_step === 'phone' && user.role === 'resident') {
    const phone = normalizePhone(text);
    if (!phone) {
      return ctx.reply(texts.phoneInvalid);
    }
    await saveResidentPhone(user.id, phone);
    return ctx.reply(texts.askPersonalAccount);
  }

  if (user.onboarding_step === 'personal_account' && user.role === 'resident') {
    if (text.length < 3) {
      return ctx.reply('Лицевой счёт слишком короткий. Укажите номер ещё раз.');
    }
    await saveResidentPersonalAccount(user.id, text);
    return ctx.reply(texts.askAddress);
  }

  if (user.onboarding_step === 'address' && user.role === 'resident') {
    await saveResidentAddress(user.id, text);
    return ctx.reply(texts.askUkSearch, replyOpts(ukSearchPromptKeyboard()));
  }

  if ((user.onboarding_step === 'uk_search' || user.flow_step === 'uk_search') && user.role === 'resident') {
    return replyUkSearchResults(ctx, user, text);
  }

  if (user.onboarding_step === 'uk_name' && user.role === 'uk') {
    await saveUkName(user.id, text);
    return ctx.reply(texts.askUkPhone);
  }

  if (user.onboarding_step === 'uk_phone' && user.role === 'uk') {
    if (!user.company_id) {
      return ctx.reply('Сначала укажите название УК. Нажмите /start.');
    }
    const phone = normalizePhone(text);
    if (!phone) {
      return ctx.reply(texts.phoneInvalid);
    }
    await saveUkPhone(user.id, user.company_id, phone);
    return ctx.reply(texts.askUkEmail);
  }

  if (user.onboarding_step === 'uk_email' && user.role === 'uk') {
    if (!user.company_id) {
      return ctx.reply('Сначала укажите название УК. Нажмите /start.');
    }
    const email = text.toLowerCase();
    if (!isValidEmail(email)) {
      return ctx.reply(texts.emailInvalid);
    }
    await saveUkEmail(user.id, user.company_id, email);
    return ctx.reply(texts.askUkAddress);
  }

  if (user.onboarding_step === 'uk_address' && user.role === 'uk') {
    if (!user.company_id) {
      return ctx.reply('Сначала укажите название УК. Нажмите /start.');
    }
    if (text.length < 5) {
      return ctx.reply('Адрес слишком короткий. Укажите адрес офиса ещё раз.');
    }
    await saveUkAddress(user.id, user.company_id, text);
    await ctx.reply(texts.ukReady);
    return showHome(ctx, {
      ...user,
      onboarding_step: 'done',
      uk_status: 'approved',
    });
  }

  if (user.onboarding_step !== 'done') {
    return startOnboarding(ctx, user);
  }

  // Настройки: смена адреса / города
  if (user.flow_step === 'settings_address' && user.role === 'resident') {
    if (text.length < 5) {
      return ctx.reply('Адрес слишком короткий. Укажите ещё раз.');
    }
    await saveResidentAddressOnly(user.id, text);
    await updateUser(user.id, { flow_step: null, flow_json: null });
    await ctx.reply('Адрес обновлён.');
    return showHome(ctx, { ...user, registration_address: text, company_id: null, flow_step: null });
  }

  if (user.flow_step === 'settings_city' && user.role === 'resident') {
    const cities = await listCities();
    const match = findBestCityMatch(text, cities);
    if (!match) {
      return ctx.reply(texts.cityNotFound);
    }
    await setPendingCity(user.id, match.slug, match.display_name);
    // setPendingCity ставит city_confirm — переопределим на settings confirm
    await updateUser(user.id, { onboarding_step: 'done', flow_step: 'settings_city_confirm' });
    return ctx.reply(
      cityConfirmText(match.display_name),
      replyOpts(cityConfirmKeyboard()),
    );
  }

  if (user.flow_step === 'settings_city_confirm') {
    return ctx.reply(
      'Подтвердите город кнопками ниже.',
      replyOpts(cityConfirmKeyboard()),
    );
  }

  const { handleTicketsText } = await import('./tickets.js');
  if (await handleTicketsText(ctx, user, text)) {
    return;
  }

  return showHome(ctx, user);
}

export async function handleNavHome(ctx) {
  const user = await getOrCreateUser(ctx);
  const { clearFlow } = await import('./tickets-db.js');
  await clearFlow(user.id);
  await ctx.answerOnCallback({ notification: 'Главная' });
  return showHome(ctx, { ...user, flow_step: null, flow_json: null });
}

export async function handleStub(ctx, title = 'Раздел') {
  await ctx.answerOnCallback({ notification: title });
  return ctx.reply(`${title}\n\n${texts.stub}`, replyOpts(homeNavKeyboard()));
}

export async function handleMyUk(ctx) {
  const user = await getOrCreateUser(ctx);
  await ctx.answerOnCallback({ notification: 'Моя УК' });
  const company = await getCompanyById(user.company_id);
  if (!company) {
    return ctx.reply(texts.myUkEmpty, replyOpts(myUkEmptyKeyboard()));
  }
  return ctx.reply(formatCompanyCard(company), replyOpts(homeNavKeyboard()));
}

export async function handleAbout(ctx) {
  await ctx.answerOnCallback({ notification: 'О чат-боте' });
  const pdf = config.consentUrl ? `\n\n📄 PDF: ${config.consentUrl}` : '';
  const app = config.miniappUrl ? `\n📱 Мини-приложение: ${config.miniappUrl}` : '';
  return replySafe(ctx, `${texts.about}${pdf}${app}`, aboutKeyboard);
}

export async function handleSettings(ctx) {
  const user = await getOrCreateUser(ctx);
  await ctx.answerOnCallback({ notification: 'Настройки' });
  return ctx.reply('⚙️ Настройки', replyOpts(settingsKeyboard(Boolean(user.company_id))));
}

export async function handleSettingsProfile(ctx) {
  const user = await getOrCreateUser(ctx);
  await ctx.answerOnCallback({ notification: 'Мои данные' });
  const address = await getPrimaryAddress(user.id);
  const company = await getCompanyById(user.company_id);
  const pending = !company ? await getPendingResidentUkRequest(user.id) : null;
  const ukLine = company?.name
    || (pending ? `${pending.company_name} (ожидает одобрения)` : 'не выбрана');

  const text = `👤 *Мои данные*

*Имя:* ${[user.first_name, user.last_name].filter(Boolean).join(' ') || 'не указано'}
*Город:* ${user.city_slug || 'не указан'}
*Телефон:* ${user.phone || 'не указан'}
*Адрес:* ${address?.address_text || user.registration_address || 'не указан'}
*Лицевой счёт:* ${user.personal_account || 'не указан'}
*УК:* ${ukLine}
*Роль:* ${user.role || 'не выбрана'}`;
  return ctx.reply(text, replyOpts(settingsKeyboard(Boolean(user.company_id))));
}

export async function handleSettingsAddress(ctx) {
  const user = await getOrCreateUser(ctx);
  await ctx.answerOnCallback({ notification: 'Сменить адрес' });
  if (user.company_id || await getPendingResidentUkRequest(user.id)) {
    await updateUser(user.id, {
      flow_step: 'unlink_warn',
      flow_json: JSON.stringify({ action: 'address' }),
    });
    return ctx.reply(
      '⚠️ При смене адреса вы будете *отвязаны от текущей УК* (или отменится заявка на подключение).\n\nПродолжить?',
      replyOpts(unlinkConfirmKeyboard('address')),
    );
  }
  await updateUser(user.id, { flow_step: 'settings_address', flow_json: null });
  return ctx.reply('Введите новый адрес проживания одним сообщением.');
}

export async function handleSettingsCity(ctx) {
  const user = await getOrCreateUser(ctx);
  await ctx.answerOnCallback({ notification: 'Сменить город' });
  if (user.company_id || await getPendingResidentUkRequest(user.id)) {
    await updateUser(user.id, {
      flow_step: 'unlink_warn',
      flow_json: JSON.stringify({ action: 'city' }),
    });
    return ctx.reply(
      '⚠️ При смене города вы будете *отвязаны от текущей УК* (или отменится заявка на подключение).\n\nПродолжить?',
      replyOpts(unlinkConfirmKeyboard('city')),
    );
  }
  await updateUser(user.id, { flow_step: 'settings_city', flow_json: null });
  return ctx.reply(texts.askCityResident);
}

export async function handleSettingsChangeUk(ctx) {
  const user = await getOrCreateUser(ctx);
  await ctx.answerOnCallback({ notification: 'Сменить УК' });
  if (user.company_id || await getPendingResidentUkRequest(user.id)) {
    await updateUser(user.id, {
      flow_step: 'unlink_warn',
      flow_json: JSON.stringify({ action: 'uk' }),
    });
    return ctx.reply(
      '⚠️ Чтобы выбрать другую УК, нужно *отвязаться от текущей*.\n\nПродолжить?',
      replyOpts(unlinkConfirmKeyboard('uk')),
    );
  }
  await startResidentUkSearch(user.id);
  return ctx.reply(texts.askUkSearch, replyOpts(ukSearchPromptKeyboard()));
}

export async function handleUnlinkConfirm(ctx, action) {
  const user = await getOrCreateUser(ctx);
  await unlinkResidentCompany(user.id);
  await ctx.answerOnCallback({ notification: 'Отвязано от УК' });

  if (action === 'address') {
    await updateUser(user.id, { flow_step: 'settings_address', flow_json: null });
    return ctx.reply('Вы отвязаны от УК. Введите новый адрес проживания.');
  }
  if (action === 'city') {
    await updateUser(user.id, { flow_step: 'settings_city', flow_json: null });
    return ctx.reply(`Вы отвязаны от УК.\n\n${texts.askCityResident}`);
  }
  if (action === 'uk') {
    await updateUser(user.id, { flow_step: null, flow_json: null });
    await startResidentUkSearch(user.id);
    return ctx.reply(
      'Вы отвязаны от УК. Найдите новую управляющую компанию.',
      replyOpts(ukSearchPromptKeyboard()),
    );
  }
  return showHome(ctx, { ...user, company_id: null });
}

export async function handleUnlinkCancel(ctx) {
  const user = await getOrCreateUser(ctx);
  await updateUser(user.id, { flow_step: null, flow_json: null });
  await ctx.answerOnCallback({ notification: 'Отменено' });
  return ctx.reply('Изменение отменено.', replyOpts(settingsKeyboard(Boolean(user.company_id))));
}

export async function handleUkStatus(ctx) {
  const user = await getOrCreateUser(ctx);
  await ctx.answerOnCallback({ notification: 'Статус' });

  if (user.role === 'uk' && user.company_id && user.uk_status !== 'approved') {
    await activateUkCompany(user.id, user.company_id);
  }
  const fresh = await getOrCreateUser(ctx);
  const company = await getCompanyById(fresh.company_id);
  return ctx.reply(
    `🏢 *${company?.name || 'УК'}*
*Город:* ${company?.city_slug || fresh.city_slug || 'не указан'}
Статус: *активна* — кабинет УК открыт.`,
    replyOpts(ukMenuKeyboard(true)),
  );
}

export async function handleAdminPendingUk(ctx) {
  const user = await getOrCreateUser(ctx);
  await ctx.answerOnCallback({ notification: 'Заявки УК' });

  if (user.role !== 'admin') {
    return ctx.reply('Доступно только администратору.');
  }

  const pending = await listPendingUkRequests();
  if (!pending.length) {
    return ctx.reply('Новых заявок на роль УК нет.', replyOpts(homeNavKeyboard()));
  }

  for (const item of pending) {
    const name = [item.first_name, item.last_name].filter(Boolean).join(' ')
      || item.username
      || 'Пользователь';
    const safeName = name
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const profileLink = item.max_user_id
      ? `<a href="max://user/${item.max_user_id}">${safeName}</a>`
      : safeName;

    await ctx.reply(
      `📋 <b>Заявка #${item.id}</b>\n\n`
      + `<b>УК:</b> ${escapeHtml(item.name)}\n`
      + `<b>Город:</b> ${escapeHtml(item.city_slug || 'не указан')}\n`
      + `<b>Телефон:</b> ${escapeHtml(item.phone || 'не указан')}\n`
      + `<b>Email:</b> ${escapeHtml(item.email || 'не указан')}\n`
      + `<b>Адрес:</b> ${escapeHtml(item.address || 'не указан')}\n\n`
      + profileLink,
      {
        format: 'html',
        attachments: [pendingUkKeyboard(item.id)],
      },
    );
  }
}

export async function handleAdminDecision(ctx, companyId, decision) {
  const user = await getOrCreateUser(ctx);
  if (user.role !== 'admin') {
    await ctx.answerOnCallback({ notification: 'Недостаточно прав' });
    return ctx.reply('Доступно только администратору.');
  }

  const status = decision === 'approve' ? 'approved' : 'rejected';
  const result = await setUkRequestStatus(companyId, status, user.id);
  await ctx.answerOnCallback({
    notification: decision === 'approve' ? 'Одобрено' : 'Отклонено',
  });

  if (result?.max_user_id) {
    const message = decision === 'approve' ? texts.ukApproved : texts.ukRejected;
    try {
      await ctx.api.sendMessageToUser(result.max_user_id, message, { format: 'markdown' });
      if (decision === 'approve') {
        await ctx.api.sendMessageToUser(
          result.max_user_id,
          'Главное меню УК. Выберите действие:',
          { attachments: [ukMenuKeyboard(true)] },
        );
      }
    } catch (error) {
      console.error('Не удалось уведомить УК:', error.message);
    }
  }

  return ctx.reply(
    decision === 'approve'
      ? `Заявка #${companyId} одобрена.`
      : `Заявка #${companyId} отклонена.`,
    replyOpts(homeNavKeyboard()),
  );
}
