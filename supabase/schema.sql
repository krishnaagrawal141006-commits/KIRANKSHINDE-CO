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
alter table public.compliance_tasks add column if not exists assigned_employee_email text;

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
create table if not exists public.invoices (
  id text primary key,
  client_id text,
  client_name text not null,
  service text not null,
  amount numeric(12,2) not null default 0,
  status text not null default 'Pending',
  due_date date,
  created_by uuid references auth.users(id) on delete set null,
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
grant select on public.compliance_tasks to authenticated;
grant all on table public.compliance_tasks to service_role;
grant all on table public.clients to service_role;
grant all on table public.invoices to service_role;

-- Private bucket for confidential client PDFs, statements and working papers.
insert into storage.buckets (id, name, public)
values ('client-documents', 'client-documents', false)
on conflict (id) do update set public = false;
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
-- ================= TALLY PRIME SYNC CONNECTOR =================
create table if not exists public.tally_sync_queue (
  id uuid primary key default gen_random_uuid(),
  source_type text not null default 'invoice', -- 'invoice', 'task', 'ledger'
  source_id text,
  client_name text not null,
  voucher_type text not null default 'Sales', -- 'Sales', 'Receipt', 'Payment', 'Journal'
  amount numeric(12,2) not null default 0,
  date date not null default current_date,
  narration text,
  sales_ledger text default 'Sales Accounts',
  party_ledger text,
  status text not null default 'PENDING', -- 'PENDING', 'PROCESSING', 'SYNCED', 'FAILED'
  tally_voucher_no text,
  error_message text,
  created_at timestamptz not null default now(),
  synced_at timestamptz
);

create table if not exists public.tally_connector_heartbeat (
  id text primary key default 'primary_pc',
  connector_name text not null default 'Office Main PC',
  tally_online boolean not null default false,
  company_name text,
  tally_version text,
  last_heartbeat timestamptz not null default now(),
  ip_info text
);

alter table public.tally_sync_queue enable row level security;
alter table public.tally_connector_heartbeat enable row level security;

grant all on table public.tally_sync_queue to service_role;
grant all on table public.tally_connector_heartbeat to service_role;
grant select, insert, update on table public.tally_sync_queue to authenticated;
grant select on table public.tally_connector_heartbeat to authenticated;

