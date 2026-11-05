// Проверка правил доступа напрямую через API Supabase, в обход интерфейса.
// Запуск: npm run security-check
import { createClient } from '@supabase/supabase-js'

const URL = process.env.VITE_SUPABASE_URL
const KEY = process.env.VITE_SUPABASE_ANON_KEY
const PASSWORD = process.env.TEST_PASSWORD

let passed = 0
let failed = 0
function check(name, ok, details) {
  if (ok) {
    passed++
    console.log(`✅ ${name}`)
  } else {
    failed++
    console.log(`❌ ${name}`, details ?? '')
  }
}

const newClient = () =>
  createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } })

async function login(email) {
  const client = newClient()
  const { data, error } = await client.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw new Error(`Не удалось войти как ${email}: ${error.message}`)
  return { client, userId: data.user.id }
}

const manager = await login('manager@minicrm.test')
const ex1 = await login('executor1@minicrm.test')
const ex2 = await login('executor2@minicrm.test')
const anon = newClient()

// Подготовка: чужая задача для исполнителя 1 и новая тестовая задача на него
const { data: allTasks } = await manager.client.from('tasks').select('id, assignee_id')
const ex2Task = allTasks.find((t) => t.assignee_id === ex2.userId)
const { data: objects } = await manager.client.from('objects').select('id').limit(1)
const { data: testTask, error: createErr } = await manager.client
  .from('tasks')
  .insert({ title: 'Security check', description: '', object_id: objects[0].id, assignee_id: ex1.userId })
  .select()
  .single()
if (createErr) throw createErr

const reread = async (taskId) =>
  (await manager.client.from('tasks').select('*').eq('id', taskId).maybeSingle()).data

console.log('\n— Чтение —')
{
  const { data } = await ex1.client.from('tasks').select('assignee_id')
  check('Исполнитель видит только свои задачи', data.length > 0 && data.every((t) => t.assignee_id === ex1.userId))
}
{
  const { data } = await ex1.client.from('tasks').select('id').eq('id', ex2Task.id).maybeSingle()
  check('Исполнитель не может прочитать чужую задачу по id', data === null)
}
{
  const { data } = await ex1.client.from('task_history').select('id').eq('task_id', ex2Task.id)
  check('Исполнитель не видит историю чужой задачи', data.length === 0)
}
{
  const { data } = await ex1.client.from('objects').select('id')
  const { data: own } = await ex1.client.from('tasks').select('object_id')
  const ownObjects = new Set(own.map((t) => t.object_id))
  check('Исполнитель видит только объекты со своими задачами', data.every((o) => ownObjects.has(o.id)))
}
{
  const { data, error } = await anon.from('tasks').select('id')
  check('Без входа задачи недоступны', !!error || data.length === 0)
}

console.log('\n— Изменение данных исполнителем —')
{
  const { error } = await ex1.client.from('tasks').update({ status: 'accepted' }).eq('id', testTask.id)
  const after = await reread(testTask.id)
  check('Исполнитель не может напрямую сменить статус', !!error && after.status === 'new')
}
{
  await ex1.client.from('tasks').update({ title: 'hacked' }).eq('id', testTask.id)
  check('Исполнитель не может редактировать свою задачу', (await reread(testTask.id)).title === 'Security check')
}
{
  await ex1.client.from('tasks').update({ assignee_id: ex1.userId }).eq('id', ex2Task.id)
  check('Исполнитель не может забрать чужую задачу', (await reread(ex2Task.id)).assignee_id === ex2.userId)
}
{
  await ex1.client.from('tasks').delete().eq('id', testTask.id)
  check('Исполнитель не может удалить задачу', (await reread(testTask.id)) !== null)
}
{
  const { error } = await ex1.client
    .from('tasks')
    .insert({ title: 'x', description: '', object_id: objects[0].id, assignee_id: ex1.userId })
  check('Исполнитель не может создать задачу', !!error)
}
{
  const { error } = await ex1.client.from('profiles').update({ role: 'manager' }).eq('id', ex1.userId)
  check('Исполнитель не может сделать себя постановщиком', !!error)
}

