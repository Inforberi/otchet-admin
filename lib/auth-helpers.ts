import { NextRequest, NextResponse } from 'next/server';
import {
    canEditContent,
    canManageUsers,
    getCurrentUserFromRequest,
    isReadOnlyUser,
    type AuthenticatedUser,
} from './auth';

const passwordChangeRequiredResponse = () =>
    NextResponse.json(
        {
            error: 'Требуется смена пароля.',
            code: 'PASSWORD_CHANGE_REQUIRED',
        },
        { status: 403 }
    );

export const requireAuthMiddleware = async (
    request: NextRequest,
    options?: { allowPasswordChange?: boolean }
): Promise<NextResponse | null> => {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
        return NextResponse.json(
            { error: 'Требуется авторизация.' },
            { status: 401 }
        );
    }

    if (!options?.allowPasswordChange && user.mustChangePassword) {
        return passwordChangeRequiredResponse();
    }

    return null;
};

export const requireEditorMiddleware = async (
    request: NextRequest,
    options?: { allowPasswordChange?: boolean }
): Promise<NextResponse | null> => {
    const authError = await requireAuthMiddleware(request, options);
    if (authError) return authError;

    const user = await getCurrentUserFromRequest(request);
    if (!user || !canEditContent(user)) {
        return NextResponse.json(
            { error: 'Доступ запрещен. Требуются права редактирования.' },
            { status: 403 }
        );
    }

    return null;
};

export const requireAdminMiddleware = requireEditorMiddleware;

export const requireSuperAdminMiddleware = async (
    request: NextRequest
): Promise<NextResponse | null> => {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
        return NextResponse.json(
            { error: 'Требуется авторизация.' },
            { status: 401 }
        );
    }

    if (user.mustChangePassword) {
        return passwordChangeRequiredResponse();
    }

    if (!canManageUsers(user)) {
        return NextResponse.json(
            { error: 'Доступ запрещен. Требуются права super_admin.' },
            { status: 403 }
        );
    }

    return null;
};

export const getRequestUser = async (
    request: NextRequest
): Promise<AuthenticatedUser | null> => getCurrentUserFromRequest(request);

export const isViewerRole = (user: AuthenticatedUser | null): boolean =>
    isReadOnlyUser(user);
