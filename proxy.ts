import { NextRequest, NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Публичные пути (не требуют авторизации)
  const publicPaths = ['/login', '/api/auth/login', '/api/auth/me'];
  
  // Проверяем, является ли путь публичным
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path));
  
  // Если это публичный путь, пропускаем
  if (isPublicPath) {
    return NextResponse.next();
  }

  // Проверяем авторизацию - работает одинаково в dev и production
  const isAuthenticated = checkAuth(request);

  // Если не авторизован, редиректим на логин (для страниц) или возвращаем 401 (для API)
  if (!isAuthenticated) {
    // Для API routes возвращаем 401
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Для страниц редиректим на логин
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|icons|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
