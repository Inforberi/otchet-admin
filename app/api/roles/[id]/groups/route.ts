import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSuperAdminMiddleware } from '@/lib/auth-helpers';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const authError = await requireSuperAdminMiddleware(request);
    if (authError) return authError;

    const { id } = await params;

    const access = await prisma.appRoleGroup.findMany({
        where: { roleId: id },
        select: { groupId: true },
    });

    return NextResponse.json(
        { groupIds: access.map((row) => row.groupId) },
        { status: 200 }
    );
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const authError = await requireSuperAdminMiddleware(request);
    if (authError) return authError;

    try {
        const { id } = await params;
        const body = await request.json();
        const groupIds = Array.isArray(body.groupIds)
            ? body.groupIds.map((value: unknown) => String(value))
            : [];

        const role = await prisma.appRole.findUnique({
            where: { id },
            select: { id: true },
        });

        if (!role) {
            return NextResponse.json(
                { error: 'Роль не найдена' },
                { status: 404 }
            );
        }

        await prisma.$transaction([
            prisma.appRoleGroup.deleteMany({ where: { roleId: id } }),
            ...(groupIds.length > 0
                ? [
                      prisma.appRoleGroup.createMany({
                          data: groupIds.map((groupId: string) => ({
                              roleId: id,
                              groupId,
                          })),
                          skipDuplicates: true,
                      }),
                  ]
                : []),
        ]);

        return NextResponse.json({ groupIds }, { status: 200 });
    } catch (error) {
        console.error('Update role groups error:', error);
        return NextResponse.json(
            { error: 'Ошибка сохранения групп' },
            { status: 500 }
        );
    }
}
