'use client';

import { useState } from 'react';
import type { ScreenshotBlockData } from '@/lib/db-types';
import { ImageLightbox } from './image-lightbox';
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

export function ScreenshotBlockView({
    data,
    titleFontSize = '40',
    descriptionFontSize = '20',
    captionFontSize = '16',
    variant = 'default',
}: ScreenshotBlockViewProps) {
    const isEmbedded = variant === 'embedded';
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    const openLightbox = (index: number) => {
        setCurrentImageIndex(index);
        setLightboxOpen(true);
    };

    const goToPrev = () => {
        setCurrentImageIndex((prev) =>
            prev === 0 ? data.images.length - 1 : prev - 1
        );
    };

    const goToNext = () => {
        setCurrentImageIndex((prev) =>
            prev === data.images.length - 1 ? 0 : prev + 1
        );
    };

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
                <section className="space-y-8">
                    {hasTitle && (
                        <h2
                            className="report-rich-text font-semibold text-zinc-100 mb-8 tracking-tight"
                            style={{ fontSize: `${titleFontSize}px` }}
                            dangerouslySetInnerHTML={{ __html: data.title ?? '' }}
                        />
                    )}

                    {hasDescription && (
                        <div
                            className="report-rich-text text-zinc-300 whitespace-pre-wrap leading-relaxed"
                            style={{ fontSize: `${descriptionFontSize}px` }}
                            dangerouslySetInnerHTML={{ __html: data.description ?? '' }}
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

                {lightboxOpen && (
                    <ImageLightbox
                        images={data.images.map((img) => img.url)}
                        currentIndex={currentImageIndex}
                        onClose={() => setLightboxOpen(false)}
                        onPrev={goToPrev}
                        onNext={goToNext}
                    />
                )}
            </>
        );
    }

    // Full width layout
    if (layout === 'full-width' && data.images.length > 0) {
        return (
            <>
                <section className="space-y-8">
                    {hasTitle && (
                        <h2
                            className="report-rich-text font-semibold text-zinc-100 mb-8 tracking-tight"
                            style={{ fontSize: `${titleFontSize}px` }}
                            dangerouslySetInnerHTML={{ __html: data.title ?? '' }}
                        />
                    )}

                    {hasDescription && (
                        <div
                            className="report-rich-text text-zinc-300 whitespace-pre-wrap leading-relaxed"
                            style={{ fontSize: `${descriptionFontSize}px` }}
                            dangerouslySetInnerHTML={{ __html: data.description ?? '' }}
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

                {lightboxOpen && (
                    <ImageLightbox
                        images={data.images.map((img) => img.url)}
                        currentIndex={currentImageIndex}
                        onClose={() => setLightboxOpen(false)}
                        onPrev={goToPrev}
                        onNext={goToNext}
                    />
                )}
            </>
        );
    }

    // Sidebar layout - описание слева, фото справа
    if (layout === 'sidebar' && data.images.length > 0) {
        return (
            <>
                <section className="space-y-6">
                    {hasTitle && (
                        <h2
                            className="report-rich-text text-[20px] font-semibold text-white mb-8 tracking-tight"
                            dangerouslySetInnerHTML={{ __html: data.title ?? '' }}
                        />
                    )}

                    <div className="flex flex-col md:flex-row gap-8">
                        {hasDescription && (
                            <div className="md:w-[40%]">
                                <div
                                    className="report-rich-text text-[18px] text-zinc-300 whitespace-pre-wrap leading-relaxed"
                                    dangerouslySetInnerHTML={{ __html: data.description ?? '' }}
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

                {lightboxOpen && (
                    <ImageLightbox
                        images={data.images.map((img) => img.url)}
                        currentIndex={currentImageIndex}
                        onClose={() => setLightboxOpen(false)}
                        onPrev={goToPrev}
                        onNext={goToNext}
                    />
                )}
            </>
        );
    }

    // Sidebar reverse layout - фото слева, описание справа
    if (layout === 'sidebar-reverse' && data.images.length > 0) {
        return (
            <>
                <section className="space-y-6">
                    {hasTitle && (
                        <h2
                            className="report-rich-text text-[20px] font-semibold text-white mb-8 tracking-tight"
                            dangerouslySetInnerHTML={{ __html: data.title ?? '' }}
                        />
                    )}

                    <div className="flex flex-col md:flex-row gap-8">
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
                                <div
                                    className="report-rich-text text-[18px] text-zinc-300 whitespace-pre-wrap leading-relaxed"
                                    dangerouslySetInnerHTML={{ __html: data.description ?? '' }}
                                />
                            </div>
                        )}
                    </div>
                </section>

                {lightboxOpen && (
                    <ImageLightbox
                        images={data.images.map((img) => img.url)}
                        currentIndex={currentImageIndex}
                        onClose={() => setLightboxOpen(false)}
                        onPrev={goToPrev}
                        onNext={goToNext}
                    />
                )}
            </>
        );
    }

    // Default/Grid layout
    return (
        <section className="space-y-8">
            {hasTitle && (
                <h2
                    className="report-rich-text font-semibold text-zinc-100 mb-8 tracking-tight"
                    style={{ fontSize: `${titleFontSize}px` }}
                    dangerouslySetInnerHTML={{ __html: data.title ?? '' }}
                />
            )}

            {hasDescription && (
                <div
                    className="report-rich-text text-zinc-300 whitespace-pre-wrap leading-relaxed"
                    style={{ fontSize: `${descriptionFontSize}px` }}
                    dangerouslySetInnerHTML={{ __html: data.description ?? '' }}
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

                    {lightboxOpen && (
                        <ImageLightbox
                            images={data.images.map((img) => img.url)}
                            currentIndex={currentImageIndex}
                            onClose={() => setLightboxOpen(false)}
                            onPrev={goToPrev}
                            onNext={goToNext}
                        />
                    )}
                </>
            ) : null}
        </section>
    );
}
