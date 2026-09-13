import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { Platform, PostStatus, BriefStatus, UserRole } from '@/types/database'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const PLATFORM_LABELS: Record<Platform, string> = {
  facebook: 'Facebook',
  twitter: 'Twitter / X',
  linkedin: 'LinkedIn',
}

export const PLATFORM_CHAR_LIMITS: Record<Platform, number> = {
  facebook: 63206,
  twitter: 280,
  linkedin: 3000,
}

export const PLATFORM_COLORS: Record<Platform, string> = {
  facebook: 'bg-blue-600 text-white',
  twitter: 'bg-sky-500 text-white',
  linkedin: 'bg-blue-800 text-white',
}

export const POST_STATUS_LABELS: Record<PostStatus, string> = {
  pending_review: 'Pending Review',
  approved: 'Approved',
  rejected: 'Rejected',
  scheduled: 'Scheduled',
  published: 'Published',
}

export const POST_STATUS_COLORS: Record<PostStatus, string> = {
  pending_review: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  scheduled: 'bg-blue-100 text-blue-800',
  published: 'bg-purple-100 text-purple-800',
}

export const BRIEF_STATUS_LABELS: Record<BriefStatus, string> = {
  pending_generation: 'Generating...',
  generated: 'Generated',
  in_review: 'In Review',
  approved: 'Approved',
  rejected: 'Rejected',
}

export const ROLE_LABELS: Record<UserRole, string> = {
  creator: 'Creator',
  approver: 'Approver',
  admin: 'Admin',
  super_admin: 'Super Admin',
}

export function truncate(text: string, length: number): string {
  if (text.length <= length) return text
  return text.slice(0, length) + '...'
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function getAppOrigin(request?: { headers?: { get: (name: string) => string | null } }): string {
  // 1. Check x-forwarded-host / host headers if valid public domain
  if (request && typeof request.headers?.get === 'function') {
    const forwardedHost = request.headers.get('x-forwarded-host')
    const host = forwardedHost || request.headers.get('host')
    const proto = request.headers.get('x-forwarded-proto') || 'https'
    if (host && !host.includes('localhost:8080') && !host.includes('127.0.0.1:8080')) {
      return `${proto}://${host}`.replace(/\/+$/, '')
    }
  }

  // 2. Check NEXT_PUBLIC_APP_URL
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').trim().replace(/\/+$/, '')
  if (appUrl && !appUrl.includes('localhost:8080') && !appUrl.includes('127.0.0.1:8080')) {
    return appUrl
  }

  return 'https://modeshare.net'
}

