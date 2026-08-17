'use client'

import { useState } from 'react'
import { Post, Platform, PostStatus } from '@/types/database'
import {
  PLATFORM_LABELS,
  PLATFORM_COLORS,
  POST_STATUS_COLORS,
  POST_STATUS_LABELS,
  formatDate,
  truncate,
  cn,
} from '@/lib/utils'
import Badge from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import PushToBufferButton from '@/components/ui/PushToBufferButton'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'

type EnrichedPost = Post & { brief: { topic: string } }

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface Props {
  posts: EnrichedPost[]
}

export default function CalendarClient({ posts }: Props) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selectedPost, setSelectedPost] = useState<EnrichedPost | null>(null)
  const [postList, setPostList] = useState(posts)

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }

  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  // Build calendar grid
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null)

  // Map posts to calendar day
  function postsForDay(day: number): EnrichedPost[] {
    return postList.filter((p) => {
      const d = p.scheduled_at ? new Date(p.scheduled_at) : null
      if (!d) return false
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day
    })
  }

  // Posts without a scheduled date (approved but not yet scheduled)
  const unscheduledPosts = postList.filter(
    (p) => p.status === 'approved' && !p.scheduled_at
  )

  function handleBufferSuccess(postId: string) {
    setPostList((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, status: 'scheduled' as PostStatus } : p
      )
    )
    setSelectedPost(null)
  }

  return (
    <div className="space-y-4">
      {/* Calendar header */}
      <Card>
        <div className="p-4">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={prevMonth}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-600"
            >
              <ChevronLeft size={18} />
            </button>
            <h2 className="font-semibold text-gray-900">
              {MONTH_NAMES[month]} {year}
            </h2>
            <button
              onClick={nextMonth}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-600"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAY_NAMES.map((d) => (
              <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar cells */}
          <div className="grid grid-cols-7 gap-px bg-gray-100 border border-gray-100 rounded-xl overflow-hidden">
            {cells.map((day, idx) => {
              const dayPosts = day ? postsForDay(day) : []
              const isToday =
                day === today.getDate() &&
                month === today.getMonth() &&
                year === today.getFullYear()

              return (
                <div
                  key={idx}
                  className={cn(
                    'bg-white min-h-[80px] p-1.5',
                    !day && 'bg-gray-50/50'
                  )}
                >
                  {day && (
                    <>
                      <span
                        className={cn(
                          'inline-flex w-6 h-6 items-center justify-center rounded-full text-xs font-medium mb-1',
                          isToday
                            ? 'bg-ms-red text-white'
                            : 'text-gray-700'
                        )}
                      >
                        {day}
                      </span>
                      <div className="space-y-0.5">
                        {dayPosts.slice(0, 3).map((p) => (
                          <button
                            key={p.id}
                            onClick={() => setSelectedPost(p)}
                            className={cn(
                              'w-full text-left px-1.5 py-0.5 rounded text-[10px] font-medium truncate transition hover:opacity-80',
                              PLATFORM_COLORS[p.platform as Platform]
                            )}
                          >
                            {PLATFORM_LABELS[p.platform as Platform]}
                          </button>
                        ))}
                        {dayPosts.length > 3 && (
                          <p className="text-[10px] text-gray-400 pl-1">
                            +{dayPosts.length - 3} more
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </Card>

      {/* Post detail drawer */}
      {selectedPost && (
        <Card className="border-ms-blue/30">
          <div className="px-5 py-4 bg-ms-blue/5 border-b border-ms-blue/10 flex items-start justify-between">
            <div>
              <p className="font-semibold text-gray-900">{selectedPost.brief.topic}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={PLATFORM_COLORS[selectedPost.platform as Platform]}>
                  {PLATFORM_LABELS[selectedPost.platform as Platform]}
                </Badge>
                <Badge className={POST_STATUS_COLORS[selectedPost.status as PostStatus]}>
                  {POST_STATUS_LABELS[selectedPost.status as PostStatus]}
                </Badge>
                {selectedPost.scheduled_at && (
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <CalendarDays size={11} />
                    {formatDate(selectedPost.scheduled_at)}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => setSelectedPost(null)}
              className="text-gray-400 hover:text-gray-600 text-lg leading-none"
            >
              ×
            </button>
          </div>
          <div className="px-5 py-4 space-y-4">
            <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
              {selectedPost.content}
            </p>
            {selectedPost.status === 'approved' && (
              <PushToBufferButton
                postId={selectedPost.id}
                onSuccess={() => handleBufferSuccess(selectedPost.id)}
              />
            )}
          </div>
        </Card>
      )}

      {/* Unscheduled approved posts */}
      {unscheduledPosts.length > 0 && (
        <Card>
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800">Approved — Not Yet Scheduled</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Push to Buffer to add these to the queue
            </p>
          </div>
          <div className="divide-y divide-gray-100">
            {unscheduledPosts.map((p) => (
              <div key={p.id} className="px-5 py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{p.brief.topic}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge className={cn(PLATFORM_COLORS[p.platform as Platform], 'text-[10px]')}>
                      {PLATFORM_LABELS[p.platform as Platform]}
                    </Badge>
                    <span className="text-xs text-gray-400 truncate">{truncate(p.content, 60)}</span>
                  </div>
                </div>
                <PushToBufferButton
                  postId={p.id}
                  onSuccess={() => handleBufferSuccess(p.id)}
                />
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
