import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import { render, screen } from '@testing-library/vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App.vue'
import router from './router'
import { persistenceService } from './services/storage'

describe('application shell', () => {
  beforeEach(() => {
    vi.spyOn(persistenceService, 'load').mockReturnValue({
      leagues: [],
      seasons: [],
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  /**
   * GIVEN the application router is initialized at the root route
   * WHEN App is rendered with Pinia, Vue Router, and PrimeVue
   * THEN the management dashboard and enabled first-league action are visible
   */
  it('renders the dashboard at the root route', async () => {
    await router.push('/')
    await router.isReady()

    render(App, {
      global: {
        plugins: [createPinia(), router, PrimeVue],
      },
    })

    expect(
      screen.getByRole('heading', { name: 'League control' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Fixture Board')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Create your first league' }),
    ).toBeEnabled()
  })
})
