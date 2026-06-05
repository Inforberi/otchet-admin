'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import HardBreak from '@tiptap/extension-hard-break';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import TextAlign from '@tiptap/extension-text-align';
import { Extension, type Editor } from '@tiptap/core';
import Link from '@tiptap/extension-link';
import { Plugin } from 'prosemirror-state';
import type { EditorState, Transaction } from 'prosemirror-state';
import type { Node as ProseMirrorNode } from 'prosemirror-model';
import {
    Bold,
    Italic,
    Palette,
    AlignCenter,
    Link2,
    Unlink,
    List,
    ListOrdered,
} from 'lucide-react';
import {
    canonicalRichTextValue,
    DESCRIPTION_HEADING_FONT_SIZE_PX,
    normalizeRichTextHtml,
    plainTextToRichTextHtml,
    RICH_TEXT_SPACER_CLASS,
    sanitizePastedHtml,
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

const ParagraphClassAttribute = Extension.create({
    name: 'paragraphClassAttribute',

    addGlobalAttributes() {
        return [
            {
                types: ['paragraph'],
                attributes: {
                    class: {
                        default: null,
                        parseHTML: (element: HTMLElement) =>
                            element.getAttribute('class'),
                        renderHTML: (attributes: { class?: string | null }) =>
                            attributes.class
                                ? { class: attributes.class }
                                : {},
                    },
                },
            },
        ];
    },
});

const isEmptyParagraphNode = (node: ProseMirrorNode): boolean => {
    if (node.childCount === 0) return true;
    if (
        node.childCount === 1 &&
        (node.firstChild?.type.name === 'hardBreak' ||
            node.firstChild?.type.name === 'br')
    ) {
        return true;
    }
    return node.textContent.trim().length === 0;
};

const SpacerParagraphPlugin = Extension.create({
    name: 'spacerParagraphPlugin',

    addProseMirrorPlugins() {
        return [
            new Plugin({
                appendTransaction(
                    transactions: readonly Transaction[],
                    _oldState: EditorState,
                    newState: EditorState
                ) {
                    if (!transactions.some((tr) => tr.docChanged)) return null;

                    const tr = newState.tr;
                    let modified = false;

                    newState.doc.descendants((node: ProseMirrorNode, pos: number) => {
                        if (node.type.name !== 'paragraph') return;

                        const empty = isEmptyParagraphNode(node);
                        const hasSpacerClass =
                            node.attrs.class === RICH_TEXT_SPACER_CLASS;

                        if (empty && !hasSpacerClass) {
                            tr.setNodeMarkup(pos, undefined, {
                                ...node.attrs,
                                class: RICH_TEXT_SPACER_CLASS,
                            });
                            modified = true;
                        } else if (!empty && hasSpacerClass) {
                            tr.setNodeMarkup(pos, undefined, {
                                ...node.attrs,
                                class: null,
                            });
                            modified = true;
                        }
                    });

                    return modified ? tr : null;
                },
            }),
        ];
    },
});

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
    /** Пресет «Текст» (px), из «Описание» отчёта */
    baseFontSize?: string;
    /** Пресет «Заголовок» (px) в описании блока */
    headingPresetPx?: string;
    onBasePresetChange?: (px: string) => void;
    onHeadingPresetChange?: (px: string) => void;
    /** Размер обёртки для inline-заголовков блока (из «Заголовок» отчёта) */
    titleFontSize?: string;
    onTitleFontSizeChange?: (px: string) => void;
    mode?: 'inline' | 'block';
};

type SizePreset = 'text' | 'heading';

const parsePx = (value: string | undefined, fallback: string): string => {
    const raw = (value ?? fallback).replace(/px$/i, '').trim();
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? String(Math.round(n)) : fallback;
};

const clampPresetPx = (value: string, fallback: string): string => {
    const n = Number(parsePx(value, fallback));
    if (!Number.isFinite(n)) return fallback;
    return String(Math.min(200, Math.max(8, Math.round(n))));
};

const isHeadingFontMark = (
    fontSize: string | undefined | null,
    headingPx: string
): boolean => {
    if (!fontSize) return false;
    return parsePx(fontSize, '') === parsePx(headingPx, '24');
};

const resolveSizePreset = (
    editor: NonNullable<ReturnType<typeof useEditor>>,
    headingPx: string
): SizePreset =>
    isHeadingFontMark(
        editor.getAttributes('textStyle').fontSize as string | undefined,
        headingPx
    )
        ? 'heading'
        : 'text';