console.log('\n— История —')
{
  const { error } = await ex1.client
    .from('task_history')
    .insert({ task_id: testTask.id, from_status: 'review', to_status: 'accepted', changed_by: manager.userId })
  check('Нельзя добавить запись в историю напрямую', !!error)
}
{
  const { error } = await manager.client.from('task_history').update({ comment: 'fake' }).eq('task_id', testTask.id)
  check('Нельзя изменить историю (даже постановщику)', !!error)
}
{
  const { error } = await manager.client.from('task_history').delete().eq('task_id', testTask.id)
  check('Нельзя удалить историю (даже постановщику)', !!error)
}

console.log('\n— Переходы статусов через функцию —')
const rpc = (who, status, comment = null) =>
  who.client.rpc('change_task_status', { p_task_id: testTask.id, p_new_status: status, p_comment: comment })
{
  const { error } = await ex1.client.rpc('change_task_status', {
    p_task_id: ex2Task.id, p_new_status: 'in_progress', p_comment: null,
  })
  check('Исполнитель не может сменить статус чужой задачи', !!error)
}
check('Запрещён переход Новая → Принята', !!(await rpc(ex1, 'accepted')).error)
check('Запрещён переход Новая → На проверке (минуя «В работе»)', !!(await rpc(ex1, 'review')).error)
check('Другой исполнитель не может взять задачу в работу', !!(await rpc(ex2, 'in_progress')).error)
check('Постановщик не может взять задачу в работу за исполнителя', !!(await rpc(manager, 'in_progress')).error)
check('Исполнитель берёт свою задачу в работу', !(await rpc(ex1, 'in_progress')).error)
check('Исполнитель отправляет на проверку', !(await rpc(ex1, 'review')).error)
check('Исполнитель не может принять свою задачу', !!(await rpc(ex1, 'accepted')).error)
check('Возврат на доработку без комментария запрещён', !!(await rpc(manager, 'rework')).error)
check('Возврат на доработку с пустым комментарием запрещён', !!(await rpc(manager, 'rework', '   ')).error)
check('Постановщик принимает задачу', !(await rpc(manager, 'accepted')).error)
check('Из «Принята» никуда нельзя перейти', !!(await rpc(ex1, 'in_progress')).error)
{
  const { data } = await manager.client.from('task_history').select('from_status, to_status').eq('task_id', testTask.id).order('id')
  const path = data.map((h) => h.to_status).join(' → ')
  check('История записала весь путь', path === 'new → in_progress → review → accepted', path)
}

console.log('\n— Подделка при создании (постановщик) —')
{
  const { error } = await manager.client
    .from('tasks')
    .insert({ title: 'x', description: '', object_id: objects[0].id, assignee_id: ex1.userId, status: 'accepted' })
  check('Нельзя создать задачу сразу в статусе «Принята»', !!error)
}
{
  const { error } = await manager.client
    .from('tasks')
    .insert({ title: 'x', description: '', object_id: objects[0].id, assignee_id: ex1.userId, author_id: ex1.userId })
  check('Нельзя подставить другого автора', !!error)
}
{
  const { error } = await manager.client
    .from('tasks')
    .insert({ title: 'x', description: '', object_id: objects[0].id, assignee_id: manager.userId })
  check('Исполнителем можно назначить только исполнителя', !!error)
}

console.log('\n— Регистрация —')
{
  const { error } = await anon.auth.signUp({ email: `hacker${Date.now()}@minicrm.test`, password: 'Hacker1234!' })
  check('Открытая регистрация отключена', !!error)
}

// Уборка
await manager.client.from('tasks').delete().eq('id', testTask.id)

console.log(`\nИтого: ${passed} пройдено, ${failed} не пройдено`)
process.exit(failed ? 1 : 0)