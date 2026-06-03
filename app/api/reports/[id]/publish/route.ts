import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildDraftPayload, computeDraftHash } from '@/lib/draft-hash';
import type { ReportBlockFromDB } from '@/lib/db-types';
import type { Prisma } from '@prisma/client';
import { requireAdminMiddleware } from '@/lib/auth-helpers';

const VERSION_CONFLICT = 'VERSION_CONFLICT';

export const POST = async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    const adminCheck = await requireAdminMiddleware(request);
    if (adminCheck) return adminCheck;

    try {
        const { id } = await params;
        const body = await request.json().catch(() => ({}));
        const expectedVersion =
            typeof body.expectedVersion === 'number'
                ? body.expectedVersion
                : Number(body.expectedVersion);

        if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
            return NextResponse.json(
                { error: 'expectedVersion is required' },
                { status: 400 }
            );
        }

        const currentReport = await prisma.report.findUnique({
            where: { id },
            include: {
                blocks: {
                    orderBy: { position: 'asc' },
                },
            },
        });

        if (!currentReport) {
            return NextResponse.json({ error: 'Report not found' }, { status: 404 });
        }

        const payload = buildDraftPayload(
            currentReport,
            currentReport.blocks as ReportBlockFromDB[]
        );
        const nextDraftHash = await computeDraftHash(payload);

        if (
            currentReport.publishedHash &&
            currentReport.publishedHash === nextDraftHash
        ) {
            return NextResponse.json({
                report: currentReport,
                alreadyPublished: true,
            });
        }

        const updateResult = await prisma.report.updateMany({
            where: {
                id,
                version: expectedVersion,
            },
            data: {
                status: 'published',
                draftHash: nextDraftHash,
                publishedHash: nextDraftHash,
                publishedSnapshot: payload as Prisma.InputJsonValue,
                publishedAt: new Date(),
                draftUpdatedAt: new Date(),
                version: { increment: 1 },
            },
        });

        if (updateResult.count === 0) {
            return NextResponse.json(
                {
                    error: 'Report has been modified by another user',
                    code: VERSION_CONFLICT,
                },
                { status: 409 }
            );
        }

        const report = await prisma.report.findUnique({
            where: { id },
            include: {
                group: {
                    select: {
                        id: true,
                        name: true,
                        path: true,
                    },
                },
                blocks: {
                    orderBy: { position: 'asc' },
                },
            },
        });

        return NextResponse.json({ report }, { status: 200 });
    } catch (error) {
        console.error('Error publishing report:', error);
        return NextResponse.json({ error: 'Failed to publish report' }, { status: 500 });
    }
};
