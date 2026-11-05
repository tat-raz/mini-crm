import { NavLink, Outlet } from 'react-router-dom'
import { useAuth, useProfile } from '../auth/AuthProvider'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-1.5 rounded-lg text-sm ${isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`

export default function Layout() {
  const { signOut } = useAuth()
  const profile = useProfile()

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-2">
          <span className="font-semibold mr-4">Мини-CRM</span>
          <NavLink to="/objects" className={linkClass}>Объекты</NavLink>
          {profile.role === 'executor' && (
            <NavLink to="/my-tasks" className={linkClass}>Мои задачи</NavLink>
          )}
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-gray-600">
              {profile.full_name} · {profile.role === 'manager' ? 'Постановщик' : 'Исполнитель'}
            </span>
            <button onClick={signOut} className="text-gray-500 hover:text-gray-900">Выйти</button>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}