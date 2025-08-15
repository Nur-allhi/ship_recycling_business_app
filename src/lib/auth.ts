
'use server';
import 'server-only';
import { cookies } from 'next/headers';
import type { User } from './types';

// This is a simplified session management system that stores user data in a cookie.
// It does not use JWTs directly anymore, as Supabase RLS will be handled
// by impersonating the user on the server-side via the service_role key.

export async function createSession(user: Omit<User, 'password'>) {
  const sessionPayload = JSON.stringify(user);
  cookies().set('session', sessionPayload, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24, // 1 day
    path: '/',
  });
}

export async function getSession(): Promise<User | null> {
  const sessionCookie = cookies().get('session')?.value;
  if (!sessionCookie) return null;

  try {
    const session = JSON.parse(sessionCookie);
    return session as User;
  } catch (e) {
    console.error("Failed to parse session cookie", e);
    return null;
  }
}

export async function removeSession() {
  cookies().set('session', '', { expires: new Date(0) });
}
