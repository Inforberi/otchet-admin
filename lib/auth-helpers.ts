import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from './auth';

export const requireAdminMiddleware = async (
    request: NextRequest,
    options?: { allowPasswordChange?: boolean }
) => {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
        return NextResponse.json(
            { error: 'Требуется авторизация.' },
            { status: 401 }
        );
    }

    if (!options?.allowPasswordChange && user.mustChangePassword) {
        return NextResponse.json(
            {
                error: 'Требуется смена пароля.',
                code: 'PASSWORD_CHANGE_REQUIRED',
            },
            { status: 403 }
        );
    }

    return null;
};

export const requireSuperAdminMiddleware = async (
    request: NextRequest
) => {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
        return NextResponse.json(
            { error: 'Требуется авторизация.' },
            { status: 401 }
        );
    }

    if (user.mustChangePassword) {
        return NextResponse.json(
            {
                error: 'Требуется смена пароля.',
                code: 'PASSWORD_CHANGE_REQUIRED',
            },
            { status: 403 }
        );
    }

    if (user.role !== 'super_admin') {
        return NextResponse.json(
            { error: 'Доступ запрещен. Требуются права super_admin.' },
            { status: 403 }
        );
    }

    return null;
};
