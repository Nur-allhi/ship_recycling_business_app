
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from './lib/auth';

export async function middleware(request: NextRequest) {
  const session = await getSession();
  const { pathname } = request.nextUrl;

  const isPublicPath = pathname.startsWith('/login');

  // If trying to access a protected route without a session, redirect to login
  if (!isPublicPath && !session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // If trying to access the login page with a session, redirect to home
  if (isPublicPath && session) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
