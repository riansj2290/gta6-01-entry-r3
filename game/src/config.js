// SOLMAR tuning, districts, story and palette. One place for every number a
// designer would want to change; the simulation modules read from here.

export const WORLD = {
  width: 3600,
  height: 2600,
  seed: 20261117,
  roadWidth: 92,
  sidewalk: 16,
};

// Avenues run north-south, streets east-west. The grid makes the road graph the
// traffic and police AI drive on.
export const AVENUES = [300, 700, 1100, 1500, 1900, 2300, 2700, 3100];
export const STREETS = [300, 650, 1000, 1350, 1700, 2050, 2400];

// Five districts, each with its own building palette and street character.
// (level-design: landmarks and a distinct look per district so players can
// navigate by sight, not by the minimap alone.)
export const DISTRICTS = [
  {
    id: 'industrial', name: 'Industrial', x0: 0, y0: 0, x1: 1450, y1: 1350,
    ground: '#8a7f6a', building: ['#7d7468', '#6b6258', '#8d8172'],
    roof: ['#5c564e', '#4f4a44', '#6e675c'], accent: '#c98f2e',
    landmark: 'Kestrel Freight Yard',
  },
  {
    id: 'downtown', name: 'Downtown', x0: 1450, y0: 0, x1: 2750, y1: 1350,
    ground: '#6f7076', building: ['#3f4a5e', '#54627e', '#46536b', '#5d6b84'],
    roof: ['#2c3444', '#39445a', '#232b3a'], accent: '#37c8e8',
    landmark: 'Solmar Tower',
  },
  {
    id: 'marina', name: 'Marina', x0: 2750, y0: 0, x1: 3600, y1: 2600,
    ground: '#c9b489', building: ['#e8dcc0', '#d9c9a3', '#f2e8d2'],
    roof: ['#b8543f', '#3f7d8c', '#d98a3f'], accent: '#2e9db4',
    landmark: 'Solmar Pier',
  },
  {
    id: 'suburbs', name: 'Suburbs', x0: 0, y0: 1350, x1: 1450, y1: 2600,
    ground: '#7fae62', building: ['#e6d3a8', '#d9b48a', '#c9a37e', '#e8c9a0'],
    roof: ['#a44a3f', '#7a4a3f', '#5d6b4a'], accent: '#5da24a',
    landmark: 'Palm Court Park',
  },
  {
    id: 'oldtown', name: 'Old Town', x0: 1450, y0: 1350, x1: 2750, y1: 2600,
    ground: '#9a8a72', building: ['#c9a06a', '#b98a5e', '#d9b878', '#a87e52'],
    roof: ['#8a4a3f', '#6e3f35', '#a85e3f'], accent: '#e8b23f',
    landmark: 'Plaza del Sol',
  },
];

export const BEACH = { x0: 3300, x1: 3440, sand: '#e8d29a' };
export const WATER = { x0: 3440, color: '#2e7fa8', deep: '#1e5f86' };
export const PIER = { x: 3360, y: 1450, w: 190, h: 26 };

export const TUNING = {
  // Player on foot.
  walkSpeed: 175, runSpeed: 265, playerRadius: 13, playerHealth: 100,
  punchDamage: 12, punchRange: 34, punchCooldown: 0.38,
  pistolDamage: 26, pistolRange: 420, pistolCooldown: 0.24, pistolAmmo: 12,
  // Cars.
  carAccel: 520, carBrake: 900, carReverse: 300, carMaxSpeed: 470,
  carMaxReverse: 170, carTurn: 2.6, carGrip: 6.5, carLength: 48, carWidth: 24,
  carHealth: 100, trafficSpeed: 130,
  // Traffic cruise throttles vary per car so the flow never looks uniform.
  trafficCruiseMin: 0.42, trafficCruiseMax: 0.68,
  // Wanted / police.
  heatPerStar: 25, heatDecay: 1.6, heatDecayHidden: 6,
  maxCops: [0, 2, 3, 4, 6, 8],
  // Economy.
  startCash: 120, missionReward: [400, 650, 800, 900, 1400, 2500],
  // Camera.
  camRate: 5.5, camLookAhead: 46, camZoomFoot: 1.0, camZoomCar: 0.82,
};

