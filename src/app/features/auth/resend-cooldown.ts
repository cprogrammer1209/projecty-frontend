import { DestroyRef, inject, signal } from '@angular/core';

const COOLDOWN_SECONDS = 30;

/** "Link sent. Resend in 30s" countdown for resend buttons. Create it in an injection context. */
export function resendCooldown() {
  const secondsLeft = signal(0);
  let timer: ReturnType<typeof setInterval> | undefined;
  inject(DestroyRef).onDestroy(() => clearInterval(timer));

  return {
    secondsLeft: secondsLeft.asReadonly(),
    start(): void {
      clearInterval(timer);
      secondsLeft.set(COOLDOWN_SECONDS);
      timer = setInterval(() => {
        secondsLeft.update((s) => s - 1);
        if (secondsLeft() <= 0) {
          clearInterval(timer);
        }
      }, 1000);
    },
  };
}
