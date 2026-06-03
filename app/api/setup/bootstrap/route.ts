import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import {
    attachSessionCookie,
    createSession,
    hashPassword,
    normalizeEmail,
} from '@/lib/auth';
import { SYSTEM_SUPER_ADMIN_ROLE_ID } from '@/lib/role-constants';

const SETUP_CODE = process.env.SETUP_CODE || '';

export async function POST(request: NextRequest) {
    try {
        const existingSuperAdmin = await prisma.user.count({
            where: { appRole: { canManageUsers: true } },
        });

        if (existingSuperAdmin > 0) {
            return NextResponse.json(
                { error: 'Первичная настройка уже завершена' },
                { status: 409 }
            );
        }

        const body = await request.json();
        const setupCode = String(body.setupCode || '');
        const firstName = String(body.firstName || '').trim();
        const lastName = String(body.lastName || '').trim();
        const email = normalizeEmail(String(body.email || ''));
        const password = String(body.password || '');

        if (!SETUP_CODE) {
            return NextResponse.json(
                { error: 'SETUP_CODE не настроен' },
                { status: 500 }
            );
        }

        if (setupCode !== SETUP_CODE) {
            return NextResponse.json(
                { error: 'Неверный setup code' },
                { status: 401 }
            );
        }

        if (!firstName || !lastName || !email || !password.trim()) {
            return NextResponse.json(
                { error: 'Все поля обязательны' },
                { status: 400 }
            );
        }

        const user = await prisma.user.create({
            data: {
                firstName,
                lastName,
                email,
                appRoleId: SYSTEM_SUPER_ADMIN_ROLE_ID,
                passwordHash: hashPassword(password),
                mustChangePassword: false,
                isActive: true,
                lastLoginAt: new Date(),
            },
            select: { id: true, appRoleId: true },
        });

        const sessionToken = createSession(user.id, user.appRoleId);

        return attachSessionCookie(
            NextResponse.json({ success: true }, { status: 201 }),
            sessionToken,
            request
        );
    } catch (error) {
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
        ) {
            return NextResponse.json(
                { error: 'Пользователь с таким email уже существует' },
                { status: 409 }
            );
        }

        console.error('Bootstrap error:', error);
        return NextResponse.json(
            { error: 'Ошибка первичной настройки' },
            { status: 500 }
        );
    }
}
