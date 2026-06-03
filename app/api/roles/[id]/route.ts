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

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const authError = await requireSuperAdminMiddleware(request);
    if (authError) return authError;

    try {
        const { id } = await params;
        const body = await request.json();
        const name = String(body.name || '').trim();
        const canEditContent =
            typeof body.canEditContent === 'boolean'
                ? body.canEditContent
                : undefined;
        const restrictGroups =
            typeof body.restrictGroups === 'boolean'
                ? body.restrictGroups
                : undefined;

        const current = await prisma.appRole.findUnique({
            where: { id },
            select: { isSystem: true, canManageUsers: true },
        });

        if (!current) {
            return NextResponse.json(
                { error: 'Роль не найдена' },
                { status: 404 }
            );
        }

        if (current.isSystem && (canEditContent === false || restrictGroups)) {
            return NextResponse.json(
                { error: 'Системную роль нельзя ограничить' },
                { status: 400 }
            );
        }

        const role = await prisma.appRole.update({
            where: { id },
            data: {
                ...(name && { name }),
                ...(canEditContent !== undefined && { canEditContent }),
                ...(restrictGroups !== undefined && { restrictGroups }),
            },
            select: roleSelect,
        });

        return NextResponse.json({ role }, { status: 200 });
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

        console.error('Update role error:', error);
        return NextResponse.json(
            { error: 'Ошибка обновления роли' },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const authError = await requireSuperAdminMiddleware(request);
    if (authError) return authError;

    try {
        const { id } = await params;

        const current = await prisma.appRole.findUnique({
            where: { id },
            include: { _count: { select: { users: true } } },
        });

        if (!current) {
            return NextResponse.json(
                { error: 'Роль не найдена' },
                { status: 404 }
            );
        }

        if (current.isSystem) {
            return NextResponse.json(
                { error: 'Системную роль нельзя удалить' },
                { status: 400 }
            );
        }

        if (current._count.users > 0) {
            return NextResponse.json(
                { error: 'Нельзя удалить роль с привязанными пользователями' },
                { status: 400 }
            );
        }

        await prisma.appRole.delete({ where: { id } });

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        console.error('Delete role error:', error);
        return NextResponse.json(
            { error: 'Ошибка удаления роли' },
            { status: 500 }
        );
    }
}
