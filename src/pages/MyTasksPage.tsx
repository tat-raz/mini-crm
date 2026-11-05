import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useProfile } from '../auth/AuthProvider'
import { errorMessage } from '../lib/errors'
import StatusBadge from '../components/StatusBadge'
import type { Task } from '../types'

type TaskRow = Task & { object: { name: string } | null }

export default function MyTasksPage() {
  const profile = useProfile()
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('tasks')
      .select('*, object:objects(name)')
      .eq('assignee_id', profile.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(errorMessage(error))
        else setTasks((data ?? []) as TaskRow[])
        setLoading(false)
      })
  }, [profile.id])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Мои задачи</h1>
      {error && <p className="text-red-600">{error}</p>}
      {loading ? (
        <p className="text-gray-500">Загрузка…</p>
      ) : tasks.length === 0 ? (
        <p className="text-gray-500">Задач нет</p>
      ) : (
        <ul className="bg-white rounded-xl border divide-y">
          {tasks.map((t) => (
            <li key={t.id}>
              <Link to={`/tasks/${t.id}`} className="flex items-center justify-between p-4 hover:bg-gray-50">
                <div>
                  <div className="font-medium">{t.title}</div>
                  <div className="text-sm text-gray-500">{t.object?.name}</div>
                </div>
                <StatusBadge status={t.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}