import { describe, expect, it } from 'vitest'
import { claudeHost, findClaudeHost, type Downloads } from './claude'
import { connectHost, host, hostName } from './current'

/** A fake `downloads` capability that records each save and answers as told. */
function fakeDownloads(answer: () => Promise<unknown>) {
  const saved: { filename: string; data: Blob }[] = []
  const downloads: Downloads = {
    save(request) {
      saved.push(request)
      return answer()
    },
  }
  return { saved, downloads }
}

describe('claudeHost', () => {
  it('saves through downloads.save({ filename, data }) and reports saved', async () => {
    const f = fakeDownloads(async () => ({ status: 'saved' }))
    const data = new Blob(['{"app":"pracdraw"}'], { type: 'application/json' })
    expect(await claudeHost(f.downloads).saveFile('Titration.pracdraw.json', data)).toBe('saved')
    expect(f.saved).toEqual([{ filename: 'Titration.pracdraw.json', data }])
  })

  it('a rejection with the code "declined" is cancelled; any other rejection failed', async () => {
    const reject = (reason: unknown) => claudeHost(fakeDownloads(() => Promise.reject(reason)).downloads).saveFile('x.png', new Blob(['x']))
    expect(await reject({ code: 'declined', message: 'The viewer said no' })).toBe('cancelled')
    for (const code of ['rate_limited', 'too_large', 'unavailable', 'bad_request', 'rejected_extension', 'not_granted'])
      expect(await reject({ code, message: '' })).toBe('failed')
    expect(await reject(new Error('boom'))).toBe('failed')
    expect(await reject(null)).toBe('failed')
    expect(await reject('declined')).toBe('failed')
  })

  it('reads and writes nothing it cannot: with no storage, load gives null and store does nothing', () => {
    const h = claudeHost(fakeDownloads(async () => ({})).downloads)
    expect(h.load('pracdraw.autosave.v1')).toBeNull()
    expect(() => h.store('k', 'v')).not.toThrow()
  })
})

describe('findClaudeHost', () => {
  const runtime = (use: (name: string) => Promise<unknown>) => ({ claude: { use } })

  it('is the Claude host when window.claude.use exists and use("downloads") resolves to an object with save', async () => {
    const f = fakeDownloads(async () => ({ status: 'saved' }))
    const asked: string[] = []
    const found = await findClaudeHost(
      runtime(async (name) => {
        asked.push(name)
        return f.downloads
      }),
    )
    expect(asked).toEqual(['downloads'])
    expect(found).not.toBeNull()
    expect(await found!.saveFile('a.svg', new Blob(['<svg/>']))).toBe('saved')
    expect(f.saved.map((s) => s.filename)).toEqual(['a.svg'])
  })

  it('is null otherwise, and never rejects', async () => {
    expect(await findClaudeHost({})).toBeNull()
    expect(await findClaudeHost(null)).toBeNull()
    expect(await findClaudeHost({ claude: {} })).toBeNull()
    expect(await findClaudeHost({ claude: { use: 'no' } })).toBeNull()
    expect(await findClaudeHost(runtime(async () => null))).toBeNull()
    expect(await findClaudeHost(runtime(async () => 'downloads'))).toBeNull()
    expect(await findClaudeHost(runtime(async () => ({ download: () => {} })))).toBeNull()
    expect(await findClaudeHost(runtime(() => Promise.reject(new Error('no'))))).toBeNull()
    expect(
      await findClaudeHost(
        runtime(() => {
          throw new Error('sync')
        }),
      ),
    ).toBeNull()
  })
})

describe('the current host', () => {
  it('starts as the web host and switches to the Claude host when use() resolves; calls go to the host of the moment', async () => {
    expect(hostName()).toBe('web')
    expect(await connectHost({})).toBe('web')
    let answer: (v: unknown) => void = () => {}
    const f = fakeDownloads(() => Promise.reject({ code: 'declined' }))
    const pending = connectHost({ claude: { use: () => new Promise((res) => (answer = res)) } })
    expect(hostName()).toBe('web')
    answer(f.downloads)
    expect(await pending).toBe('claude')
    expect(hostName()).toBe('claude')
    expect(await host.saveFile('late.png', new Blob(['png']))).toBe('cancelled')
    expect(f.saved.map((s) => s.filename)).toEqual(['late.png'])
  })
})
