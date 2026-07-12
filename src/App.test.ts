import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import App from './App.vue'
import router from './router'

describe('application shell', () => {
  it('renders the dashboard at the root route', async () => {
    await router.push('/')
    await router.isReady()

    render(App, {
      global: {
        plugins: [createPinia(), router, PrimeVue],
      },
    })

    expect(
      screen.getByRole('heading', { name: /every fixture.*one clear table/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('Fixture Board')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Create your first league' }),
    ).toBeDisabled()
  })
})
