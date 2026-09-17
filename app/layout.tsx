import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'モジノビ — 類語最長語検索',
  description: '入力した単語の類語の中で最も文字数が多い言葉をWeblioから検索します',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  )
}
