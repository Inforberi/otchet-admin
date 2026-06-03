import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { requireSuperAdminMiddleware } from '@/lib/auth-helpers';

const RECOVERY_PHRASE = process.env.RECOVERY_PHRASE || '';

const verifyRecoveryPhrase = (phrase: string): boolean => {
    if (!RECOVERY_PHRASE) return false;
    const expected = Buffer.from(RECOVERY_PHRASE);
    const actual = Buffer.from(phrase);
    if (expected.length !== actual.length) return false;
    return timingSafeEqual(expected, actual);
};

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
        const recoveryPhrase = String(body.recoveryPhrase || '');

        if (!RECOVERY_PHRASE) {
            return NextResponse.json(
                { error: 'RECOVERY_PHRASE не настроен' },
                { status: 500 }
            );
        }

        if (!recoveryPhrase || !verifyRecoveryPhrase(recoveryPhrase)) {
            return NextResponse.json(
                { error: 'Неверная ключевая фраза' },
                { status: 401 }
            );
        }

        if (!temporaryPassword.trim() || temporaryPassword.length < 8) {
            return NextResponse.json(
                { error: 'Временный пароль должен быть не короче 8 символов' },
                { status: 400 }
            );
        }

        const currentUser = await prisma.user.findUnique({
            where: { id },
            select: { id: true },
        });

        if (!currentUser) {
            return NextResponse.json(
                { error: 'Пользователь не найден' },
                { status: 404 }
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
