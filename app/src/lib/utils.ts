import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateId(prefix: string = ""): string {
  const rand = Math.random().toString(36).slice(2, 10)
  const ts = Date.now().toString(36)
  return prefix ? `${prefix}-${ts}-${rand}` : `${ts}-${rand}`
}
