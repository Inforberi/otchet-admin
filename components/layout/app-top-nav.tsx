'use client';

import { usePathname, useRouter } from 'next/navigation';
import { KeyRound, LogOut } from 'lucide-react';
import { useUserRole } from '@/hooks/use-user-role';

type AppTopNavProps = {
    onLogout: () => void | Promise<void>;
    variant?: 'default' | 'editor';
};

export function AppTopNav({ onLogout, variant = 'default' }: AppTopNavProps) {
    const router = useRouter();
    const pathname = usePathname();
    const { canEdit, canManageUsers, loading } = useUserRole();

    const isEditor = variant === 'editor';

    const sectionLinkClass = (active: boolean) => {
        if (isEditor) {
            return `px-3 py-2 text-sm font-medium transition-colors cursor-pointer border-b-2 -mb-px ${
                active
                    ? 'border-white text-white'
                    : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`;
        }
        return `px-3 py-2 text-sm font-medium transition-colors cursor-pointer border-b-2 -mb-px ${
            active
                ? 'border-[var(--color-primary)] text-[var(--color-grayscale-2)]'
                : 'border-transparent text-[var(--color-grayscale-6)] hover:text-[var(--color-grayscale-4)]'
        }`;
    };

    const accountBtnClass = isEditor
        ? 'rounded-md px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200 cursor-pointer'
        : 'rounded-md px-3 py-1.5 text-sm text-[var(--color-grayscale-6)] transition-colors hover:bg-[var(--color-grayscale-13)] hover:text-[var(--color-grayscale-4)] cursor-pointer';

    const logoutBtnClass =
        'rounded-md px-3 py-1.5 text-sm text-red-400 transition-colors hover:bg-red-500/10 cursor-pointer';

    const navBorderClass = isEditor
        ? 'border-b border-zinc-800'
        : 'border-b border-[var(--color-alpha-3)]';

    const manageUsersActive = pathname.startsWith('/users/manage');
    const taskPeopleActive = pathname.startsWith('/task-people/manage');
    const showUsersTab = !loading && canManageUsers;
    const showTaskPeopleTab = !loading && canEdit;
    const showNavSections = showUsersTab || showTaskPeopleTab;

    return (
        <nav
            className={`flex flex-wrap items-center gap-x-6 gap-y-2 ${
                isEditor ? 'bg-zinc-900 px-4' : ''
            } ${navBorderClass} ${showNavSections ? 'justify-between' : 'justify-end'}`}
            aria-label="Основная навигация"
        >
            {showNavSections && (
                <div className="flex flex-wrap items-center gap-1">
                    {showTaskPeopleTab && (
                        <button
                            type="button"
                            onClick={() => router.push('/task-people/manage')}
                            className={sectionLinkClass(taskPeopleActive)}
                        >
                            Исполнители
                        </button>
                    )}
                    {showUsersTab && (
                        <button
                            type="button"
                            onClick={() => router.push('/users/manage')}
                            className={sectionLinkClass(manageUsersActive)}
                        >
                            Пользователи
                        </button>
                    )}
                </div>
            )}
            <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                <button
                    type="button"
                    onClick={() => router.push('/change-password')}
                    className={`${accountBtnClass} inline-flex items-center gap-1.5`}
                >
                    <KeyRound className="h-4 w-4 shrink-0" />
                    <span className="hidden sm:inline">Сменить пароль</span>
                    <span className="sm:hidden">Пароль</span>
                </button>
                <button
                    type="button"
                    onClick={() => void onLogout()}
                    className={`${logoutBtnClass} inline-flex items-center gap-1.5`}
                >
                    <LogOut className="h-4 w-4 shrink-0" />
                    Выйти
                </button>
            </div>
        </nav>
    );
}
