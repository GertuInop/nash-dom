/** Категории заявок жителя */

export const EMERGENCY_CATEGORIES = [
  { id: 'no_power', title: 'Нет электричества' },
  { id: 'no_water', title: 'Нет воды' },
  { id: 'elevator', title: 'Застрял лифт' },
  { id: 'leak', title: 'Протечка воды' },
  { id: 'gas', title: 'Запах газа' },
  { id: 'other', title: 'Другое' },
];

export const REGULAR_CATEGORIES = [
  { id: 'plumbing', title: 'Сантехника' },
  { id: 'heating', title: 'Отопление' },
  { id: 'electrical', title: 'Электрика' },
  { id: 'cleaning', title: 'Уборка' },
  { id: 'common', title: 'Общее имущество' },
  { id: 'other', title: 'Другое' },
];

export const REQUEST_STATUS = {
  new: 'Новая',
  in_progress: 'В работе',
  done: 'Выполнена',
  rejected: 'Отклонена',
};

export function categoryTitle(type, categoryId) {
  const list = type === 'emergency' ? EMERGENCY_CATEGORIES : REGULAR_CATEGORIES;
  return list.find((c) => c.id === categoryId)?.title || categoryId;
}

export function typeTitle(type) {
  return type === 'emergency' ? 'Авария' : 'Заявка';
}
