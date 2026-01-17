import { NextRequest, NextResponse } from 'next/server';
import { getRequestRole } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const role = getRequestRole(request);
  // Возвращаем роль или null, но не ошибку 401, чтобы фронтенд мог проверить статус
  return NextResponse.json({ role }, { status: 200 });
}
