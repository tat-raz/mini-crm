export function errorMessage(error: { code?: string; message: string }): string {
  switch (error.code) {
    case '23503': return 'Нельзя удалить: есть связанные записи (сначала удалите задачи объекта)'
    case '42501': return 'Действие недоступно для вашей роли или текущего статуса'
    case '22023': return 'Укажите комментарий'
    case 'P0002': return 'Задача не найдена'
    case '23514': return 'Заполните обязательные поля'
    default: return error.message
  }
}