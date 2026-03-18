import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback-secret-change-this'
);

export async function middleware(req: NextRequest) {
  const token = req.cookies.get('vp_token')?.value;
  const { pathname } = req.nextUrl;

  const isAuthPage = pathname === '/login' || pathname === '/signup';
  const isProtected = pathname === '/';

  // Not logged in + trying to access protected page → redirect to login
  if (isProtected) {
    if (!token) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
    try {
      await jwtVerify(token, SECRET);
    } catch {
      const res = NextResponse.redirect(new URL('/login', req.url));
      res.cookies.delete('vp_token');
      return res;
    }
  }

  // Already logged in + trying to access auth pages → redirect to home
  if (isAuthPage && token) {
    try {
      await jwtVerify(token, SECRET);
      return NextResponse.redirect(new URL('/', req.url));
    } catch {
      // token invalid, let them through to login
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/login', '/signup'],
};