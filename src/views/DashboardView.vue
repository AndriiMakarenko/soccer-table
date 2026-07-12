<script setup lang="ts">
import Button from 'primevue/button'
</script>

<template>
  <section class="dashboard" aria-labelledby="dashboard-title">
    <div class="dashboard-copy">
      <p class="eyebrow">Competition desk / 00 leagues</p>
      <h1 id="dashboard-title" class="dashboard-title">
        Every fixture.<br />One clear table.
      </h1>
      <p class="dashboard-intro">
        Build round robin seasons, record matchdays, and watch the standings
        settle in real time.
      </p>
      <Button
        label="Create your first league"
        disabled
        class="dashboard-action"
      />
      <p class="coming-soon">League creation arrives in the next setup step.</p>
    </div>

    <div class="pitch-board" aria-hidden="true">
      <span class="pitch-board__line" />
      <span class="pitch-board__circle" />
      <span class="pitch-board__spot" />
      <p>Ready for kick-off</p>
    </div>
  </section>
</template>

<style scoped>
.dashboard {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(20rem, 0.95fr);
  gap: clamp(3rem, 8vw, 8rem);
  align-items: center;
  min-height: calc(100vh - 5.25rem);
  padding-block: 4rem;
}

.eyebrow,
.coming-soon {
  color: var(--color-muted);
  font: 600 0.72rem/1.4 var(--font-utility);
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.dashboard-title {
  max-width: 11ch;
  margin: 1.25rem 0 1.5rem;
  font-family: var(--font-headline);
  font-size: clamp(3.3rem, 7vw, 6.8rem);
  font-weight: 750;
  letter-spacing: normal;
  line-height: 0.92;
}

.dashboard-intro {
  max-width: 36rem;
  color: #bac6d8;
  font-size: clamp(1rem, 1.6vw, 1.2rem);
  line-height: 1.7;
}

.dashboard-action {
  margin-top: 2rem;
}
.coming-soon {
  margin-top: 0.8rem;
  letter-spacing: 0.05em;
  text-transform: none;
}

.pitch-board {
  position: relative;
  aspect-ratio: 4 / 5;
  overflow: hidden;
  border: 1px solid #30425d;
  border-radius: 1.25rem;
  background: linear-gradient(145deg, #101b2c, #0b1320);
  box-shadow: 0 2rem 5rem rgb(0 0 0 / 28%);
}

.pitch-board::before {
  position: absolute;
  inset: 1.5rem;
  border: 1px solid rgb(149 185 234 / 34%);
  content: '';
}

.pitch-board__line,
.pitch-board__circle,
.pitch-board__spot {
  position: absolute;
  display: block;
}
.pitch-board__line {
  top: 50%;
  right: 1.5rem;
  left: 1.5rem;
  border-top: 1px solid rgb(149 185 234 / 34%);
}
.pitch-board__circle {
  top: 50%;
  left: 50%;
  width: 32%;
  aspect-ratio: 1;
  border: 1px solid rgb(149 185 234 / 34%);
  border-radius: 50%;
  transform: translate(-50%, -50%);
}
.pitch-board__spot {
  top: 50%;
  left: 50%;
  width: 0.4rem;
  height: 0.4rem;
  border-radius: 50%;
  background: var(--color-floodlight);
  transform: translate(-50%, -50%);
  box-shadow: 0 0 2rem var(--color-floodlight);
}

.pitch-board p {
  position: absolute;
  right: 3rem;
  bottom: 3rem;
  left: 3rem;
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(1.5rem, 3vw, 2.5rem);
  letter-spacing: -0.035em;
}

@media (max-width: 800px) {
  .dashboard {
    grid-template-columns: 1fr;
    min-height: auto;
  }
  .pitch-board {
    width: min(100%, 32rem);
    aspect-ratio: 5 / 3;
  }
}
</style>
