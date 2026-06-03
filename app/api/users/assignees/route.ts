import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireEditorMiddleware } from '@/lib/auth-helpers';

/** Список пользователей для выбора исполнителя в задачах (редакторы и super_admin). */
export async function GET(request: NextRequest) {
    const authError = await requireEditorMiddleware(request);
    if (authError) return authError;

    try {
        const users = await prisma.user.findMany({
            where: { isActive: true },
            orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
            },
        });

        return NextResponse.json({ users }, { status: 200 });
    } catch (error) {
        console.error('Error fetching assignees:', error);
        return NextResponse.json(
            { error: 'Failed to fetch assignees' },
            { status: 500 }
        );
    }
}
