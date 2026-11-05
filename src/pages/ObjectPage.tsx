import { useEffect, useState, type SubmitEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useProfile } from '../auth/AuthProvider'
import { errorMessage } from '../lib/errors'
import StatusBadge from '../components/StatusBadge'
import type { ObjectItem, Profile, Task } from '../types'

type TaskRow = Task & { assignee: { full_name: string } | null }

export default function ObjectPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const profile = useProfile()
  const isManager = profile.role === 'manager'

  const [object, setObject] = useState<ObjectItem | null>(null)
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [executors, setExecutors] = useState<Pick<Profile, 'id' | 'full_name'>[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editAddress, setEditAddress] = useState('')

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assigneeId, setAssigneeId] = useState('')

  useEffect(() => {
    if (!id) return
    Promise.all([
      supabase.from('objects').select('*').eq('id', id).maybeSingle(),
      // у задачи две ссылки на profiles (исполнитель и автор), поэтому указываем, по какой связи
      supabase
        .from('tasks')
        .select('*, assignee:profiles!tasks_assignee_id_fkey(full_name)')
        .eq('object_id', id)
        .order('created_at'),
      isManager
        ? supabase.from('profiles').select('id, full_name').eq('role', 'executor').order('full_name')
        : Promise.resolve({ data: [], error: null }),
    ]).then(([objRes, tasksRes, execRes]) => {
      const err = objRes.error ?? tasksRes.error ?? execRes.error
      if (err) setError(errorMessage(err))
      setObject(objRes.data as ObjectItem | null)
      setTasks((tasksRes.data ?? []) as TaskRow[])
      setExecutors((execRes.data ?? []) as Pick<Profile, 'id' | 'full_name'>[])
      setLoading(false)
    })
  }, [id, isManager, reloadKey])

  if (loading) return <p className="text-gray-500">Загрузка…</p>
  if (!object) return <p className="text-gray-500">Объект не найден или нет доступа</p>

  const startEdit = () => {
    setEditName(object.name)
    setEditAddress(object.address)
    setEditing(true)
  }

  const handleSave = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const { error } = await supabase
      .from('objects')
      .update({ name: editName.trim(), address: editAddress.trim() })
      .eq('id', object.id)
    if (error) return setError(errorMessage(error))
    setEditing(false)
    setReloadKey((k) => k + 1)
  }

  const handleDelete = async () => {
    if (!confirm(`Удалить объект «${object.name}»?`)) return
    const { error } = await supabase.from('objects').delete().eq('id', object.id)
    if (error) return setError(errorMessage(error))
    navigate('/objects')
  }

  const handleCreateTask = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    // статус, автора и дату не передаём: база ставит их сама
    const { error } = await supabase.from('tasks').insert({
      title: title.trim(),
      description: description.trim(),
      object_id: object.id,
      assignee_id: assigneeId,
    })
    if (error) return setError(errorMessage(error))
    setTitle('')
    setDescription('')
    setAssigneeId('')
    setReloadKey((k) => k + 1)
  }

  return (
    <div className="space-y-6">
      <Link to="/objects" className="text-sm text-blue-600">← Все объекты</Link>

      {editing ? (
        <form onSubmit={handleSave} className="bg-white rounded-xl border p-4 space-y-2">
          <input required value={editName} onChange={(e) => setEditName(e.target.value)}
            className="w-full border rounded-lg px-3 py-2" />
          <input value={editAddress} onChange={(e) => setEditAddress(e.target.value)}
            className="w-full border rounded-lg px-3 py-2" />
          <div className="flex gap-2">
            <button className="bg-blue-600 text-white rounded-lg px-4 py-2">Сохранить</button>
            <button type="button" onClick={() => setEditing(false)} className="px-4 py-2">Отмена</button>
          </div>
        </form>
      ) : (
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{object.name}</h1>
            <p className="text-gray-500">{object.address}</p>
          </div>
          {isManager && (
            <div className="flex gap-2 text-sm">
              <button onClick={startEdit} className="border rounded-lg px-3 py-1.5">Изменить</button>
              <button onClick={handleDelete} className="border border-red-300 text-red-600 rounded-lg px-3 py-1.5">Удалить</button>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-red-600">{error}</p>}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Задачи</h2>
        {tasks.length === 0 ? (
          <p className="text-gray-500">Задач нет</p>
        ) : (
          <ul className="bg-white rounded-xl border divide-y">
            {tasks.map((t) => (
              <li key={t.id}>
                <Link to={`/tasks/${t.id}`} className="flex items-center justify-between p-4 hover:bg-gray-50">
                  <div>
                    <div className="font-medium">{t.title}</div>
                    <div className="text-sm text-gray-500">{t.assignee?.full_name ?? '—'}</div>
                  </div>
                  <StatusBadge status={t.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isManager && (
        <form onSubmit={handleCreateTask} className="bg-white rounded-xl border p-4 space-y-2">
          <h2 className="font-semibold">Новая задача</h2>
          <input required placeholder="Название" value={title} onChange={(e) => setTitle(e.target.value)}
            className="w-full border rounded-lg px-3 py-2" />
          <textarea placeholder="Описание" value={description} onChange={(e) => setDescription(e.target.value)}
            className="w-full border rounded-lg px-3 py-2" rows={3} />
          <select required value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}
            className="w-full border rounded-lg px-3 py-2">
            <option value="">Выберите исполнителя</option>
            {executors.map((ex) => (
              <option key={ex.id} value={ex.id}>{ex.full_name}</option>
            ))}
          </select>
          <button className="bg-blue-600 text-white rounded-lg px-4 py-2">Создать задачу</button>
        </form>
      )}
    </div>
  )
}