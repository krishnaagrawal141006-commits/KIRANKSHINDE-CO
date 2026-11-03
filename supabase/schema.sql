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

create table if not exists public.compliance_deadlines (
  id text primary key,
  category text not null,
  category_label text not null,
  category_class text not null default 'cat-it',
  title text not null,
  description text not null default '',
  frequency text not null default 'annual',
  due_day integer,
  due_date date,
  due_date_label text,
  action_text text not null default 'View compliance',
  source_url text,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.employees enable row level security;
alter table public.clients enable row level security;
alter table public.compliance_tasks enable row level security;
alter table public.client_documents enable row level security;
alter table public.compliance_deadlines enable row level security;

-- Start restrictive. Add manager/admin policies only after Auth is connected.
revoke all on public.employees, public.clients, public.compliance_tasks, public.client_documents from anon;
grant select on public.employees, public.clients, public.compliance_tasks, public.client_documents to authenticated;
grant select on public.compliance_deadlines to anon, authenticated;
grant all on table public.compliance_deadlines to service_role;
drop policy if exists "Public can view active compliance deadlines" on public.compliance_deadlines;
create policy "Public can view active compliance deadlines" on public.compliance_deadlines for select using (is_active = true);

insert into public.compliance_deadlines
  (id, category, category_label, category_class, title, description, frequency, due_day, due_date, due_date_label, action_text, source_url)
values
  ('gstr1', 'gst', 'GST Filing', 'cat-gst', 'GSTR-1 Monthly Return', 'Mandatory return of outward supplies & sales for registered regular taxpayers.', 'monthly', 11, null, null, 'File GSTR-1', 'https://tutorial.gst.gov.in/'),
  ('gstr3b', 'gst', 'GST Compliance', 'cat-gst', 'GSTR-3B Monthly Return & Tax Payment', 'Summary return for declaring GST liabilities and claiming eligible ITC.', 'monthly', 20, null, null, 'Reconcile ITC & File', 'https://tutorial.gst.gov.in/'),
  ('tds-deposit', 'income-tax', 'TDS Challan 281', 'cat-it', 'Monthly TDS Deposit / Challan Payment', 'Deposit of tax deducted at source for the preceding month.', 'monthly', 7, null, null, 'Deposit Challan', 'https://www.incometax.gov.in/'),
  ('advance-tax', 'income-tax', 'Advance Tax', 'cat-it', 'Advance Tax Installment (Sec 208/211)', 'Quarterly payment of estimated tax liability.', 'annual', null, '2027-03-15', '15th June / 15th September / 15th December / 15th March', 'Calculate Advance Tax', 'https://www.incometax.gov.in/'),
  ('tax-audit', 'audit', 'Statutory Audit', 'cat-audit', 'Section 44AB Tax Audit Report (Form 3CA/3CB/3CD)', 'Submission of the Chartered Accountant tax audit report.', 'annual', null, '2027-09-30', '30th September (standard) / 21st October (extended cases)', 'Book Audit Review', 'https://www.incometax.gov.in/'),
  ('roc-annual', 'audit', 'Corporate MCA', 'cat-audit', 'ROC Annual Filing (AOC-4 & MGT-7)', 'Submission of audited financial statements and annual return.', 'annual', null, '2027-10-30', 'As per AGM date and Companies Act timelines', 'MCA Compliance', 'https://www.mca.gov.in/')
on conflict (id) do update set title = excluded.title, description = excluded.description, due_date = excluded.due_date, due_date_label = excluded.due_date_label, updated_at = now();
