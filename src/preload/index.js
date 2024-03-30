import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import Store from 'electron-store'

const store = new Store()

// Custom APIs for renderer
const api = {
  get(key) {
    return store.get(key)
  },

  set(key, value) {
    return store.set(key, value)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
