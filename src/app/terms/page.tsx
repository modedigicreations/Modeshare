import Link from 'next/link'
import { FileText, ArrowLeft, CheckCircle2, AlertCircle, Mail } from 'lucide-react'

export const metadata = {
  title: 'Terms of Service — Modeshare',
  description: 'Terms of Service for Modeshare Marketing Platform and social publishing tools.',
}

export default function TermsOfServicePage() {
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
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
              <FileText size={24} />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Terms of Service</h1>
            <p className="text-sm text-gray-500 mt-1">Last Updated: {lastUpdated}</p>
          </div>

          <section className="space-y-3 text-sm text-gray-600 leading-relaxed">
            <h2 className="text-lg font-semibold text-gray-900">1. Acceptance of Terms</h2>
            <p>
              By accessing or using Modeshare (<code className="text-xs bg-gray-100 px-1 py-0.5 rounded">https://modeshare.net</code>), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the platform.
            </p>
          </section>

          <section className="space-y-3 text-sm text-gray-600 leading-relaxed">
            <h2 className="text-lg font-semibold text-gray-900">2. Service Description</h2>
            <p>
              Modeshare provides content generation, review workflows, approval management, scheduling, and analytics synchronization across connected social channels, including Meta Facebook Pages and Buffer accounts.
            </p>
          </section>

          <section className="space-y-3 text-sm text-gray-600 leading-relaxed">
            <h2 className="text-lg font-semibold text-gray-900">3. User Responsibilities & Conduct</h2>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>You must maintain the security and confidentiality of your credentials and connected social tokens.</li>
              <li>You agree not to publish illegal, abusive, infringing, or harmful content through the platform.</li>
              <li>You agree to comply with all applicable terms of third-party platforms, including Meta&apos;s Platform Terms and Community Standards.</li>
            </ul>
          </section>

          <section className="space-y-3 text-sm text-gray-600 leading-relaxed">
            <h2 className="text-lg font-semibold text-gray-900">4. Third-Party Integrations</h2>
            <p>
              Modeshare integrates with third-party APIs including Meta / Facebook Graph API and Buffer. We do not control third-party service uptime, API limits, or account terminations imposed by third-party providers.
            </p>
          </section>

          <section className="space-y-3 text-sm text-gray-600 leading-relaxed">
            <h2 className="text-lg font-semibold text-gray-900">5. Termination</h2>
            <p>
              We reserve the right to suspend or terminate account access for violations of these Terms or misuse of the platform. You may discontinue use and delete your account or social connections at any time in Settings.
            </p>
          </section>

          <section className="space-y-3 border-t border-gray-100 pt-6">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Mail size={18} className="text-indigo-600" />
              6. Contact Information
            </h2>
            <p className="text-sm text-gray-600">
              For any questions regarding these Terms, contact us at <a href="mailto:support@modeshare.net" className="text-blue-600 underline">support@modeshare.net</a>.
            </p>
          </section>
        </div>
      </main>
    </div>
  )
}
