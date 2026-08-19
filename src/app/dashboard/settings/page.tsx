export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Settings, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react'
import BufferConnectButton from './BufferConnectButton'
import RoleSwitcher from './RoleSwitcher'

export const metadata = { title: 'Settings — Modeshare' }

interface Props {
  searchParams: Promise<{ success?: string; error?: string }>
}

export default async function SettingsPage({ searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?error=' + encodeURIComponent('No user session in SettingsPage'))

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { data: bufferConn } = await supabase
    .from('buffer_connections')
    .select('profile_ids, connected_at')
    .eq('user_id', user.id)
    .single()

  const params = await searchParams
  const bufferAuthUrl = '/api/buffer/connect'

  const connectedPlatforms = bufferConn
    ? Object.keys(bufferConn.profile_ids as Record<string, string>)
    : []

  const PLATFORM_NAMES: Record<string, string> = {
    facebook: 'Facebook',
    twitter: 'Twitter / X',
    linkedin: 'LinkedIn',
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
          <Settings size={20} className="text-gray-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500">Manage your account and integrations</p>
        </div>
      </div>

      {/* Status banners */}
      {params.success === 'buffer_connected' && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-3">
          <CheckCircle2 size={16} />
          Buffer connected successfully!
        </div>
      )}
      {params.error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          <AlertCircle size={16} />
          {params.error === 'buffer_auth_failed'
            ? 'Buffer authorization failed. Please try again.'
            : params.error === 'buffer_callback_failed'
              ? 'Could not complete Buffer connection. Check your credentials.'
              : params.error}
        </div>
      )}

      {/* Account info */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-gray-800">Account</h2>
        </CardHeader>
        <CardBody className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-500">Name</span>
            <span className="text-sm font-medium text-gray-900">{profile?.full_name || '—'}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-500">Email</span>
            <span className="text-sm font-medium text-gray-900">{profile?.email}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-gray-500">Role</span>
            <RoleSwitcher currentRole={profile?.role || 'creator'} />
          </div>
        </CardBody>
      </Card>

      {/* Buffer integration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-800">Buffer Integration</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Connect your Buffer account to publish posts to social media
              </p>
            </div>
            {bufferConn ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                <CheckCircle2 size={12} />
                Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                Not connected
              </span>
            )}
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          {bufferConn ? (
            <>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Connected social accounts
                </p>
                {connectedPlatforms.length > 0 ? (
                  <div className="space-y-2">
                    {connectedPlatforms.map((p) => (
                      <div key={p} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 size={14} className="text-green-500" />
                        <span className="text-gray-700">{PLATFORM_NAMES[p] || p}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">No platforms detected in Buffer account</p>
                )}
              </div>
              <div className="pt-2 border-t border-gray-100">
                {!process.env.BUFFER_CLIENT_ID || !process.env.BUFFER_REDIRECT_URI ? (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
                    Buffer configuration is missing. Reconnection disabled.
                  </div>
                ) : (
                  <BufferConnectButton href={bufferAuthUrl} reconnect />
                )}
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Connect Buffer to schedule and publish approved posts directly to Facebook,
                Twitter/X, and LinkedIn from Modeshare.
              </p>
              <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2.5 text-xs text-amber-700">
                You need a{' '}
                <a
                  href="https://buffer.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline inline-flex items-center gap-0.5"
                >
                  Buffer account <ExternalLink size={10} />
                </a>{' '}
                with your social profiles connected before linking here.
              </div>
              {!process.env.BUFFER_CLIENT_ID || !process.env.BUFFER_REDIRECT_URI ? (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-xs text-red-700 space-y-1">
                  <p className="font-semibold">Buffer Configuration Missing:</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {!process.env.BUFFER_CLIENT_ID && <li>`BUFFER_CLIENT_ID` is not set</li>}
                    {!process.env.BUFFER_REDIRECT_URI && <li>`BUFFER_REDIRECT_URI` is not set</li>}
                  </ul>
                  <p className="mt-1 text-[10px] text-red-500">
                    Configure these variables in your `.env.local` or Railway settings to enable Buffer connection.
                  </p>
                </div>
              ) : (
                <BufferConnectButton href={bufferAuthUrl} />
              )}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
