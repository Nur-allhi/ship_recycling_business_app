import { NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get('session');
  const { pathname } = request.nextUrl;

  const isPublicPath = pathname === '/login';

  // If there's no session cookie and the user is trying to access a protected route,
  // redirect them to the login page.
  if (!sessionCookie && !isPublicPath) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // If there is a session cookie and the user is on the login page,
  // redirect them to the dashboard.
  if (sessionCookie && isPublicPath) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Otherwise, allow the request to proceed.
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
    '/((?!api|_next/static|_next/image|favicon.ico).*)/',
  ],
};