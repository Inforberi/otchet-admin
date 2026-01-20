import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/groups/by-slug/[slug] - получение группы по slug
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const { slug } = await params;
        const group = await prisma.reportGroup.findUnique({
            where: { slug },
            include: {
                _count: {
                    select: {
                        reports: true,
                    },
                },
            },
        });

        if (!group) {
            return NextResponse.json(
                { error: 'Group not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ group }, { status: 200 });
    } catch (error) {
        console.error('Error fetching group by slug:', error);
        return NextResponse.json(
            { error: 'Failed to fetch group' },
            { status: 500 }
        );
    }
}
