import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE_NAME = 'admin_session';
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-me-in-production';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const VIEWER_USERNAME = process.env.VIEWER_USERNAME || 'viewer';
const VIEWER_PASSWORD = process.env.VIEWER_PASSWORD || 'viewer123';

export type UserRole = 'admin' | 'viewer';

// Проверка логина и пароля, возвращает роль
export function verifyCredentials(
    username: string,
    password: string
): UserRole | null {
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        return 'admin';
    }
    if (username === VIEWER_USERNAME && password === VIEWER_PASSWORD) {
        return 'viewer';
    }
    return null;
}

// Создание сессии с ролью
export async function createSession(role: UserRole): Promise<string> {
    const sessionData = `${Date.now()}-${role}-${SESSION_SECRET}`;
    const sessionToken = Buffer.from(sessionData).toString('base64');
    return sessionToken;
}

// Проверка валидности сессии и получение роли
export function getSessionRole(
    sessionToken: string | undefined
): UserRole | null {
    if (!sessionToken) return null;
    try {
        const decoded = Buffer.from(sessionToken, 'base64').toString('utf-8');
        if (!decoded.includes(SESSION_SECRET)) return null;

        // Извлекаем роль из сессии
        if (decoded.includes('-admin-')) return 'admin';
        if (decoded.includes('-viewer-')) return 'viewer';
        return null;
    } catch {
        return null;
    }
}

// Проверка валидности сессии
export function isValidSession(sessionToken: string | undefined): boolean {
    return getSessionRole(sessionToken) !== null;
}

// Проверка прав доступа (только для админа)
export function requireAdmin(role: UserRole | null): boolean {
    return role === 'admin';
}

// Получение сессии из cookies
export async function getSession(): Promise<string | null> {
    const cookieStore = await cookies();
    const session = cookieStore.get(SESSION_COOKIE_NAME);
    return session?.value || null;
}

// Установка сессии в cookies
export async function setSession(sessionToken: string): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 дней
        path: '/',
    });
}

// Удаление сессии
export async function deleteSession(): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE_NAME);
}

// Проверка авторизации для middleware
export function checkAuth(request: NextRequest): boolean {
    const session = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    return isValidSession(session);
}

// Получение роли из запроса
export function getRequestRole(request: NextRequest): UserRole | null {
    const session = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    return getSessionRole(session);
}
