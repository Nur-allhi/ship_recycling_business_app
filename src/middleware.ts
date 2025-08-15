
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from './lib/auth';

export async function middleware(request: NextRequest) {
  const session = await getSession();
  const { pathname } = request.nextUrl;

  // If user is trying to access login page but is already logged in,
  // redirect them to the home page.
  if (pathname.startsWith('/login') && session) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // If user is trying to access any other page and is not logged in,
  // redirect them to the login page.
  if (!pathname.startsWith('/login') && !session) {
    return NextResponse.redirect(new URL('/login', request.url));
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
