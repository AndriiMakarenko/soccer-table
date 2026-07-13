<template>
  <div class="app-shell app-dark">
    <header class="shell-header">
      <RouterLink class="brand" to="/" aria-label="Fixture Board home">
        <span class="brand-mark" aria-hidden="true"><span /></span>
        <span>
          <strong class="brand-name">Fixture Board</strong>
          <small class="brand-kicker">Tournament control</small>
        </span>
      </RouterLink>
      <span class="local-badge">Stored locally</span>
    </header>

    <main class="shell-main">
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

.local-badge {
  padding: 0.45rem 0.7rem;
  border: 1px solid var(--color-line);
  border-radius: 999px;
  color: var(--color-muted);
  font: 600 0.7rem/1 var(--font-utility);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.shell-main {
  width: min(100% - 4rem, 76rem);
  margin: 0 auto;
}

@media (max-width: 640px) {
  .shell-header {
    padding-inline: 1rem;
  }
  .shell-main {
    width: min(100% - 2rem, 76rem);
  }
  .local-badge {
    display: none;
  }
}
</style>
