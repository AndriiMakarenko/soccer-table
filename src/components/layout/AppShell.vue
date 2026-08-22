<script setup lang="ts">
import StateTransferControls from '@/components/state-transfer/StateTransferControls.vue'
</script>

<template>
  <div class="app-shell app-dark" spellcheck="false">
    <a class="skip-link" href="#main-content">Skip to main content</a>

    <header class="shell-header">
      <RouterLink class="brand" to="/" aria-label="Fixture Board home">
        <span class="brand-mark" aria-hidden="true"><span /></span>
        <span>
          <strong class="brand-name">Fixture Board</strong>
          <small class="brand-kicker">Tournament control</small>
        </span>
      </RouterLink>
      <StateTransferControls />
    </header>

    <main id="main-content" class="shell-main" tabindex="-1">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  background:
    radial-gradient(
      circle at 78% 18%,
      rgb(82 136 193 / 12%),
      transparent 28rem
    ),
    var(--color-night);
  color: var(--color-chalk);
}

.skip-link {
  position: fixed;
  z-index: 10000;
  top: 0.75rem;
  right: 0.75rem;
  padding: 0.7rem 1rem;
  border-radius: 0.35rem;
  background: var(--color-chalk);
  color: var(--color-night);
  font-weight: 800;
  text-decoration: none;
  transform: translateY(calc(-100% - 1rem));
  transition: transform 120ms ease;
}

.skip-link:focus {
  transform: translateY(0);
}

.shell-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 5.25rem;
  padding: 0 2rem;
  border-bottom: 1px solid var(--color-line);
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 0.8rem;
  color: inherit;
  text-decoration: none;
}

.brand-mark {
  position: relative;
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  place-items: center;
  border: 1px solid var(--color-floodlight);
  border-radius: 50%;
}

.brand-mark::before,
.brand-mark::after,
.brand-mark span {
  position: absolute;
  content: '';
  background: var(--color-floodlight);
}

.brand-mark::before {
  width: 100%;
  height: 1px;
}
.brand-mark::after {
  width: 1px;
  height: 100%;
}
.brand-mark span {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 50%;
}

.brand-name,
.brand-kicker {
  display: block;
}
.brand-name {
  font-family: var(--font-display);
  font-size: 1rem;
  letter-spacing: 0.04em;
}
.brand-kicker {
  margin-top: 0.1rem;
  color: var(--color-muted);
  font-size: 0.65rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.shell-main {
  width: min(100% - 4rem, 76rem);
  margin: 0 auto;
}

@media (max-width: 640px) {
  .skip-link {
    right: 0.5rem;
    padding-inline: 0.5rem;
    font-size: 0.9rem;
  }

  .shell-header {
    padding-inline: 1rem;
  }
  .shell-main {
    width: min(100% - 2rem, 76rem);
  }
}

@media (max-width: 480px) {
  .brand-kicker {
    display: none;
  }
}
</style>
