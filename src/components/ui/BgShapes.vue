<template>
  <div class="shapes" aria-hidden="true">
    <span class="shape s1 anim-loop anim-drift" />
    <span class="shape s2 anim-loop anim-drift" />
    <span class="shape s3 anim-loop anim-drift" />
    <span class="shape s4 anim-loop anim-drift" />
  </div>
</template>

<style scoped>
.shapes { position: absolute; inset: 0; pointer-events: none; }
.shape { position: absolute; border: var(--outline); }
.s1 { top: 40px; inset-inline-start: -18px; width: 60px; height: 60px; border-radius: 50%; background: var(--grape); }
.s2 { bottom: 140px; inset-inline-end: -10px; width: 44px; height: 44px; background: var(--mint); animation-duration: 5s; }
.s3 { bottom: 40px; inset-inline-start: 20px; width: 90px; height: 26px; border-radius: var(--radius-pill); background: var(--tangerine); animation-duration: 6s; animation-delay: -2s; }
.s4 { top: 90px; inset-inline-end: 24px; width: 30px; height: 30px; border-radius: 50%; background: var(--paper); animation-duration: 4s; }
</style>
