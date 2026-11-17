// Missions and the story of Dario Cruz and Mara Solis. A small state
// machine over the data in config.js: each mission is a list of steps, each
// step completes on a condition (reach a marker, steal a car, collect, or
// survive an evade timer). Dialogue plays as a queue so the player reads one
// line at a time; completing a mission pays cash, saves, and unlocks the
// next. (level-design: the six missions pace teach -> pressure -> breather
// -> climax, and every step reuses the open world rather than a new arena.)

import { MISSIONS, TUNING } from './config.js';
import { dist, clamp } from './util.js';

export class MissionManager {
  constructor(W) {
    this.W = W;
    this.index = 0; // mission currently offered
    this.completed = []; // ids of finished missions
    this.stepI = 0;
    this.stepT = 0; // timer for evade steps
    this.dialogue = []; // {speaker, text, t}
    this.dialogueT = 0;
    this.marker = null; // {x, y, label} drawn on the world and minimap
    this.active = false;
    this.finished = false; // every mission done
    this.failed = false;
    this.vanStolen = false;
  }

  get current() {
    return MISSIONS[this.index] || null;
  }

  get step() {
    const m = this.current;
    return m ? m.steps[this.stepI] : null;
  }

  start() {
    const m = this.current;
    if (!m || this.active) return;
    this.active = true;
    this.stepI = 0;
    this.stepT = 0;
    this.failed = false;
    this.say('Mara', m.briefing);
    if (m.steps[0].wanted) this.W.police.heat = m.steps[0].wanted * TUNING.heatPerStar;
    this.updateMarker();
    this.W.audio.mission();
  }

  say(speaker, text) {
    this.dialogue.push({ speaker, text });
    if (this.dialogue.length > 4) this.dialogue.shift();
    this.dialogueT = 6;
  }

  updateMarker() {
    const s = this.step;
    if (!s) { this.marker = null; return; }
    if (s.at) this.marker = { x: s.at[0], y: s.at[1], label: s.text };
    else this.marker = null;
  }

  // Called when the player enters any car.
  onEnterCar(car) {
    const s = this.step;
    if (!this.active || !s) return;
    if (s.type === 'steal') {
      if (car.missionVan && this.current.id === 'm5') {
        this.completeStep('The van is yours. Go!');
      } else if (this.current.id === 'm1') {
        this.completeStep('Nice wheels. Now drive to Mara.');
      }
    }
  }

  completeStep(line) {
    const m = this.current;
    this.stepI++;
    this.stepT = 0;
    if (line) this.say('Mara', line);
    if (this.stepI >= m.steps.length) {
      this.completeMission();
    } else {
      const next = this.step;
      if (next && next.wanted) this.W.police.heat = next.wanted * TUNING.heatPerStar;
      this.updateMarker();
    }
  }

  completeMission() {
    const W = this.W;
    const m = this.current;
    const reward = TUNING.missionReward[this.index] || 500;
    W.cash += reward;
    W.fx.floatText(W.player.x, W.player.y - 30, '+$' + reward, '#7be07b');
    this.completed.push(m.id);
    this.active = false;
    this.marker = null;
    W.audio.mission();
    W.stats.missionsDone++;
    this.say('Mara', '"' + m.title + '" done. $' + reward + ' is yours, Dario.');
    W.saveGame();
    if (this.index + 1 < MISSIONS.length) {
      this.index++;
      this.say('Mara', 'Next job: ' + MISSIONS[this.index].title + '. Press Enter on the marker to start.');
    } else {
      this.finished = true;
      this.say('Mara', '"We did it, Dario. Solmar is ours — for now."');
      W.onStoryComplete();
    }
  }

  failMission(reason) {
    const W = this.W;
    this.active = false;
    this.failed = true;
    this.marker = null;
    this.say('Mara', reason);
    W.audio.fail();
    this.stepI = 0;
    // The mission stays available: walk back to the marker to retry.
    setTimeout(() => { this.failed = false; }, 100);
  }

  update(dt) {
    const W = this.W;
    if (this.dialogueT > 0) this.dialogueT -= dt;
    else if (this.dialogue.length) this.dialogue.shift();
    if (!this.active) return;
    const s = this.step;
    if (!s) return;
    const p = W.player;

    if (s.type === 'goto') {
      if (dist(p.x, p.y, s.at[0], s.at[1]) < 64) {
        this.completeStep();
      }
    } else if (s.type === 'collect') {
      if (dist(p.x, p.y, s.at[0], s.at[1]) < 58) {
        W.cash += 150;
        W.fx.floatText(p.x, p.y - 28, '+$150', '#7be07b');
        W.audio.pickup();
        const last = this.stepI >= this.current.steps.length - 1;
        this.completeStep(last ? 'Collected. All three — nice work.' : 'Collected. Next one.');
      }
    } else if (s.type === 'evade') {
      this.stepT += dt;
      // Evade completes when the timer runs out AND the heat is gone.
      if (this.stepT >= s.seconds && W.police.stars === 0) {
        this.completeStep('Clean. They lost you.');
      } else if (this.stepT >= s.seconds * 2.2) {
        // Mercy: the heat eventually dies even if the player hides badly.
        W.police.heat = 0;
        this.completeStep('Clean. They lost you.');
      }
    } else if (s.type === 'steal') {
      // Completion happens in onEnterCar; the marker (if any) just guides.
      if (s.at && dist(p.x, p.y, s.at[0], s.at[1]) < 90) {
        this.marker = { x: s.at[0], y: s.at[1], label: s.text };
      }
    }
  }

  // The objective line the HUD shows.
  objectiveText() {
    if (this.finished) return 'Story complete — Solmar is yours. Free roam!';
    if (!this.active) {
      const m = this.current;
      if (!m) return '';
      return 'Next mission: ' + m.title + ' — go to the yellow marker and press E';
    }
    const s = this.step;
    if (!s) return '';
    if (s.type === 'evade') {
      return s.text + ' (' + Math.max(0, Math.ceil(s.seconds - this.stepT)) + 's)';
    }
    return s.text;
  }

  // Where the "start mission" marker sits when no mission is active.
  startMarker() {
    if (this.active || this.finished) return null;
    const m = this.current;
    if (!m) return null;
    const s = m.steps[0];
    if (s.at) return { x: s.at[0], y: s.at[1], label: m.title };
    // Missions that start by stealing: marker at a busy downtown corner.
    return { x: 1900, y: 650, label: m.title };
  }
}
