'use client'

import { createBrowserClient } from '@supabase/ssr'

/**
 * Browser Supabase client used by client components (Header, pages).
 *
 * Sessions are managed through cookies (set by createBrowserClient), not
 * localStorage — Supabase handles the cookie read/write for us.
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to your environment.',
    )
  }

  return createBrowserClient(supabaseUrl, supabaseKey)
}

/**
 * Returns the authenticated user's email from Supabase Auth, or null when
 * there is no session (or Supabase is not configured). Never throws — callers
 * fall back to anonymous behavior, matching the previous localStorage flow.
 */
export async function getAuthenticatedUserEmail(): Promise<string | null> {
  try {
    const supabase = createClient()
    const { data } = await supabase.auth.getUser()
    return data?.user?.email ?? null
  } catch (error) {
    console.warn('Unable to read Supabase session:', error)
    return null
  }
}