const getEditorExtensions = (mode: 'inline' | 'block') => {
    const base = [
        StarterKit.configure({
            hardBreak: false,
            heading: false,
            bulletList: mode === 'block' ? {} : false,
            orderedList: mode === 'block' ? {} : false,
            blockquote: mode === 'block' ? {} : false,
        }),
        ParagraphClassAttribute,
        SpacerParagraphPlugin,
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
            types: ['paragraph'],
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
    headingPx: string
) => ({
    isBold: editor.isActive('bold'),
    isItalic: editor.isActive('italic'),
    isCentered: editor.isActive({ textAlign: 'center' }),
    color:
        (editor.getAttributes('textStyle').color as string | undefined) ||
        DEFAULT_COLOR,
    sizePreset: resolveSizePreset(editor, headingPx),
    linkHref: (editor.getAttributes('link').href as string | undefined) ?? '',
    isBulletList: editor.isActive('bulletList'),
    isOrderedList: editor.isActive('orderedList'),
});

export default function RichTextEditor({
    editorId,
    value,
    onChange,
    placeholder,
    minHeight = '200px',
    baseFontSize = '20',
    headingPresetPx = DESCRIPTION_HEADING_FONT_SIZE_PX,
    onBasePresetChange,
    onHeadingPresetChange,
    titleFontSize = '40',
    onTitleFontSizeChange,
    mode = 'block',
}: RichTextEditorProps) {
    const bodyPx = parsePx(baseFontSize, '20');
    const headingPx = parsePx(headingPresetPx, DESCRIPTION_HEADING_FONT_SIZE_PX);
    const titlePx = parsePx(titleFontSize, '40');
    const wrapperFontPx = mode === 'block' ? bodyPx : titlePx;
    const headingPxRef = useRef(headingPx);
    headingPxRef.current = headingPx;
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
        sizePreset: 'text' as SizePreset,
        linkHref: '',
        isBulletList: false,
        isOrderedList: false,
    });
    const colorPickerRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<Editor | null>(null);
    const emitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastEmittedRef = useRef('');

    const canonicalValue = useMemo(
        () => canonicalRichTextValue(value, mode),
        [value, mode]
    );

    const editorContent = useMemo(
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
            content: editorContent,
            editorProps: {
                attributes: {
                    class:
                        'min-h-full px-3 py-2 text-zinc-200 outline-none [&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-zinc-600 [&_blockquote]:pl-4 [&_strong]:font-semibold',
                    style: `word-break: break-word; min-height: ${minHeight}; color: rgb(228, 228, 231); font-size: ${wrapperFontPx}px;`,
                },
                handlePaste: (_view, event) => {
                    const clipboard = event.clipboardData;
                    const ed = editorRef.current;
                    if (!clipboard || !ed) return false;

                    const html = clipboard.getData('text/html');
                    const text = clipboard.getData('text/plain');
                    if (!html?.trim() && !text?.trim()) return false;

                    event.preventDefault();

                    if (html?.trim()) {
                        const clean = sanitizePastedHtml(html);
                        ed.chain().focus().insertContent(clean).run();
                    } else if (text?.trim()) {
                        ed.chain()
                            .focus()
                            .insertContent(plainTextToRichTextHtml(text, mode))
                            .run();
                    }

                    return true;
                },
            },
            onCreate: ({ editor: currentEditor }) => {
                editorRef.current = currentEditor;
                setToolbarState(syncToolbarState(currentEditor, headingPx));
            },
            onSelectionUpdate: ({ editor: currentEditor }) => {
                setToolbarState(syncToolbarState(currentEditor, headingPx));
            },
            onTransaction: ({ editor: currentEditor }) => {
                setToolbarState(syncToolbarState(currentEditor, headingPx));
            },
            onUpdate: ({ editor: currentEditor }) => {
                const nextValue = canonicalRichTextValue(
                    currentEditor.getHTML(),
                    mode
                );

                if (emitTimerRef.current) clearTimeout(emitTimerRef.current);
                emitTimerRef.current = setTimeout(() => {
                    lastEmittedRef.current = nextValue;
                    onChange(nextValue);
                }, 120);
            },
            onDestroy: () => {
                editorRef.current = null;
            },
        },
        [editorId]
    );

    useEffect(() => {
        setRecentColors(getRecentColors());
    }, []);

    useEffect(() => {
        if (!editor) return;
        editor.view.dom.style.fontSize = `${wrapperFontPx}px`;
    }, [editor, wrapperFontPx]);

    useEffect(() => {
        if (!editor) return;

        const currentValue = canonicalRichTextValue(editor.getHTML(), mode);
        if (currentValue === canonicalValue) return;
        if (
            editor.isFocused &&
            canonicalValue === lastEmittedRef.current
        ) {
            return;
        }

        const { from, to } = editor.state.selection;
        editor.commands.setContent(editorContent, {
            emitUpdate: false,
        });
        const docSize = editor.state.doc.content.size;
        const safeFrom = Math.min(from, docSize);
        const safeTo = Math.min(to, docSize);
        editor.commands.setTextSelection({ from: safeFrom, to: safeTo });

        setToolbarState(syncToolbarState(editor, headingPx));
    }, [editor, mode, canonicalValue, editorContent, headingPx]);

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

    const applySizePreset = (preset: SizePreset) => {
        if (!editor || mode !== 'block') return;

        if (preset === 'heading') {
            editor
                .chain()
                .focus()
                .setFontSize(`${headingPxRef.current}px`)
                .run();
        } else {
            editor.chain().focus().unsetFontSize().run();
        }

        setToolbarState((prev) => ({ ...prev, sizePreset: preset }));
    };

    const commitBodyPreset = (raw: string) => {
        const next = clampPresetPx(raw, '20');
        onBasePresetChange?.(next);
    };

    const commitHeadingPreset = (raw: string) => {
        const next = clampPresetPx(raw, DESCRIPTION_HEADING_FONT_SIZE_PX);
        onHeadingPresetChange?.(next);
    };

    const commitTitlePreset = (raw: string) => {
        const next = clampPresetPx(raw, '40');
        onTitleFontSizeChange?.(next);
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
            <div className="flex flex-wrap items-center gap-1.5 rounded-t border border-zinc-700 bg-zinc-800 p-2">
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
                    <>
                        <button
                            type="button"
                            onClick={() =>
                                editor.chain().focus().toggleBulletList().run()
                            }
                            className={`cursor-pointer rounded p-1.5 transition-colors ${
                                toolbarState.isBulletList
                                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                                    : 'text-zinc-300 hover:bg-zinc-700'
                            }`}
                            title="Маркированный список"
                        >
                            <List className="h-4 w-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() =>
                                editor.chain().focus().toggleOrderedList().run()
                            }
                            className={`cursor-pointer rounded p-1.5 transition-colors ${
                                toolbarState.isOrderedList
                                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                                    : 'text-zinc-300 hover:bg-zinc-700'
                            }`}
                            title="Нумерованный список"
                        >
                            <ListOrdered className="h-4 w-4" />
                        </button>
                    </>
                )}
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
                            <div className="absolute left-0 top-full z-50 mt-1 w-64 max-w-[calc(100vw-2rem)] rounded border border-zinc-700 bg-zinc-800 p-3 shadow-lg">
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
                        <div className="absolute left-0 top-full z-50 mt-1 min-w-[200px] max-w-[calc(100vw-2rem)] rounded border border-zinc-700 bg-zinc-800 p-3 shadow-lg">
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
                {mode === 'inline' && (
                    <div
                        className="flex items-center gap-1 border-l border-zinc-700 pl-2"
                        title="Размер заголовка блока"
                    >
                        <span className="whitespace-nowrap text-xs text-zinc-400">
                            Размер
                        </span>
                        <input
                            type="number"
                            min={8}
                            max={200}
                            aria-label="Размер заголовка, px"
                            value={titlePx}
                            onMouseDown={(e) => e.stopPropagation()}
                            onChange={(e) =>
                                onTitleFontSizeChange?.(e.target.value)
                            }
                            onBlur={(e) => commitTitlePreset(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    commitTitlePreset(
                                        (e.currentTarget as HTMLInputElement).value
                                    );
                                    e.currentTarget.blur();
                                }
                            }}
                            className="w-11 rounded border border-zinc-600 bg-zinc-900 px-1.5 py-0.5 text-xs text-zinc-200 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-[10px] text-zinc-500">px</span>
                    </div>
                )}
                {mode === 'block' && (
                    <div
                        className="flex flex-wrap items-center gap-1.5 border-l border-zinc-700 pl-2"
                        title="Размер для выделения или следующего ввода"
                    >
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => applySizePreset('text')}
                                className={`cursor-pointer rounded px-2 py-1 text-xs transition-colors ${
                                    toolbarState.sizePreset === 'text'
                                        ? 'bg-blue-600 text-white'
                                        : 'text-zinc-400 hover:bg-zinc-700'
                                }`}
                            >
                                Текст
                            </button>
                            <input
                                type="number"
                                min={8}
                                max={200}
                                aria-label="Размер текста, px"
                                value={bodyPx}
                                onMouseDown={(e) => e.stopPropagation()}
                                onChange={(e) =>
                                    onBasePresetChange?.(e.target.value)
                                }
                                onBlur={(e) => commitBodyPreset(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        commitBodyPreset(
                                            (e.currentTarget as HTMLInputElement)
                                                .value
                                        );
                                        e.currentTarget.blur();
                                    }
                                }}
                                className="w-11 rounded border border-zinc-600 bg-zinc-900 px-1.5 py-0.5 text-xs text-zinc-200 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="text-[10px] text-zinc-500">px</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => applySizePreset('heading')}
                                className={`cursor-pointer rounded px-2 py-1 text-xs transition-colors ${
                                    toolbarState.sizePreset === 'heading'
                                        ? 'bg-blue-600 text-white'
                                        : 'text-zinc-400 hover:bg-zinc-700'
                                }`}
                            >
                                Заголовок
                            </button>
                            <input
                                type="number"
                                min={8}
                                max={200}
                                aria-label="Размер заголовка в тексте, px"
                                value={headingPx}
                                onMouseDown={(e) => e.stopPropagation()}
                                onChange={(e) =>
                                    onHeadingPresetChange?.(e.target.value)
                                }
                                onBlur={(e) =>
                                    commitHeadingPreset(e.target.value)
                                }
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        commitHeadingPreset(
                                            (e.currentTarget as HTMLInputElement)
                                                .value
                                        );
                                        e.currentTarget.blur();
                                    }
                                }}
                                className="w-11 rounded border border-zinc-600 bg-zinc-900 px-1.5 py-0.5 text-xs text-zinc-200 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="text-[10px] text-zinc-500">px</span>
                        </div>
                    </div>
                )}
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
