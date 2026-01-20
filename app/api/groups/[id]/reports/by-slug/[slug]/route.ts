import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/groups/[id]/reports/by-slug/[slug] - получение отчета по slug в группе
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; slug: string }> }
) {
    try {
        const { id: groupId, slug } = await params;
        
        const report = await prisma.report.findUnique({
            where: {
                groupId_slug: {
                    groupId,
                    slug,
                },
            },
            include: {
                blocks: {
                    orderBy: { position: 'asc' },
                },
            },
        });

        if (!report) {
            return NextResponse.json(
                { error: 'Report not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ report }, { status: 200 });
    } catch (error) {
        console.error('Error fetching report by slug:', error);
        return NextResponse.json(
            { error: 'Failed to fetch report' },
            { status: 500 }
        );
    }
}
