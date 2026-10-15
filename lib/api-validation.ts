import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export const validationErrorResponse = (error: unknown): NextResponse | null => {
    if (error instanceof ZodError) {
        return NextResponse.json({
            error: 'Некорректные данные запроса',
            code: 'VALIDATION_ERROR',
            issues: error.issues.map(({ path, message }) => ({ path: path.join('.'), message })),
        }, { status: 400 });
    }
    if (error instanceof SyntaxError) {
        return NextResponse.json({ error: 'Некорректный JSON', code: 'INVALID_JSON' }, { status: 400 });
    }
    return null;
};
