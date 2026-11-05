import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthProvider'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import ObjectsPage from './pages/ObjectsPage'
import ObjectPage from './pages/ObjectPage'
import TaskPage from './pages/TaskPage'
import MyTasksPage from './pages/MyTasksPage'

function RequireAuth() {
  const { session, profile, loading } = useAuth()
  if (loading) return <div className="p-8 text-gray-500">Загрузка…</div>
  if (!session) return <Navigate to="/login" replace />
  if (!profile) return <div className="p-8 text-red-600">Профиль не найден</div>
  return <Outlet />
}

function HomeRedirect() {
  const { profile } = useAuth()
  return <Navigate to={profile?.role === 'executor' ? '/my-tasks' : '/objects'} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route index element={<HomeRedirect />} />
          <Route path="objects" element={<ObjectsPage />} />
          <Route path="objects/:id" element={<ObjectPage />} />
          <Route path="tasks/:id" element={<TaskPage />} />
          <Route path="my-tasks" element={<MyTasksPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}