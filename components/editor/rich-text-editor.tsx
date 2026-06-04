'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import HardBreak from '@tiptap/extension-hard-break';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import TextAlign from '@tiptap/extension-text-align';
import { Extension } from '@tiptap/core';
import Link from '@tiptap/extension-link';
import { Bold, Italic, Palette, AlignCenter, Link2, Unlink } from 'lucide-react';
import {
    extractFontSizeFromHtml,
    normalizeRichTextHtml,
    plainTextToRichTextHtml,
} from '@/lib/rich-text';

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        fontSize: {
            setFontSize: (fontSize: string) => ReturnType;
            unsetFontSize: () => ReturnType;
        };
    }
}

const RECENT_COLORS_KEY = 'formattedTextEditor_recentColors';
const DEFAULT_COLOR = '#ffffff';

const normalizeOutput = (
    html: string,
    mode: 'inline' | 'block'
): string => {
    const normalized = normalizeRichTextHtml(html);
    if (!normalized || mode === 'block') return normalized;

    return normalized
        .replace(/^<p>/i, '')
        .replace(/<\/p>$/i, '')
        .replace(/<\/p>\s*<p>/gi, '<br>');
};

const FontSize = Extension.create({
    name: 'fontSize',

    addOptions() {
        return {
            types: ['textStyle'],
        };
    },

    addGlobalAttributes() {
        return [
            {
                types: this.options.types,
                attributes: {
                    fontSize: {
                        default: null,
                        parseHTML: (element: HTMLElement) =>
                            element.style.fontSize || null,
                        renderHTML: (attributes: { fontSize?: string | null }) =>
                            attributes.fontSize
                                ? { style: `font-size: ${attributes.fontSize}` }
                                : {},
                    },
                },
            },
        ];
    },

    addCommands() {
        return {
            setFontSize:
                (fontSize: string) =>
                ({ chain }) =>
                    chain()
                        .setMark('textStyle', {
                            fontSize: fontSize.endsWith('px')
                                ? fontSize
                                : `${fontSize}px`,
                        })
                        .run(),
            unsetFontSize:
                () =>
                ({ chain }) =>
                    chain()
                        .setMark('textStyle', { fontSize: null })
                        .removeEmptyTextStyle()
                        .run(),
        };
    },
});

const getRecentColors = (): string[] => {
    if (typeof window === 'undefined') return [];

    try {
        const stored = window.localStorage.getItem(RECENT_COLORS_KEY);
        return stored ? (JSON.parse(stored) as string[]) : [];
    } catch {
        return [];
    }
};

const saveRecentColor = (color: string): void => {
    if (typeof window === 'undefined') return;

    try {
        const recent = getRecentColors();
        const updated = [color, ...recent.filter((item) => item !== color)].slice(
            0,
            8
        );

        window.localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify(updated));
    } catch {
        // ignore
    }
};

const siteColors = [
    { name: 'Primary', value: '#3b82f6' },
    { name: 'Grayscale-2', value: '#f5f5f5' },
    { name: 'Grayscale-3', value: '#e8e8e8' },
    { name: 'Grayscale-4', value: '#d4d4d4' },
    { name: 'Grayscale-5', value: '#a3a3a3' },
    { name: 'Grayscale-6', value: '#737373' },
    { name: 'Белый', value: '#ffffff' },
] as const;

type RichTextEditorProps = {
    editorId: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    minHeight?: string;
    defaultFontSize?: string;
    /** Сохранённый размер блока (px), отображается в toolbar если нет mark в HTML */
    fontSize?: string;
    onFontSizeChange?: (px: string) => void;
    mode?: 'inline' | 'block';
};

const resolveToolbarFontSize = (
    editor: NonNullable<ReturnType<typeof useEditor>>,
    html: string,
    storedFontSize?: string,
    defaultFontSize = '20'
): string => {
    const fromMark = (
        editor.getAttributes('textStyle').fontSize as string | undefined
    )?.replace('px', '');
    if (fromMark) return fromMark;

    const fromHtml = extractFontSizeFromHtml(html);
    if (fromHtml) return fromHtml;

    if (storedFontSize) return storedFontSize.replace(/px$/i, '');

    return defaultFontSize;
};

