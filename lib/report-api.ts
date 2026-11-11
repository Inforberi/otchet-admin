import { z } from 'zod';
import { sanitizeRichTextHtml } from '@/lib/rich-text-sanitize';

const richText = z.string().transform(sanitizeRichTextHtml);
const layout = z.enum(['full-width', 'sidebar', 'sidebar-reverse', 'two-column']);
const size = z.enum(['small', 'medium', 'large']);
const id = z.string().min(1).max(200);
export const versionSchema = z.number().int().positive();

export const imageDataSchema = z.object({
    url: z.string().min(1).refine(
        (value) => /^https?:\/\//i.test(value) || /^\/(?!\/)/.test(value),
        'Используйте http(s) URL или абсолютный путь /api/static/uploads/...'
    ),
    caption: z.string().optional(),
    alt: z.string().optional(),
    uploadId: id.optional(),
    mimeType: z.string().optional(),
    fit: z.enum(['auto-width', 'auto-height', 'vertical']).optional(),
    align: z.enum(['left', 'center', 'right']).optional(),
    center: z.boolean().optional(),
});

const parent = { parentId: id.nullable().optional() };
export const apiBlockSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('text'), ...parent, data: z.object({
        title: richText.default(''), content: richText,
    }) }),
    z.object({ type: z.literal('screenshot'), ...parent, data: z.object({
        title: richText.default(''), description: richText.optional(),
        images: z.array(imageDataSchema), layout: layout.optional(),
        imageSize: size.optional(), customWidth: z.string().optional(), spacing: size.optional(),
    }) }),
    z.object({ type: z.literal('divider'), ...parent, data: z.object({}).strict() }),
    z.object({ type: z.literal('section'), ...parent, data: z.object({
        title: richText.default(''), collapsed: z.boolean().optional(),
        sidebarCollapsed: z.boolean().optional(), editorCollapsed: z.boolean().optional(),
    }) }),
    z.object({ type: z.literal('task'), ...parent, data: z.object({
        title: richText.default(''), description: richText.default(''),
        images: z.array(imageDataSchema).default([]), layout: layout.optional(),
        titleFontSize: z.string().nullable().optional(),
        descriptionFontSize: z.string().nullable().optional(),
        createdAt: z.string().datetime({ offset: true }).default(() => new Date().toISOString()),
        startDate: z.string().nullable().default(null),
        deadline: z.string().nullable().default(null),
        assignees: z.array(z.object({
            kind: z.enum(['user', 'person']), id,
            firstName: z.string(), lastName: z.string(),
        })).default([]),
        assigneeId: z.string().nullable().optional(),
        assigneeName: z.string().nullable().optional(),
    }) }),
]);

// position в старом одиночном запросе сохраняем для совместимости;
// при добавлении сервер всегда ставит блоки в конец.
export const appendBlocksSchema = z.union([
    z.object({ expectedReportVersion: versionSchema, blocks: z.array(apiBlockSchema).min(1).max(100) }),
    z.object({ expectedReportVersion: versionSchema, position: z.number().int().nonnegative().optional() })
        .and(apiBlockSchema),
]);

export const createReportSchema = z.object({
    title: z.string().trim().min(1).transform(sanitizeRichTextHtml)
        .refine((value) => value.replace(/<[^>]*>/g, '').trim().length > 0, 'Укажите название'),
    subtitle: richText.optional(), client: z.string().optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
        const parsed = new Date(`${value}T00:00:00Z`);
        return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
    }, 'Некорректная дата').optional(),
    status: z.enum(['draft', 'published']).optional(), groupId: id,
});

/** Входные типы: type определяет допустимое содержимое data. */
export type ApiBlockInput = z.input<typeof apiBlockSchema>;
export type ApiBlock = z.output<typeof apiBlockSchema>;
export type AppendBlocksInput = z.input<typeof appendBlocksSchema>;
export type CreateReportApiInput = z.input<typeof createReportSchema>;
