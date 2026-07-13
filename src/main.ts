import { createPinia } from 'pinia'
import { definePreset } from '@primeuix/themes'
import Aura from '@primeuix/themes/aura'
import PrimeVue from 'primevue/config'
import { createApp } from 'vue'

import App from './App.vue'
import router from './router'
import './styles/main.css'

const FixtureBoardPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#eef7fd',
      100: '#d9ecfa',
      200: '#b9dcf5',
      300: '#8cc5ed',
      400: '#64a8dc',
      500: '#4b91c8',
      600: '#3c75a5',
      700: '#315e86',
      800: '#2b506f',
      900: '#263f56',
      950: '#172a3b',
    },
    colorScheme: {
      dark: {
        surface: {
          0: '#ffffff',
          50: '#f4f7f9',
          100: '#e7edf1',
          200: '#cfd9e0',
          300: '#adbdc8',
          400: '#7f91a4',
          500: '#667989',
          600: '#4d6170',
          700: '#344654',
          800: '#1f2c38',
          900: '#17212b',
          950: '#101923',
        },
      },
    },
  },
})

createApp(App)
  .use(createPinia())
  .use(router)
  .use(PrimeVue, {
    theme: {
      preset: FixtureBoardPreset,
      options: {
        darkModeSelector: '.app-dark',
      },
    },
  })
  .mount('#app')
