'use client'

import { useState, useRef, useCallback } from 'react'

type Result = {
  word: string
  longest: string
  longestLength: number
  originalLength: number
  diff: number
  candidates: string[]
}

const DELIM = /[\s。、！？,.!?「」【】『』\n（）〔〕]/

/** テキストエリアの選択範囲またはカーソル直前のセグメントを返す */
function detectWord(
  text: string,
  selStart: number,
  selEnd: number,
): { word: string; start: number } {
  // 選択テキストを優先
  if (selStart !== selEnd) {
    return { word: text.substring(selStart, selEnd), start: selStart }
  }
  // 直前のデリミタからカーソルまでのセグメント
  const before = text.substring(0, selStart)
  const match = before.match(/[^\s。、！？,.!?「」【】『』\n（）〔〕]+$/)
  if (!match) return { word: '', start: selStart }
  const word = match[0]
  // 8文字超は自動検索しない（文全体を検索してしまうのを防ぐ）
  if (word.length > 8) return { word: '', start: selStart }
  return { word, start: selStart - word.length }
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export default function Home() {
  const [text, setText] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [currentWord, setCurrentWord] = useState('')
  const [wordStart, setWordStart] = useState(0)
  const [loading, setLoading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const fetchSuggestion = useCallback(async (word: string) => {
    if (!word || word.length < 2) { setResult(null); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/search?word=${encodeURIComponent(word)}`)
      if (!res.ok) { setResult(null); return }
      const data: Result = await res.json()
      setResult(data.diff > 0 ? data : null)
    } catch {
      setResult(null)
    } finally {
      setLoading(false)
    }
  }, [])

  function updateWord(ta: HTMLTextAreaElement, value: string) {
    const { word, start } = detectWord(value, ta.selectionStart, ta.selectionEnd)
    setCurrentWord(word)
    setWordStart(start)
    if (!word) { setResult(null); return }
    const delay = ta.selectionStart !== ta.selectionEnd ? 200 : 500
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestion(word), delay)
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const v = e.target.value
    setText(v)
    updateWord(e.target, v)
  }

  function handleSelect(e: React.SyntheticEvent<HTMLTextAreaElement>) {
    updateWord(e.currentTarget, text)
  }

  function accept(replacement: string) {
    const ta = textareaRef.current
    if (!ta) return
    const before = text.substring(0, wordStart) + replacement
    const after = text.substring(wordStart + currentWord.length)
    const next = before + after
    setText(next)
    setResult(null)
    setCurrentWord('')
    setTimeout(() => {
      ta.focus()
      ta.selectionStart = ta.selectionEnd = before.length
    }, 0)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Tab' && result) {
      e.preventDefault()
      accept(result.longest)
    }
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">文字数稼ぎ</h1>
        <p className="text-gray-400 text-sm mt-1">
          文章を書きながらカーソル位置（または選択テキスト）の単語を自動検索 →&nbsp;
          <kbd className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-xs font-mono">Tab</kbd>
          &nbsp;で長い類語に置換
        </p>
      </div>

      <textarea
        ref={textareaRef}
        value={text}
        onChange={handleChange}
        onSelect={handleSelect}
        onClick={handleSelect}
        onKeyUp={handleSelect}
        onKeyDown={handleKeyDown}
        placeholder="ここに文章を書いてください…"
        className="w-full h-52 px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white resize-none text-base leading-relaxed"
        autoFocus
      />

      {/* Suggestion bar */}
      <div className="mt-2 h-14 flex items-center">
        {loading && (
          <p className="text-sm text-gray-400 animate-pulse">検索中…</p>
        )}
        {!loading && result && (
          <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 w-full">
            <span className="text-gray-500 text-sm shrink-0">「{currentWord}」→</span>
            <button
              onClick={() => accept(result.longest)}
              className="text-blue-700 font-bold text-lg hover:text-blue-900 transition-colors truncate"
              title={result.longest}
            >
              {result.longest}
            </button>
            <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full shrink-0">
              +{result.diff}文字
            </span>
            <span className="text-gray-300 text-xs ml-auto shrink-0 hidden sm:block">
              Tab で置換
            </span>
          </div>
        )}
        {!loading && !result && (
          <p className="text-sm text-gray-300">
            {currentWord.length >= 2
              ? `「${currentWord}」より長い類語なし`
              : '単語を選択するか、区切り文字（、。）の後に単語を書くと検索します'}
          </p>
        )}
      </div>

      {/* Candidates */}
      {result && result.candidates.length > 1 && (
        <div className="mt-3 bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
          <p className="text-xs text-gray-400 mb-2">他の候補</p>
          <div className="flex flex-wrap gap-2">
            {result.candidates.slice(1, 8).map((w) => (
              <button
                key={w}
                onClick={() => accept(w)}
                className="text-sm text-gray-600 bg-gray-50 hover:bg-blue-50 hover:text-blue-700 border border-gray-200 rounded-lg px-3 py-1 transition-colors"
              >
                {w}
                <span className="text-gray-400 text-xs ml-1">{w.length}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 text-right text-sm text-gray-400">
        {text.length} 文字
      </div>
    </main>
  )
}
