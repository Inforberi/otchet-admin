"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    router.push("/reports")
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-grayscale-16)]">
      <div className="text-[var(--color-grayscale-6)]">Загрузка...</div>
    </div>
  )
}
