import { useEffect, useState, type SubmitEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useProfile } from '../auth/AuthProvider'
import { errorMessage } from '../lib/errors'
import { getAvailableActions, STATUS_LABELS, type StatusAction } from '../lib/status'
import StatusBadge from '../components/StatusBadge'
import type { ObjectItem, Profile, Task, TaskHistoryItem } from '../types'

type TaskFull = Task & {
  object: Pick<ObjectItem, 'id' | 'name'> | null
  assignee: { full_name: string } | null
  author: { full_name: string } | null
}
type HistoryRow = TaskHistoryItem & { user: { full_name: string } | null }

const formatDate = (iso: string) => new Date(iso).toLocaleString('ru-RU')

export default function TaskPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const profile = useProfile()
  const isManager = profile.role === 'manager'

  const [task, setTask] = useState<TaskFull | null>(null)
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [executors, setExecutors] = useState<Pick<Profile, 'id' | 'full_name'>[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  // смена статуса
  const [pendingAction, setPendingAction] = useState<StatusAction | null>(null)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)

  // редактирование
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editAssignee, setEditAssignee] = useState('')

  useEffect(() => {
    if (!id) return
    Promise.all([
      supabase
        .from('tasks')
        .select(`
          *,
          object:objects(id, name),
          assignee:profiles!tasks_assignee_id_fkey(full_name),
          author:profiles!tasks_author_id_fkey(full_name)
        `)
        .eq('id', id)
        .maybeSingle(),
      supabase
        .from('task_history')
        .select('*, user:profiles(full_name)')
        .eq('task_id', id)
        .order('id'),
      isManager
        ? supabase.from('profiles').select('id, full_name').eq('role', 'executor').order('full_name')
        : Promise.resolve({ data: [], error: null }),
    ]).then(([taskRes, histRes, execRes]) => {
      const err = taskRes.error ?? histRes.error ?? execRes.error
      if (err) setError(errorMessage(err))
      setTask(taskRes.data as TaskFull | null)
      setHistory((histRes.data ?? []) as HistoryRow[])
      setExecutors((execRes.data ?? []) as Pick<Profile, 'id' | 'full_name'>[])
      setLoading(false)
    })
  }, [id, isManager, reloadKey])

  if (loading) return <p className="text-gray-500">Загрузка…</p>
  if (!task) return <p className="text-gray-500">Задача не найдена или нет доступа</p>

  const actions = getAvailableActions(task, profile)

  const runAction = async (action: StatusAction, actionComment?: string) => {
    setError(null)
    setBusy(true)
    const { error } = await supabase.rpc('change_task_status', {
      p_task_id: task.id,
      p_new_status: action.to,
      p_comment: actionComment ?? null,
    })
    setBusy(false)
    if (error) return setError(errorMessage(error))
    setPendingAction(null)
    setComment('')
    setReloadKey((k) => k + 1)
  }

  const handleActionClick = (action: StatusAction) => {
    if (action.needsComment) {
      setPendingAction(action)
    } else {
      runAction(action)
    }
  }

  const handleCommentSubmit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!pendingAction) return
    if (!comment.trim()) return setError('Укажите комментарий')
    runAction(pendingAction, comment.trim())
  }

  const startEdit = () => {
    setEditTitle(task.title)
    setEditDescription(task.description)
    setEditAssignee(task.assignee_id)
    setEditing(true)
  }

  const handleSave = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const { error } = await supabase
      .from('tasks')
      .update({ title: editTitle.trim(), description: editDescription.trim(), assignee_id: editAssignee })
      .eq('id', task.id)
    if (error) return setError(errorMessage(error))
    setEditing(false)
    setReloadKey((k) => k + 1)
  }

  const handleDelete = async () => {
    if (!confirm(`Удалить задачу «${task.title}»?`)) return
    const { error } = await supabase.from('tasks').delete().eq('id', task.id)
    if (error) return setError(errorMessage(error))
    navigate(task.object ? `/objects/${task.object.id}` : '/objects')
  }

  return (
    <div className="space-y-6">
      {task.object && (
        <Link to={`/objects/${task.object.id}`} className="text-sm text-blue-600">
          ← {task.object.name}
        </Link>
      )}

      {/* Данные задачи */}
      {editing ? (
        <form onSubmit={handleSave} className="bg-white rounded-xl border p-4 space-y-2">
          <input required value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
            className="w-full border rounded-lg px-3 py-2" />
          <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)}
            className="w-full border rounded-lg px-3 py-2" rows={3} />
          <select required value={editAssignee} onChange={(e) => setEditAssignee(e.target.value)}
            className="w-full border rounded-lg px-3 py-2">
            {executors.map((ex) => (
              <option key={ex.id} value={ex.id}>{ex.full_name}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button className="bg-blue-600 text-white rounded-lg px-4 py-2">Сохранить</button>
            <button type="button" onClick={() => setEditing(false)} className="px-4 py-2">Отмена</button>
          </div>
        </form>
      ) : (
        <div className="bg-white rounded-xl border p-4 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-2xl font-semibold">{task.title}</h1>
            <StatusBadge status={task.status} />
          </div>
          {task.description && <p className="whitespace-pre-wrap text-gray-700">{task.description}</p>}
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-gray-500">Объект</dt><dd>{task.object?.name ?? '—'}</dd>
            <dt className="text-gray-500">Исполнитель</dt><dd>{task.assignee?.full_name ?? '—'}</dd>
            <dt className="text-gray-500">Автор</dt><dd>{task.author?.full_name ?? '—'}</dd>
            <dt className="text-gray-500">Создана</dt><dd>{formatDate(task.created_at)}</dd>
          </dl>
          {isManager && (
            <div className="flex gap-2 text-sm pt-2">
              <button onClick={startEdit} className="border rounded-lg px-3 py-1.5">Изменить</button>
              <button onClick={handleDelete} className="border border-red-300 text-red-600 rounded-lg px-3 py-1.5">Удалить</button>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-red-600">{error}</p>}

      {/* Действия по статусу: показываем только доступные */}
      {actions.length > 0 && !pendingAction && (
        <div className="flex flex-wrap gap-2">
          {actions.map((a) => (
            <button
              key={a.to}
              disabled={busy}
              onClick={() => handleActionClick(a)}
              className={`rounded-lg px-4 py-2 text-white disabled:opacity-50 ${
                a.to === 'rework' ? 'bg-red-600' : 'bg-blue-600'
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}

      {pendingAction && (
        <form onSubmit={handleCommentSubmit} className="bg-white rounded-xl border p-4 space-y-2">
          <label className="block text-sm font-medium">Что нужно исправить?</label>
          <textarea required value={comment} onChange={(e) => setComment(e.target.value)}
            className="w-full border rounded-lg px-3 py-2" rows={3} autoFocus />
          <div className="flex gap-2">
            <button disabled={busy} className="bg-red-600 text-white rounded-lg px-4 py-2 disabled:opacity-50">
              {pendingAction.label}
            </button>
            <button type="button" onClick={() => { setPendingAction(null); setComment('') }} className="px-4 py-2">
              Отмена
            </button>
          </div>
        </form>
      )}

      {/* История */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">История</h2>
        <ol className="bg-white rounded-xl border divide-y">
          {history.map((h) => (
            <li key={h.id} className="p-4 text-sm space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-gray-500">{formatDate(h.created_at)}</span>
                <span className="font-medium">{h.user?.full_name ?? '—'}</span>
                <span className="text-gray-700">
                  {h.from_status ? `${STATUS_LABELS[h.from_status]} → ` : 'Создана: '}
                  {STATUS_LABELS[h.to_status]}
                </span>
              </div>
              {h.comment && <p className="text-gray-700 bg-gray-50 rounded px-2 py-1">💬 {h.comment}</p>}
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}