const getEditorExtensions = (mode: 'inline' | 'block') => {
    const base = [
        StarterKit.configure({
            hardBreak: false,
            heading: mode === 'block' ? { levels: [1, 2, 3] } : false,
            bulletList: mode === 'block' ? {} : false,
            orderedList: mode === 'block' ? {} : false,
            blockquote: mode === 'block' ? {} : false,
        }),
        Placeholder.configure({
            placeholder: '',
            emptyEditorClass: 'is-editor-empty',
        }),
        HardBreak.configure({
            keepMarks: true,
        }),
        TextStyle,
        Color,
        FontSize,
        TextAlign.configure({
            types: mode === 'block' ? ['heading', 'paragraph'] : ['paragraph'],
            alignments: ['left', 'center', 'right'],
        }),
    ];

    if (mode === 'block') {
        return [
            ...base,
            Link.configure({
                openOnClick: false,
                autolink: true,
                linkOnPaste: true,
                HTMLAttributes: {
                    target: '_blank',
                    rel: 'noopener noreferrer',
                    class: 'text-blue-400 underline',
                },
            }),
        ];
    }

    return base;
};

const syncToolbarState = (
    editor: NonNullable<ReturnType<typeof useEditor>>,
    html: string,
    storedFontSize?: string,
    defaultFontSize = '20'
) => ({
    isBold: editor.isActive('bold'),
    isItalic: editor.isActive('italic'),
    isCentered: editor.isActive({ textAlign: 'center' }),
    color:
        (editor.getAttributes('textStyle').color as string | undefined) ||
        DEFAULT_COLOR,
    fontSize: resolveToolbarFontSize(
        editor,
        html,
        storedFontSize,
        defaultFontSize
    ),
    linkHref: (editor.getAttributes('link').href as string | undefined) ?? '',
});

