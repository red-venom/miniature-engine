// current.ts — the host the app talks to (section 13). It starts as the web host and becomes the Claude host when
// `window.claude.use('downloads')` resolves to an object, which can take up to 10 s. Everything that holds `host` keeps
// working across the switch, because each call goes to the host of the moment.

import { findClaudeHost } from './claude'
import type { Host } from './host'
import { webHost } from './web'

export type HostName = 'web' | 'claude'

let active: { name: HostName; host: Host } = { name: 'web', host: webHost }

export const host: Host = {
  saveFile: (name, data) => active.host.saveFile(name, data),
  copyImage: (png) => active.host.copyImage(png),
  copyText: (text) => active.host.copyText(text),
  load: (key) => active.host.load(key),
  store: (key, value) => active.host.store(key, value),
}

/** Which host the app uses now. */
export const hostName = (): HostName => active.name

/** Look for the Claude host once; switch to it if it answers. Resolves with the host in use. */
export async function connectHost(scope: unknown = globalThis): Promise<HostName> {
  const claude = await findClaudeHost(scope)
  if (claude) active = { name: 'claude', host: claude }
  return active.name
}
