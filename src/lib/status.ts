import type { Profile, Task, TaskStatus } from '../types'

export const STATUS_LABELS: Record<TaskStatus, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  review: 'На проверке',
  accepted: 'Принята',
  rework: 'На доработке',
}

export const STATUS_COLORS: Record<TaskStatus, string> = {
  new: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  review: 'bg-amber-100 text-amber-800',
  accepted: 'bg-green-100 text-green-700',
  rework: 'bg-red-100 text-red-700',
}

export interface StatusAction {
  to: TaskStatus
  label: string
  needsComment?: boolean
}

export function getAvailableActions(
  task: Pick<Task, 'status' | 'assignee_id'>,
  profile: Profile
): StatusAction[] {
  const isAssignee = task.assignee_id === profile.id
  const isManager = profile.role === 'manager'

  if (isAssignee && (task.status === 'new' || task.status === 'rework')) {
    return [{ to: 'in_progress', label: 'Взять в работу' }]
  }
  if (isAssignee && task.status === 'in_progress') {
    return [{ to: 'review', label: 'Отправить на проверку' }]
  }
  if (isManager && task.status === 'review') {
    return [
      { to: 'accepted', label: 'Принять' },
      { to: 'rework', label: 'Вернуть на доработку', needsComment: true },
    ]
  }
  return []
}