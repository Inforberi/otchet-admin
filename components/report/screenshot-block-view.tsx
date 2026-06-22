'use client';

import { useState } from 'react';
import type { ScreenshotBlockData } from '@/lib/db-types';
import { getAttachmentLabel, isImageData } from '@/lib/db-types';
import { ImageLightbox } from './image-lightbox';
import { RichTextView } from './rich-text-view';
import { ImageOff } from 'lucide-react';

interface ScreenshotBlockViewProps {
    data: ScreenshotBlockData;
    titleFontSize?: string;
    descriptionFontSize?: string;
    captionFontSize?: string;
    /** Ограничивает превью внутри карточки задачи; полный размер — в lightbox */
    variant?: 'default' | 'embedded';
}

// Функция для проверки, является ли HTML строка пустой
function isEmptyHtml(html: string | null | undefined): boolean {
    if (!html) return true;
    // Удаляем HTML теги и проверяем, осталось ли что-то кроме пробелов
    const textContent = html.replace(/<[^>]*>/g, '').trim();
    return textContent.length === 0;
}

// Функция для проверки, является ли обычная строка пустой
function isEmpty(str: string | null | undefined): boolean {
    if (!str) return true;
    return str.trim().length === 0;
}

const EMBEDDED_IMG_MAX_CLASS = 'max-h-[min(480px,70vh)]';

const getViewLayoutClasses = (isEmbedded: boolean) => ({
    section: isEmbedded ? 'space-y-3' : 'space-y-8',
    sectionSidebar: isEmbedded ? 'space-y-3' : 'space-y-6',
    title: isEmbedded
        ? 'font-semibold text-zinc-100 tracking-tight'
        : 'font-semibold text-zinc-100 mb-8 tracking-tight',
    titleSidebar: isEmbedded
        ? 'font-semibold text-zinc-100 tracking-tight'
        : 'text-[20px] font-semibold text-white mb-8 tracking-tight',
    description:
        'text-zinc-300 leading-relaxed [&_p]:whitespace-pre-wrap [&_li]:whitespace-pre-wrap',
    descriptionSidebar: isEmbedded
        ? 'text-zinc-300 leading-relaxed [&_p]:whitespace-pre-wrap [&_li]:whitespace-pre-wrap'
        : 'text-[18px] text-zinc-300 leading-relaxed [&_p]:whitespace-pre-wrap [&_li]:whitespace-pre-wrap',
    sidebarGap: isEmbedded ? 'gap-4' : 'gap-8',
});

