import type { TaskAssignee, TaskAssigneeKind, TaskBlockData } from '@/lib/db-types';

export const assigneeKey = (kind: TaskAssigneeKind, id: string): string =>
    `${kind}:${id}`;

export const formatAssigneeName = (a: Pick<TaskAssignee, 'firstName' | 'lastName'>): string =>
    [a.firstName, a.lastName].filter(Boolean).join(' ').trim();

export const formatAssigneesList = (assignees: TaskAssignee[]): string =>
    assignees.map(formatAssigneeName).filter(Boolean).join(', ');

const parseLegacyName = (name: string | null | undefined): { firstName: string; lastName: string } => {
    const trimmed = (name ?? '').trim();
    if (!trimmed) return { firstName: '', lastName: '' };
    const parts = trimmed.split(/\s+/);
    if (parts.length === 1) return { firstName: parts[0], lastName: '' };
    return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
};

export const normalizeTaskAssignees = (data: TaskBlockData): TaskAssignee[] => {
    if (Array.isArray(data.assignees) && data.assignees.length > 0) {
        return data.assignees.map((a) => ({
            kind: a.kind,
            id: a.id,
            firstName: a.firstName ?? '',
            lastName: a.lastName ?? '',
        }));
    }

    if (data.assigneeId) {
        const { firstName, lastName } = parseLegacyName(data.assigneeName);
        return [
            {
                kind: 'user',
                id: data.assigneeId,
                firstName,
                lastName,
            },
        ];
    }

    return [];
};

export const isAssigneeSelected = (
    assignees: TaskAssignee[],
    kind: TaskAssigneeKind,
    id: string
): boolean => assignees.some((a) => a.kind === kind && a.id === id);

export const canUserActOnTask = (
    userId: string | undefined,
    assignees: TaskAssignee[],
    isEditor: boolean
): boolean => {
    if (isEditor) return true;
    if (assignees.length === 0) return true;
    const userAssignees = assignees.filter((a) => a.kind === 'user');
    if (userAssignees.length === 0) return false;
    if (!userId) return false;
    return userAssignees.some((a) => a.id === userId);
};

export const validatePersonName = (
    firstName: unknown,
    lastName: unknown
): { firstName: string; lastName: string } | { error: string } => {
    const fn = String(firstName ?? '').trim();
    const ln = String(lastName ?? '').trim();
    if (!fn) return { error: 'Имя обязательно' };
    if (!ln) return { error: 'Фамилия обязательна' };
    return { firstName: fn, lastName: ln };
};
