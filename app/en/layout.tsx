import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'WordGrow — Longest Synonym Finder',
  description: 'Auto-search for longer synonyms as you type using the Weblio English thesaurus',
}

export default function EnLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
