# VYBE Admin Setup

The public site does not link to the admin page. The private panel is `admin.html` and requires Supabase Auth plus the database admin policies.

## One-time setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL Editor.
3. Run `supabase/security_hardening.sql` immediately after it.
4. In Supabase Authentication, create the single administrator account using the authorised Gmail address enforced by `security_hardening.sql`.
5. Set the password in Supabase Auth itself. **Never place the password in GitHub, JavaScript, HTML, SQL files, GitHub Actions, or `vybe-config.js`.**
6. Because the administrator password was shared in the chat during setup, use a fresh password in Supabase Auth rather than reusing that exposed password.
7. Put the Supabase project URL and public anon/publishable key into `vybe-config.js`. Never use the `service_role` key in browser code.
8. Open `/admin.html` and sign in. After authentication, the database bootstrap function grants the `admin` role only when the authenticated account matches the allow-listed email; RLS then controls every admin operation.

## Security model

- The administrator identity is enforced server-side by Supabase SQL policies/functions, not by a hidden URL or frontend-only check.
- Public users cannot promote themselves to `admin` through the profile table.
- Song/artist catalogue writes and VYBE asset uploads are admin-only.
- Public users can only read published songs and public artist information under the normal RLS rules.
- `admin.html` has `noindex,nofollow,noarchive` and is not linked from the public website. This is obscurity only; the actual protection is Supabase Auth + RLS.
- Never ship a Supabase `service_role` key or any other private secret to the browser.

## Admin capabilities

The Studio can manage songs, lyrics, metadata, audio files, artwork, artists, publication status, song requests, artist submissions and user profiles. New songs can be drafted, published, unlisted, rejected, edited or deleted.

## Important limitation

A browser-delivered website cannot hide its HTML/CSS/JavaScript from a determined visitor. Those assets must reach the user's device. VYBE therefore keeps secrets and privileged authority on the backend and protects database/storage operations with authentication and RLS. To prevent the repository itself from being publicly readable, host the source in a private repository or private build pipeline; do not put secrets in the frontend.
