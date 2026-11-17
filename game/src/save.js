// Save / load through localStorage. One slot, versioned, written on mission
// completion and from the pause menu. A corrupt or foreign save is ignored
// rather than crashing the game.

const KEY = 'solmar-save-v1';

export function saveGame(state) {
  try {
    const data = {
      version: 1,
      savedAt: Date.now(),
      cash: state.cash,
      missionIndex: state.missions.index,
      completed: state.missions.completed,
      player: { x: state.player.x, y: state.player.y, health: state.player.health },
      wanted: state.police.heat,
      stats: state.stats,
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) {
      // A save from another version (or a foreign one) is dropped, never trusted.
      localStorage.removeItem(KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* storage unavailable */ }
}
