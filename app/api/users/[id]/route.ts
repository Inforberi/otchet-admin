import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { normalizeEmail } from '@/lib/auth';
import { requireSuperAdminMiddleware } from '@/lib/auth-helpers';

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const authError = await requireSuperAdminMiddleware(request);
    if (authError) return authError;

    try {
        const { id } = await params;
        const body = await request.json();
        const firstName = String(body.firstName || '').trim();
        const lastName = String(body.lastName || '').trim();
        const email = normalizeEmail(String(body.email || ''));
        const isActive =
            typeof body.isActive === 'boolean' ? body.isActive : undefined;

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
                { error: 'super_admin нельзя редактировать через этот экран' },
                { status: 400 }
            );
        }

        const user = await prisma.user.update({
            where: { id },
            data: {
                ...(firstName && { firstName }),
                ...(lastName && { lastName }),
                ...(email && { email }),
                ...(isActive !== undefined && { isActive }),
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true,
                isActive: true,
                mustChangePassword: true,
                lastLoginAt: true,
                createdAt: true,
            },
        });

        return NextResponse.json({ user }, { status: 200 });
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

        console.error('Update user error:', error);
        return NextResponse.json(
            { error: 'Ошибка обновления пользователя' },
            { status: 500 }
        );
    }
}
