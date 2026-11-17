// Input: named actions over raw keys (input-systems skill). Gameplay reads
// actions, never key codes, so bindings stay in one place and edge vs held
// reads never get mixed up. Discrete presses are buffered for 0.15 s of game
// time so an early press still fires when it becomes legal.

const DEFAULT_BINDINGS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'],
  enter: ['KeyE'],
  punch: ['KeyF'],
  shoot: ['Mouse0'],
  interact: ['KeyE'],
  horn: ['KeyH'],
  pause: ['KeyP', 'Escape'],
  mute: ['KeyM'],
  reload: ['KeyR'],
};

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.bindings = DEFAULT_BINDINGS;
    this.held = new Set();
    this.pressed = new Set(); // edge: true only on the frame of the press
    this.buffered = new Map(); // action -> game time of latest press
    this.mouse = { x: 0, y: 0, worldX: 0, worldY: 0 };
    this.mouseDown = false;
    this.anyKey = false;
    this.attach();
  }

  attach() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.held.add(e.code);
      this.pressed.add(e.code);
      this.anyKey = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => this.held.delete(e.code));
    window.addEventListener('blur', () => { this.held.clear(); this.mouseDown = false; });
    this.canvas.addEventListener('mousemove', (e) => {
      const r = this.canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
    });
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.mouseDown = true;
        this.held.add('Mouse0');
        this.pressed.add('Mouse0');
        this.anyKey = true;
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.mouseDown = false;
        this.held.delete('Mouse0');
      }
    });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  actionHeld(action) {
    return this.bindings[action].some((k) => this.held.has(k));
  }

  actionPressed(action) {
    return this.bindings[action].some((k) => this.pressed.has(k));
  }

  // Buffer a discrete press in game time; consume() fires it once, inside
  // its window, and only once.
  bufferPress(action, now) {
    this.buffered.set(action, now);
  }

  consume(action, now, window = 0.15) {
    const t = this.buffered.get(action);
    if (t === undefined || now - t > window) return false;
    this.buffered.delete(action);
    return true;
  }

  clearBuffer() {
    this.buffered.clear();
  }

  // Movement vector from the four move actions, normalised (diagonals are
  // not faster) — the radial-deadzone equivalent for a keyboard.
  moveVector() {
    let x = 0, y = 0;
    if (this.actionHeld('left')) x -= 1;
    if (this.actionHeld('right')) x += 1;
    if (this.actionHeld('up')) y -= 1;
    if (this.actionHeld('down')) y += 1;
    if (x !== 0 && y !== 0) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
    return { x, y };
  }

  // Rebind one action at runtime (the pause menu's future rebind screen
  // calls this; bindings are data, never hard-coded in gameplay).
  bindAction(action, code) {
    if (!this.bindings[action]) return false;
    this.bindings[action] = [code];
    return true;
  }

  // Call at the end of each frame: edges live exactly one frame.
  endFrame() {
    this.pressed.clear();
  }
}
