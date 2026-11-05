import { useEffect, useState, type SubmitEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useProfile } from '../auth/AuthProvider'
import { errorMessage } from '../lib/errors'
import type { ObjectItem } from '../types'

type ObjectRow = ObjectItem & { tasks: { count: number }[] }

export default function ObjectsPage() {
  const profile = useProfile()
  const isManager = profile.role === 'manager'
  const [objects, setObjects] = useState<ObjectRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')

  useEffect(() => {
    // tasks(count) — количество задач, тоже с учётом RLS: исполнитель видит число своих
    supabase
      .from('objects')
      .select('*, tasks(count)')
      .order('created_at')
      .then(({ data, error }) => {
        if (error) setError(errorMessage(error))
        else setObjects((data ?? []) as ObjectRow[])
        setLoading(false)
      })
  }, [reloadKey])

  const handleCreate = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const { error } = await supabase.from('objects').insert({ name: name.trim(), address: address.trim() })
    if (error) return setError(errorMessage(error))
    setName('')
    setAddress('')
    setReloadKey((k) => k + 1)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Объекты</h1>

      {isManager && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl border p-4 flex flex-wrap gap-2">
          <input required placeholder="Название" value={name} onChange={(e) => setName(e.target.value)}
            className="flex-1 min-w-48 border rounded-lg px-3 py-2" />
          <input placeholder="Адрес" value={address} onChange={(e) => setAddress(e.target.value)}
            className="flex-1 min-w-48 border rounded-lg px-3 py-2" />
          <button className="bg-blue-600 text-white rounded-lg px-4 py-2">Добавить объект</button>
        </form>
      )}

      {error && <p className="text-red-600">{error}</p>}
      {loading ? (
        <p className="text-gray-500">Загрузка…</p>
      ) : objects.length === 0 ? (
        <p className="text-gray-500">Объектов нет</p>
      ) : (
        <ul className="bg-white rounded-xl border divide-y">
          {objects.map((o) => (
            <li key={o.id}>
              <Link to={`/objects/${o.id}`} className="flex items-center justify-between p-4 hover:bg-gray-50">
                <div>
                  <div className="font-medium">{o.name}</div>
                  <div className="text-sm text-gray-500">{o.address}</div>
                </div>
                <span className="text-sm text-gray-500">Задач: {o.tasks[0]?.count ?? 0}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}