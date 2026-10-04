// claude.ts — the host inside a Claude artifact (section 13). It saves through the artifact runtime's `downloads`
// capability: `downloads.save({ filename, data })` shows the viewer a confirmation and resolves when they accept. A
// rejection with the code `declined` means the viewer said no (cancelled); any other code means it failed. Copy and
// storage are the web host's: the Clipboard API and localStorage. This folder imports nothing from the rest of src.

import type { Host } from './host'
import { webHost } from './web'

/** What this host needs of the `downloads` capability (artifact runtime contract 0.2.66). */
export interface Downloads {
  save(request: { filename: string; data: Blob }): Promise<unknown>
}

/** The only part of `window.claude` that the app reads: `use(name)`, which resolves a capability or null. */
interface ClaudeRuntime {
  use?: (name: string) => Promise<unknown>
}

export function claudeHost(downloads: Downloads): Host {
  return {
    async saveFile(name, data) {
      try {
        await downloads.save({ filename: name, data })
        return 'saved'
      } catch (e) {
        return (e as { code?: unknown } | null)?.code === 'declined' ? 'cancelled' : 'failed'
      }
    },
    copyImage: (png) => webHost.copyImage(png),
    copyText: (text) => webHost.copyText(text),
    load: (key) => webHost.load(key),
    store: (key, value) => webHost.store(key, value),
  }
}

/**
 * The Claude host, when `window.claude.use` exists and `use('downloads')` resolves to an object with a `save`;
 * otherwise null. In a Claude artifact `use()` can take up to 10 s to answer, so the app starts with the web host and
 * switches when this resolves. It never rejects.
 */
export async function findClaudeHost(scope: unknown = globalThis): Promise<Host | null> {
  try {
    const claude = (scope as { claude?: ClaudeRuntime } | null)?.claude
    if (typeof claude?.use !== 'function') return null
    const downloads = (await claude.use('downloads')) as Partial<Downloads> | null
    return downloads && typeof downloads === 'object' && typeof downloads.save === 'function' ? claudeHost(downloads as Downloads) : null
  } catch {
    return null
  }
}
