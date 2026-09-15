# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Wastify/WasteWise** - An AI-powered waste management platform that rewards users for reporting and collecting waste. Built with Next.js 14 App Router, PostgreSQL (Supabase), and Supabase Auth for email magic link authentication.

## Development Commands

```bash
npm run dev          # Start development server (http://localhost:3000)
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Run ESLint
npm run db:push      # Push Drizzle schema changes to database
npm run db:studio    # Open Drizzle Studio (database GUI)
```

## Architecture

### Tech Stack
- **Framework:** Next.js 14.2.16 (App Router)
- **Database:** PostgreSQL via Supabase + Drizzle ORM
- **Auth:** Supabase Auth (email magic links via @supabase/ssr)
- **UI:** Radix UI + Tailwind CSS (shadcn/ui pattern)
- **AI:** Google Generative AI (Gemini) for waste verification
- **Maps:** MapLibre GL + Leaflet
- **Animations:** Framer Motion

### Directory Structure
```
app/                    # Next.js App Router pages
  api/gemini/route.ts   # Gemini AI API endpoint (image + text)
  api/geocode/route.ts  # Geocoding API endpoint
  */page.tsx            # Route pages (report, collect, rewards, etc.)
components/             # React components
  Header.tsx            # Main nav with Supabase Auth, notifications, balance
  ui/                   # shadcn/ui primitives (button, card, badge, etc.)
utils/db/
  schema.ts             # Drizzle schema definitions
  action.ts             # Server actions (all DB operations)
hooks/
  useClientCache.ts     # Client-side cache for server action calls
  useMediaQuery.ts      # Responsive breakpoint hook
lib/utils.ts            # cn() utility for Tailwind class merging
lib/supabase/
  client.ts             # Browser Supabase client (createBrowserClient)
  server.ts             # Server Supabase client (createServerClient)
middleware.ts           # Session refresh middleware (no route protection)
```

### Key Patterns

**Authentication Flow:**
- Supabase Auth via `@supabase/ssr` with cookie-based sessions
- Browser client (`lib/supabase/client.ts`) and server client (`lib/supabase/server.ts`)
- Middleware (`middleware.ts`) refreshes sessions on every request (no route protection)
- Email OTP magic link: `signInWithOtp` → email redirect → `onAuthStateChange` in Header
- `createUser()` server action creates/updates user in DB (idempotent, case-insensitive)
- User email resolved from Supabase session, not localStorage

**Data Access:**
- All DB operations are server actions in `utils/db/action.ts`
- Client components call server actions directly (no API routes for CRUD)
- `cachedCall()` wrapper provides 30s client-side caching with deduplication
- Use `invalidateCache(keyPrefix)` after mutations to refresh stale data

**Component Loading:**
- Header is dynamically imported with `ssr: false` to avoid hydration issues
- Pages use Next.js `loading.tsx` for Suspense boundaries
- Heavy components (maps, globe) load on-demand

**Environment Variables:**
- `DATABASE_URL` - PostgreSQL connection string (Neon)
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` - Supabase publishable (anon) key
- `GEMINI_API_KEY` / `NEXT_PUBLIC_GEMINI_API_KEY` - Google AI key
- `GEMINI_MODEL` - Model ID (defaults to `gemini-3.6-flash`)

### Database Schema (Drizzle)
- `users` - User accounts (email, name)
- `reports` - Waste reports (location, type, amount, image, verification)
- `rewards` - User reward balances and levels
- `collected_wastes` - Collection records linking reports to collectors
- `notifications` - User notifications
- `transactions` - Point earning/redemption history

After schema changes, run `npm run db:push` to apply.

## Code Style

- TypeScript strict mode enabled
- `@/*` path alias maps to project root
- Server actions use `'use server'` directive
- Client components use `'use client'` directive
- Tailwind for styling - use `cn()` from `lib/utils.ts` for conditional classes
- Prefer Radix UI primitives from `components/ui/` over custom implementations
