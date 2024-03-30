import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { resolve } from 'path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    // build: {
    //   rollupOptions: {
    //     input: {
    //       newWorkspace: resolve(__dirname, 'src/preload/index.js'),
    //       preferences: resolve(__dirname, 'src/preload/index.js')
    //     }
    //   }
    // }
  },
  renderer: {
    build: {
      rollupOptions: {
        input: {
          newWorkspace: resolve(__dirname, 'src/renderer/new-workspace.html'),
          preferences: resolve(__dirname, 'src/renderer/preferences.html')
        }
      }
    }
  }
})
