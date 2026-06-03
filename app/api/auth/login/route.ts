import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    createSession,
    normalizeEmail,
    setSession,
    verifyPassword,
} from '@/lib/auth';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const email = normalizeEmail(String(body.email || ''));
        const password = String(body.password || '');

        if (!email || !password) {
            return NextResponse.json(
                { error: 'Email и пароль обязательны' },
                { status: 400 }
            );
        }

        const user = await prisma.user.findUnique({
            where: { email },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                passwordHash: true,
                mustChangePassword: true,
                isActive: true,
            },
        });

        if (!user || !user.isActive || !verifyPassword(password, user.passwordHash)) {
            return NextResponse.json(
                { error: 'Неверный email или пароль' },
                { status: 401 }
            );
        }

        const sessionToken = createSession(user.id, user.role as 'super_admin' | 'editor');
        await setSession(sessionToken);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                lastLoginAt: new Date(),
            },
        });

        return NextResponse.json(
            {
                success: true,
                role: user.role,
                mustChangePassword: user.mustChangePassword,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json(
            { error: 'Ошибка при входе' },
            { status: 500 }
        );
    }
}
