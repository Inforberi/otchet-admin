import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { CreateReportInput } from '@/lib/db-types';
import { Prisma } from '@prisma/client';
import {
    getRequestUser,
    isViewerRole,
    requireEditorMiddleware,
} from '@/lib/auth-helpers';
import { canAccessGroupId, getAccessibleGroupFilter } from '@/lib/group-access';
import { createSlug, generateUniqueSlug } from '@/lib/slug';
import { getCurrentMonthDateRange } from '@/lib/report-date-range';

// GET /api/reports - список всех отчетов
export async function GET(request: NextRequest) {
    try {
        const user = await getRequestUser(request);
        const searchParams = request.nextUrl.searchParams;
        const search = searchParams.get('search');
        const groupId = searchParams.get('groupId');
        const dateFrom = searchParams.get('dateFrom');
        const dateTo = searchParams.get('dateTo');
        const allTime = searchParams.get('allTime') === '1';

        const where: Prisma.ReportWhereInput = {};

        if (user && isViewerRole(user)) {
            where.status = 'published';
        }
        const defaultRange = getCurrentMonthDateRange();
        const effectiveDateFrom = allTime
            ? null
            : dateFrom || defaultRange.dateFrom;
        const effectiveDateTo = allTime
            ? null
            : dateTo || defaultRange.dateTo;

        if (groupId) {
            if (user && !(await canAccessGroupId(user, groupId))) {
                return NextResponse.json({ reports: [] }, { status: 200 });
            }
            where.groupId = groupId;
        } else if (user && isViewerRole(user)) {
            const groupFilter = await getAccessibleGroupFilter(user);
            if (groupFilter) {
                where.groupId = groupFilter.id;
            }
        }

        if (search) {
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { client: { contains: search, mode: 'insensitive' } },
            ];
        }

        if (effectiveDateFrom || effectiveDateTo) {
            where.date = {
                ...(effectiveDateFrom && { gte: effectiveDateFrom }),
                ...(effectiveDateTo && { lte: effectiveDateTo }),
            };
        }

        const reports = await prisma.report.findMany({
            where: Object.keys(where).length > 0 ? where : undefined,
            orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
            include: {
                blocks: {
                    orderBy: { position: 'asc' },
                },
            },
        });

        // Сортируем: сначала по date (null в конец), затем по createdAt
        reports.sort((a, b) => {
            if (!a.date && !b.date)
                return (
                    new Date(b.createdAt).getTime() -
                    new Date(a.createdAt).getTime()
                );
            if (!a.date) return 1;
            if (!b.date) return -1;
            if (a.date !== b.date) return b.date.localeCompare(a.date);
            return (
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime()
            );
        });

        return NextResponse.json({ reports }, { status: 200 });
    } catch (error) {
        console.error('Error fetching reports:', error);
        return NextResponse.json(
            { error: 'Failed to fetch reports' },
            { status: 500 }
        );
    }
}

// POST /api/reports - создание нового отчета
export async function POST(request: NextRequest) {
    // Проверка прав администратора
    const adminCheck = await requireEditorMiddleware(request);
    if (adminCheck) return adminCheck;

    try {
        const body: CreateReportInput & { groupId?: string } = await request.json();

        if (!body.title) {
            return NextResponse.json(
                { error: 'Title is required' },
                { status: 400 }
            );
        }

        if (!body.groupId) {
            return NextResponse.json(
                { error: 'Group ID is required' },
                { status: 400 }
            );
        }

        // Проверяем существование группы
        const group = await prisma.reportGroup.findUnique({
            where: { id: body.groupId },
        });

        if (!group) {
            return NextResponse.json(
                { error: 'Group not found' },
                { status: 404 }
            );
        }

        // Генерируем уникальный slug в рамках группы
        const baseSlug = createSlug(body.title);
        const slug = await generateUniqueSlug(
            baseSlug,
            async (s) => {
                const exists = await prisma.report.findUnique({
                    where: {
                        groupId_slug: {
                            groupId: body.groupId,
                            slug: s,
                        },
                    },
                });
                return !exists;
            }
        );

        const report = await prisma.report.create({
            data: {
                title: body.title,
                slug,
                subtitle: body.subtitle,
                client: body.client,
                date: body.date,
                status: body.status || 'draft',
                groupId: body.groupId,
            },
        });

        return NextResponse.json({ report }, { status: 201 });
    } catch (error) {
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
        ) {
            return NextResponse.json(
                { error: 'Report slug already exists in this group' },
                { status: 409 }
            );
        }

        console.error('Error creating report:', error);
        return NextResponse.json(
            { error: 'Failed to create report' },
            { status: 500 }
        );
    }
}
