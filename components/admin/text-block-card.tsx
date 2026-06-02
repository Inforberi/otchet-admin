"use client"

import type { TextBlock } from "@/lib/types"
import { ChevronUp, ChevronDown, Copy, Trash2 } from "lucide-react"

interface TextBlockCardProps {
  block: TextBlock
  index: number
  total: number
  onChange: (block: TextBlock) => void
  onDelete: () => void
  onDuplicate: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}

export function TextBlockCard({
  block,
  index,
  total,
  onChange,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
}: TextBlockCardProps) {
  const handleFieldChange = (field: keyof TextBlock, value: string) => {
    onChange({ ...block, [field]: value })
  }

  return (
    <div className="rounded-lg border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-14)] p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white">Текст</span>
          <span className="text-sm text-[var(--color-grayscale-6)]">Блок #{index + 1}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            className="rounded p-1.5 text-[var(--color-grayscale-6)] hover:bg-[var(--color-alpha-3)] disabled:opacity-30"
            title="Переместить вверх"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="rounded p-1.5 text-[var(--color-grayscale-6)] hover:bg-[var(--color-alpha-3)] disabled:opacity-30"
            title="Переместить вниз"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          <button
            onClick={onDuplicate}
            className="rounded p-1.5 text-[var(--color-grayscale-6)] hover:bg-[var(--color-alpha-3)]"
            title="Дублировать"
          >
            <Copy className="h-4 w-4" />
          </button>
          <button onClick={onDelete} className="rounded p-1.5 text-red-400 hover:bg-red-500/10" title="Удалить">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm text-[var(--color-grayscale-6)]">Заголовок блока</label>
          <input
            type="text"
            value={block.title}
            onChange={(e) => handleFieldChange("title", e.target.value)}
            placeholder="Рекомендации по оптимизации"
            className="w-full rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)] px-3 py-2 text-[var(--color-grayscale-3)] placeholder:text-[var(--color-grayscale-8)] focus:border-[var(--color-primary)] focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm text-[var(--color-grayscale-6)]">Размер текста</label>
          <select
            aria-label="Размер текста"
            value={block.fontSize || "medium"}
            onChange={(e) => handleFieldChange("fontSize", e.target.value)}
            className="w-full rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)] px-3 py-2 text-[var(--color-grayscale-3)] focus:border-[var(--color-primary)] focus:outline-none"
          >
            <option value="small">Маленький</option>
            <option value="medium">Средний (по умолчанию)</option>
            <option value="large">Большой</option>
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm text-[var(--color-grayscale-6)]">Контент</label>
          <textarea
            value={block.content}
            onChange={(e) => handleFieldChange("content", e.target.value)}
            placeholder="Введите текст... Поддерживается простое форматирование с переносами строк."
            rows={6}
            className="w-full resize-none rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)] px-3 py-2 text-[var(--color-grayscale-3)] placeholder:text-[var(--color-grayscale-8)] focus:border-[var(--color-primary)] focus:outline-none"
          />
        </div>
      </div>
    </div>
  )
}
