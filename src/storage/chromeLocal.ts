/**
 * @fileoverview Promise-based helpers around `chrome.storage.local` for typed reads/writes.
 */

export function storageLocalGet(
  keys: string | string[],
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (res) => {
      const err = chrome.runtime.lastError
      if (err) reject(new Error(err.message))
      else resolve(res as Record<string, unknown>)
    })
  })
}

export function storageLocalSet(
  items: Record<string, unknown>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(items, () => {
      const err = chrome.runtime.lastError
      if (err) reject(new Error(err.message))
      else resolve()
    })
  })
}
