'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Sparkles, AlertCircle } from 'lucide-react'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { Platform } from '@/types/database'

function PlatformBadge({ platform, selected }: { platform: Platform; selected: boolean }) {
  const map: Record<Platform, { letter: string; bg: string }> = {
    facebook: { letter: 'f', bg: 'bg-blue-600' },
    twitter: { letter: 'X', bg: 'bg-slate-800' },
    linkedin: { letter: 'in', bg: 'bg-blue-800' },
  }
  const { letter, bg } = map[platform]
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center w-5 h-5 rounded text-white text-[10px] font-bold',
        selected ? 'bg-ms-blue' : bg
      )}
    >
      {letter}
    </span>
  )
}

const schema = z.object({
  topic: z.string().min(3, 'Topic must be at least 3 characters').max(300),
  description: z.string().max(1000).optional(),
  tone: z.enum(['professional', 'casual', 'witty', 'informative', 'inspirational']),
  platforms: z.array(z.enum(['facebook', 'twitter', 'linkedin'])).min(1, 'Select at least one platform'),
  target_date: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

const TONES = [
  { value: 'professional', label: 'Professional', emoji: '👔' },
  { value: 'casual', label: 'Casual', emoji: '😊' },
  { value: 'witty', label: 'Witty', emoji: '😄' },
  { value: 'informative', label: 'Informative', emoji: '📚' },
  { value: 'inspirational', label: 'Inspirational', emoji: '✨' },
] as const

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'facebook', label: 'Facebook' },
  { value: 'twitter', label: 'Twitter / X' },
  { value: 'linkedin', label: 'LinkedIn' },
]

