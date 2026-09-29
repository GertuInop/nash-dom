import { Keyboard } from '@maxhub/max-bot-api';
import { config } from './config.js';

const { button, inlineKeyboard } = Keyboard;

/** Кнопка открытия мини-приложения (MAX OpenAppButton) */
function miniappOpenRow() {
  if (!config.miniappUrl) return [];
  return [[button.openApp('📱 Открыть Наш Дом', config.miniappUrl)]];
}

export function consentKeyboard() {
  const rows = [];
  if (config.consentUrl) {
    rows.push([button.link('📄 Открыть PDF соглашения', config.consentUrl)]);
  }
  rows.push([button.callback('📜 Кратко о соглашении', 'consent:read')]);
  rows.push([button.callback('✅ Согласен', 'consent:accept')]);
  rows.push([button.callback('❌ Не согласен', 'consent:decline')]);
  return inlineKeyboard(rows);
}

export function roleKeyboard() {
  return inlineKeyboard([
    [button.callback('🏠 Житель', 'role:resident')],
    [button.callback('🏢 Управляющая компания', 'role:uk')],
  ]);
}

export function residentMenuKeyboard() {
  return inlineKeyboard([
    ...miniappOpenRow(),
    [
      button.callback('🚨 Авария', 'menu:emergency'),
      button.callback('📝 Подать заявку', 'menu:request'),
    ],
    [
      button.callback('📞 Моя УК', 'menu:my_uk'),
      button.callback('📂 Мои заявки', 'menu:my_requests'),
    ],
    [
      button.callback('🅿️ Парковка', 'menu:parking'),
      button.callback('💧 Отключения воды', 'menu:water'),
    ],
    [
      button.callback('⚙️ Настройки', 'menu:settings'),
      button.callback('ℹ️ О чат-боте', 'menu:about'),
    ],
  ]);
}

/** Без привязанной УК — только настройки и справка (+ поиск УК) */
export function residentLimitedMenuKeyboard() {
  return inlineKeyboard([
    ...miniappOpenRow(),
    [button.callback('🔎 Найти УК', 'uksearch:start')],
    [
      button.callback('⚙️ Настройки', 'menu:settings'),
      button.callback('ℹ️ О чат-боте', 'menu:about'),
    ],
  ]);
}

/** Заявка на УК отправлена, ждём одобрения */
export function residentPendingMenuKeyboard() {
  return inlineKeyboard([
    ...miniappOpenRow(),
    [button.callback('⏳ Статус заявки в УК', 'resident:join_status')],
    [button.callback('❌ Отменить заявку в УК', 'resident:join_cancel')],
    [
      button.callback('⚙️ Настройки', 'menu:settings'),
      button.callback('ℹ️ О чат-боте', 'menu:about'),
    ],
  ]);
}

export function ukMenuKeyboard(isApproved) {
  if (!isApproved) {
    return inlineKeyboard([
      ...miniappOpenRow(),
      [button.callback('⏳ Статус заявки', 'uk:status')],
      [button.callback('ℹ️ О чат-боте', 'menu:about')],
      [button.callback('🏠 На главную', 'nav:home')],
    ]);
  }

  return inlineKeyboard([
    ...miniappOpenRow(),
    [button.callback('📥 Входящие заявки', 'uk:incoming')],
    [button.callback('👥 Жильцы', 'uk:resident_joins')],
    [button.callback('📢 Рассылка жителям', 'uk:broadcast')],
    [button.callback('💧 Отключения воды', 'uk:water')],
    [button.callback('🅿️ Парковка', 'uk:parking')],
    [button.callback('⚙️ Профиль УК', 'uk:profile')],
    [button.callback('ℹ️ О чат-боте', 'menu:about')],
  ]);
}

export function adminMenuKeyboard() {
  return inlineKeyboard([
    [button.callback('📋 Заявки на роль УК', 'admin:pending_uk')],
    [button.callback('ℹ️ О чат-боте', 'menu:about')],
  ]);
}

export function pendingUkKeyboard(companyId) {
  return inlineKeyboard([
    [
      button.callback('✅ Одобрить', `admin:approve:${companyId}`),
      button.callback('❌ Отклонить', `admin:reject:${companyId}`),
    ],
  ]);
}

export function homeNavKeyboard() {
  return inlineKeyboard([
    [button.callback('🏠 На главную', 'nav:home')],
  ]);
}

export function settingsKeyboard(hasCompany) {
  const rows = [
    [button.callback('👤 Мои данные', 'settings:profile')],
    [button.callback('🏠 Сменить адрес', 'settings:address')],
    [button.callback('🏙 Сменить город', 'settings:city')],
  ];
  if (hasCompany) {
    rows.push([button.callback('🏢 Сменить УК', 'settings:change_uk')]);
  } else {
    rows.push([button.callback('🔎 Найти УК', 'uksearch:start')]);
  }
  rows.push([button.callback('🏠 На главную', 'nav:home')]);
  return inlineKeyboard(rows);
}

