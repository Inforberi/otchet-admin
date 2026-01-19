"use client"

import type React from "react"

import type { ScreenshotBlock } from "@/lib/types"
import { ChevronUp, ChevronDown, Copy, Trash2, ImagePlus, X, Upload, GripVertical } from "lucide-react"
import { useRef, useState } from "react"

interface ScreenshotBlockCardProps {
  block: ScreenshotBlock
  index: number
  total: number
  onChange: (block: ScreenshotBlock) => void
  onDelete: () => void
  onDuplicate: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}

export function ScreenshotBlockCard({
  block,
  index,
  total,
  onChange,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
}: ScreenshotBlockCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [draggedImageIndex, setDraggedImageIndex] = useState<number | null>(null)
  const [dragOverImageIndex, setDragOverImageIndex] = useState<number | null>(null)

  const handleFieldChange = (field: keyof ScreenshotBlock, value: string) => {
    onChange({ ...block, [field]: value })
  }

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target
    const cursorPosition = textarea.selectionStart
    const newValue = e.target.value
    
    handleFieldChange("description", newValue)
    
    // Восстанавливаем позицию курсора после обновления
    setTimeout(() => {
      if (descriptionTextareaRef.current) {
        descriptionTextareaRef.current.setSelectionRange(cursorPosition, cursorPosition)
      }
    }, 0)
  }

  const handleImagesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    Array.from(files).forEach((file) => {
      const reader = new FileReader()
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string
        onChange({ ...block, images: [...block.images, dataUrl] })
      }
      reader.readAsDataURL(file)
    })

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleRemoveImage = (imageIndex: number) => {
    const newImages = block.images.filter((_, i) => i !== imageIndex)
    onChange({ ...block, images: newImages })
  }

  const handleImageDragStart = (e: React.DragEvent, imageIndex: number) => {
    setDraggedImageIndex(imageIndex)
    e.dataTransfer.effectAllowed = "move"
    e.dataTransfer.setData("text/html", e.currentTarget.outerHTML)
  }

  const handleImageDragOver = (e: React.DragEvent, imageIndex: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    if (draggedImageIndex !== null && draggedImageIndex !== imageIndex) {
      setDragOverImageIndex(imageIndex)
    }
  }

  const handleImageDragLeave = () => {
    setDragOverImageIndex(null)
  }

  const handleImageDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    setDragOverImageIndex(null)

    if (draggedImageIndex === null || draggedImageIndex === dropIndex) {
      setDraggedImageIndex(null)
      return
    }

    const newImages = [...block.images]
    const [draggedImage] = newImages.splice(draggedImageIndex, 1)
    newImages.splice(dropIndex, 0, draggedImage)

    onChange({ ...block, images: newImages })
    setDraggedImageIndex(null)
  }

  const handleImageDragEnd = () => {
    setDraggedImageIndex(null)
    setDragOverImageIndex(null)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files).filter((file) => file.type.startsWith("image/"))

    files.forEach((file) => {
      const reader = new FileReader()
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string
        onChange({ ...block, images: [...block.images, dataUrl] })
      }
      reader.readAsDataURL(file)
    })
  }

  return (
    <div className="rounded-lg border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-14)] p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded bg-[var(--color-primary)] px-2 py-0.5 text-xs font-medium text-white">
            Скриншоты
          </span>
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
            placeholder="Результаты PageSpeed Insights"
            className="w-full rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)] px-3 py-2 text-[var(--color-grayscale-3)] placeholder:text-[var(--color-grayscale-8)] focus:border-[var(--color-primary)] focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm text-[var(--color-grayscale-6)]">Описание</label>
          <textarea
            ref={descriptionTextareaRef}
            value={block.description}
            onChange={handleDescriptionChange}
            placeholder="Опишите результаты анализа..."
            rows={3}
            className="w-full resize-none rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)] px-3 py-2 text-[var(--color-grayscale-3)] placeholder:text-[var(--color-grayscale-8)] focus:border-[var(--color-primary)] focus:outline-none"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm text-[var(--color-grayscale-6)]">Расположение</label>
            <select
              aria-label="Расположение изображений"
              value={block.layout || "full-width"}
              onChange={(e) => handleFieldChange("layout", e.target.value)}
              className="w-full rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)] px-3 py-2 text-[var(--color-grayscale-3)] focus:border-[var(--color-primary)] focus:outline-none"
            >
              <option value="full-width">На всю ширину</option>
              <option value="sidebar">Сбоку</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm text-[var(--color-grayscale-6)]">Размер изображений</label>
            <select
              aria-label="Размер изображений"
              value={block.imageSize || "medium"}
              onChange={(e) => handleFieldChange("imageSize", e.target.value)}
              className="w-full rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)] px-3 py-2 text-[var(--color-grayscale-3)] focus:border-[var(--color-primary)] focus:outline-none"
            >
              <option value="small">Маленький</option>
              <option value="medium">Средний</option>
              <option value="large">Большой</option>
            </select>
          </div>
        </div>

        {/* Кастомная ширина (опционально) */}
        <div>
          <label className="mb-1.5 block text-sm text-[var(--color-grayscale-6)]">Кастомная ширина (опционально)</label>
          <input
            type="text"
            value={block.customWidth || ""}
            onChange={(e) => handleFieldChange("customWidth", e.target.value)}
            placeholder="Например: 800px, 90%, 1200px"
            className="w-full rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)] px-3 py-2 text-[var(--color-grayscale-3)] placeholder:text-[var(--color-grayscale-8)] focus:border-[var(--color-primary)] focus:outline-none"
          />
          <p className="mt-1 text-xs text-[var(--color-grayscale-7)]">
            Если указано, перекрывает стандартный размер. Примеры: 800px, 90%, 100%
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm text-[var(--color-grayscale-6)]">
            Изображения ({block.images.length})
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            aria-label="Загрузить изображения"
            multiple
            onChange={handleImagesUpload}
            className="hidden"
          />
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-4 py-6 text-sm transition-all ${
              isDragging
                ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10"
                : "border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/5"
            }`}
          >
            <div className="flex items-center gap-2">
              <Upload
                className={`h-5 w-5 ${isDragging ? "text-[var(--color-primary)]" : "text-[var(--color-grayscale-6)]"}`}
              />
              <ImagePlus
                className={`h-5 w-5 ${isDragging ? "text-[var(--color-primary)]" : "text-[var(--color-grayscale-6)]"}`}
              />
            </div>
            <span
              className={isDragging ? "font-medium text-[var(--color-primary)]" : "text-[var(--color-grayscale-6)]"}
            >
              {isDragging ? "Отпустите файлы здесь" : "Перетащите изображения или кликните"}
            </span>
          </div>

          {block.images.length > 0 && (
            <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
              {block.images.map((img, imgIndex) => (
                <div
                  key={imgIndex}
                  draggable
                  onDragStart={(e) => handleImageDragStart(e, imgIndex)}
                  onDragOver={(e) => handleImageDragOver(e, imgIndex)}
                  onDragLeave={handleImageDragLeave}
                  onDrop={(e) => handleImageDrop(e, imgIndex)}
                  onDragEnd={handleImageDragEnd}
                  className={`group relative aspect-square cursor-move transition-all ${
                    draggedImageIndex === imgIndex ? "opacity-50" : ""
                  } ${
                    dragOverImageIndex === imgIndex ? "ring-2 ring-[var(--color-primary)] ring-offset-2" : ""
                  }`}
                >
                  <img
                    src={img || "/placeholder.svg"}
                    alt={`Скриншот ${imgIndex + 1}`}
                    className="h-full w-full rounded object-cover"
                    draggable={false}
                  />
                  <div className="absolute left-1 top-1 rounded bg-black/50 p-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <GripVertical className="h-3 w-3 text-white" />
                  </div>
                  <button
                    onClick={() => handleRemoveImage(imgIndex)}
                    aria-label={`Удалить изображение ${imgIndex + 1}`}
                    className="absolute -right-1.5 -top-1.5 rounded-full bg-red-500 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
