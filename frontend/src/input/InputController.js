export class InputController {
  constructor({ onInput, tickMs = 50 }) {
    this.onInput = onInput;
    this.tickMs = tickMs;
    this.intervalId = null;
    this.keyState = {
      KeyW: false,
      KeyA: false,
      KeyS: false,
      KeyD: false
    };

    this.onKeyDown = (event) => {
      if (event.code in this.keyState) {
        this.keyState[event.code] = true;
      }
    };

    this.onKeyUp = (event) => {
      if (event.code in this.keyState) {
        this.keyState[event.code] = false;
      }
    };
  }

  start() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);

    this.intervalId = window.setInterval(() => {
      this.onInput(this.getCurrentInput());
    }, this.tickMs);
  }

  stop() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    if (this.intervalId) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  getCurrentInput() {
    const x = (this.keyState.KeyD ? 1 : 0) - (this.keyState.KeyA ? 1 : 0);
    const z = (this.keyState.KeyS ? 1 : 0) - (this.keyState.KeyW ? 1 : 0);
    const len = Math.hypot(x, z) || 1;
    return { x: x / len, z: z / len };
  }
}
