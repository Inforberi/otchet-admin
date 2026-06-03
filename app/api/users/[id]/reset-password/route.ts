import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { requireSuperAdminMiddleware } from '@/lib/auth-helpers';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const authError = await requireSuperAdminMiddleware(request);
    if (authError) return authError;

    try {
        const { id } = await params;
        const body = await request.json();
        const temporaryPassword = String(body.temporaryPassword || '');

        if (!temporaryPassword.trim()) {
            return NextResponse.json(
                { error: 'Временный пароль обязателен' },
                { status: 400 }
            );
        }

        const currentUser = await prisma.user.findUnique({
            where: { id },
            select: { role: true },
        });

        if (!currentUser) {
            return NextResponse.json(
                { error: 'Пользователь не найден' },
                { status: 404 }
            );
        }

        if (currentUser.role === 'super_admin') {
            return NextResponse.json(
                { error: 'Пароль super_admin сбрасывается только вручную' },
                { status: 400 }
            );
        }

        await prisma.user.update({
            where: { id },
            data: {
                passwordHash: hashPassword(temporaryPassword),
                mustChangePassword: true,
            },
        });

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        console.error('Reset password error:', error);
        return NextResponse.json(
            { error: 'Ошибка сброса пароля' },
            { status: 500 }
        );
    }
}
