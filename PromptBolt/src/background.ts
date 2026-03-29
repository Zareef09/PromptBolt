chrome.runtime.onInstalled.addListener(() => {
  void chrome.storage.local.get('prompts', (items) => {
    if (items.prompts == null) {
      void chrome.storage.local.set({ prompts: [] })
    }
  })
})
