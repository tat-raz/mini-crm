-- ============ История при создании задачи ============
create function public.log_task_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.task_history (task_id, from_status, to_status, changed_by)
  values (new.id, null, new.status, new.author_id);
  return new;
end;
$$;

create trigger tasks_log_created
  after insert on public.tasks
  for each row execute function public.log_task_created();

-- ============ Смена статуса ============
create function public.change_task_status(
  p_task_id uuid,
  p_new_status public.task_status,
  p_comment text default null
)
returns public.tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_is_manager boolean := public.is_manager();
  v_comment text := nullif(trim(p_comment), '');
  v_task public.tasks;
  v_old_status public.task_status;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  -- блокируем строку, чтобы два одновременных запроса не сменили статус дважды
  select * into v_task from public.tasks where id = p_task_id for update;

  -- чужую задачу исполнитель «не видит»
  if not found or (not v_is_manager and v_task.assignee_id <> v_uid) then
    raise exception 'Task not found' using errcode = 'P0002';
  end if;

  v_old_status := v_task.status;

  -- разрешённые переходы из ТЗ, всё остальное запрещено
  if not (
       (v_old_status = 'new'         and p_new_status = 'in_progress' and v_task.assignee_id = v_uid)
    or (v_old_status = 'in_progress' and p_new_status = 'review'      and v_task.assignee_id = v_uid)
    or (v_old_status = 'rework'      and p_new_status = 'in_progress' and v_task.assignee_id = v_uid)
    or (v_old_status = 'review'      and p_new_status = 'accepted'    and v_is_manager)
    or (v_old_status = 'review'      and p_new_status = 'rework'      and v_is_manager)
  ) then
    raise exception 'Transition % -> % is not allowed', v_old_status, p_new_status
      using errcode = '42501';
  end if;

  if p_new_status = 'rework' and v_comment is null then
    raise exception 'Comment is required for rework' using errcode = '22023';
  end if;

  update public.tasks
     set status = p_new_status
   where id = p_task_id
  returning * into v_task;

  insert into public.task_history (task_id, from_status, to_status, changed_by, comment)
  values (p_task_id, v_old_status, p_new_status, v_uid, v_comment);

  return v_task;
end;
$$;

revoke all on function public.change_task_status(uuid, public.task_status, text) from public, anon;
grant execute on function public.change_task_status(uuid, public.task_status, text) to authenticated;