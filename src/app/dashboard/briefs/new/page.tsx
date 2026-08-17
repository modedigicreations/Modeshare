export const dynamic = 'force-dynamic'

import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { PenSquare } from 'lucide-react'
import NewBriefForm from './NewBriefForm'

export const metadata = { title: 'New Brief — Modeshare' }

export default function NewBriefPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-ms-red/10 flex items-center justify-center">
          <PenSquare size={20} className="text-ms-red" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">New Brief</h1>
          <p className="text-sm text-gray-500">
            Describe your topic and let AI generate platform-ready posts
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-gray-700">Brief Details</h2>
        </CardHeader>
        <CardBody>
          <NewBriefForm />
        </CardBody>
      </Card>
    </div>
  )
}
