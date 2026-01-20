"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import type { ReportDraft } from "@/lib/types"
import { loadReport } from "@/lib/storage"
import { ScreenshotBlockView } from "@/components/report/screenshot-block-view"
import { TextBlockView } from "@/components/report/text-block-view"
import { FileQuestion, ArrowRight, Printer, Download, Home, Settings } from "lucide-react"

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

export default function ReportPage() {
  const router = useRouter()
  const [draft, setDraft] = useState<ReportDraft | null>(null)
  const [mounted, setMounted] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    setMounted(true)
    const loaded = loadReport()
    setDraft(loaded)
  }, [])

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-grayscale-16)]">
        <div className="text-[var(--color-grayscale-6)]">Загрузка...</div>
      </div>
    )
  }

  // Empty state
  if (!draft || (!draft.meta.title && draft.blocks.length === 0)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--color-grayscale-16)] px-4">
        <div className="text-center">
          <div className="mb-4 inline-flex items-center justify-center rounded-full bg-[var(--color-grayscale-14)] p-4">
            <FileQuestion className="h-10 w-10 text-[var(--color-grayscale-6)]" />
          </div>
          <h1 className="mb-2 text-2xl font-semibold text-[var(--color-grayscale-3)]">Отчёт пуст</h1>
          <p className="mb-6 text-[var(--color-grayscale-6)]">
            Создайте отчёт в админ-панели, чтобы увидеть его здесь.
          </p>
          <button
            onClick={() => router.push("/admin")}
            className="inline-flex items-center gap-2 rounded-md bg-[var(--color-primary)] px-6 py-3 font-medium text-white transition-opacity hover:opacity-90"
          >
            Перейти в админку
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    )
  }

  const handleExportPDF = async () => {
    setIsExporting(true)
    try {
      // Use browser's print dialog with PDF option
      window.print()
    } finally {
      setTimeout(() => setIsExporting(false), 500)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-grayscale-16)]">
      {/* Header */}
      <header className="border-b border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)]">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              {!isEmptyHtml(draft.meta.title) ? (
                <h1 className="text-balance text-3xl font-bold text-[var(--color-grayscale-2)] sm:text-4xl">
                  {draft.meta.title}
                </h1>
              ) : (
                <h1 className="text-balance text-3xl font-bold text-[var(--color-grayscale-2)] sm:text-4xl">
                  Без названия
                </h1>
              )}
              {!isEmpty(draft.meta.subtitle) && <p className="text-lg text-[var(--color-grayscale-5)]">{draft.meta.subtitle}</p>}
            </div>
            <div className="flex flex-shrink-0 flex-col items-end gap-2 text-sm text-[var(--color-grayscale-6)]">
              {!isEmpty(draft.meta.client) && <span>{draft.meta.client}</span>}
              {draft.meta.date && !isEmpty(draft.meta.date) && <span>{draft.meta.date}</span>}
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => router.push("/")}
                  className="inline-flex items-center gap-1.5 rounded border border-[var(--color-alpha-3)] px-3 py-1.5 text-[var(--color-grayscale-5)] transition-colors hover:bg-[var(--color-grayscale-14)] print:hidden"
                >
                  <Home className="h-4 w-4" />
                  Главная
                </button>
                <button
                  onClick={() => router.push("/admin")}
                  className="inline-flex items-center gap-1.5 rounded border border-[var(--color-alpha-3)] px-3 py-1.5 text-[var(--color-grayscale-5)] transition-colors hover:bg-[var(--color-grayscale-14)] print:hidden"
                >
                  <Settings className="h-4 w-4" />
                  Админка
                </button>
                <button
                  onClick={handleExportPDF}
                  disabled={isExporting}
                  className="inline-flex items-center gap-1.5 rounded border border-[var(--color-alpha-3)] bg-[var(--color-primary)] px-3 py-1.5 text-white transition-opacity hover:opacity-90 disabled:opacity-50 print:hidden"
                >
                  <Download className="h-4 w-4" />
                  {isExporting ? "Экспорт..." : "PDF"}
                </button>
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded border border-[var(--color-alpha-3)] px-3 py-1.5 text-[var(--color-grayscale-5)] transition-colors hover:bg-[var(--color-grayscale-14)] print:hidden"
                >
                  <Printer className="h-4 w-4" />
                  Печать
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="space-y-12">
          {draft.blocks.map((block) =>
            block.type === "screenshot" ? (
              <ScreenshotBlockView 
                key={block.id} 
                data={{
                  title: block.title,
                  description: block.description,
                  images: block.images.map((url) => ({ url, alt: '', caption: '' })),
                  layout: block.layout,
                  imageSize: block.imageSize,
                  customWidth: block.customWidth,
                }} 
              />
            ) : (
              <TextBlockView 
                key={block.id} 
                data={{
                  title: block.title,
                  content: block.content,
                }} 
              />
            ),
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--color-alpha-3)] py-6 print:hidden">
        <div className="mx-auto max-w-5xl px-4 text-center text-sm text-[var(--color-grayscale-7)] sm:px-6 lg:px-8">
          Сгенерировано с помощью конструктора отчётов
        </div>
      </footer>
    </div>
  )
}