export default function RichTextEditor({
    editorId,
    value,
    onChange,
    placeholder,
    minHeight = '200px',
    defaultFontSize = '20',
    fontSize: storedFontSize,
    onFontSizeChange,
    mode = 'block',
}: RichTextEditorProps) {
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [showLinkEditor, setShowLinkEditor] = useState(false);
    const [linkUrl, setLinkUrl] = useState('');
    const linkEditorRef = useRef<HTMLDivElement>(null);
    const [customColor, setCustomColor] = useState(DEFAULT_COLOR);
    const [recentColors, setRecentColors] = useState<string[]>([]);
    const [toolbarState, setToolbarState] = useState({
        isBold: false,
        isItalic: false,
        isCentered: false,
        color: DEFAULT_COLOR,
        fontSize: '',
        linkHref: '',
    });
    const colorPickerRef = useRef<HTMLDivElement>(null);
    const emitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const normalizedValue = useMemo(
        () => normalizeRichTextHtml(value),
        [value]
    );

    const editor = useEditor(
        {
            immediatelyRender: false,
            extensions: getEditorExtensions(mode).map((extension) =>
                extension.name === 'placeholder'
                    ? extension.configure({ placeholder: placeholder || '' })
                    : extension
            ),
            content: normalizedValue,
            editorProps: {
                attributes: {
                    class:
                        'min-h-full px-3 py-2 text-zinc-200 outline-none [&_p]:my-0 [&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-zinc-600 [&_blockquote]:pl-4 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_strong]:font-semibold [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6',
                    style: `white-space: pre-wrap; word-break: break-word; min-height: ${minHeight}; color: rgb(228, 228, 231);`,
                },
            },
            onCreate: ({ editor: currentEditor }) => {
                setToolbarState(
                    syncToolbarState(
                        currentEditor,
                        normalizedValue,
                        storedFontSize,
                        defaultFontSize
                    )
                );
            },
            onSelectionUpdate: ({ editor: currentEditor }) => {
                setToolbarState(
                    syncToolbarState(
                        currentEditor,
                        normalizeOutput(currentEditor.getHTML(), mode),
                        storedFontSize,
                        defaultFontSize
                    )
                );
            },
            onTransaction: ({ editor: currentEditor }) => {
                setToolbarState(
                    syncToolbarState(
                        currentEditor,
                        normalizeOutput(currentEditor.getHTML(), mode),
                        storedFontSize,
                        defaultFontSize
                    )
                );
            },
            onUpdate: ({ editor: currentEditor }) => {
                const nextValue = normalizeOutput(currentEditor.getHTML(), mode);

                if (emitTimerRef.current) clearTimeout(emitTimerRef.current);
                emitTimerRef.current = setTimeout(() => {
                    onChange(nextValue);
                }, 120);
            },
        },
        [editorId]
    );

    useEffect(() => {
        setRecentColors(getRecentColors());
    }, []);

    useEffect(() => {
        if (!editor) return;

        const currentValue = normalizeOutput(editor.getHTML(), mode);
        if (currentValue === normalizedValue) return;

        editor.commands.setContent(normalizedValue, {
            emitUpdate: false,
        });
        setToolbarState(
            syncToolbarState(
                editor,
                normalizedValue,
                storedFontSize,
                defaultFontSize
            )
        );
    }, [editor, mode, normalizedValue, storedFontSize, defaultFontSize]);

    useEffect(() => {
        if (!editor) return;
        setToolbarState((prev) => ({
            ...prev,
            fontSize: resolveToolbarFontSize(
                editor,
                normalizedValue,
                storedFontSize,
                defaultFontSize
            ),
        }));
    }, [editor, normalizedValue, storedFontSize, defaultFontSize]);

    useEffect(() => {
        if (!editor) return;

        const handlePaste = (event: ClipboardEvent) => {
            const text = event.clipboardData?.getData('text/plain');
            const html = event.clipboardData?.getData('text/html');
            if (!text || html) return;

            event.preventDefault();
            editor
                .chain()
                .focus()
                .insertContent(plainTextToRichTextHtml(text, mode))
                .run();
        };

        const dom = editor.view.dom;
        dom.addEventListener('paste', handlePaste);

        return () => {
            dom.removeEventListener('paste', handlePaste);
        };
    }, [editor, mode]);

    useEffect(() => {
        if (!editor || mode !== 'inline') return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Enter' || event.isComposing) return;

            event.preventDefault();
            editor.chain().focus().setHardBreak().run();
        };

        const dom = editor.view.dom;
        dom.addEventListener('keydown', handleKeyDown);

        return () => {
            dom.removeEventListener('keydown', handleKeyDown);
        };
    }, [editor, mode]);

    useEffect(
        () => () => {
            if (emitTimerRef.current) clearTimeout(emitTimerRef.current);
        },
        []
    );

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (
                colorPickerRef.current &&
                !colorPickerRef.current.contains(target)
            ) {
                setShowColorPicker(false);
            }
            if (
                linkEditorRef.current &&
                !linkEditorRef.current.contains(target)
            ) {
                setShowLinkEditor(false);
            }
        };

        if (!showColorPicker && !showLinkEditor) return;

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showColorPicker, showLinkEditor]);

    const applyColor = (color: string) => {
        if (!editor) return;

        editor.chain().focus().setColor(color).run();
        setCustomColor(color);
        saveRecentColor(color);
        setRecentColors(getRecentColors());
        setShowColorPicker(false);
    };

    const applyFontSize = (size: string) => {
        if (!editor) return;

        const parsed = Number(size);
        if (!Number.isInteger(parsed) || parsed < 8 || parsed > 200) return;

        const px = `${parsed}px`;
        const hasText = editor.state.doc.textContent.length > 0;
        const chain = editor.chain().focus();
        if (hasText && editor.state.selection.empty) {
            chain.selectAll();
        }
        chain.setFontSize(px).run();

        const nextPx = String(parsed);
        setToolbarState((prev) => ({ ...prev, fontSize: nextPx }));
        onFontSizeChange?.(nextPx);
    };

    const applyLink = (rawHref: string) => {
        if (!editor || mode !== 'block') return;

        const trimmed = rawHref.trim();
        if (!trimmed) {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            setShowLinkEditor(false);
            setLinkUrl('');
            return;
        }

        const href =
            /^https?:\/\//i.test(trimmed) || /^mailto:/i.test(trimmed)
                ? trimmed
                : `https://${trimmed}`;

        editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
        setShowLinkEditor(false);
    };

    const removeLink = () => {
        if (!editor) return;
        editor.chain().focus().extendMarkRange('link').unsetLink().run();
        setLinkUrl('');
        setShowLinkEditor(false);
    };

    if (!editor) {
        return (
            <div className="space-y-2">
                <div className="h-12 rounded-t border border-zinc-700 bg-zinc-800" />
                <div
                    className="rounded-b border border-t-0 border-zinc-700 bg-zinc-800"
                    style={{ minHeight }}
                />
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-t border border-zinc-700 bg-zinc-800 p-2">
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    className={`cursor-pointer rounded p-1.5 transition-colors ${
                        toolbarState.isBold
                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                            : 'text-zinc-300 hover:bg-zinc-700'
                    }`}
                    title="Жирный (Ctrl+B)"
                >
                    <Bold className="h-4 w-4" />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    className={`cursor-pointer rounded p-1.5 transition-colors ${
                        toolbarState.isItalic
                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                            : 'text-zinc-300 hover:bg-zinc-700'
                    }`}
                    title="Курсив (Ctrl+I)"
                >
                    <Italic className="h-4 w-4" />
                </button>
                <button
                    type="button"
                    onClick={() =>
                        editor
                            .chain()
                            .focus()
                            .setTextAlign(
                                toolbarState.isCentered ? 'left' : 'center'
                            )
                            .run()
                    }
                    className={`cursor-pointer rounded p-1.5 transition-colors ${
                        toolbarState.isCentered
                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                            : 'text-zinc-300 hover:bg-zinc-700'
                    }`}
                    title="Выровнять по центру"
                >
                    <AlignCenter className="h-4 w-4" />
                </button>
                {mode === 'block' && (
                    <div className="relative" ref={linkEditorRef}>
                        <button
                            type="button"
                            onClick={() => {
                                setShowLinkEditor((open) => {
                                    const next = !open;
                                    if (next) {
                                        setLinkUrl(toolbarState.linkHref || '');
                                    }
                                    return next;
                                });
                                setShowColorPicker(false);
                            }}
                            className={`cursor-pointer rounded p-1.5 transition-colors ${
                                toolbarState.linkHref || showLinkEditor
                                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                                    : 'text-zinc-300 hover:bg-zinc-700'
                            }`}
                            title="Ссылка"
                        >
                            <Link2 className="h-4 w-4" />
                        </button>
                        {showLinkEditor && (
                            <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded border border-zinc-700 bg-zinc-800 p-3 shadow-lg">
                                <label className="mb-1 block text-xs text-zinc-400">
                                    URL
                                </label>
                                <input
                                    type="url"
                                    value={linkUrl}
                                    onChange={(e) => setLinkUrl(e.target.value)}
                                    placeholder="https://example.com"
                                    className="mb-2 w-full rounded border border-zinc-600 bg-zinc-900 px-2 py-1 text-xs text-zinc-200"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            applyLink(linkUrl);
                                        }
                                    }}
                                />
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => applyLink(linkUrl)}
                                        className="flex-1 rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 cursor-pointer"
                                    >
                                        Применить
                                    </button>
                                    {toolbarState.linkHref && (
                                        <button
                                            type="button"
                                            onClick={removeLink}
                                            className="rounded border border-zinc-600 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700 cursor-pointer"
                                            title="Убрать ссылку"
                                        >
                                            <Unlink className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
                <div className="relative" ref={colorPickerRef}>
                    <button
                        type="button"
                        onClick={() => setShowColorPicker((current) => !current)}
                        className={`flex cursor-pointer items-center gap-1 rounded p-1.5 transition-colors ${
                            showColorPicker
                                ? 'bg-zinc-700 text-zinc-200'
                                : 'text-zinc-300 hover:bg-zinc-700'
                        }`}
                        title="Цвет текста"
                    >
                        <Palette className="h-4 w-4" />
                        <div
                            className="h-3 w-3 rounded border border-zinc-500"
                            style={{ backgroundColor: toolbarState.color }}
                        />
                    </button>
                    {showColorPicker && (
                        <div className="absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded border border-zinc-700 bg-zinc-800 p-3 shadow-lg">
                            {recentColors.length > 0 && (
                                <div className="mb-3">
                                    <label className="mb-1 block text-xs text-zinc-400">
                                        Последние
                                    </label>
                                    <div className="grid grid-cols-4 gap-1">
                                        {recentColors.map((color) => (
                                            <button
                                                key={color}
                                                type="button"
                                                onClick={() => applyColor(color)}
                                                className="h-6 w-6 cursor-pointer rounded border border-zinc-600 transition-transform hover:scale-110"
                                                style={{ backgroundColor: color }}
                                                title={color}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div
                                className={recentColors.length > 0 ? 'mb-3' : 'mb-2'}
                            >
                                <label className="mb-1 block text-xs text-zinc-400">
                                    {recentColors.length > 0
                                        ? 'Цвета сайта'
                                        : 'Быстрые цвета'}
                                </label>
                                <div className="grid grid-cols-4 gap-1">
                                    {siteColors.map((color) => (
                                        <button
                                            key={color.value}
                                            type="button"
                                            onClick={() => applyColor(color.value)}
                                            className="h-6 w-6 cursor-pointer rounded border border-zinc-600 transition-transform hover:scale-110"
                                            style={{
                                                backgroundColor: color.value,
                                            }}
                                            title={color.name}
                                        />
                                    ))}
                                </div>
                            </div>
                            <div className="border-t border-zinc-700 pt-2">
                                <label className="mb-1 block text-xs text-zinc-400">
                                    Выбрать цвет
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="color"
                                        value={customColor}
                                        onChange={(event) => {
                                            const nextColor = event.target.value;
                                            setCustomColor(nextColor);
                                            applyColor(nextColor);
                                        }}
                                        aria-label="Выбрать цвет"
                                        className="h-8 w-10 cursor-pointer rounded border border-zinc-600"
                                    />
                                    <input
                                        type="text"
                                        value={customColor}
                                        placeholder="#000000"
                                        onChange={(event) => {
                                            const nextColor = event.target.value;
                                            setCustomColor(nextColor);
                                            if (/^#[0-9A-F]{6}$/i.test(nextColor)) {
                                                applyColor(nextColor);
                                            }
                                        }}
                                        className="flex-1 rounded border border-zinc-600 bg-zinc-900 px-2 py-1 text-xs text-zinc-200"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-1.5 border-l border-zinc-700 pl-2">
                    <span className="whitespace-nowrap text-xs text-zinc-400">
                        Размер:
                    </span>
                    <input
                        type="number"
                        min="8"
                        max="200"
                        value={
                            toolbarState.fontSize ||
                            storedFontSize ||
                            defaultFontSize
                        }
                        placeholder={defaultFontSize}
                        className="w-14 rounded border border-zinc-600 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                        onChange={(event) =>
                            setToolbarState((prev) => ({
                                ...prev,
                                fontSize: event.target.value,
                            }))
                        }
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                event.preventDefault();
                                applyFontSize(
                                    (event.currentTarget as HTMLInputElement).value
                                );
                                event.currentTarget.blur();
                            }
                        }}
                        onBlur={(event) => applyFontSize(event.target.value)}
                    />
                    <span className="text-xs text-zinc-400">px</span>
                </div>
            </div>

            <div
                className="rounded-b border border-t-0 border-zinc-700 bg-zinc-800 focus-within:border-transparent focus-within:ring-2 focus-within:ring-blue-500"
                style={{ minHeight }}
            >
                <EditorContent editor={editor} />
                <style jsx global>{`
                    .is-editor-empty:first-child::before {
                        color: #71717a;
                        content: attr(data-placeholder);
                        float: left;
                        height: 0;
                        pointer-events: none;
                    }
                `}</style>
            </div>
        </div>
    );
}
