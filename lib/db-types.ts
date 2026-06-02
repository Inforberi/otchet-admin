// Типы для работы с БД (более расширенная версия)

export interface ReportMeta {
    title: string;
    subtitle?: string;
    client?: string;
    date?: string;
}

// Базовые блоки
export interface BaseBlockData {
    title: string;
}

// Данные текстового блока в БД (в поле data)
export interface TextBlockData extends BaseBlockData {
    content: string; // обычный текст
}

// Данные для одного изображения
export interface ImageData {
    url: string; // путь к файлу на сервере (не base64!)
    caption?: string; // подпись под изображением
    alt?: string; // alt текст
    uploadId?: string; // ID записи в таблице uploads (для удаления)
    /** auto-width: ширина 100%, высота auto; auto-height: высота по контейнеру, ширина auto; vertical: @deprecated используйте auto-height */
    fit?: 'auto-width' | 'auto-height' | 'vertical';
    /** Выравнивание (для auto-height): по левому краю, по центру, по правому краю */
    align?: 'left' | 'center' | 'right';
    /** @deprecated используйте align; true → center */
    center?: boolean;
}

// Данные скриншот-блока в БД
export interface ScreenshotBlockData extends BaseBlockData {
    description?: string;
    images: ImageData[];
    layout?: 'full-width' | 'sidebar' | 'sidebar-reverse' | 'two-column'; // добавили sidebar-reverse и two-column
    imageSize?: 'small' | 'medium' | 'large';
    customWidth?: string;
    spacing?: 'small' | 'medium' | 'large'; // отступы между изображениями
}

// Данные блока-разделителя (пустой объект)
export interface DividerBlockData {
    [key: string]: never;
}

// Тип блока из БД (с id, type, position)
export interface ReportBlockFromDB {
    id: string;
    reportId: string;
    type: 'text' | 'screenshot' | 'divider';
    position: number;
    version: number;
    data: TextBlockData | ScreenshotBlockData | DividerBlockData;
    createdAt: Date;
    updatedAt: Date;
}

// Отчет из БД
export interface ReportFromDB {
    id: string;
    title: string;
    subtitle?: string | null;
    client?: string | null;
    date?: string | null;
    status: string;
    groupId: string; // ID группы отчетов
    /** URL-friendly имя (уникален в рамках группы), приходит с API */
    slug?: string | null;
    titleFontSize?: string | null; // размер шрифта заголовка в px (по умолчанию 40px)
    descriptionFontSize?: string | null; // размер шрифта описания в px (по умолчанию 20px)
    captionFontSize?: string | null; // размер шрифта подписи к изображениям в px (по умолчанию 16px)
    version: number;
    createdAt: Date;
    updatedAt: Date;
    group?: {
        id: string;
        name: string;
        path: string;
    } | null;
    blocks?: ReportBlockFromDB[];
}

// Типы для создания/обновления
export interface CreateReportInput {
    title: string;
    subtitle?: string;
    client?: string;
    date?: string;
    status?: string;
    groupId: string; // ID группы отчетов
}

export interface UpdateReportInput extends Partial<CreateReportInput> {
    id: string;
    titleFontSize?: string | null;
    descriptionFontSize?: string | null;
    captionFontSize?: string | null;
    expectedVersion?: number;
}

export interface CreateBlockInput {
    reportId: string;
    type: 'text' | 'screenshot' | 'divider';
    position: number;
    data: TextBlockData | ScreenshotBlockData | DividerBlockData;
}

export interface UpdateBlockInput {
    id: string;
    data?: TextBlockData | ScreenshotBlockData | DividerBlockData;
    position?: number;
    expectedReportVersion?: number;
}
