# VYBE Admin Setup

The public site does not link to the admin page. The private panel is `admin.html` and requires Supabase Auth plus the database admin policy.

## One-time setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL Editor.
3. Run `supabase/admin_security.sql` immediately after it.
4. In Supabase Authentication, create the single administrator account using the authorised Gmail address configured in `admin_security.sql`.
5. Set the password in Supabase Auth itself. **Never place the password in GitHub, JavaScript, HTML, SQL files, GitHub Actions, or `vybe-config.js`.**
6. Put the Supabase project URL and public anon/publishable key into `vybe-config.js`. Never use the `service_role` key in browser code.
7. Open `/admin.html` and sign in. The page checks both the authenticated email and the database admin role.

## Security model

- The allow-listed administrator email is enforced server-side by Supabase SQL policies/functions.
- Public users cannot promote themselves to `admin` through the profile table.
- Song/artist catalogue writes and VYBE asset uploads are admin-only.
- Public users can only read published songs and public artist information under the normal RLS rules.
- `admin.html` has `noindex,nofollow,noarchive` and is not linked from the public website. This is obscurity only; the actual protection is Supabase Auth + RLS.

## Admin capabilities

The Studio can manage songs, lyrics, metadata, audio files, artwork, artists, publication status, song requests, artist submissions and user profiles. New songs can be drafted, published, unlisted, rejected, edited or deleted.

## Important

A static site cannot keep a database password secret in frontend code. VYBE therefore uses Supabase Auth for the password and the public anon key only for browser operations. RLS must remain enabled. A service-role key must never be shipped to the browser.
