'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

type Result = {
  word: string
  longest: string
  longestLength: number
  originalLength: number
  diff: number
  candidates: string[]
}

const DELIM = /[\s。、！？,.!?「」【】『』\n（）〔〕]/

function detectWord(
  text: string,
  selStart: number,
  selEnd: number,
): { word: string; start: number } {
  if (selStart !== selEnd) {
    return { word: text.substring(selStart, selEnd), start: selStart }
  }
  const before = text.substring(0, selStart)
  const match = before.match(/[^\s。、！？,.!?「」【】『』\n（）〔〕]+$/)
  if (!match) return { word: '', start: selStart }
  const word = match[0]
  if (word.length > 8) return { word: '', start: selStart }
  return { word, start: selStart - word.length }
}

export default function Home() {
  const [text, setText] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [currentWord, setCurrentWord] = useState('')
  const [wordStart, setWordStart] = useState(0)
  const [loading, setLoading] = useState(false)
  const [composing, setComposing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  function clearAll() {
    setText('')
    setResult(null)
    setCurrentWord('')
    textareaRef.current?.focus()
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  // ハイドレーション後にlocalStorageから復元
  useEffect(() => {
    try {
      const saved = localStorage.getItem('moji-kase-text')
      if (saved) setText(saved)
    } catch {}
  }, [])

  // textが変わるたびに保存
  useEffect(() => {
    try { localStorage.setItem('moji-kase-text', text) } catch {}
  }, [text])

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const compositionStartPosRef = useRef(0)

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

  function scheduleSearch(word: string, start: number, delay = 500) {
    setCurrentWord(word)
    setWordStart(start)
    clearTimeout(debounceRef.current)
    if (!word) { setResult(null); return }
    debounceRef.current = setTimeout(() => fetchSuggestion(word), delay)
  }

  // ── 通常の変更（非IME）──────────────────────────────
  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const v = e.target.value
    setText(v)
    if (composing) return  // IME中は compositionUpdate に任せる
    const { word, start } = detectWord(v, e.target.selectionStart, e.target.selectionEnd)
    scheduleSearch(word, start, e.target.selectionStart !== e.target.selectionEnd ? 200 : 500)
  }

  function handleSelect(e: React.SyntheticEvent<HTMLTextAreaElement>) {
    if (composing) return
    const ta = e.currentTarget
    const { word, start } = detectWord(text, ta.selectionStart, ta.selectionEnd)
    scheduleSearch(word, start, ta.selectionStart !== ta.selectionEnd ? 200 : 500)
  }

  // ── IME コンポジション ────────────────────────────────
  function handleCompositionStart(e: React.CompositionEvent<HTMLTextAreaElement>) {
    setComposing(true)
    compositionStartPosRef.current = e.currentTarget.selectionStart
    clearTimeout(debounceRef.current)
  }

  function handleCompositionUpdate(e: React.CompositionEvent<HTMLTextAreaElement>) {
    const word = e.data
    if (!word) return
    // コンポジション文字列（ひらがな等）でリアルタイム検索
    scheduleSearch(word, compositionStartPosRef.current, 350)
  }

  function handleCompositionEnd(e: React.CompositionEvent<HTMLTextAreaElement>) {
    setComposing(false)
    const committed = e.data   // 確定した文字列（漢字変換後）
    const start = compositionStartPosRef.current
    // 確定後も同じ位置で検索（変換前と結果が違う場合もあるので再検索）
    scheduleSearch(committed, start, 100)
  }

  // ── 置換 ───────────────────────────────────────────
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
    if (e.key === 'Tab' && result && !composing) {
      e.preventDefault()
      accept(result.longest)
    }
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">文字数稼ぎ</h1>
        <p className="text-gray-400 text-sm mt-1">
          書きながら類語を自動検索 →&nbsp;
          <span className="sm:hidden">タップ</span>
          <span className="hidden sm:inline">
            タップ or <kbd className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-xs font-mono">Tab</kbd>
          </span>
          &nbsp;で長い表現に置換
        </p>
      </div>

      <div className="flex justify-end mb-1">
        <button
          onClick={clearAll}
          disabled={mounted ? !text : false}
          className="text-xs text-red-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors px-2 py-1 rounded hover:bg-red-50"
        >
          全消去
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
        onCompositionStart={handleCompositionStart}
        onCompositionUpdate={handleCompositionUpdate}
        onCompositionEnd={handleCompositionEnd}
        placeholder="ここに文章を書いてください…"
        className="w-full h-52 px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white resize-none text-base leading-relaxed"
        autoFocus
      />

      {/* Suggestion bar */}
      <div className="mt-2 min-h-[3.5rem] flex items-center">
        {loading && (
          <p className="text-sm text-gray-400 animate-pulse">検索中…</p>
        )}
        {!loading && result && (
          <div className={`flex items-center gap-3 rounded-xl px-4 py-2.5 w-full border ${
            composing
              ? 'bg-amber-50 border-amber-200'   // 変換前：黄色
              : 'bg-blue-50 border-blue-200'      // 確定後：青
          }`}>
            <span className="text-gray-500 text-sm shrink-0">
              「{currentWord}」→
              {composing && (
                <span className="ml-1 text-amber-500 text-xs">変換前</span>
              )}
            </span>
            <button
              onClick={() => accept(result.longest)}
              className={`font-bold text-lg active:scale-95 transition-all truncate underline decoration-dotted underline-offset-2 ${
                composing
                  ? 'text-amber-700 hover:text-amber-900'
                  : 'text-blue-700 hover:text-blue-900'
              }`}
              title="タップ / Tab で置換"
            >
              {result.longest}
            </button>
            <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full shrink-0">
              +{result.diff}文字
            </span>
            <span className="text-gray-300 text-xs ml-auto shrink-0">
              <span className="hidden sm:inline">Tab /&nbsp;</span>タップ
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

      <div className="mt-4 flex items-center justify-between text-sm text-gray-400">
        <span>{text.length} 文字</span>
      </div>

      {/* Output block */}
      {mounted && text && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-gray-400">作成した文章</p>
            <button
              onClick={copyText}
              className="text-xs px-3 py-1 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-500 transition-colors"
            >
              {copied ? '✓ コピー済み' : 'コピー'}
            </button>
          </div>
          <pre className="w-full bg-gray-900 text-gray-100 rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap break-all font-sans select-all">
            {text}
          </pre>
        </div>
      )}
    </main>
  )
}
