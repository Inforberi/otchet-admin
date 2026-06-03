import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
    const user = await getCurrentUserFromRequest(request);

    return NextResponse.json(
        {
            role: user?.role ?? null,
            user: user
                ? {
                      id: user.id,
                      email: user.email,
                      firstName: user.firstName,
                      lastName: user.lastName,
                      role: user.role,
                      mustChangePassword: user.mustChangePassword,
                  }
                : null,
            mustChangePassword: user?.mustChangePassword ?? false,
        },
        { status: 200 }
    );
}
