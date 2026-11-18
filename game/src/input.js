// Keyboard + mouse input. Tracks held keys, edge-triggered presses, and the
// mouse position in screen and world space. The game loop polls this object.

export function createInput(canvas) {
  const input = {
    keys: new Set(),
    pressed: new Set(),       // edge-triggered: cleared once per frame by main.js
    mouseX: 0, mouseY: 0,     // screen pixels
    mouseDown: false,
    mouseClicked: false,      // edge-triggered
    anyKey: false,
  };

  const KEYMAP = {
    KeyW: 'up', ArrowUp: 'up',
    KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    ShiftLeft: 'run', ShiftRight: 'run',
    Space: 'brake',
    KeyE: 'enter',
    KeyF: 'punch',
    KeyH: 'horn',
    KeyR: 'radio',
    KeyM: 'mute',
    Escape: 'pause',
    Enter: 'confirm',
    KeyP: 'photo',
  };

  window.addEventListener('keydown', (e) => {
    const action = KEYMAP[e.code];
    if (action) {
      if (!e.repeat) input.pressed.add(action);
      input.keys.add(action);
      input.anyKey = true;
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => {
    const action = KEYMAP[e.code];
    if (action) input.keys.delete(action);
  });
  window.addEventListener('blur', () => { input.keys.clear(); });

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouseX = e.clientX - r.left;
    input.mouseY = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { input.mouseDown = true; input.mouseClicked = true; }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  input.down = (action) => input.keys.has(action);
  input.hit = (action) => input.pressed.has(action);
  // Called at the end of each frame so edge presses fire exactly once.
  input.endFrame = () => { input.pressed.clear(); input.mouseClicked = false; };
  return input;
}
