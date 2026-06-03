import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { hashPassword, normalizeEmail } from '@/lib/auth';
import { requireSuperAdminMiddleware } from '@/lib/auth-helpers';

const userSelect = {
    id: true,
    firstName: true,
    lastName: true,
    email: true,
    appRoleId: true,
    isActive: true,
    mustChangePassword: true,
    lastLoginAt: true,
    createdAt: true,
    appRole: {
        select: {
            id: true,
            name: true,
            canEditContent: true,
            canManageUsers: true,
        },
    },
} as const;

export async function GET(request: NextRequest) {
    const authError = await requireSuperAdminMiddleware(request);
    if (authError) return authError;

    const users = await prisma.user.findMany({
        orderBy: [{ createdAt: 'asc' }],
        select: userSelect,
    });

    return NextResponse.json({ users }, { status: 200 });
}

export async function POST(request: NextRequest) {
    const authError = await requireSuperAdminMiddleware(request);
    if (authError) return authError;

    try {
        const body = await request.json();
        const firstName = String(body.firstName || '').trim();
        const lastName = String(body.lastName || '').trim();
        const email = normalizeEmail(String(body.email || ''));
        const temporaryPassword = String(body.temporaryPassword || '');
        const appRoleId = String(body.appRoleId || '');

        if (!firstName || !lastName || !email || !temporaryPassword.trim()) {
            return NextResponse.json(
                { error: 'Все поля обязательны' },
                { status: 400 }
            );
        }

        if (!appRoleId) {
            return NextResponse.json(
                { error: 'Роль обязательна' },
                { status: 400 }
            );
        }

        const role = await prisma.appRole.findUnique({
            where: { id: appRoleId },
            select: { canManageUsers: true },
        });

        if (!role) {
            return NextResponse.json(
                { error: 'Роль не найдена' },
                { status: 404 }
            );
        }

        const user = await prisma.user.create({
            data: {
                firstName,
                lastName,
                email,
                appRoleId,
                passwordHash: hashPassword(temporaryPassword),
                mustChangePassword: true,
                isActive: true,
            },
            select: userSelect,
        });

        return NextResponse.json({ user }, { status: 201 });
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

        console.error('Create user error:', error);
        return NextResponse.json(
            { error: 'Ошибка создания пользователя' },
            { status: 500 }
        );
    }
}
