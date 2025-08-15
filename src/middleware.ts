
import { NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get('session');
  const { pathname } = request.nextUrl;

  const isPublicPath = pathname === '/login';

  // If the user is trying to access a protected route without a session cookie, redirect to login
  if (!isPublicPath && !sessionCookie) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // If the user is logged in and tries to access the login page, redirect to the home page
  if (isPublicPath && sessionCookie) {
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