export function ScreenshotBlockView({
    data,
    titleFontSize = '40',
    descriptionFontSize = '20',
    captionFontSize = '16',
    variant = 'default',
}: ScreenshotBlockViewProps) {
    const isEmbedded = variant === 'embedded';
    const layoutClasses = getViewLayoutClasses(isEmbedded);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const lightboxImages = data.images.filter(isImageData);

    const openLightbox = (index: number) => {
        const img = data.images[index];
        if (!isImageData(img)) return;
        const lightboxIndex = data.images
            .slice(0, index + 1)
            .filter(isImageData).length - 1;
        setCurrentImageIndex(lightboxIndex);
        setLightboxOpen(true);
    };

    const goToPrev = () => {
        setCurrentImageIndex((prev) =>
            prev === 0 ? lightboxImages.length - 1 : prev - 1
        );
    };

    const goToNext = () => {
        setCurrentImageIndex((prev) =>
            prev === lightboxImages.length - 1 ? 0 : prev + 1
        );
    };

    const lightboxProps = {
        images: lightboxImages.map((img) => img.url),
        captions: lightboxImages.map((img) => img.caption),
        currentIndex: currentImageIndex,
        onClose: () => setLightboxOpen(false),
        onPrev: goToPrev,
        onNext: goToNext,
    };

    const renderLightbox = () =>
        lightboxOpen ? <ImageLightbox {...lightboxProps} /> : null;

    const layout = data.layout || 'full-width';
    const imageSize = data.imageSize || 'medium';
    const customWidth = data.customWidth;
    const spacing = data.spacing || 'medium';

    const spacingClasses = {
        small: 'gap-2',
        medium: 'gap-4',
        large: 'gap-6',
    };

    const sizeClasses = {
        small: 'sm:grid-cols-4 lg:grid-cols-6',
        medium: 'sm:grid-cols-2 lg:grid-cols-3',
        large: 'sm:grid-cols-1 lg:grid-cols-2',
    };

    const autoHeightMaxPx = { small: 240, medium: 400, large: 560 }[imageSize];

    const embeddedMaxPx = 480;

    const renderImg = (img: (typeof data.images)[0], index: number, title: string, layoutClass: string, captionClass?: string) => {
        if (!isImageData(img)) {
            return (
                <div key={index} className="space-y-2">
                    <a
                        href={img.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/60 px-4 py-3 text-sm text-blue-400 hover:bg-zinc-800"
                    >
                        {getAttachmentLabel(img)}
                    </a>
                    {!isEmpty(img.caption) && (
                        <p className={`font-medium mt-3 ${captionClass ?? 'text-zinc-400'}`} style={{ fontSize: `${captionFontSize}px` }}>
                            {img.caption}
                        </p>
                    )}
                </div>
            );
        }

        const isAutoHeight = img.fit === 'auto-height' || img.fit === 'vertical';
        const align = img.align ?? (img.center ? 'center' : 'left');
        const justify = align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start';
        const ringClass = isEmbedded
            ? 'ring-2 ring-transparent ring-inset group-hover:ring-blue-500 group-focus-visible:ring-blue-500'
            : 'ring-2 ring-transparent ring-offset-2 ring-offset-zinc-950 group-hover:ring-blue-500 group-focus-visible:ring-blue-500';
        const maxHeightPx = isEmbedded
            ? embeddedMaxPx
            : isAutoHeight
              ? autoHeightMaxPx
              : undefined;
        return (
            <div key={index} className="space-y-2">
                <div
                    className={`${layoutClass}${isAutoHeight ? ` min-h-[120px] flex ${justify} items-center` : ''} ${isEmbedded ? 'max-w-full overflow-hidden' : ''}`}
                >
                    <button
                        type="button"
                        onClick={() => openLightbox(index)}
                        className={`group block cursor-pointer rounded-lg bg-transparent transition-all focus:outline-none focus-visible:outline-none ${isAutoHeight ? 'w-fit max-w-full' : 'w-full'} ${isEmbedded ? 'max-w-full' : ''}`}
                    >
                        <span
                            className={`relative block overflow-hidden rounded-lg transition-all ${ringClass} ${isAutoHeight ? 'w-fit max-w-full' : 'w-full'}`}
                        >
                            <img
                                src={img.url}
                                alt={img.alt || `${title} - изображение ${index + 1}`}
                                className={`block object-contain ${isAutoHeight ? 'h-auto w-auto' : 'h-auto w-full'} ${isEmbedded ? EMBEDDED_IMG_MAX_CLASS : ''}`}
                                style={maxHeightPx !== undefined ? { maxHeight: maxHeightPx } : undefined}
                            />
                        </span>
                    </button>
                </div>
                {!isEmpty(img.caption) && (
                    <p className={`font-medium mt-3 ${captionClass ?? 'text-zinc-400'}`} style={{ fontSize: `${captionFontSize}px` }}>
                        {img.caption}
                    </p>
                )}
            </div>
        );
    };

    const layoutClass = 'w-full';

    // Не показываем блок, если нет ни заголовка, ни описания, ни изображений
    const hasTitle = !isEmptyHtml(data.title);
    const hasDescription = !isEmptyHtml(data.description);
    const hasImages = data.images && data.images.length > 0;

    if (!hasTitle && !hasDescription && !hasImages) {
        return null;
    }

    // Поддержка 2 фото рядом
    if (layout === 'two-column' && data.images.length > 0) {
        return (
            <>
                <section className={layoutClasses.section}>
                    {hasTitle && (
                        <RichTextView
                            as="h2"
                            html={data.title}
                            className={layoutClasses.title}
                            style={{ fontSize: `${titleFontSize}px` }}
                        />
                    )}

                    {hasDescription && (
                        <RichTextView
                            html={data.description}
                            className={layoutClasses.description}
                            style={{ fontSize: `${descriptionFontSize}px` }}
                        />
                    )}

                    <div
                        className={`grid grid-cols-1 md:grid-cols-2 ${spacingClasses[spacing]}`}
                    >
                        {data.images.map((img, index) =>
                            renderImg(img, index, data.title ?? '', layoutClass, 'text-zinc-400')
                        )}
                    </div>
                </section>

                {renderLightbox()}
            </>
        );
    }

    // Full width layout
    if (layout === 'full-width' && data.images.length > 0) {
        return (
            <>
                <section className={layoutClasses.section}>
                    {hasTitle && (
                        <RichTextView
                            as="h2"
                            html={data.title}
                            className={layoutClasses.title}
                            style={{ fontSize: `${titleFontSize}px` }}
                        />
                    )}

                    {hasDescription && (
                        <RichTextView
                            html={data.description}
                            className={layoutClasses.description}
                            style={{ fontSize: `${descriptionFontSize}px` }}
                        />
                    )}

                    <div
                        className={`grid ${spacingClasses[spacing]} ${customWidth ? '' : 'grid-cols-1'
                            }`}
                        style={
                            customWidth
                                ? { width: customWidth, margin: '0 auto' }
                                : undefined
                        }
                    >
                        {data.images.map((img, index) =>
                            renderImg(img, index, data.title ?? '', layoutClass, 'text-sm text-center text-gray-300')
                        )}
                    </div>
                </section>

                {renderLightbox()}
            </>
        );
    }

    // Sidebar layout - описание слева, фото справа
    if (layout === 'sidebar' && data.images.length > 0) {
        return (
            <>
                <section className={layoutClasses.sectionSidebar}>
                    {hasTitle && (
                        <RichTextView
                            as="h2"
                            html={data.title}
                            className={layoutClasses.titleSidebar}
                            style={isEmbedded ? { fontSize: `${titleFontSize}px` } : undefined}
                        />
                    )}

                    <div className={`flex flex-col md:flex-row ${layoutClasses.sidebarGap}`}>
                        {hasDescription && (
                            <div className="md:w-[40%]">
                                <RichTextView
                                    html={data.description}
                                    className={layoutClasses.descriptionSidebar}
                                    style={
                                        isEmbedded
                                            ? { fontSize: `${descriptionFontSize}px` }
                                            : undefined
                                    }
                                />
                            </div>
                        )}

                        <div
                            className={`${hasDescription ? 'md:w-[60%]' : 'md:w-full'} space-y-3 ${spacingClasses[spacing]}`}
                            style={
                                customWidth ? { width: customWidth } : undefined
                            }
                        >
                            {data.images.map((img, index) =>
                                renderImg(img, index, data.title ?? '', layoutClass, 'text-sm text-gray-300')
                            )}
                        </div>
                    </div>
                </section>

                {renderLightbox()}
            </>
        );
    }

    // Sidebar reverse layout - фото слева, описание справа
    if (layout === 'sidebar-reverse' && data.images.length > 0) {
        return (
            <>
                <section className={layoutClasses.sectionSidebar}>
                    {hasTitle && (
                        <RichTextView
                            as="h2"
                            html={data.title}
                            className={layoutClasses.titleSidebar}
                            style={isEmbedded ? { fontSize: `${titleFontSize}px` } : undefined}
                        />
                    )}

                    <div className={`flex flex-col md:flex-row ${layoutClasses.sidebarGap}`}>
                        <div
                            className={`${hasDescription ? 'md:w-[60%]' : 'md:w-full'} space-y-4 ${spacingClasses[spacing]}`}
                            style={
                                customWidth ? { width: customWidth } : undefined
                            }
                        >
                            {data.images.map((img, index) =>
                                renderImg(img, index, data.title ?? '', layoutClass, 'text-sm text-gray-300')
                            )}
                        </div>

                        {hasDescription && (
                            <div className="md:w-[40%]">
                                <RichTextView
                                    html={data.description}
                                    className={layoutClasses.descriptionSidebar}
                                    style={
                                        isEmbedded
                                            ? { fontSize: `${descriptionFontSize}px` }
                                            : undefined
                                    }
                                />
                            </div>
                        )}
                    </div>
                </section>

                {renderLightbox()}
            </>
        );
    }

    // Default/Grid layout
    return (
        <section className={layoutClasses.section}>
            {hasTitle && (
                <RichTextView
                    as="h2"
                    html={data.title}
                    className={layoutClasses.title}
                    style={{ fontSize: `${titleFontSize}px` }}
                />
            )}

            {hasDescription && (
                <RichTextView
                    html={data.description}
                    className={layoutClasses.description}
                    style={{ fontSize: `${descriptionFontSize}px` }}
                />
            )}

            {data.images.length > 0 ? (
                <>
                    <div
                        className={`grid ${spacingClasses[spacing]} ${customWidth ? '' : sizeClasses[imageSize]
                            }`}
                        style={
                            customWidth
                                ? { width: customWidth, margin: '0 auto' }
                                : undefined
                        }
                    >
                        {data.images.map((img, index) =>
                            renderImg(img, index, data.title ?? '', layoutClass, 'text-zinc-400')
                        )}
                    </div>

                    {renderLightbox()}
                </>
            ) : null}
        </section>
    );
}
