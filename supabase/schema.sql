-- Run this in Supabase SQL Editor before enabling cloud sync.
create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  name text not null,
  designation text,
  work_email text unique,
  role text not null default 'employee',
  permissions text[] not null default '{}',
  status text not null default 'Active',
  incentive numeric(12,2) not null default 0,
  photo_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.clients (
  id text primary key,
  name text not null,
  entity text,
  pan text,
  gstin text,
  phone text,
  status text not null default 'Pending KYC',
  assigned_employee_id uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.compliance_tasks (
  id text primary key,
  client_id text not null references public.clients(id) on delete cascade,
  task_name text not null,
  assigned_employee_id uuid references public.employees(id) on delete set null,
  stage text not null default 'todo',
  due_date date,
  remarks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.client_documents (
  id uuid primary key default gen_random_uuid(),
  client_id text not null references public.clients(id) on delete cascade,
  task_id text references public.compliance_tasks(id) on delete set null,
  file_name text not null,
  storage_provider text not null default 'cloudinary',
  storage_path text not null,
  stage text not null default 'received',
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.employees enable row level security;
alter table public.clients enable row level security;
alter table public.compliance_tasks enable row level security;
alter table public.client_documents enable row level security;

-- Start restrictive. Add manager/admin policies only after Auth is connected.
revoke all on public.employees, public.clients, public.compliance_tasks, public.client_documents from anon;
grant select on public.employees, public.clients, public.compliance_tasks, public.client_documents to authenticated;
