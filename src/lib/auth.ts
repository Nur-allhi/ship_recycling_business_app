
'use server';
import 'server-only';
import { cookies } from 'next/headers';

// This is a simplified user type for the session cookie.
// It should not contain sensitive information like passwords.
export interface SessionPayload {
    id: string;
    username: string;
    role: 'admin' | 'user';
    accessToken: string; // JWT token
}

export async function createSession(payload: SessionPayload, rememberMe?: boolean) {
  const sessionPayload = JSON.stringify(payload);
  const maxAge = rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 24; // 30 days or 1 day

  cookies().set('session', sessionPayload, {
    httpOnly: true,
    secure: true, 
    maxAge: maxAge,
    path: '/',
    // 'none' is often required for cross-site contexts in development environments (like iframes or proxies).
    // It requires the 'secure' attribute to be true.
    sameSite: 'none',
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const sessionCookie = cookies().get('session')?.value;
  if (!sessionCookie) return null;

  try {
    const session = JSON.parse(sessionCookie);
    return session as SessionPayload;
  } catch (e) {
    console.error("Failed to parse session cookie", e);
    return null;
  }
}

export async function removeSession() {
  cookies().set('session', '', {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/',
    expires: new Date(0),
  });
}
