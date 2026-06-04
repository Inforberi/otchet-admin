import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireEditorMiddleware } from '@/lib/auth-helpers';
import { validatePersonName } from '@/lib/task-assignees';

export async function GET(request: NextRequest) {
    const authError = await requireEditorMiddleware(request);
    if (authError) return authError;

    try {
        const q = request.nextUrl.searchParams.get('q')?.trim() ?? '';
        const includeInactive =
            request.nextUrl.searchParams.get('includeInactive') === 'true';

        const people = await prisma.taskPerson.findMany({
            where: {
                ...(includeInactive ? {} : { isActive: true }),
                ...(q
                    ? {
                          OR: [
                              { firstName: { contains: q, mode: 'insensitive' } },
                              { lastName: { contains: q, mode: 'insensitive' } },
                          ],
                      }
                    : {}),
            },
            orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
            select: {
                id: true,
                firstName: true,
                lastName: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        return NextResponse.json({ people }, { status: 200 });
    } catch (error) {
        console.error('Error fetching task people:', error);
        return NextResponse.json(
            { error: 'Failed to fetch task people' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    const authError = await requireEditorMiddleware(request);
    if (authError) return authError;

    try {
        const body = await request.json();
        const validated = validatePersonName(body.firstName, body.lastName);
        if ('error' in validated) {
            return NextResponse.json({ error: validated.error }, { status: 400 });
        }

        const person = await prisma.taskPerson.create({
            data: validated,
            select: {
                id: true,
                firstName: true,
                lastName: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        return NextResponse.json({ person }, { status: 201 });
    } catch (error) {
        console.error('Error creating task person:', error);
        return NextResponse.json(
            { error: 'Failed to create task person' },
            { status: 500 }
        );
    }
}
