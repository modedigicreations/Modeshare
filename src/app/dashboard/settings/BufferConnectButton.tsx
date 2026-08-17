'use client'

import { ExternalLink, RefreshCw } from 'lucide-react'

interface Props {
  href: string
  reconnect?: boolean
}

export default function BufferConnectButton({ href, reconnect = false }: Props) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-2 px-4 py-2 bg-ms-blue hover:bg-ms-blue-dark text-white text-sm font-medium rounded-lg transition"
    >
      {reconnect ? (
        <>
          <RefreshCw size={14} />
          Reconnect Buffer
        </>
      ) : (
        <>
          <ExternalLink size={14} />
          Connect Buffer account
        </>
      )}
    </a>
  )
}