export default function NewBriefForm() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  // Smart Scraper states
  const [showScraper, setShowScraper] = useState(false)
  const [scraperType, setScraperType] = useState<'url' | 'text'>('url')
  const [scraperInput, setScraperInput] = useState('')
  const [scraping, setScraping] = useState(false)
  const [scraperError, setScraperError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      tone: 'professional',
      platforms: [],
    },
  })

  const selectedPlatforms = watch('platforms') || []
  const selectedTone = watch('tone')

  async function handleAnalyzeSource() {
    if (!scraperInput.trim()) return
    setScraping(true)
    setScraperError(null)
    try {
      const res = await fetch('/api/analyze-source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: scraperType === 'url' ? scraperInput.trim() : undefined,
          text: scraperType === 'text' ? scraperInput.trim() : undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to analyze source')

      const { topic, description, tone } = json.brief
      if (topic) setValue('topic', topic, { shouldValidate: true })
      if (description) setValue('description', description, { shouldValidate: true })
      if (tone) setValue('tone', tone, { shouldValidate: true })

      setShowScraper(false)
      setScraperInput('')
    } catch (err) {
      setScraperError(err instanceof Error ? err.message : 'Source analysis failed')
    } finally {
      setScraping(false)
    }
  }

  function togglePlatform(platform: Platform) {
    if (selectedPlatforms.includes(platform)) {
      setValue(
        'platforms',
        selectedPlatforms.filter((p) => p !== platform),
        { shouldValidate: true }
      )
    } else {
      setValue('platforms', [...selectedPlatforms, platform], { shouldValidate: true })
    }
  }

  async function onSubmit(values: FormValues) {
    setSubmitting(true)
    setApiError(null)

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })

      const json = await res.json()

      if (!res.ok) {
        setApiError(json.error || 'Something went wrong')
        return
      }

      router.push(`/dashboard/briefs/${json.briefId}`)
    } catch {
      setApiError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="space-y-6">
      {/* Smart Scraper Accordion */}
      <div className="bg-purple-50/50 border border-purple-100 rounded-xl p-4 shadow-sm">
        <button
          type="button"
          onClick={() => setShowScraper(!showScraper)}
          className="flex items-center justify-between w-full text-left focus:outline-none"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600 shrink-0">
              <Sparkles size={16} />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-purple-900">Auto-fill with AI Scraper</h4>
              <p className="text-xs text-purple-700/80 mt-0.5">Paste a blog link or copy-paste text to generate your brief automatically</p>
            </div>
          </div>
          <span className="text-purple-600 text-xs font-semibold hover:underline">
            {showScraper ? 'Hide' : 'Show'}
          </span>
        </button>

        {showScraper && (
          <div className="mt-4 pt-4 border-t border-purple-100/50 space-y-4">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setScraperType('url'); setScraperInput(''); setScraperError(null) }}
                className={cn(
                  'px-3 py-1 rounded text-xs font-medium border transition',
                  scraperType === 'url'
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'bg-white text-purple-700 border-purple-200 hover:border-purple-300'
                )}
              >
                Website Link (URL)
              </button>
              <button
                type="button"
                onClick={() => { setScraperType('text'); setScraperInput(''); setScraperError(null) }}
                className={cn(
                  'px-3 py-1 rounded text-xs font-medium border transition',
                  scraperType === 'text'
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'bg-white text-purple-700 border-purple-200 hover:border-purple-300'
                )}
              >
                Raw Source Text
              </button>
            </div>

            <div className="space-y-2">
              {scraperType === 'url' ? (
                <input
                  type="url"
                  value={scraperInput}
                  onChange={(e) => setScraperInput(e.target.value)}
                  placeholder="e.g. https://mycompany.com/blog/new-launch"
                  className="w-full px-3 py-2 border border-purple-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-200"
                />
              ) : (
                <textarea
                  value={scraperInput}
                  onChange={(e) => setScraperInput(e.target.value)}
                  rows={4}
                  placeholder="Paste your newsletter draft, product release notes, or raw content here..."
                  className="w-full px-3 py-2 border border-purple-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-200 resize-none"
                />
              )}
            </div>

            {scraperError && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertCircle size={12} className="shrink-0" />
                {scraperError}
              </p>
            )}

            <div className="flex gap-2">
              <Button
                type="button"
                onClick={handleAnalyzeSource}
                loading={scraping}
                disabled={!scraperInput.trim()}
                className="bg-purple-600 hover:bg-purple-700 text-xs py-1.5"
              >
                <Sparkles size={13} />
                Analyze and Auto-fill Form
              </Button>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Topic */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Topic <span className="text-ms-red">*</span>
          </label>
          <input
            {...register('topic')}
            type="text"
            placeholder="e.g. Our new product launch — SaaS dashboard for SMBs"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ms-blue focus:border-transparent transition"
          />
          {errors.topic && (
            <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
              <AlertCircle size={12} /> {errors.topic.message}
            </p>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Additional context{' '}
            <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            {...register('description')}
            rows={3}
            placeholder="Key points, links, hashtags to include, things to avoid..."
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ms-blue focus:border-transparent transition resize-none"
          />
          {errors.description && (
            <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
              <AlertCircle size={12} /> {errors.description.message}
            </p>
          )}
        </div>

        {/* Tone */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tone <span className="text-ms-red">*</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {TONES.map(({ value, label, emoji }) => (
              <button
                key={value}
                type="button"
                onClick={() => setValue('tone', value, { shouldValidate: true })}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition',
                  selectedTone === value
                    ? 'bg-ms-blue text-white border-ms-blue'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-ms-blue hover:text-ms-blue'
                )}
              >
                <span>{emoji}</span>
                {label}
              </button>
            ))}
          </div>
          <input type="hidden" {...register('tone')} />
        </div>

        {/* Platforms */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Platforms <span className="text-ms-red">*</span>
          </label>
          <div className="flex gap-3">
            {PLATFORMS.map(({ value, label }) => {
              const selected = selectedPlatforms.includes(value)
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => togglePlatform(value)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm border transition flex-1 justify-center',
                    selected
                      ? 'bg-ms-blue/5 border-ms-blue text-ms-blue font-medium'
                      : 'bg-white border-gray-300 text-gray-600 hover:border-ms-blue'
                  )}
                >
                  <PlatformBadge platform={value} selected={selected} />
                  {label}
                  {selected && (
                    <span className="ml-auto w-4 h-4 rounded-full bg-ms-blue flex items-center justify-center">
                      <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                        <path d="M1 3l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          {errors.platforms && (
            <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
              <AlertCircle size={12} /> {errors.platforms.message}
            </p>
          )}
        </div>

        {/* Target date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Target publish date{' '}
            <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            {...register('target_date')}
            type="date"
            min={today}
            className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ms-blue focus:border-transparent transition"
          />
        </div>

        {/* API error */}
        {apiError && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{apiError}</p>
          </div>
        )}

        {/* Submit */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <p className="text-xs text-gray-400">
            AI will generate 3 variations per selected platform
          </p>
          <Button
            type="submit"
            loading={submitting}
            className="gap-2"
          >
            <Sparkles size={15} />
            {submitting ? 'Generating posts...' : 'Generate posts'}
          </Button>
        </div>
      </form>
    </div>
  )
}
