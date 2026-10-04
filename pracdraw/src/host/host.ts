// host.ts — all contact with the outside world goes through this interface (section 13 of the specification).
// This folder imports nothing from the rest of src.

export interface Host {
  saveFile(name: string, data: Blob): Promise<'saved' | 'cancelled' | 'failed'>
  copyImage(png: Promise<Blob>): Promise<boolean>
  copyText(text: string): Promise<boolean>
  load(key: string): string | null
  store(key: string, value: string): void
}
