import { NextRequest, NextResponse } from 'next/server';
import { getRequestRole, requireAdmin } from './auth';

// Middleware для проверки прав администратора
export function requireAdminMiddleware(request: NextRequest) {
  const role = getRequestRole(request);
  if (!requireAdmin(role)) {
    return NextResponse.json(
      { error: 'Доступ запрещен. Требуются права администратора.' },
      { status: 403 }
    );
  }
  return null;
}
