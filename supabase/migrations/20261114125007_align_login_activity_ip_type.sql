alter table public.user_login_activity
alter column ip_address type text
using ip_address::text;
