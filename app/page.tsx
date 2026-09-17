'use client'

import { useState, useRef } from 'react'

type SearchResult = {
  word: string
  longest: string
  longestLength: number
  originalLength: number
  diff: number
  candidates: string[]
}

export default function Home() {
  const [input, setInput] = useState('')
  const [result, setResult] = useState<SearchResult | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function search(word: string) {
    if (!word.trim()) return
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const res = await fetch(`/api/search?word=${encodeURIComponent(word.trim())}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'エラーが発生しました')
      } else {
        setResult(data as SearchResult)
      }
    } catch {
      setError('通信エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') search(input)
  }

  return (
    <main className="max-w-xl mx-auto px-4 py-16">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">文字数稼ぎ</h1>
        <p className="text-gray-500 text-sm">
          単語を入力すると、同じ意味で一番長い類語を探します
        </p>
      </div>

      <div className="flex gap-2 mb-8">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="例：嬉しい"
          className="flex-1 px-4 py-3 text-lg border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
          autoFocus
        />
        <button
          onClick={() => search(input)}
          disabled={loading || !input.trim()}
          className="px-6 py-3 bg-blue-500 text-white rounded-xl font-medium shadow-sm hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? '検索中…' : '検索'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-4 text-sm">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <p className="text-xs text-gray-400 mb-1">最長の類語</p>
            <p className="text-4xl font-bold text-gray-800 mb-3">{result.longest}</p>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="bg-blue-100 text-blue-700 text-sm font-medium px-3 py-1 rounded-full">
                {result.longestLength}文字
              </span>
              {result.diff > 0 && (
                <span className="bg-green-100 text-green-700 text-sm font-medium px-3 py-1 rounded-full">
                  「{result.word}」より +{result.diff}文字
                </span>
              )}
              {result.diff === 0 && (
                <span className="bg-gray-100 text-gray-500 text-sm px-3 py-1 rounded-full">
                  「{result.word}」と同じ文字数
                </span>
              )}
            </div>
          </div>

          {result.candidates.length > 1 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
              <p className="text-xs text-gray-400 mb-3">他の候補（文字数順）</p>
              <ul className="space-y-2">
                {result.candidates.slice(1).map((w) => (
                  <li
                    key={w}
                    className="flex justify-between items-center text-sm text-gray-700 hover:bg-gray-50 px-2 py-1 rounded-lg cursor-pointer"
                    onClick={() => {
                      setInput(w)
                      search(w)
                    }}
                  >
                    <span>{w}</span>
                    <span className="text-gray-400 ml-4">{w.length}文字</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </main>
  )
}
