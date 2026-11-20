update public.emergency_contacts
set
  department_name = 'MDRRMC',
  service_type = 'Disaster/Rescue',
  contact_number = '0912 214 9765, 0966 723 0478, 0963 974 2460',
  availability = 'Hours not listed',
  sort_order = 3,
  is_active = true
where department_name in ('MDRRMO Tago / Rescue', 'MDRRMC Tago / Rescue', 'MDRRMC');

insert into public.emergency_contacts(
  department_name, service_type, contact_number, address, availability, sort_order, is_active
)
select
  'MDRRMC', 'Disaster/Rescue',
  '0912 214 9765, 0966 723 0478, 0963 974 2460',
  'Tago, Surigao del Sur', 'Hours not listed', 3, true
where not exists (
  select 1 from public.emergency_contacts
  where department_name = 'MDRRMC'
);

update public.emergency_contacts
set
  department_name = 'TAGO POLICE STATION',
  contact_number = '0998 598 7376',
  availability = 'Hours not listed',
  sort_order = 4,
  is_active = true
where department_name in ('Tago Municipal Police Station', 'TAGO POLICE STATION');

insert into public.emergency_contacts(
  department_name, service_type, contact_number, address, availability, sort_order, is_active
)
select
  'TAGO POLICE STATION', 'Police', '0998 598 7376',
  'Tago, Surigao del Sur', 'Hours not listed', 4, true
where not exists (
  select 1 from public.emergency_contacts
  where department_name = 'TAGO POLICE STATION'
);

update public.emergency_contacts
set
  department_name = 'BUREAU OF FIRE PROTECTION',
  contact_number = '0970 543 0047, 214-6295',
  availability = 'Hours not listed',
  sort_order = 5,
  is_active = true
where department_name in ('Tago Bureau of Fire Protection', 'BUREAU OF FIRE PROTECTION');

insert into public.emergency_contacts(
  department_name, service_type, contact_number, address, availability, sort_order, is_active
)
select
  'BUREAU OF FIRE PROTECTION', 'Fire', '0970 543 0047, 214-6295',
  'Tago, Surigao del Sur', 'Hours not listed', 5, true
where not exists (
  select 1 from public.emergency_contacts
  where department_name = 'BUREAU OF FIRE PROTECTION'
);

update public.emergency_contacts
set
  department_name = 'MUNICIPAL HEALTH OFFICE',
  service_type = 'Health/Hospital',
  contact_number = '0946 107 0378',
  availability = 'Hours not listed',
  sort_order = 6,
  is_active = true
where department_name in ('Tago Rural Health Unit', 'Tago Municipal Health Office', 'MUNICIPAL HEALTH OFFICE');

insert into public.emergency_contacts(
  department_name, service_type, contact_number, address, availability, sort_order, is_active
)
select
  'MUNICIPAL HEALTH OFFICE', 'Health/Hospital', '0946 107 0378',
  'Tago, Surigao del Sur', 'Hours not listed', 6, true
where not exists (
  select 1 from public.emergency_contacts
  where department_name = 'MUNICIPAL HEALTH OFFICE'
);

update public.emergency_contacts
set
  department_name = 'LGU TAGO',
  contact_number = '086-214-2116',
  availability = 'Office hours not listed',
  sort_order = 7,
  is_active = true
where department_name in ('Tago Municipal Hall', 'LGU TAGO');

insert into public.emergency_contacts(
  department_name, service_type, contact_number, address, availability, sort_order, is_active
)
select
  'LGU TAGO', 'Government', '086-214-2116',
  'Tago, Surigao del Sur', 'Office hours not listed', 7, true
where not exists (
  select 1 from public.emergency_contacts
  where department_name = 'LGU TAGO'
);

update public.emergency_contacts
set
  department_name = 'COAST GUARD STATION',
  service_type = 'Maritime',
  contact_number = '0906 3811224',
  availability = 'Hours not listed',
  sort_order = 8,
  is_active = true
where department_name in ('Philippine Coast Guard Auxiliary', 'COAST GUARD STATION');

insert into public.emergency_contacts(
  department_name, service_type, contact_number, address, availability, sort_order, is_active
)
select
  'COAST GUARD STATION', 'Maritime', '0906 3811224',
  'Tago, Surigao del Sur', 'Hours not listed', 8, true
where not exists (
  select 1 from public.emergency_contacts
  where department_name = 'COAST GUARD STATION'
);

update public.emergency_contacts
set
  department_name = 'PHILIPPINE RED CROSS',
  service_type = 'Health/Hospital',
  contact_number = '0964 133 9751, 09951205195',
  availability = 'Hours not listed',
  sort_order = 9,
  is_active = true
where department_name in ('Philippine Red Cross', 'PHILIPPINE RED CROSS');

insert into public.emergency_contacts(
  department_name, service_type, contact_number, address, availability, sort_order, is_active
)
select
  'PHILIPPINE RED CROSS', 'Health/Hospital', '0964 133 9751, 09951205195',
  'Tago, Surigao del Sur', 'Hours not listed', 9, true
where not exists (
  select 1 from public.emergency_contacts
  where department_name = 'PHILIPPINE RED CROSS'
);
