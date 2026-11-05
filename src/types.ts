export type Role = 'manager' | 'executor'
export type TaskStatus = 'new' | 'in_progress' | 'review' | 'accepted' | 'rework'

export interface Profile {
  id: string
  full_name: string
  role: Role
}

export interface ObjectItem {
  id: string
  name: string
  address: string
  created_at: string
}

export interface Task {
  id: string
  title: string
  description: string
  object_id: string
  assignee_id: string
  status: TaskStatus
  author_id: string
  created_at: string
}

export interface TaskHistoryItem {
  id: number
  task_id: string
  from_status: TaskStatus | null
  to_status: TaskStatus
  changed_by: string
  comment: string | null
  created_at: string
}