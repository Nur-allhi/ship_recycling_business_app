
'use server';
import 'server-only';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

// This is a simplified user type for the session cookie.
// It should not contain sensitive information like passwords.
export interface SessionPayload {
    id: string;
    username: string;
    role: 'admin' | 'user';
    accessToken: string; // JWT token
}

const secret = new TextEncoder().encode(process.env.APP_SESSION_SECRET || 'fallback-secret-at-least-32-chars-long');

export async function createSession(payload: SessionPayload, rememberMe?: boolean) {
  const expirationTime = rememberMe ? '30d' : '1d';
  
  const token = await new SignJWT(payload as any)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expirationTime)
    .sign(secret);

  const maxAge = rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 24; // 30 days or 1 day

  (await cookies()).set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', 
    maxAge: maxAge,
    path: '/',
    sameSite: 'lax',
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const sessionCookie = (await cookies()).get('session')?.value;
  if (!sessionCookie) return null;

  try {
    const { payload } = await jwtVerify(sessionCookie, secret, {
      algorithms: ['HS256'],
    });
    return payload as unknown as SessionPayload;
  } catch (e) {
    console.error("Failed to verify session cookie", e);
    return null;
  }
}

export async function removeSession() {
  (await cookies()).set('session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(0),
  });
}
