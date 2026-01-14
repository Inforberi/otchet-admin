"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import type { ReportDraft, ScreenshotBlock, TextBlock, ReportBlock } from "@/lib/types"
import { saveReport, loadReport, clearReport, getDefaultDraft, generateId } from "@/lib/storage"
import { MetaForm } from "@/components/admin/meta-form"
import { ScreenshotBlockCard } from "@/components/admin/screenshot-block-card"
import { TextBlockCard } from "@/components/admin/text-block-card"
import { ImagePlus, FileText, Save, Trash2, ExternalLink, Check, Home } from "lucide-react"

export default function AdminPage() {
  const router = useRouter()
  const [draft, setDraft] = useState<ReportDraft>(getDefaultDraft())
  const [saved, setSaved] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const loaded = loadReport()
    if (loaded) {
      setDraft(loaded)
    }
  }, [])

  const handleSave = () => {
    saveReport(draft)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleClear = () => {
    if (confirm("Вы уверены, что хотите очистить весь отчёт?")) {
      clearReport()
      setDraft(getDefaultDraft())
    }
  }

  const addScreenshotBlock = () => {
    const newBlock: ScreenshotBlock = {
      id: generateId(),
      type: "screenshot",
      title: "",
      description: "",
      images: [],
    }
    setDraft((prev) => ({ ...prev, blocks: [...prev.blocks, newBlock] }))
  }

  const addTextBlock = () => {
    const newBlock: TextBlock = {
      id: generateId(),
      type: "text",
      title: "",
      content: "",
    }
    setDraft((prev) => ({ ...prev, blocks: [...prev.blocks, newBlock] }))
  }

  const updateBlock = (index: number, updatedBlock: ReportBlock) => {
    setDraft((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b, i) => (i === index ? updatedBlock : b)),
    }))
  }

  const deleteBlock = (index: number) => {
    setDraft((prev) => ({
      ...prev,
      blocks: prev.blocks.filter((_, i) => i !== index),
    }))
  }

  const duplicateBlock = (index: number) => {
    const block = draft.blocks[index]
    const newBlock = { ...block, id: generateId() }
    setDraft((prev) => ({
      ...prev,
      blocks: [...prev.blocks.slice(0, index + 1), newBlock, ...prev.blocks.slice(index + 1)],
    }))
  }

  const moveBlock = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= draft.blocks.length) return
    const newBlocks = [...draft.blocks]
    ;[newBlocks[index], newBlocks[newIndex]] = [newBlocks[newIndex], newBlocks[index]]
    setDraft((prev) => ({ ...prev, blocks: newBlocks }))
  }

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-grayscale-16)]">
        <div className="text-[var(--color-grayscale-6)]">Загрузка...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--color-grayscale-16)]">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <h1 className="text-xl font-bold text-[var(--color-grayscale-3)]">Конструктор отчёта</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/")}
              className="flex items-center gap-2 rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-14)] px-4 py-2 text-sm text-[var(--color-grayscale-4)] transition-colors hover:bg-[var(--color-grayscale-13)]"
            >
              <Home className="h-4 w-4" />
              Главная
            </button>
            <button
              onClick={() => router.push("/report")}
              className="flex items-center gap-2 rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-14)] px-4 py-2 text-sm text-[var(--color-grayscale-4)] transition-colors hover:bg-[var(--color-grayscale-13)]"
            >
              <ExternalLink className="h-4 w-4" />
              Открыть отчёт
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="space-y-6">
          {/* Meta Form */}
          <MetaForm meta={draft.meta} onChange={(meta) => setDraft((prev) => ({ ...prev, meta }))} />

          {/* Blocks Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--color-grayscale-3)]">Блоки ({draft.blocks.length})</h2>
              <div className="flex gap-2">
                <button
                  onClick={addScreenshotBlock}
                  className="flex items-center gap-2 rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
                >
                  <ImagePlus className="h-4 w-4" />
                  Скриншоты PageSpeed
                </button>
                <button
                  onClick={addTextBlock}
                  className="flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
                >
                  <FileText className="h-4 w-4" />
                  Текст
                </button>
              </div>
            </div>

            {draft.blocks.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)] px-6 py-16 text-center">
                <p className="text-[var(--color-grayscale-6)]">
                  Блоки не добавлены. Используйте кнопки выше, чтобы добавить контент.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {draft.blocks.map((block, index) =>
                  block.type === "screenshot" ? (
                    <ScreenshotBlockCard
                      key={block.id}
                      block={block}
                      index={index}
                      total={draft.blocks.length}
                      onChange={(updated) => updateBlock(index, updated as ScreenshotBlock)}
                      onDelete={() => deleteBlock(index)}
                      onDuplicate={() => duplicateBlock(index)}
                      onMoveUp={() => moveBlock(index, "up")}
                      onMoveDown={() => moveBlock(index, "down")}
                    />
                  ) : (
                    <TextBlockCard
                      key={block.id}
                      block={block}
                      index={index}
                      total={draft.blocks.length}
                      onChange={(updated) => updateBlock(index, updated as TextBlock)}
                      onDelete={() => deleteBlock(index)}
                      onDuplicate={() => duplicateBlock(index)}
                      onMoveUp={() => moveBlock(index, "up")}
                      onMoveDown={() => moveBlock(index, "down")}
                    />
                  ),
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 border-t border-[var(--color-alpha-3)] pt-6">
            <button
              onClick={handleSave}
              className="flex items-center gap-2 rounded-md bg-[var(--color-primary)] px-6 py-2.5 font-medium text-white transition-opacity hover:opacity-90"
            >
              {saved ? (
                <>
                  <Check className="h-4 w-4" />
                  Сохранено!
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Сохранить
                </>
              )}
            </button>
            <button
              onClick={handleClear}
              className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-red-400 transition-colors hover:bg-red-500/20"
            >
              <Trash2 className="h-4 w-4" />
              Очистить
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
