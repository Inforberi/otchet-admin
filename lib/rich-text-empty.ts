import { isRichTextEmpty } from '@/lib/rich-text';

/** Проверка пустого rich-text HTML (без React, для API и серверных маршрутов). */
export const isEmptyRichHtml = isRichTextEmpty;
