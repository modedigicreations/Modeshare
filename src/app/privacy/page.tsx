import Link from 'next/link'
import { Shield, ArrowLeft, Lock, Database, Eye, RefreshCw, Mail, Trash2 } from 'lucide-react'


export const metadata = {
  title: 'Privacy Policy — Modeshare',
  description: 'Privacy Policy for Modeshare Marketing Platform and Meta / Facebook API integration.',
}

export default function PrivacyPolicyPage() {
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
          {/* Title banner */}
          <div className="border-b border-gray-100 pb-6">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
              <Shield size={24} />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Privacy Policy</h1>
            <p className="text-sm text-gray-500 mt-1">Last Updated: {lastUpdated}</p>
          </div>

          {/* Section 1: Overview */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Eye size={18} className="text-blue-600" />
              1. Overview
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Modeshare (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;) is an AI-assisted marketing and social media
              publishing platform designed to help teams generate, review, approve, schedule, and publish content across social networks, including Facebook, Twitter/X, and LinkedIn.
            </p>
            <p className="text-sm text-gray-600 leading-relaxed">
              This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you access or use Modeshare at <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-800">https://modeshare.net</code>, including when you connect third-party platforms such as Meta / Facebook and Buffer.
            </p>
          </section>

          {/* Section 2: Information We Collect */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Database size={18} className="text-blue-600" />
              2. Information We Collect
            </h2>
            <div className="space-y-2 text-sm text-gray-600">
              <p><strong>A. Account & Profile Information:</strong> When you register or log in, we collect your email address, full name, and role permissions.</p>
              <p><strong>B. Content Data:</strong> Information contained in content briefs, AI-generated post variants, reviewer notes, and scheduled publishing dates.</p>
              <p><strong>C. Meta / Facebook Data:</strong> When you connect your Facebook Page via the Meta Graph API, we access and store:</p>
              <ul className="list-disc pl-6 space-y-1 text-gray-600">
                <li>Your Facebook User ID and long-lived OAuth access token (encrypted).</li>
                <li>Facebook Page details: Page ID, Page Name, category, and Page Access Token.</li>
                <li>Post publishing status and basic engagement metrics (reactions, comments, shares) for posts published through Modeshare.</li>
              </ul>
              <p className="text-xs text-gray-500 italic bg-gray-50 p-3 rounded-lg border border-gray-100 mt-2">
                We only request permissions strictly required for social scheduling and analytics (<code className="font-mono">pages_show_list</code>, <code className="font-mono">pages_read_engagement</code>, <code className="font-mono">pages_manage_posts</code>, <code className="font-mono">public_profile</code>). We do NOT access private user messages, personal friends lists, or private personal feeds.
              </p>
            </div>
          </section>

          {/* Section 3: How We Use Your Information */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <RefreshCw size={18} className="text-blue-600" />
              3. How We Use Your Information
            </h2>
            <ul className="list-disc pl-6 space-y-1.5 text-sm text-gray-600">
              <li>To provide, operate, and maintain the Modeshare content management dashboard.</li>
              <li>To publish and schedule approved posts directly to your connected Facebook Pages or Buffer queue.</li>
              <li>To fetch performance metrics (likes, reactions, comments) to display engagement analytics in your dashboard.</li>
              <li>To send notifications regarding pending post approvals or system alerts.</li>
              <li>To maintain platform security, prevent unauthorized access, and troubleshoot service issues.</li>
            </ul>
          </section>

          {/* Section 4: Data Sharing & Third-Party Services */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Lock size={18} className="text-blue-600" />
              4. Data Sharing & Third-Party Services
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              We do NOT sell, rent, or monetize your personal data. We share information only with service providers strictly necessary to deliver platform functionality:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-sm text-gray-600">
              <li><strong>Meta Platforms, Inc. (Facebook API):</strong> To schedule, publish, and sync Page posts. Subject to the <a href="https://www.facebook.com/privacy/policy/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Meta Privacy Policy</a>.</li>
              <li><strong>Buffer:</strong> To queue and publish multi-channel social media posts.</li>
              <li><strong>Supabase:</strong> For secure database storage, authentication, and Row Level Security (RLS).</li>
              <li><strong>DeepSeek API:</strong> For AI text generation and automated post rewriting.</li>
            </ul>
          </section>

          {/* Section 5: Data Security & Retention */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Shield size={18} className="text-blue-600" />
              5. Data Security & Retention
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              We implement enterprise-grade security practices, including HTTPS encryption in transit, encrypted token storage at rest, and granular Row Level Security (RLS) policies ensuring users only access authorized organizational data.
            </p>
            <p className="text-sm text-gray-600 leading-relaxed">
              We retain account data and access tokens only for as long as your integration remains active or as required by law. You can disconnect your Facebook account at any time in Settings.
            </p>
          </section>

          {/* Section 6: User Rights & Data Deletion */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Trash2 size={18} className="text-blue-600" />
              6. User Rights & Data Deletion
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              You have full rights to access, modify, or permanently delete your data. To disconnect your Facebook account or request complete data deletion:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-sm text-gray-600">
              <li>Navigate to <strong>Settings</strong> &gt; <strong>Facebook API Integration</strong> and click <strong>Disconnect</strong>.</li>
              <li>View our dedicated <Link href="/data-deletion" className="text-blue-600 underline font-medium">Data Deletion Instructions page</Link>.</li>
              <li>Contact our team directly at <a href="mailto:support@modeshare.net" className="text-blue-600 underline">support@modeshare.net</a> to request immediate deletion of all stored credentials and profiles.</li>
            </ul>
          </section>

          {/* Section 7: Contact Us */}
          <section className="space-y-3 border-t border-gray-100 pt-6">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Mail size={18} className="text-blue-600" />
              7. Contact Us
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              If you have any questions, concerns, or requests regarding this Privacy Policy or your data, please contact:
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-700 space-y-1">
              <p className="font-semibold text-gray-900">Modeshare Legal & Privacy Team</p>
              <p>Email: <a href="mailto:support@modeshare.net" className="text-blue-600 hover:underline">support@modeshare.net</a></p>
              <p>Website: <a href="https://modeshare.net" className="text-blue-600 hover:underline">https://modeshare.net</a></p>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
