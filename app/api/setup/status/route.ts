import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    const count = await prisma.user.count({
        where: {
            appRole: { canManageUsers: true },
        },
    });

    return NextResponse.json({ needsSetup: count === 0 }, { status: 200 });
}
