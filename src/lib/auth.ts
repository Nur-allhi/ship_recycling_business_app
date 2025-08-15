
'use server';
import 'server-only';
import { cookies } from 'next/headers';

// This is a simplified user type for the session cookie.
// It should not contain sensitive information like passwords.
export interface SessionPayload {
    id: string;
    username: string;
    role: 'admin' | 'user';
}

export async function createSession(payload: SessionPayload) {
  const sessionPayload = JSON.stringify(payload);
  cookies().set('session', sessionPayload, {
    httpOnly: true,
    // The `secure` flag is required for `sameSite: 'none'`.
    // We set it to true for all environments because the editor preview
    // operates in a cross-site context.
    secure: true, 
    maxAge: 60 * 60 * 24, // 1 day
    path: '/',
    // This is the critical change. 'lax' (the default) prevents the cookie
    // from being sent in a cross-site iframe context (the editor preview).
    // 'none' allows the cookie to be sent, fixing the login loop.
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
  cookies().set('session', '', { expires: new Date(0), path: '/' });
}
