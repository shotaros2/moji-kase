'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Link from 'next/link'

type Result = {
  word: string
  longest: string
  longestLength: number
  originalLength: number
  diff: number
  candidates: string[]
}

function detectWord(
  text: string,
  selStart: number,
  selEnd: number,
): { word: string; start: number } {
  if (selStart !== selEnd) {
    return { word: text.substring(selStart, selEnd), start: selStart }
  }
  const before = text.substring(0, selStart)
  const match = before.match(/[a-zA-Z']+$/)
  if (!match) return { word: '', start: selStart }
  const word = match[0]
  if (word.length > 20) return { word: '', start: selStart }
  return { word, start: selStart - word.length }
}

export default function EnPage() {
  const [text, setText] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [predictions, setPredictions] = useState<string[]>([])
  const [currentWord, setCurrentWord] = useState('')
  const [wordStart, setWordStart] = useState(0)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  function clearAll() {
    if (!window.confirm('Clear all text?')) return
    setText('')
    setResult(null)
    setCurrentWord('')
    setPredictions([])
    textareaRef.current?.focus()
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  useEffect(() => {
    try {
      const saved = localStorage.getItem('wordgrow-text')
      if (saved) setText(saved)
    } catch {}
  }, [])

  useEffect(() => {
    try { localStorage.setItem('wordgrow-text', text) } catch {}
  }, [text])

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const predictDebounceRef = useRef<ReturnType<typeof setTimeout>>()

  const fetchSuggestion = useCallback(async (word: string) => {
    if (!word || word.length < 2) { setResult(null); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/search-en?word=${encodeURIComponent(word)}`)
      if (!res.ok) { setResult(null); return }
      const data: Result = await res.json()
      setResult(data.diff > 0 ? data : null)
    } catch {
      setResult(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchPredictions = useCallback(async (word: string) => {
    if (!word || word.length < 2) { setPredictions([]); return }
    try {
      // Prefix completions + related words in parallel
      const [compRes, relRes] = await Promise.all([
        fetch(`https://api.datamuse.com/words?sp=${encodeURIComponent(word)}*&max=8`),
        fetch(`https://api.datamuse.com/words?ml=${encodeURIComponent(word)}&max=8`),
      ])
      const [compData, relData]: { word: string }[][] = await Promise.all([
        compRes.ok ? compRes.json() : Promise.resolve([]),
        relRes.ok ? relRes.json() : Promise.resolve([]),
      ])
      const seen = new Set<string>([word.toLowerCase()])
      const merged: string[] = []
      for (const { word: w } of [...compData, ...relData]) {
        const lw = w.toLowerCase()
        if (!seen.has(lw) && /^[a-zA-Z'-]+$/.test(w)) {
          seen.add(lw)
          merged.push(w)
          if (merged.length >= 10) break
        }
      }
      setPredictions(merged)
    } catch {
      setPredictions([])
    }
  }, [])

  function scheduleSearch(word: string, start: number, delay = 500) {
    setCurrentWord(word)
    setWordStart(start)
    clearTimeout(debounceRef.current)
    clearTimeout(predictDebounceRef.current)
    if (!word) { setResult(null); setPredictions([]); return }
    // Predictions: fast (250ms)
    predictDebounceRef.current = setTimeout(() => fetchPredictions(word), 250)
    // Synonym search: slower (500ms)
    debounceRef.current = setTimeout(() => fetchSuggestion(word), delay)
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const v = e.target.value
    setText(v)
    const { word, start } = detectWord(v, e.target.selectionStart, e.target.selectionEnd)
    scheduleSearch(word, start, e.target.selectionStart !== e.target.selectionEnd ? 200 : 500)
  }

  function handleSelect(e: React.SyntheticEvent<HTMLTextAreaElement>) {
    const ta = e.currentTarget
    const { word, start } = detectWord(text, ta.selectionStart, ta.selectionEnd)
    scheduleSearch(word, start, ta.selectionStart !== ta.selectionEnd ? 200 : 500)
  }

  function accept(replacement: string) {
    const ta = textareaRef.current
    if (!ta) return
    const before = text.substring(0, wordStart) + replacement
    const after = text.substring(wordStart + currentWord.length)
    const next = before + after
    setText(next)
    setResult(null)
    setPredictions([])
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
      <div className="mb-6 text-center">
        <h1 className="text-6xl font-bold tracking-wide text-gray-900">WordGrow</h1>
        <p className="text-gray-400 text-sm mt-1">
          Auto-search synonyms as you type →&nbsp;
          <span className="sm:hidden">Tap</span>
          <span className="hidden sm:inline">
            Tap or <kbd className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-xs font-mono">Tab</kbd>
          </span>
          &nbsp;to replace with a longer one
        </p>
      </div>

      <div className="flex justify-end mb-1">
        <button
          onClick={clearAll}
          disabled={mounted ? !text : false}
          className="text-sm font-medium text-red-500 hover:text-white hover:bg-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors px-3 py-1.5 rounded-lg border border-red-300 hover:border-red-500"
        >
          Clear all
        </button>
      </div>

      <textarea
        ref={textareaRef}
        value={text}
        onChange={handleChange}
        onSelect={handleSelect}
        onClick={handleSelect}
        onKeyUp={handleSelect}
        onKeyDown={handleKeyDown}
        placeholder="Start writing here…"
        className="w-full h-52 px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white resize-none text-base leading-relaxed"
        autoFocus
      />

      {/* Predictions row */}
      {predictions.length > 0 && (
        <div className="mt-2">
          <p className="text-xs text-gray-400 mb-1.5">Predictions</p>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {predictions.map((w) => (
              <button
                key={w}
                onClick={() => accept(w)}
                className="text-sm text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-1.5 whitespace-nowrap hover:bg-purple-50 hover:text-purple-700 hover:border-purple-200 active:scale-95 transition-all shrink-0"
              >
                {w}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Synonym suggestion bar */}
      <div className="mt-2 min-h-[3.5rem] flex items-center">
        {loading && (
          <p className="text-sm text-gray-400 animate-pulse">Searching…</p>
        )}
        {!loading && result && (
          <div className="flex items-center gap-3 rounded-xl px-4 py-2.5 w-full border bg-blue-50 border-blue-200">
            <span className="text-gray-500 text-sm shrink-0">
              &ldquo;{currentWord}&rdquo; →
            </span>
            <button
              onClick={() => accept(result.longest)}
              className="font-bold text-lg text-blue-700 hover:text-blue-900 active:scale-95 transition-all truncate underline decoration-dotted underline-offset-2"
              title="Tap / Tab to replace"
            >
              {result.longest}
            </button>
            <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full shrink-0">
              +{result.diff} chars
            </span>
            <span className="text-gray-300 text-xs ml-auto shrink-0">
              <span className="hidden sm:inline">Tab /&nbsp;</span>Tap
            </span>
          </div>
        )}
        {!loading && !result && (
          <p className="text-sm text-gray-300">
            {currentWord.length >= 2
              ? `No longer synonym found for "${currentWord}"`
              : 'Select a word, or type after a space/punctuation to search'}
          </p>
        )}
      </div>

      {/* Other synonym candidates */}
      {result && result.candidates.length > 1 && (
        <div className="mt-3 bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
          <p className="text-xs text-gray-400 mb-2">Other candidates</p>
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

      <div className="mt-4 flex items-center justify-between text-sm text-gray-400">
        <span>{text.trim() ? text.trim().split(/\s+/).length : 0} words</span>
      </div>

      {/* Output block */}
      {mounted && text && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-gray-400">Your text</p>
            <button
              onClick={copyText}
              className="text-xs px-3 py-1 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-500 transition-colors"
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <pre className="w-full bg-gray-900 text-gray-100 rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap break-all font-sans select-all">
            {text}
          </pre>
        </div>
      )}

      <div className="mt-8 text-center">
        <Link href="/" className="text-xs text-gray-300 hover:text-gray-500 transition-colors">
          日本語版 (モジノビ) →
        </Link>
      </div>
    </main>
  )
}
