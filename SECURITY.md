# VYBE Security Notes

## Important
VYBE is a static GitHub Pages frontend plus a Supabase backend. Browser code can never be made secret: users can inspect HTML, CSS and JavaScript delivered to their browser. Security therefore depends on never putting secrets in frontend code and enforcing authorization in Supabase/server-side functions.

## Production rules
- Never commit passwords, service-role keys, API secrets, SMTP credentials, or private signing keys.
- Only the Supabase publishable/anon key may be present in browser configuration, and only with Row Level Security enabled.
- The sole VYBE admin identity must be enforced by a server-side database role check, not by hiding a URL or comparing an email in JavaScript.
- Keep all management operations behind authenticated admin RLS policies or server-side Edge Functions.
- Public users may read only published catalogue rows.
- Artist submissions and requests must not expose private reviewer notes or arbitrary storage objects.
- Validate file type, extension, size, and metadata before accepting audio/artwork uploads.
- Use HTTPS, secure authentication settings, rate limits, CAPTCHA/abuse controls, and email verification in the production Supabase project.
- Review Supabase Auth logs, database logs, and storage access regularly.

## No impossible guarantee
No public website can honestly be guaranteed impossible to hack or completely hide its client-side source code. The goal is defense in depth: least privilege, secure authentication, strict database/storage policies, safe secret handling, validation, monitoring, and a small public attack surface.
