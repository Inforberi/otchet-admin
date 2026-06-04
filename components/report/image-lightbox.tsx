"use client"

import { useEffect, useCallback, useState } from "react"
import { createPortal } from "react-dom"
import { X, ChevronLeft, ChevronRight } from "lucide-react"

interface ImageLightboxProps {
  images: string[]
  captions?: (string | null | undefined)[]
  currentIndex: number
  onClose: () => void
  onPrev: () => void
  onNext: () => void
}

const getCaption = (
  captions: (string | null | undefined)[] | undefined,
  index: number,
): string | null => {
  const value = captions?.[index]?.trim()
  return value ? value : null
}

export function ImageLightbox({
  images,
  captions,
  currentIndex,
  onClose,
  onPrev,
  onNext,
}: ImageLightboxProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowLeft") onPrev()
      if (e.key === "ArrowRight") onNext()
    },
    [onClose, onPrev, onNext],
  )

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = ""
    }
  }, [handleKeyDown])

  if (!mounted) return null

  const currentCaption = getCaption(captions, currentIndex)
  const showCounter = images.length > 1
  const showFooter = Boolean(currentCaption) || showCounter
  const imageMaxClass = showFooter
    ? "max-h-[calc(90vh-5rem)] max-w-[90vw]"
    : "max-h-[90vh] max-w-[90vw]"

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90" onClick={onClose}>
      <button
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
      >
        <X className="h-6 w-6" />
      </button>

      {images.length > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onPrev()
            }}
            className="absolute left-4 rounded-full bg-white/10 p-3 text-white transition-colors hover:bg-white/20"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onNext()
            }}
            className="absolute right-4 rounded-full bg-white/10 p-3 text-white transition-colors hover:bg-white/20"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      <div className={imageMaxClass} onClick={(e) => e.stopPropagation()}>
        <img
          src={images[currentIndex] || "/placeholder.svg"}
          alt={currentCaption || `Изображение ${currentIndex + 1}`}
          className={`${imageMaxClass} object-contain`}
        />
      </div>

      {showFooter && (
        <div
          className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 px-4 pb-4 pt-2"
          onClick={(e) => e.stopPropagation()}
        >
          {currentCaption && (
            <p className="max-w-3xl text-center text-sm leading-relaxed text-white/90">
              {currentCaption}
            </p>
          )}
          {showCounter && (
            <div className="rounded-full bg-white/10 px-4 py-2 text-sm text-white">
              {currentIndex + 1} / {images.length}
            </div>
          )}
        </div>
      )}
    </div>,
    document.body,
  )
}
