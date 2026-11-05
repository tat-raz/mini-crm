-- ============ 1. Типы ============
-- Роли пользователей и статусы задач: база не даст записать другое значение
create type public.user_role as enum ('manager', 'executor');
create type public.task_status as enum ('new', 'in_progress', 'review', 'accepted', 'rework');

-- ============ 2. Профили ============
-- Supabase хранит логины в auth.users, а роль и имя храним здесь
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.user_role not null default 'executor',
  created_at timestamptz not null default now()
);

-- ============ 3. Объекты (стройки) ============
create table public.objects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  address text not null default '',
  created_at timestamptz not null default now()
);

-- ============ 4. Задачи ============
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  description text not null default '',
  object_id uuid not null references public.objects(id) on delete restrict,
  assignee_id uuid not null references public.profiles(id),
  status public.task_status not null default 'new',
  author_id uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now()
);

create index tasks_object_id_idx on public.tasks(object_id);
create index tasks_assignee_id_idx on public.tasks(assignee_id);

-- ============ 5. История статусов ============
create table public.task_history (
  id bigint generated always as identity primary key,
  task_id uuid not null references public.tasks(id) on delete cascade,
  from_status public.task_status,          -- пусто при создании задачи
  to_status public.task_status not null,
  changed_by uuid not null references public.profiles(id),
  comment text,
  created_at timestamptz not null default now()
);

create index task_history_task_id_idx on public.task_history(task_id);

-- ============ 6. Включаем RLS ============
-- Пока нет политик (шаг 3), никто ничего не видит: по умолчанию всё закрыто
alter table public.profiles enable row level security;
alter table public.objects enable row level security;
alter table public.tasks enable row level security;
alter table public.task_history enable row level security;

-- ============ 7. Доступ через API ============
-- Гостям без входа не даём ничего
revoke all on public.profiles, public.objects, public.tasks, public.task_history from anon;

-- Вошедшим пользователям даём только нужное
grant usage on schema public to authenticated;

-- Профили только читать: сменить себе роль через API нельзя
grant select on public.profiles to authenticated;

grant select, delete on public.objects to authenticated;
grant insert (name, address), update (name, address) on public.objects to authenticated;

-- В задачах нельзя напрямую писать статус, автора и дату создания
grant select, delete on public.tasks to authenticated;
grant insert (title, description, object_id, assignee_id) on public.tasks to authenticated;
grant update (title, description, object_id, assignee_id) on public.tasks to authenticated;

-- Историю только читать: писать в неё будет только функция из шага 4
grant select on public.task_history to authenticated;

-- ============ 8. Профиль для нового пользователя ============
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();