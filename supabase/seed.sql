-- ============ Роли и имена ============
update public.profiles set role = 'manager', full_name = 'Иван Петров'
 where id = (select id from auth.users where email = 'manager@minicrm.test');

update public.profiles set full_name = 'Алексей Смирнов'
 where id = (select id from auth.users where email = 'executor1@minicrm.test');

update public.profiles set full_name = 'Мария Козлова'
 where id = (select id from auth.users where email = 'executor2@minicrm.test');

-- ============ Объекты и задачи ============
do $$
declare
  m  uuid := (select id from auth.users where email = 'manager@minicrm.test');
  e1 uuid := (select id from auth.users where email = 'executor1@minicrm.test');
  e2 uuid := (select id from auth.users where email = 'executor2@minicrm.test');
  o1 uuid; o2 uuid; o3 uuid;
  t  uuid;
begin
  insert into public.objects (name, address) values ('ЖК «Северный»', 'ул. Северная, 12') returning id into o1;
  insert into public.objects (name, address) values ('Школа №5, пристройка', 'пр. Мира, 40') returning id into o2;
  insert into public.objects (name, address) values ('Склад «Логистик»', 'Промышленная ул., 3') returning id into o3;

  -- Новая (исполнитель 1)
  insert into public.tasks (title, description, object_id, assignee_id, author_id)
  values ('Залить фундамент секции Б', 'Бетон М300, проверить опалубку', o1, e1, m);

  -- В работе (исполнитель 1)
  insert into public.tasks (title, description, object_id, assignee_id, author_id)
  values ('Монтаж окон 1 этаж', '12 оконных блоков', o2, e1, m) returning id into t;
  update public.tasks set status = 'in_progress' where id = t;
  insert into public.task_history (task_id, from_status, to_status, changed_by) values (t, 'new', 'in_progress', e1);

  -- На проверке (исполнитель 1)
  insert into public.tasks (title, description, object_id, assignee_id, author_id)
  values ('Демонтаж старой кровли', 'Вывезти мусор', o1, e1, m) returning id into t;
  update public.tasks set status = 'review' where id = t;
  insert into public.task_history (task_id, from_status, to_status, changed_by) values
    (t, 'new', 'in_progress', e1),
    (t, 'in_progress', 'review', e1);

  -- На доработке (исполнитель 2)
  insert into public.tasks (title, description, object_id, assignee_id, author_id)
  values ('Электропроводка 2 этаж', 'По проекту ЭМ-2', o1, e2, m) returning id into t;
  update public.tasks set status = 'rework' where id = t;
  insert into public.task_history (task_id, from_status, to_status, changed_by, comment) values
    (t, 'new', 'in_progress', e2, null),
    (t, 'in_progress', 'review', e2, null),
    (t, 'review', 'rework', m, 'Не промаркированы кабели в щитке');

  -- Принята (исполнитель 2)
  insert into public.tasks (title, description, object_id, assignee_id, author_id)
  values ('Устройство стяжки пола', 'Толщина 50 мм', o3, e2, m) returning id into t;
  update public.tasks set status = 'accepted' where id = t;
  insert into public.task_history (task_id, from_status, to_status, changed_by) values
    (t, 'new', 'in_progress', e2),
    (t, 'in_progress', 'review', e2),
    (t, 'review', 'accepted', m);

  -- Новая (исполнитель 2)
  insert into public.tasks (title, description, object_id, assignee_id, author_id)
  values ('Покраска ворот', 'RAL 7024', o3, e2, m);
end $$;