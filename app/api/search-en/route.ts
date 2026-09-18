import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { load } from 'cheerio'

export async function GET(request: NextRequest) {
  const word = request.nextUrl.searchParams.get('word')?.trim()

  if (!word) {
    return NextResponse.json({ error: 'Enter a word' }, { status: 400 })
  }

  try {
    const url = `https://ejje.weblio.jp/english-thesaurus/content/${encodeURIComponent(word)}`
    const { data } = await axios.get<string>(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'en,ja;q=0.9',
      },
      timeout: 10000,
    })

    const $ = load(data)
    const wordSet = new Set<string>()

    $('a[href*="/english-thesaurus/content/"]').each((_, el) => {
      const text = $(el).text().trim()
      if (text && text !== word && /^[a-zA-Z][a-zA-Z\s\-']*$/.test(text)) {
        wordSet.add(text)
      }
    })

    const words = Array.from(wordSet)

    if (words.length === 0) {
      return NextResponse.json(
        { error: `No synonyms found for "${word}"` },
        { status: 404 },
      )
    }

    const sorted = words.sort((a, b) => b.length - a.length)

    return NextResponse.json({
      word,
      longest: sorted[0],
      longestLength: sorted[0].length,
      originalLength: word.length,
      diff: sorted[0].length - word.length,
      candidates: sorted.slice(0, 10),
    })
  } catch (err) {
    if (axios.isAxiosError(err)) {
      if (err.response?.status === 404) {
        return NextResponse.json(
          { error: `No thesaurus page found for "${word}"` },
          { status: 404 },
        )
      }
    }
    console.error(err)
    return NextResponse.json({ error: 'Failed to connect to Weblio' }, { status: 500 })
  }
}