export function unlinkConfirmKeyboard(action) {
  return inlineKeyboard([
    [button.callback('✅ Да, отвязать от УК', `unlink:confirm:${action}`)],
    [button.callback('❌ Отмена', 'unlink:cancel')],
  ]);
}

export function residentJoinKeyboard(requestId) {
  return inlineKeyboard([
    [
      button.callback('✅ Принять жильца', `rjoin:approve:${requestId}`),
      button.callback('❌ Отклонить', `rjoin:reject:${requestId}`),
    ],
  ]);
}

export function aboutKeyboard() {
  const rows = [];
  if (config.consentUrl) {
    rows.push([button.link('📄 Пользовательское соглашение (PDF)', config.consentUrl)]);
  }
  rows.push([button.callback('📜 Текст соглашения', 'consent:read')]);
  rows.push([button.callback('🏠 На главную', 'nav:home')]);
  return inlineKeyboard(rows);
}

export function cityConfirmKeyboard() {
  return inlineKeyboard([
    [button.callback('✅ Да, верно', 'city:confirm')],
    [button.callback('✏️ Ввести ещё раз', 'city:retry')],
  ]);
}

export function ukSearchPromptKeyboard() {
  return inlineKeyboard([
    [button.callback('⏭ Пропустить — выбрать позже', 'uksearch:skip')],
  ]);
}

export function ukSearchResultsKeyboard(companies) {
  const rows = companies.map((company) => {
    const label = truncateButtonLabel(company.name, 56);
    return [button.callback(label, `ukpick:${company.id}`)];
  });
  rows.push([button.callback('🔎 Искать ещё раз', 'uksearch:again')]);
  rows.push([button.callback('⏭ Пропустить', 'uksearch:skip')]);
  return inlineKeyboard(rows);
}

export function myUkEmptyKeyboard() {
  return inlineKeyboard([
    [button.callback('🔎 Найти УК', 'uksearch:start')],
    [button.callback('🏠 На главную', 'nav:home')],
  ]);
}

export function requestCategoriesKeyboard(type) {
  const list = type === 'emergency'
    ? [
        { id: 'no_power', title: 'Нет электричества' },
        { id: 'no_water', title: 'Нет воды' },
        { id: 'elevator', title: 'Застрял лифт' },
        { id: 'leak', title: 'Протечка воды' },
        { id: 'gas', title: 'Запах газа' },
        { id: 'other', title: 'Другое' },
      ]
    : [
        { id: 'plumbing', title: 'Сантехника' },
        { id: 'heating', title: 'Отопление' },
        { id: 'electrical', title: 'Электрика' },
        { id: 'cleaning', title: 'Уборка' },
        { id: 'common', title: 'Общее имущество' },
        { id: 'other', title: 'Другое' },
      ];

  const rows = [];
  for (let i = 0; i < list.length; i += 2) {
    const pair = [button.callback(list[i].title, `reqcat:${list[i].id}`)];
    if (list[i + 1]) {
      pair.push(button.callback(list[i + 1].title, `reqcat:${list[i + 1].id}`));
    }
    rows.push(pair);
  }
  rows.push([button.callback('❌ Отмена', 'req:cancel')]);
  return inlineKeyboard(rows);
}

export function requestAddressKeyboard(hasMyAddress) {
  const rows = [];
  if (hasMyAddress) {
    rows.push([button.callback('📍 Мой адрес', 'req:my_address')]);
  }
  rows.push([button.callback('❌ Отмена', 'req:cancel')]);
  return inlineKeyboard(rows);
}

export function requestDetailsKeyboard() {
  return inlineKeyboard([
    [button.callback('⏭ Пропустить', 'req:skip_details')],
    [button.callback('❌ Отмена', 'req:cancel')],
  ]);
}

export function requestConfirmKeyboard() {
  return inlineKeyboard([
    [button.callback('✅ Отправить', 'req:submit')],
    [button.callback('❌ Отмена', 'req:cancel')],
  ]);
}

export function requestStatusKeyboard(requestId) {
  return inlineKeyboard([
    [
      button.callback('⏳ В работе', `reqst:${requestId}:in_progress`),
      button.callback('✅ Выполнена', `reqst:${requestId}:done`),
    ],
    [
      button.callback('❌ Отклонить', `reqst:${requestId}:rejected`),
      button.callback('💬 Комментарий', `reqst:${requestId}:comment`),
    ],
    [button.callback('🏠 На главную', 'nav:home')],
  ]);
}

export function residentReplyKeyboard(requestId) {
  return inlineKeyboard([
    [button.callback('💬 Ответить УК', `reqreply:${requestId}`)],
    [button.callback('🏠 На главную', 'nav:home')],
  ]);
}

export function broadcastConfirmKeyboard() {
  return inlineKeyboard([
    [button.callback('✅ Отправить всем жильцам', 'bc:send')],
    [button.callback('❌ Отмена', 'bc:cancel')],
  ]);
}

function truncateButtonLabel(text, max) {
  const value = String(text || 'УК');
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}
