// svg.ts — open an SVG file that PracDraw exported (section 13). The file holds the document as JSON in its first
// `<metadata>` element. It is found by string search, not with DOMParser, so it runs in Node too.

import { parseDoc, type ParseResult } from '../model/parse'

const NAMED: Readonly<Record<string, string>> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" }

/**
 * Turn the character references of XML text back into characters: &lt; &gt; &amp; &quot; &apos; and numeric ones
 * (&#38; &#x26;). One pass, so "&amp;lt;" becomes "&lt;", not "<". A reference XML does not know stays as it is.
 */
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (ref: string, body: string) => {
    if (body[0] !== '#') return NAMED[body] ?? ref
    const n = body[1] === 'x' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10)
    return n <= 0x10ffff ? String.fromCodePoint(n) : ref
  })
}

/**
 * The text of the first `<metadata>` element of an SVG file, with its references turned back into characters (a CDATA
 * section is taken as it is). Null when the file has no such element.
 */
export function svgMetadata(svg: string): string | null {
  const start = svg.search(/<metadata[\s/>]/)
  if (start < 0) return null
  const open = svg.indexOf('>', start)
  if (open < 0) return null
  if (svg[open - 1] === '/') return '' // <metadata/>
  const end = svg.indexOf('</metadata', open + 1)
  if (end < 0) return null
  return svg
    .slice(open + 1, end)
    .split(/(<!\[CDATA\[[\s\S]*?\]\]>)/)
    .map((part) => (part.startsWith('<![CDATA[') ? part.slice(9, -3) : decodeEntities(part)))
    .join('')
}

/** The document in an SVG file that PracDraw exported: its metadata, through `parseDoc`. */
export function docFromSvg(svg: string): ParseResult {
  const meta = svgMetadata(svg)
  if (!meta?.trim()) return { ok: false, problems: ['The SVG file holds no PracDraw diagram: only an SVG that PracDraw exported can be opened.'] }
  let value: unknown
  try {
    value = JSON.parse(meta)
  } catch {
    return { ok: false, problems: ['The PracDraw diagram in the SVG file is damaged.'] }
  }
  return parseDoc(value)
}
