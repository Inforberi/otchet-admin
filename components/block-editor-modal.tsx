"use client"

import { useState, useEffect } from "react"
import type { ReportBlockFromDB, TextBlockData, ScreenshotBlockData } from "@/lib/db-types"
import { X, Save } from "lucide-react"
import dynamic from "next/dynamic"

const MDEditor = dynamic(
  () => import("@uiw/react-md-editor").then((mod) => mod.default),
  { ssr: false }
)

interface BlockEditorModalProps {
  block: ReportBlockFromDB
  onClose: () => void
  onSave: (updatedData: TextBlockData | ScreenshotBlockData) => void
}

export function BlockEditorModal({ block, onClose, onSave }: BlockEditorModalProps) {
  const [data, setData] = useState(block.data as TextBlockData | ScreenshotBlockData)

  const handleSave = () => {
    onSave(data)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-4xl rounded-lg bg-[var(--color-grayscale-14)] shadow-2xl border border-[var(--color-alpha-3)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-alpha-3)] px-6 py-4">
          <h2 className="text-lg font-semibold text-[var(--color-grayscale-2)]">
            Редактировать блок: {block.type === "text" ? "Текст" : "Фото"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-[var(--color-grayscale-6)] hover:bg-[var(--color-alpha-3)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[70vh] overflow-y-auto p-6">
          {block.type === "text" ? (
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--color-grayscale-5)]">
                  Заголовок
                </label>
                <input
                  type="text"
                  value={(data as TextBlockData).title}
                  onChange={(e) => setData({ ...data, title: e.target.value })}
                  className="w-full rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)] px-3 py-2 text-[var(--color-grayscale-3)] focus:border-[var(--color-primary)] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--color-grayscale-5)]">
                  Контент (Markdown)
                </label>
                <div data-color-mode="dark">
                  <MDEditor
                    value={(data as TextBlockData).content}
                    onChange={(val) => setData({ ...data, content: val || "" })}
                    height={400}
                    preview="edit"
                    hideToolbar={false}
                    enableScroll={true}
                    visibleDragbar={false}
                  />
                </div>
                <p className="mt-2 text-xs text-[var(--color-grayscale-7)]">
                  Используйте toolbar выше для форматирования текста
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--color-grayscale-5)]">
                  Размер текста
                </label>
                <select
                  value={(data as TextBlockData).fontSize || "medium"}
                  onChange={(e) => setData({ ...data, fontSize: e.target.value as "small" | "medium" | "large" })}
                  className="w-full rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)] px-3 py-2 text-[var(--color-grayscale-3)] focus:border-[var(--color-primary)] focus:outline-none"
                >
                  <option value="small">Маленький</option>
                  <option value="medium">Средний</option>
                  <option value="large">Большой</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--color-grayscale-5)]">
                  Заголовок
                </label>
                <input
                  type="text"
                  value={(data as ScreenshotBlockData).title}
                  onChange={(e) => setData({ ...data, title: e.target.value })}
                  className="w-full rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)] px-3 py-2 text-[var(--color-grayscale-3)] focus:border-[var(--color-primary)] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--color-grayscale-5)]">
                  Описание
                </label>
                <textarea
                  value={(data as ScreenshotBlockData).description || ""}
                  onChange={(e) =>
                    setData({ ...data, description: e.target.value } as ScreenshotBlockData)
                  }
                  rows={3}
                  className="w-full resize-none rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)] px-3 py-2 text-[var(--color-grayscale-3)] focus:border-[var(--color-primary)] focus:outline-none"
                />
              </div>

              <div>
                <p className="text-sm text-[var(--color-grayscale-6)]">
                  Для загрузки изображений используйте кнопку "Добавить блок" →  "Блок с фото"
                </p>
                <p className="mt-2 text-xs text-[var(--color-grayscale-7)]">
                  Изображений: {(data as ScreenshotBlockData).images.length}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-[var(--color-alpha-3)] px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)] px-4 py-2 text-sm text-[var(--color-grayscale-4)] transition-colors hover:bg-[var(--color-grayscale-13)]"
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            <Save className="h-4 w-4" />
            Сохранить изменения
          </button>
        </div>
      </div>
    </div>
  )
}
