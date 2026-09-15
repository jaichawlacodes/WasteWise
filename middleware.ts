import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Session-refresh proxy. Refreshes the Supabase auth session cookies on
 * matching requests so a logged-in user stays logged in across navigation.
 *
 * This intentionally does NOT protect routes or redirect anyone — the
 * application has always allowed anonymous browsing, and that behavior is
 * preserved. It only keeps the session cookies fresh.
 */
export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    // Supabase not configured — pass everything through untouched.
    return NextResponse.next()
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        )
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        )
      },
    },
  })

  // Trigger the session-refresh logic. We do not use the returned user to
  // gate access.
  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: [
    // Skip static assets and public files; everything else needs cookie refresh.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}