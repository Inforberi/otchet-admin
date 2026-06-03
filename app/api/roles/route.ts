import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { requireSuperAdminMiddleware } from '@/lib/auth-helpers';

const roleSelect = {
    id: true,
    name: true,
    canEditContent: true,
    canManageUsers: true,
    isSystem: true,
    restrictGroups: true,
    createdAt: true,
    updatedAt: true,
    _count: {
        select: {
            users: true,
            groupAccess: true,
        },
    },
} as const;

export async function GET(request: NextRequest) {
    const authError = await requireSuperAdminMiddleware(request);
    if (authError) return authError;

    const roles = await prisma.appRole.findMany({
        orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
        select: roleSelect,
    });

    return NextResponse.json({ roles }, { status: 200 });
}

export async function POST(request: NextRequest) {
    const authError = await requireSuperAdminMiddleware(request);
    if (authError) return authError;

    try {
        const body = await request.json();
        const name = String(body.name || '').trim();
        const canEditContent = Boolean(body.canEditContent);
        const restrictGroups = Boolean(body.restrictGroups);

        if (!name) {
            return NextResponse.json(
                { error: 'Название роли обязательно' },
                { status: 400 }
            );
        }

        const role = await prisma.appRole.create({
            data: {
                name,
                canEditContent,
                canManageUsers: false,
                isSystem: false,
                restrictGroups,
            },
            select: roleSelect,
        });

        return NextResponse.json({ role }, { status: 201 });
    } catch (error) {
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
        ) {
            return NextResponse.json(
                { error: 'Роль с таким именем уже существует' },
                { status: 409 }
            );
        }

        console.error('Create role error:', error);
        return NextResponse.json(
            { error: 'Ошибка создания роли' },
            { status: 500 }
        );
    }
}
