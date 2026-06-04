import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireEditorMiddleware } from '@/lib/auth-helpers';
import { validatePersonName } from '@/lib/task-assignees';

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const authError = await requireEditorMiddleware(request);
    if (authError) return authError;

    try {
        const { id } = await params;
        const body = await request.json();

        const data: { firstName?: string; lastName?: string; isActive?: boolean } = {};

        if (body.firstName !== undefined || body.lastName !== undefined) {
            const validated = validatePersonName(
                body.firstName ?? '',
                body.lastName ?? ''
            );
            if ('error' in validated) {
                return NextResponse.json({ error: validated.error }, { status: 400 });
            }
            data.firstName = validated.firstName;
            data.lastName = validated.lastName;
        }

        if (typeof body.isActive === 'boolean') {
            data.isActive = body.isActive;
        }

        if (Object.keys(data).length === 0) {
            return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
        }

        const person = await prisma.taskPerson.update({
            where: { id },
            data,
            select: {
                id: true,
                firstName: true,
                lastName: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        return NextResponse.json({ person }, { status: 200 });
    } catch (error) {
        console.error('Error updating task person:', error);
        return NextResponse.json(
            { error: 'Failed to update task person' },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const authError = await requireEditorMiddleware(request);
    if (authError) return authError;

    try {
        const { id } = await params;

        const person = await prisma.taskPerson.update({
            where: { id },
            data: { isActive: false },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        return NextResponse.json({ person }, { status: 200 });
    } catch (error) {
        console.error('Error deactivating task person:', error);
        return NextResponse.json(
            { error: 'Failed to deactivate task person' },
            { status: 500 }
        );
    }
}
