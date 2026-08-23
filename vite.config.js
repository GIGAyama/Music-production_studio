import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

const htmlEntry = (name) => fileURLToPath(new URL(`./${name}`, import.meta.url))

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    rollupOptions: {
      // 既定では index.html しかビルド対象にならないため、
      // プライバシーポリシーと利用規約も明示的にエントリーへ加える。
      // これがないと dist に含まれず、公開後に 404 になる。
      input: {
        main: htmlEntry('index.html'),
        privacy: htmlEntry('privacy.html'),
        terms: htmlEntry('terms.html'),
      },
    },
  },
})
