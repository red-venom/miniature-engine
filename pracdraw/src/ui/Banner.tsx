// Banner.tsx — a message over the top of the canvas: what Open could not read, or had to change (section 7, rule 5).
// It does not block the screen: the canvas around it works, and it stays until it is closed or another file opens.

import { closeBanner } from '../editor/files'
import { useEditor } from '../editor/store'
import { icons } from './icons'

/** At most this many problems show; the rest are counted. */
const SHOWN = 8

export function Banner() {
  const banner = useEditor((s) => s.banner)
  if (!banner) return null
  const more = banner.problems.length - SHOWN
  return (
    <section className="banner" aria-label="Message" aria-live="polite">
      <div className="banner-head">
        <strong>{banner.title}</strong>
        <button type="button" className="icon-button" aria-label="Close the message" onClick={closeBanner}>
          {icons.close}
        </button>
      </div>
      <ul>
        {banner.problems.slice(0, SHOWN).map((p, i) => (
          <li key={i}>{p}</li>
        ))}
        {more > 0 && <li>{more === 1 ? 'And 1 more.' : `And ${more} more.`}</li>}
      </ul>
    </section>
  )
}
