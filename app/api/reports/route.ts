import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createReportSchema } from '@/lib/report-api';
import { validationErrorResponse } from '@/lib/api-validation';
import { Prisma } from '@prisma/client';
import {
    getRequestUser,
    isViewerRole,
    requireEditorMiddleware,
} from '@/lib/auth-helpers';
import {
    canAccessGroupId,
    getGroupAccessOptionsFromRequest,
} from '@/lib/group-access';
import {
    filterVisibleReports,
    getReportAccessOptionsFromRequest,
} from '@/lib/report-access';
import { createSlug, generateUniqueSlug } from '@/lib/slug';
import { getCurrentMonthDateRange } from '@/lib/report-date-range';

// GET /api/reports?groupId=... - список отчетов в доступной группе
export async function GET(request: NextRequest) {
    try {
        const user = await getRequestUser(request);
        const searchParams = request.nextUrl.searchParams;
        const search = searchParams.get('search');
        const groupId = searchParams.get('groupId');
        const dateFrom = searchParams.get('dateFrom');
        const dateTo = searchParams.get('dateTo');
        const allTime = searchParams.get('allTime') === '1';
        const noDateFilter = searchParams.get('noDateFilter') === '1';
        const accessOptions = getReportAccessOptionsFromRequest(request);
        const groupAccessOptions = getGroupAccessOptionsFromRequest(request);

        const where: Prisma.ReportWhereInput = {};

        if (!user) {
            return NextResponse.json(
                { error: 'Требуется авторизация.' },
                { status: 401 }
            );
        }

        if (!groupId) {
            return NextResponse.json(
                { error: 'Group ID is required' },
                { status: 400 }
            );
        }

        if (user && isViewerRole(user)) {
            where.status = 'published';
        }

        const defaultRange = getCurrentMonthDateRange();
        let effectiveDateFrom: string | null = null;
        let effectiveDateTo: string | null = null;

        if (!allTime && !noDateFilter) {
            effectiveDateFrom = dateFrom || defaultRange.dateFrom;
            effectiveDateTo = dateTo || defaultRange.dateTo;
        } else if (!allTime && noDateFilter && (dateFrom || dateTo)) {
            effectiveDateFrom = dateFrom;
            effectiveDateTo = dateTo;
        }

        if (!(await canAccessGroupId(user, groupId, groupAccessOptions))) {
            return NextResponse.json({ reports: [] }, { status: 200 });
        }
        where.groupId = groupId;

        if (search) {
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { client: { contains: search, mode: 'insensitive' } },
            ];
        }

        if (effectiveDateFrom || effectiveDateTo) {
            const dateRange: Prisma.StringNullableFilter = {
                ...(effectiveDateFrom && { gte: effectiveDateFrom }),
                ...(effectiveDateTo && { lte: effectiveDateTo }),
            };

            const existingAnd = where.AND
                ? Array.isArray(where.AND)
                    ? where.AND
                    : [where.AND]
                : [];

            where.AND = [
                ...existingAnd,
                {
                    OR: [{ date: dateRange }, { excludeFromDateFilter: true }],
                },
            ];
        }

        const reports = filterVisibleReports(
            await prisma.report.findMany({
            where: Object.keys(where).length > 0 ? where : undefined,
            orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
            include: {
                group: {
                    select: { id: true, name: true, path: true },
                },
                blocks: {
                    orderBy: { position: 'asc' },
                },
            },
        }),
            user,
            accessOptions
        );

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

    const user = await getRequestUser(request);
    const groupAccessOptions = getGroupAccessOptionsFromRequest(request);

    try {
        const body = createReportSchema.parse(await request.json());

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

        if (
            !user ||
            !(await canAccessGroupId(user, body.groupId, groupAccessOptions))
        ) {
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
                createdByUserId: user?.id ?? null,
            },
        });

        return NextResponse.json({ report }, { status: 201 });
    } catch (error) {
        const validationError = validationErrorResponse(error);
        if (validationError) return validationError;
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
