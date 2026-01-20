import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminMiddleware } from '@/lib/auth-helpers';
import { createSlug, generateUniqueSlug } from '@/lib/slug';

// GET /api/groups - список всех групп
export async function GET(request: NextRequest) {
    try {
        const groups = await prisma.reportGroup.findMany({
            orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
            include: {
                _count: {
                    select: {
                        reports: true,
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
    const adminCheck = requireAdminMiddleware(request);
    if (adminCheck) return adminCheck;

    try {
        const body = await request.json();
        const { name, description, order } = body;

        if (!name || typeof name !== 'string' || name.trim() === '') {
            return NextResponse.json(
                { error: 'Group name is required' },
                { status: 400 }
            );
        }

        // Проверяем, что группа с таким именем не существует
        const existing = await prisma.reportGroup.findUnique({
            where: { name: name.trim() },
        });

        if (existing) {
            return NextResponse.json(
                { error: 'Group with this name already exists' },
                { status: 400 }
            );
        }

        // Генерируем уникальный slug
        const baseSlug = createSlug(name.trim());
        const slug = await generateUniqueSlug(
            baseSlug,
            async (s) => {
                const exists = await prisma.reportGroup.findUnique({
                    where: { slug: s },
                });
                return !exists;
            }
        );

        const group = await prisma.reportGroup.create({
            data: {
                name: name.trim(),
                slug,
                description: description?.trim() || null,
                order: order ?? 0,
            },
        });

        return NextResponse.json({ group }, { status: 201 });
    } catch (error) {
        console.error('Error creating group:', error);
        return NextResponse.json(
            { error: 'Failed to create group' },
            { status: 500 }
        );
    }
}
