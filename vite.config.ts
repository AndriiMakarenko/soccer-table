import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

import { resolvePersistenceBackend } from './src/services/persistenceBackendConfig'

export default defineConfig(({ mode }) => {
  const persistenceBackend = resolvePersistenceBackend(mode)
  const selectedPersistenceFile =
    persistenceBackend === 'tauri'
      ? './src/services/selectedTauriPersistence.ts'
      : './src/services/selectedPersistence.ts'

  return {
    plugins: [vue(), tailwindcss()],
    resolve: {
      alias: [
        {
          find: '@/services/selectedPersistence',
          replacement: fileURLToPath(
            new URL(selectedPersistenceFile, import.meta.url),
          ),
        },
        {
          find: '@',
          replacement: fileURLToPath(new URL('./src', import.meta.url)),
        },
      ],
    },
  }
})
