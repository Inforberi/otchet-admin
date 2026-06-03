import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
    const user = await getCurrentUserFromRequest(request);

    return NextResponse.json(
        {
            roleName: user?.roleName ?? null,
            canEdit: user?.canEditContent ?? false,
            canManageUsers: user?.canManageUsers ?? false,
            user: user
                ? {
                      id: user.id,
                      email: user.email,
                      firstName: user.firstName,
                      lastName: user.lastName,
                      appRoleId: user.appRoleId,
                      roleName: user.roleName,
                      canEditContent: user.canEditContent,
                      canManageUsers: user.canManageUsers,
                      mustChangePassword: user.mustChangePassword,
                  }
                : null,
            mustChangePassword: user?.mustChangePassword ?? false,
        },
        { status: 200 }
    );
}
