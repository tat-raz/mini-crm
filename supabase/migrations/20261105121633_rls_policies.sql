-- ============ Вспомогательная функция: текущий пользователь — постановщик? ============
-- security definer: читает profiles в обход RLS, иначе политики зациклились бы друг на друге
create function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'manager'
  );
$$;

revoke all on function public.is_manager() from public, anon;
grant execute on function public.is_manager() to authenticated;

-- ============ Профили ============
create policy "profiles: authenticated can read"
  on public.profiles for select
  to authenticated
  using (true);

-- ============ Объекты ============
create policy "objects: manager sees all, executor sees objects with own tasks"
  on public.objects for select
  to authenticated
  using (
    public.is_manager()
    or exists (
      select 1 from public.tasks t
      where t.object_id = objects.id
        and t.assignee_id = (select auth.uid())
    )
  );

create policy "objects: manager can insert"
  on public.objects for insert
  to authenticated
  with check (public.is_manager());

create policy "objects: manager can update"
  on public.objects for update
  to authenticated
  using (public.is_manager())
  with check (public.is_manager());

create policy "objects: manager can delete"
  on public.objects for delete
  to authenticated
  using (public.is_manager());

-- ============ Задачи ============
create policy "tasks: manager sees all, executor sees own"
  on public.tasks for select
  to authenticated
  using (
    public.is_manager()
    or assignee_id = (select auth.uid())
  );

create policy "tasks: manager can insert, assignee must be executor"
  on public.tasks for insert
  to authenticated
  with check (
    public.is_manager()
    and exists (
      select 1 from public.profiles p
      where p.id = assignee_id and p.role = 'executor'
    )
  );

create policy "tasks: manager can update, assignee must be executor"
  on public.tasks for update
  to authenticated
  using (public.is_manager())
  with check (
    public.is_manager()
    and exists (
      select 1 from public.profiles p
      where p.id = assignee_id and p.role = 'executor'
    )
  );

create policy "tasks: manager can delete"
  on public.tasks for delete
  to authenticated
  using (public.is_manager());

-- ============ История ============
-- Только чтение. Подзапрос к tasks сам проходит через RLS задач:
-- исполнитель найдёт там только свои задачи, постановщик — все
create policy "task_history: visible if task is visible"
  on public.task_history for select
  to authenticated
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_history.task_id
    )
  );