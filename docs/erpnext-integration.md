# ERPNext employee workspace integration

## Clone and status

- Source: https://github.com/frappe/erpnext
- Local clone: `integrations/erpnext` (kept separate from the public CA website)
- Current checkout: `develop`
- ERPNext is GPL-3.0 licensed and is a complete Frappe application, not a drop-in JavaScript dashboard.

## What ERPNext can provide to employees

Use Frappe/ERPNext users and roles for employee login. The employee dashboard can expose only the modules assigned to the user's role, for example:

- CRM: leads, customers and contacts
- Projects: tasks, timesheets and assignments
- Accounts: invoices and payment status (only for authorised staff)
- HR/Employee: employee profile, attendance and leave (if HRMS is installed)
- File/document workspace: controlled attachments and approvals

Do not create or store employee passwords in this website's localStorage. Create users in Frappe/ERPNext and let the built-in password reset/invite flow handle credentials.

## Deployment requirement

ERPNext needs the Frappe runtime plus a database and background services. The official disposable Docker setup uses `frappe_docker` and `docker compose -f pwd.yml up -d`; it is for evaluation, not production. A production setup should use Frappe Cloud or a properly secured self-hosted Docker/Bench deployment with backups, HTTPS and role permissions.

## Integration plan

1. Deploy ERPNext separately (for example `erp.company-domain.com`).
2. Create employee users and roles in ERPNext; never copy passwords into this static site.
3. Add SSO/OAuth or a server-side Frappe API integration to the CA admin portal.
4. Map website employees to ERPNext Employee/User IDs, then show an “Open ERPNext workspace” link or embedded authorised views.
5. Keep client, document and task permissions enforced by ERPNext server-side roles; the website UI is not a security boundary.

## Current website state

The existing employee portal remains a demo shell. The work-email, role and permission fields in the admin panel are metadata only until the ERPNext/Frappe authentication integration is configured.
