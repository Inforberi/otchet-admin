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
}

export function ScreenshotBlockView({ 
    data, 
    titleFontSize = '40', 
    descriptionFontSize = '20',
    captionFontSize = '16'
}: ScreenshotBlockViewProps) {
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

    // Не показываем блок, если нет ни заголовка, ни описания, ни изображений
    if (
        !data.title &&
        !data.description &&
        (!data.images || data.images.length === 0)
    ) {
        return null;
    }

    // Поддержка 2 фото рядом
    if (layout === 'two-column' && data.images.length > 0) {
        return (
            <>
                <section className="space-y-8">
                    {data.title && (
                        <h2
                            className="font-semibold text-zinc-100 mb-8 tracking-tight"
                            style={{ fontSize: `${titleFontSize}px` }}
                        >
                            {data.title}
                        </h2>
                    )}

                    {data.description && (
                        <div
                            className="text-zinc-300 whitespace-pre-wrap leading-relaxed"
                            style={{ fontSize: `${descriptionFontSize}px` }}
                            dangerouslySetInnerHTML={{ __html: data.description }}
                        />
                    )}

                    <div
                        className={`grid grid-cols-1 md:grid-cols-2 ${spacingClasses[spacing]}`}
                    >
                        {data.images.map((img, index) => (
                            <div key={index} className="space-y-2">
                                <button
                                    onClick={() => openLightbox(index)}
                                    className="group relative w-full overflow-hidden rounded-lg border border-zinc-700 bg-white shadow-lg transition-all hover:border-blue-500 hover:shadow-xl"
                                >
                                    <img
                                        src={img.url}
                                        alt={
                                            img.alt ||
                                            `${data.title} - изображение ${
                                                index + 1
                                            }`
                                        }
                                        className="h-auto w-full object-contain"
                                    />
                                    <div className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/5" />
                                </button>
                                {img.caption && (
                                    <p
                                        className="text-zinc-400 font-medium mt-3"
                                        style={{ fontSize: `${captionFontSize}px` }}
                                    >
                                        {img.caption}
                                    </p>
                                )}
                            </div>
                        ))}
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
                    {data.title && (
                        <h2
                            className="font-semibold text-zinc-100 mb-8 tracking-tight"
                            style={{ fontSize: `${titleFontSize}px` }}
                        >
                            {data.title}
                        </h2>
                    )}

                    {data.description && (
                        <div
                            className="text-zinc-300 whitespace-pre-wrap leading-relaxed"
                            style={{ fontSize: `${descriptionFontSize}px` }}
                            dangerouslySetInnerHTML={{ __html: data.description }}
                        />
                    )}

                    <div
                        className={`grid ${spacingClasses[spacing]} ${
                            customWidth ? '' : 'grid-cols-1'
                        }`}
                        style={
                            customWidth
                                ? { width: customWidth, margin: '0 auto' }
                                : undefined
                        }
                    >
                        {data.images.map((img, index) => (
                            <div key={index} className="space-y-2">
                                <button
                                    onClick={() => openLightbox(index)}
                                    className="group relative w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-50 transition-all hover:border-blue-500"
                                >
                                    <img
                                        src={img.url}
                                        alt={
                                            img.alt ||
                                            `${data.title} - изображение ${
                                                index + 1
                                            }`
                                        }
                                        className="h-auto w-full object-contain"
                                    />
                                    <div className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/10" />
                                </button>
                                {img.caption && (
                                    <p className="text-sm text-center text-gray-300 font-medium mt-3">
                                        {img.caption}
                                    </p>
                                )}
                            </div>
                        ))}
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
                    {data.title && (
                        <h2 className="text-[20px] font-semibold text-white mb-8 tracking-tight">
                            {data.title}
                        </h2>
                    )}

                    <div className="flex flex-col md:flex-row gap-8">
                        <div className="md:w-[40%]">
                            {data.description && (
                                <div 
                                    className="text-[18px] text-zinc-300 whitespace-pre-wrap leading-relaxed"
                                    dangerouslySetInnerHTML={{ __html: data.description }}
                                />
                            )}
                        </div>

                        <div
                            className={`md:w-[60%] space-y-3 ${spacingClasses[spacing]}`}
                            style={
                                customWidth ? { width: customWidth } : undefined
                            }
                        >
                            {data.images.map((img, index) => (
                                <div key={index} className="space-y-2">
                                    <button
                                        onClick={() => openLightbox(index)}
                                        className="group relative w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-50 transition-all hover:border-blue-500"
                                    >
                                        <img
                                            src={img.url}
                                            alt={
                                                img.alt ||
                                                `${data.title} - изображение ${
                                                    index + 1
                                                }`
                                            }
                                            className="h-auto w-full object-contain"
                                        />
                                        <div className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/10" />
                                    </button>
                                    {img.caption && (
                                        <p className="text-sm text-gray-300 font-medium mt-3">
                                            {img.caption}
                                        </p>
                                    )}
                                </div>
                            ))}
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
                    {data.title && (
                        <h2 className="text-[20px] font-semibold text-white mb-8 tracking-tight">
                            {data.title}
                        </h2>
                    )}

                    <div className="flex flex-col md:flex-row gap-8">
                        <div
                            className={`md:w-[60%] space-y-4 ${spacingClasses[spacing]}`}
                            style={
                                customWidth ? { width: customWidth } : undefined
                            }
                        >
                            {data.images.map((img, index) => (
                                <div key={index} className="space-y-2">
                                    <button
                                        onClick={() => openLightbox(index)}
                                        className="group relative w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-50 transition-all hover:border-blue-500"
                                    >
                                        <img
                                            src={img.url}
                                            alt={
                                                img.alt ||
                                                `${data.title} - изображение ${
                                                    index + 1
                                                }`
                                            }
                                            className="h-auto w-full object-contain"
                                        />
                                        <div className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/10" />
                                    </button>
                                    {img.caption && (
                                        <p className="text-sm text-gray-300 font-medium mt-3">
                                            {img.caption}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="md:w-[40%]">
                            {data.description && (
                                <div 
                                    className="text-[18px] text-zinc-300 whitespace-pre-wrap leading-relaxed"
                                    dangerouslySetInnerHTML={{ __html: data.description }}
                                />
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

    // Default/Grid layout
    return (
        <section className="space-y-8">
            {data.title && (
                <h2
                    className="font-semibold text-zinc-100 mb-8 tracking-tight"
                    style={{ fontSize: `${titleFontSize}px` }}
                >
                    {data.title}
                </h2>
            )}

            {data.description && (
                <p
                    className="text-zinc-300 whitespace-pre-wrap leading-relaxed"
                    style={{ fontSize: `${descriptionFontSize}px` }}
                >
                    {data.description}
                </p>
            )}

            {data.images.length > 0 ? (
                <>
                    <div
                        className={`grid ${spacingClasses[spacing]} ${
                            customWidth ? '' : sizeClasses[imageSize]
                        }`}
                        style={
                            customWidth
                                ? { width: customWidth, margin: '0 auto' }
                                : undefined
                        }
                    >
                        {data.images.map((img, index) => (
                            <div key={index} className="space-y-2">
                                <button
                                    onClick={() => openLightbox(index)}
                                    className="group relative w-full overflow-hidden rounded-lg border border-zinc-700 bg-white shadow-lg transition-all hover:border-blue-500 hover:shadow-xl"
                                >
                                    <img
                                        src={img.url}
                                        alt={
                                            img.alt ||
                                            `${data.title} - изображение ${
                                                index + 1
                                            }`
                                        }
                                        className="h-auto w-full object-contain"
                                    />
                                    <div className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/5" />
                                </button>
                                {img.caption && (
                                    <p
                                        className="text-zinc-400 font-medium mt-3"
                                        style={{ fontSize: `${captionFontSize}px` }}
                                    >
                                        {img.caption}
                                    </p>
                                )}
                            </div>
                        ))}
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
