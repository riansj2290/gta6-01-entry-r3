// Staged screenshot scenes. Each shot arranges the live game into one
// readable frame — title over a busy downtown, driving with traffic, a
// police chase, a mission in progress — using the game's own simulation,
// then lets it run so the capture shows a living city. Nothing here is a
// fake image: the browser renders the real game and the screenshot is taken
// of that page. Query: ?shot=start|drive|chase|mission

export function applyShot(name, W) {
  const p = W.player;
  const clearCops = () => {
    W.police.clearAll();
  };
  if (name === 'start') {
    // Title screen over a busy downtown avenue.
    W.state = 'title';
    p.x = 1900; p.y = 650;
    W.camera.snapTo(1900, 650);
    return;
  }
  if (name === 'drive') {
    W.state = 'play';
    clearCops();
    const car = W.vehicles.nearestCar(1900, 650, 500) || W.vehicles.cars[0];
    p.x = car.x; p.y = car.y;
    p.car = car;
    car.driver = 'player';
    car.angle = -Math.PI / 2; // north, up the avenue toward Mara
    car.x = 1900; car.y = 1700;
    car.speed = 240;
    car.vx = 0; car.vy = -240;
    // The car keeps driving itself (traffic AI) so the frame shows motion;
    // Dario rides along, which is all the camera needs. Route it north up
    // the avenue, then west, so the shot catches it closing on Mara's
    // marker instead of driving through it and completing the mission
    // before the shutter fires.
    car.driver = 'traffic';
    const nodeId = (ax, sy) => W.city.nodeIndex.get(ax + ',' + sy);
    car.route = [nodeId(1900, 1700), nodeId(1900, 1350), nodeId(1500, 1350), nodeId(1500, 1000), nodeId(1500, 650)];
    car.routeI = 0;
    // Traffic around the player.
    const t1 = W.vehicles.cars.find((c) => c.driver === 'traffic' && c !== car);
    if (t1) { t1.x = 1900; t1.y = 1400; t1.angle = -Math.PI / 2; t1.speed = 130; }
    W.missions.index = 0;
    W.missions.start();
    W.missions.onEnterCar(car);
    W.camera.snapTo(car.x, car.y);
    return;
  }
  if (name === 'chase') {
    W.state = 'play';
    clearCops();
    const car = W.vehicles.nearestCar(2300, 1350, 600) || W.vehicles.cars[0];
    p.x = car.x; p.y = car.y;
    p.car = car;
    car.driver = 'player';
    car.angle = Math.PI; // west, down the 1350 street
    car.x = 2300; car.y = 1350;
    car.speed = 300;
    // Let the traffic AI keep the getaway moving while the cops close in.
    // Route it west along the street so the camera stays centred on the
    // chase instead of clamping at the beach edge.
    car.driver = 'traffic';
    const nodeId = (ax, sy) => W.city.nodeIndex.get(ax + ',' + sy);
    car.route = [nodeId(2300, 1350), nodeId(1900, 1350), nodeId(1500, 1350), nodeId(1100, 1350)];
    car.routeI = 0;
    W.police.heat = 76; // 3 stars
    W.police.lastKnown = { x: car.x, y: car.y };
    W.police.seenT = 0;
    W.police.spawnCopCar();
    W.police.spawnCopCar();
    for (const cc of W.police.copCars) {
      cc.x = car.x + 140;
      cc.y = car.y + (cc === W.police.copCars[0] ? -70 : 70);
      cc.angle = Math.PI;
      cc.speed = 280;
    }
    W.missions.index = 2;
    W.missions.start();
    W.police.heat = 95; // 3 stars for the frame (mission 3 sets 2; heat decays)
    W.camera.snapTo(car.x, car.y);
    return;
  }
  if (name === 'mission') {
    W.state = 'play';
    clearCops();
    p.car = null;
    p.x = 820; p.y = 620;
    p.angle = -Math.PI / 2;
    W.missions.index = 4;
    W.missions.start();
    const van = W.vehicles.cars.find((c) => c.missionVan);
    if (van) { van.x = 900; van.y = 500; van.angle = 0; }
    // A patrol car sweeping the yard so the frame shows the stakes.
    W.police.heat = 50; // 2 stars
    W.police.spawnCopCar();
    const cc = W.police.copCars[0];
    if (cc) { cc.x = 1150; cc.y = 420; cc.angle = Math.PI / 2; cc.speed = 120; }
    W.camera.snapTo(p.x, p.y);
    return;
  }
  // Unknown shot name: fall back to the title.
  W.state = 'title';
}
