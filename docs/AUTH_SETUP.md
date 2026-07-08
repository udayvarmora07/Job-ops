# Auth Setup — Login & Signup (Web + Mobile)

Both the web dashboard and the mobile app use **Supabase Auth** for login/signup,
including **email/password** and **Google, GitHub, and LinkedIn** social sign-in.

Supabase's free tier (50k monthly active users) is enough for personal use.

> Until you complete the steps below, auth stays **disabled**: the web dashboard
> is open (no login wall) and the mobile app runs in **dev-bypass** mode (any
> credentials sign you in). This keeps local development frictionless.

---

## 1. Create a Supabase project

1. Go to <https://supabase.com> → **New project** (free).
2. Once created, open **Project Settings → API** and copy:
   - **Project URL** → `…SUPABASE_URL`
   - **anon public** key → `…SUPABASE_ANON_KEY`

## 2. Configure the web app

Edit `web/.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL="https://YOUR-PROJECT.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
```

Restart `npm run dev`. Now:
- Unauthenticated visits to any page redirect to **`/login`**.
- `/login`, `/signup`, `/forgot-password` render email/password + social buttons.
- Sign-out is in the dashboard header.

## 3. Configure the mobile app

Edit `mobile/.env.example` → `mobile/.env` (or set in `app.json` `extra`):

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

The app's deep-link scheme is already `jobops` (`mobile/app.json`), so the OAuth
redirect is **`jobops://auth-callback`**.

## 4. Allow the redirect URLs in Supabase

In **Supabase → Authentication → URL Configuration → Redirect URLs**, add:

```
http://localhost:4317/auth/callback     # web (dev)
https://YOUR-WEB-DOMAIN/auth/callback    # web (prod)
jobops://auth-callback                    # mobile
```

## 5. Enable the social providers

Each social login needs an OAuth app registered with that provider. This is
required by **every** auth system — there's no way around it. For each provider,
create the OAuth app, then paste its **Client ID** and **Client Secret** into
**Supabase → Authentication → Providers**.

The **callback URL** to give each provider is your Supabase one:
`https://YOUR-PROJECT.supabase.co/auth/v1/callback`

| Provider | Where to register | Supabase provider name |
|----------|-------------------|------------------------|
| **Google** | <https://console.cloud.google.com> → APIs & Services → Credentials → OAuth client ID (Web application) | `google` |
| **GitHub** | GitHub → Settings → Developer settings → OAuth Apps → New OAuth App | `github` |
| **LinkedIn** | <https://www.linkedin.com/developers/apps> → Create app → **Sign In with LinkedIn using OpenID Connect** product | `linkedin_oidc` |

Enable each in Supabase and toggle it **on**.

## 6. Email confirmation (optional)

By default Supabase requires email confirmation on signup. During development you
can disable it under **Authentication → Providers → Email → Confirm email** so
new signups get an immediate session. Leave it on for production.

---

## How it's wired

**Web** (`web/`)
- `lib/supabase/{client,server,middleware}.ts` — SSR-aware Supabase clients.
- `middleware.ts` — refreshes the session cookie and gates protected pages
  (keeps CORS for `/api/*`).
- `app/login`, `app/signup`, `app/forgot-password` — pages.
- `components/auth/AuthForm.tsx` — email/password + social buttons.
- `app/auth/callback/route.ts` — exchanges the OAuth code for a session.
- `app/auth/signout/route.ts` — sign-out.
- `components/auth/UserMenu.tsx` — header email + sign-out (dashboard).

**Mobile** (`mobile/`)
- `src/providers/AuthProvider.tsx` — `signIn`, `signUp`, `signInWithProvider`,
  `signOut`, `resetPassword`. Social flow uses `expo-web-browser` +
  `expo-linking` PKCE code exchange.
- `src/components/auth/SocialButtons.tsx` — Google/GitHub/LinkedIn buttons.
- `app/(auth)/{login,signup,forgot-password}.tsx` — screens.
- `app/_layout.tsx` — redirects unauthenticated users to `/(auth)/login`.
