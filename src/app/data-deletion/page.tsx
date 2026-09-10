import Link from 'next/link'
import { Trash2, ArrowLeft, CheckCircle2, ShieldCheck, Mail } from 'lucide-react'

export const metadata = {
  title: 'User Data Deletion Instructions — Modeshare',
  description: 'Instructions on how users can request deletion of their data and Facebook credentials from Modeshare.',
}

export default function DataDeletionPage() {
  const lastUpdated = 'September 10, 2026'

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition"
          >
            <ArrowLeft size={16} />
            Back to Modeshare
          </Link>
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Legal & Compliance
          </span>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 sm:p-12 shadow-sm space-y-8">
          <div className="border-b border-gray-100 pb-6">
            <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mb-4">
              <Trash2 size={24} />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">User Data Deletion Instructions</h1>
            <p className="text-sm text-gray-500 mt-1">Last Updated: {lastUpdated}</p>
          </div>

          <div className="space-y-6 text-sm text-gray-600 leading-relaxed">
            <p>
              Modeshare respects your privacy and gives you full control over the personal data and Facebook account information stored on our platform.
              In accordance with Meta / Facebook Platform policies, this page provides clear instructions on how you can remove your activities and data associated with Modeshare.
            </p>

            <div className="space-y-4">
              <h2 className="text-base font-semibold text-gray-900">Option 1: Disconnect Facebook Directly from Modeshare (Instant)</h2>
              <ol className="list-decimal pl-6 space-y-2">
                <li>Log in to your account at <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-800">https://modeshare.net</code>.</li>
                <li>Go to <strong>Settings</strong> from the left navigation.</li>
                <li>Under the <strong>Facebook API Integration</strong> card, click <strong>Disconnect</strong>.</li>
                <li>All stored Facebook User Access Tokens, Page Access Tokens, and Page mappings will be instantly deleted from our database.</li>
              </ol>
            </div>

            <div className="space-y-4">
              <h2 className="text-base font-semibold text-gray-900">Option 2: Remove Modeshare Access via Facebook Settings</h2>
              <ol className="list-decimal pl-6 space-y-2">
                <li>Log in to your Facebook account and go to <strong>Settings & Privacy</strong> &gt; <strong>Settings</strong>.</li>
                <li>In the left sidebar, click <strong>Business Integrations</strong> (or <strong>Apps and Websites</strong>).</li>
                <li>Locate <strong>Modeshare</strong> in the list.</li>
                <li>Click <strong>Remove</strong> to revoke all permissions granted to Modeshare.</li>
              </ol>
            </div>

            <div className="space-y-4">
              <h2 className="text-base font-semibold text-gray-900">Option 3: Request Manual Account & Complete Data Deletion</h2>
              <p>
                If you would like to permanently delete your entire Modeshare user account, profiles, briefs, and associated content from our servers, please send an email request to our Data Protection team:
              </p>
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-700 space-y-1">
                <p className="font-semibold text-gray-900">Data Deletion Request</p>
                <p>Email: <a href="mailto:support@modeshare.net" className="text-blue-600 hover:underline">support@modeshare.net</a></p>
                <p>Subject: <span className="font-mono text-xs">Request Data Deletion - [Your Email / User ID]</span></p>
                <p className="text-xs text-gray-500 pt-1">Requests are processed and permanently wiped within 48 business hours.</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
