import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    attachSessionCookie,
    createSession,
    getCurrentUserFromRequest,
    hashPassword,
    verifyPassword,
} from '@/lib/auth';

export async function POST(request: NextRequest) {
    try {
        const currentUser = await getCurrentUserFromRequest(request);
        if (!currentUser) {
            return NextResponse.json(
                { error: 'Требуется авторизация' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const currentPassword = String(body.currentPassword || '');
        const newPassword = String(body.newPassword || '');

        if (!newPassword.trim() || newPassword.length < 8) {
            return NextResponse.json(
                { error: 'Новый пароль должен быть не короче 8 символов' },
                { status: 400 }
            );
        }

        const user = await prisma.user.findUnique({
            where: { id: currentUser.id },
            select: {
                id: true,
                appRoleId: true,
                passwordHash: true,
                mustChangePassword: true,
                isActive: true,
            },
        });

        if (!user || !user.isActive) {
            return NextResponse.json(
                { error: 'Пользователь не найден' },
                { status: 404 }
            );
        }

        if (!user.mustChangePassword) {
            if (!currentPassword) {
                return NextResponse.json(
                    { error: 'Текущий пароль обязателен' },
                    { status: 400 }
                );
            }

            if (!verifyPassword(currentPassword, user.passwordHash)) {
                return NextResponse.json(
                    { error: 'Текущий пароль неверный' },
                    { status: 401 }
                );
            }
        }

        await prisma.user.update({
            where: { id: user.id },
            data: {
                passwordHash: hashPassword(newPassword),
                mustChangePassword: false,
            },
        });

        const sessionToken = createSession(user.id, user.appRoleId);

        return attachSessionCookie(
            NextResponse.json({ success: true }, { status: 200 }),
            sessionToken,
            request
        );
    } catch (error) {
        console.error('Change password error:', error);
        return NextResponse.json(
            { error: 'Ошибка при смене пароля' },
            { status: 500 }
        );
    }
}