// The story: six missions, a sawtooth of calm and pressure (level-design
// pacing: teach, then pressure, then a breather, then the climax).
export const MISSIONS = [
  {
    id: 'm1', title: 'First Wheels', district: 'Downtown',
    briefing: 'Mara: "Dario, we need wheels before sunrise. Borrow one. Permanently."',
    steps: [
      { type: 'steal', text: 'Steal a car (walk up and press E)' },
      { type: 'goto', text: 'Drive to Mara at the Downtown garage', at: [1900, 640] },
    ],
  },
  {
    id: 'm2', title: 'The Drop', district: 'Marina',
    briefing: 'Mara: "A package for the pier. No questions, no stops, no cops."',
    steps: [
      { type: 'goto', text: 'Pick up the package at the Marina warehouse', at: [2950, 1150] },
      { type: 'goto', text: 'Deliver it to the end of Solmar Pier', at: [3520, 1463], wanted: 1 },
    ],
  },
  {
    id: 'm3', title: 'Hot Pursuit', district: 'Suburbs',
    briefing: 'Mara: "You tripped a camera. Lose them. All of them."',
    steps: [
      { type: 'evade', text: 'Lose the police — stay out of sight until the heat dies', seconds: 45, wanted: 2 },
    ],
  },
  {
    id: 'm4', title: 'Old Town Racket', district: 'Old Town',
    briefing: 'Dario: "Three shops owe the crew. Collect. Politely, if you can."',
    steps: [
      { type: 'collect', text: 'Collect from the bakery on Plaza del Sol', at: [2050, 1900], count: 1 },
      { type: 'collect', text: 'Collect from the garage on Calle Verde', at: [2400, 2250], count: 1 },
      { type: 'collect', text: 'Collect from the bar on Old Town Row', at: [1650, 2250], count: 1 },
    ],
  },
  {
    id: 'm5', title: 'Industrial Heist', district: 'Industrial',
    briefing: 'Mara: "Kestrel moves payroll in an armored van at noon. Take it."',
    steps: [
      { type: 'steal', text: 'Steal the armored van in the freight yard', at: [900, 500], wanted: 2 },
      { type: 'goto', text: 'Drive the van to the chop shop', at: [1300, 1900], wanted: 3 },
    ],
  },
  {
    id: 'm6', title: 'The Solmar Job', district: 'Downtown',
    briefing: 'Mara: "One last score. The bank on Solmar Tower plaza. Then the beach. Then gone."',
    steps: [
      { type: 'goto', text: 'Reach the bank at Solmar Tower plaza', at: [2100, 850] },
      { type: 'collect', text: 'Grab the case from the vault courier', at: [2100, 850], count: 1, wanted: 3 },
      { type: 'goto', text: 'Escape to the end of Solmar Pier', at: [3520, 1463], wanted: 4 },
    ],
  },
];

export const CAR_COLORS = [
  '#c93b3b', '#3b6fc9', '#e8c33f', '#3fae5a', '#e8e8e8', '#2b2b30',
  '#c97b2e', '#8a4fc9', '#37b8a8', '#d96a9b', '#7a8a99', '#b8b03a',
];

export const PED_SHIRTS = [
  '#e8e8e8', '#c93b3b', '#3b6fc9', '#e8c33f', '#3fae5a', '#c97b2e',
  '#8a4fc9', '#37b8a8', '#d96a9b', '#7a8a99', '#5a3a2a', '#2b2b30',
];

export const CAR_NAMES = [
  'Solano', 'Brisa', 'Coral GT', 'Marlin', 'Duna', 'Vela', 'Toro', 'Arena',
];

export const RADIO_LINES = [
  'SOLMAR FM — the sun never sets on this city.',
  'Traffic on the Marina causeway is moving slow tonight.',
  'Solmar PD reminds you: lock your doors. Someone will try them.',
  'That was The Palms with "Golden Hour". Next: street news.',
];
