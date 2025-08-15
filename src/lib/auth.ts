
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
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24, // 1 day
    path: '/',
    sameSite: 'lax',
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
