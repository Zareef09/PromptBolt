chrome.runtime.onInstalled.addListener(() => {
  void chrome.storage.local.get(['folders', 'prompts'], (items) => {
    if (items.folders != null) return

    const id =
      globalThis.crypto && 'randomUUID' in globalThis.crypto
        ? globalThis.crypto.randomUUID()
        : `promptbolt-${Date.now()}`

    const legacyPrompts = Array.isArray(items.prompts) ? items.prompts : []

    void chrome.storage.local.set({
      folders: [{ id, name: 'General', prompts: legacyPrompts }],
      selectedFolderId: id,
    })

    if (items.prompts != null) {
      void chrome.storage.local.remove('prompts')
    }
  })
})
