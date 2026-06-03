import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { requireAdminMiddleware } from '@/lib/auth-helpers';
import { generateGroupSlugAndPath } from '@/lib/group-service';

// GET /api/groups - список всех групп
export async function GET(request: NextRequest) {
    try {
        const tree = request.nextUrl.searchParams.get('tree');
        const groups = await prisma.reportGroup.findMany({
            where: tree === '1' ? undefined : { parentId: null },
            orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
            include: {
                _count: {
                    select: {
                        reports: true,
                        children: true,
                    },
                },
            },
        });

        return NextResponse.json({ groups }, { status: 200 });
    } catch (error) {
        console.error('Error fetching groups:', error);
        return NextResponse.json(
            { error: 'Failed to fetch groups' },
            { status: 500 }
        );
    }
}

// POST /api/groups - создание новой группы
export async function POST(request: NextRequest) {
    const adminCheck = await requireAdminMiddleware(request);
    if (adminCheck) return adminCheck;

    try {
        const body = await request.json();
        const { name, description, order, parentId } = body;

        if (!name || typeof name !== 'string' || name.trim() === '') {
            return NextResponse.json(
                { error: 'Group name is required' },
                { status: 400 }
            );
        }

        const { slug, path } = await generateGroupSlugAndPath({
            name: name.trim(),
            parentId: parentId ?? null,
        });

        const group = await prisma.reportGroup.create({
            data: {
                name: name.trim(),
                slug,
                path,
                description: description?.trim() || null,
                order: order ?? 0,
                parentId: parentId ?? null,
            },
        });

        return NextResponse.json({ group }, { status: 201 });
    } catch (error) {
        if (error instanceof Error) {
            if (error.message === 'PARENT_NOT_FOUND') {
                return NextResponse.json(
                    { error: 'Parent group not found' },
                    { status: 404 }
                );
            }

            if (
                error.message === 'RESERVED_GROUP_SLUG' ||
                error.message === 'RESERVED_ROOT_GROUP_SLUG'
            ) {
                return NextResponse.json(
                    { error: 'This group slug is reserved and cannot be used' },
                    { status: 400 }
                );
            }
        }

        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
        ) {
            return NextResponse.json(
                { error: 'Group path already exists' },
                { status: 409 }
            );
        }

        console.error('Error creating group:', error);
        return NextResponse.json(
            { error: 'Failed to create group' },
            { status: 500 }
        );
    }
}
