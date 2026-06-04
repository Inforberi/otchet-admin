import type {
    ReportBlockFromDB,
    ScreenshotBlockData,
    SectionBlockData,
    TaskBlockData,
    TextBlockData,
} from '@/lib/db-types';
import { canonicalRichTextValue } from '@/lib/rich-text';
import { normalizeTaskAssignees } from '@/lib/task-assignees';

const richInlineEqual = (
    a: string | null | undefined,
    b: string | null | undefined
): boolean =>
    canonicalRichTextValue(a, 'inline') === canonicalRichTextValue(b, 'inline');

const richBlockEqual = (
    a: string | null | undefined,
    b: string | null | undefined
): boolean =>
    canonicalRichTextValue(a, 'block') === canonicalRichTextValue(b, 'block');

export const taskBlockDataSemanticallyEqual = (
    a: TaskBlockData,
    b: TaskBlockData
): boolean => {
    if (!richInlineEqual(a.title, b.title)) return false;
    if (!richBlockEqual(a.description, b.description)) return false;

    const assigneesA = normalizeTaskAssignees(a);
    const assigneesB = normalizeTaskAssignees(b);
    if (JSON.stringify(assigneesA) !== JSON.stringify(assigneesB)) return false;

    const {
        title: _at,
        description: _ad,
        assignees: _aa,
        assigneeId: _aid,
        assigneeName: _an,
        ...restA
    } = a;
    const {
        title: _bt,
        description: _bd,
        assignees: _ba,
        assigneeId: _bid,
        assigneeName: _bn,
        ...restB
    } = b;

    return JSON.stringify(restA) === JSON.stringify(restB);
};

export const reportBlockDataSemanticallyEqual = (
    type: ReportBlockFromDB['type'],
    prevData: ReportBlockFromDB['data'],
    nextData: ReportBlockFromDB['data']
): boolean => {
    if (type === 'text') {
        const prev = prevData as TextBlockData;
        const next = nextData as TextBlockData;
        return (
            richInlineEqual(prev.title, next.title) &&
            richBlockEqual(prev.content, next.content)
        );
    }

    if (type === 'screenshot') {
        const prev = prevData as ScreenshotBlockData;
        const next = nextData as ScreenshotBlockData;
        if (!richInlineEqual(prev.title, next.title)) return false;
        if (!richBlockEqual(prev.description, next.description)) return false;

        const { title: _pt, description: _pd, ...restP } = prev;
        const { title: _nt, description: _nd, ...restN } = next;

        return JSON.stringify(restP) === JSON.stringify(restN);
    }

    if (type === 'task') {
        return taskBlockDataSemanticallyEqual(
            prevData as TaskBlockData,
            nextData as TaskBlockData
        );
    }

    if (type === 'section') {
        const prev = prevData as SectionBlockData;
        const next = nextData as SectionBlockData;
        if (!richInlineEqual(prev.title, next.title)) return false;

        const { title: _pt, ...restP } = prev;
        const { title: _nt, ...restN } = next;

        return JSON.stringify(restP) === JSON.stringify(restN);
    }

    return JSON.stringify(prevData) === JSON.stringify(nextData);
};

const completionTimeEqual = (
    a: Date | string | null | undefined,
    b: Date | string | null | undefined
): boolean => String(a ?? '') === String(b ?? '');

export const reportBlocksSemanticallyEqual = (
    prev: ReportBlockFromDB,
    next: ReportBlockFromDB
): boolean => {
    if (prev.id !== next.id || prev.type !== next.type) return false;
    if (
        !reportBlockDataSemanticallyEqual(prev.type, prev.data, next.data)
    ) {
        return false;
    }

    if (prev.type !== 'task') return true;

    return (
        completionTimeEqual(prev.taskCompletedAt, next.taskCompletedAt) &&
        prev.taskCompletedByUserId === next.taskCompletedByUserId &&
        richBlockEqual(prev.taskCompletionNotes, next.taskCompletionNotes) &&
        prev.taskCompletionLayout === next.taskCompletionLayout &&
        JSON.stringify(prev.taskCompletionImages ?? null) ===
            JSON.stringify(next.taskCompletionImages ?? null)
    );
};
