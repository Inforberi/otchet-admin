import { NextRequest, NextResponse } from 'next/server';
import { verifyCredentials, createSession, setSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { username, password } = body;

        if (!username || !password) {
            return NextResponse.json(
                { error: 'Логин и пароль обязательны' },
                { status: 400 }
            );
        }

        // Проверяем логин и пароль, получаем роль
        const role = verifyCredentials(username, password);
        if (!role) {
            return NextResponse.json(
                { error: 'Неверный логин или пароль' },
                { status: 401 }
            );
        }

        // Создаем сессию с ролью
        const sessionToken = await createSession(role);
        await setSession(sessionToken);

        return NextResponse.json({ success: true, role }, { status: 200 });
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json(
            { error: 'Ошибка при входе' },
            { status: 500 }
        );
    }
}
