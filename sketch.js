const { Engine, World, Bodies, Body } = Matter;
let engine, world, bullet, monkey, hunter;
let isFired = false, trajectory = [], draggingObj = null, lastHitTime = 0;

// ─── UI ヘルパー ──────────────────────────────────────────
const UI = {
  getVal: (id) => parseFloat(document.getElementById(id).value),
  setVal: (id, v) => { const el = document.getElementById(id); el.value = v.toFixed((el.step || '1').includes('.') ? 1 : 0); },
  getGravity: () => parseFloat(document.querySelector('input[name="gravity"]:checked').value),
  isChecked: (id) => document.getElementById(id).checked,
};

// ─── 座標ヘルパー ─────────────────────────────────────────
const pct = (id, dim) => (UI.getVal(id) / 100) * dim;
const monkeyPos = () => ({ x: pct('monkeyX', width), y: pct('monkeyY', height) });
const hunterPos = () => ({ x: pct('bulletX', width), y: pct('bulletY', height) });
const aimAngle = () => radians(-UI.getVal('angle'));

// ハンター前方に弾をオフセット（ハンターと重ならないよう）
const bulletOffset = (hx, hy) => ({ x: hx + Math.cos(aimAngle()) * 28, y: hy + Math.sin(aimAngle()) * 28 });

// ─── 照準角度の自動計算 ───────────────────────────────────
function updateAngleFromPositions() {
  const { x: mx, y: my } = monkeyPos();
  const { x: hx, y: hy } = hunterPos();
  UI.setVal('angle', -degrees(Math.atan2(my - hy, mx - hx)));
}

// ─── setup / reset ────────────────────────────────────────
function setup() {
  const container = document.getElementById('canvas-container');
  createCanvas(container.offsetWidth, container.offsetHeight).parent(container);
  engine = Engine.create();
  world = engine.world;

  // 位置入力 → リセット（角度は変更しない）
  ['monkeyX', 'monkeyY', 'bulletX', 'bulletY', 'angle', 'speed'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => { if (!isFired) resetSimulation(); });
  });
  document.querySelectorAll('input[name="gravity"]').forEach(el => {
    el.addEventListener('change', () => { engine.gravity.y = UI.getGravity(); });
  });
  document.getElementById('hunterFall').addEventListener('change', () => { if (!isFired) resetSimulation(); });
  document.getElementById('fireBtn').onclick = fire;
  document.getElementById('resetBtn').onclick = resetSimulation;
  document.getElementById('autoAimBtn').onclick = () => { updateAngleFromPositions(); resetSimulation(); };

  resetSimulation();
  updateAngleFromPositions();
}

function resetSimulation() {
  World.clear(world);
  Object.assign(engine.gravity, { y: UI.getGravity() });
  isFired = false; trajectory = []; lastHitTime = 0;

  const { x: mx, y: my } = monkeyPos();
  const { x: hx, y: hy } = hunterPos();
  const bp = bulletOffset(hx, hy);

  monkey = Bodies.circle(mx, my, 20, { isStatic: true });
  hunter = Bodies.circle(hx, hy, 20, { isStatic: true, isSensor: true }); // 弾と衝突しない
  bullet = Bodies.circle(bp.x, bp.y, 10, { isStatic: true });             // サルとは物理衝突あり

  World.add(world, [monkey, hunter, bullet]);
}

// ─── 発射 ─────────────────────────────────────────────────
function fire() {
  if (isFired) return;
  isFired = true;
  Body.setStatic(monkey, false);
  Body.setStatic(bullet, false);
  if (UI.isChecked('hunterFall')) Body.setStatic(hunter, false);

  const ang = aimAngle(), speed = UI.getVal('speed');
  Body.setVelocity(bullet, { x: Math.cos(ang) * speed, y: Math.sin(ang) * speed });
}

// ─── マウス操作 ───────────────────────────────────────────
function mousePressed() {
  if (isFired) return;
  if (dist(mouseX, mouseY, monkey.position.x, monkey.position.y) < 40) draggingObj = 'monkey';
  else if (dist(mouseX, mouseY, hunter.position.x, hunter.position.y) < 40) draggingObj = 'hunter';
}

function mouseDragged() {
  if (!draggingObj || isFired) return;

  const configs = {
    monkey: { ids: ['monkeyX', 'monkeyY'], limits: [[40, 95], [5, 80]], body: () => monkey },
    hunter: { ids: ['bulletX', 'bulletY'], limits: [[2, 95], [5, 95]], body: () => hunter },
  };
  const cfg = configs[draggingObj];
  const [xPct, yPct] = [
    constrain((mouseX / width) * 100, ...cfg.limits[0]),
    constrain((mouseY / height) * 100, ...cfg.limits[1]),
  ];
  UI.setVal(cfg.ids[0], xPct);
  UI.setVal(cfg.ids[1], yPct);

  const { x: hx, y: hy } = hunterPos();
  const { x: mx, y: my } = monkeyPos();

  if (draggingObj === 'monkey') {
    Body.setPosition(monkey, { x: mx, y: my });
    // サルを動かしても照準角度は変えない（意図的なズレを実験できるよう）
  } else {
    Body.setPosition(hunter, { x: hx, y: hy });
    // ハンターを動かしても照準角度は変えない
    const bp = bulletOffset(hx, hy);
    Body.setPosition(bullet, { x: bp.x, y: bp.y });
  }
}

function mouseReleased() { draggingObj = null; }

// ─── 描画 ─────────────────────────────────────────────────
function draw() {
  background(255);
  Engine.update(engine);

  const { x: bx, y: by } = bullet.position;
  const { x: mx, y: my } = monkey.position;
  const { x: hx, y: hy } = hunter.position;
  const ang = aimAngle();
  const ext = max(width, height) * 2;

  // 照準線（発射前のみ）
  if (!isFired) {
    const [ux, uy] = [Math.cos(ang), Math.sin(ang)];
    stroke(255, 0, 0, 220); strokeWeight(3);
    drawingContext.setLineDash([10, 5]);
    line(hx - ux * ext, hy - uy * ext, hx + ux * ext, hy + uy * ext);
    drawingContext.setLineDash([]);
  }

  // ハンター↔サル 結線
  if (UI.isChecked('showLine')) {
    const [dx, dy] = [mx - hx, my - hy];
    const len = sqrt(dx * dx + dy * dy);
    if (len > 0) {
      const [ux, uy] = [dx / len, dy / len];
      stroke(100, 100, 100, 200); strokeWeight(2);
      line(hx - ux * ext, hy - uy * ext, hx + ux * ext, hy + uy * ext);
    }
  }

  // 弾の軌道
  if (isFired && UI.isChecked('showTrajectory')) {
    trajectory.push({ x: bx, y: by });
    if (trajectory.length > 100) trajectory.shift();
    noFill(); stroke(0, 150, 255, 180); strokeWeight(4);
    drawingContext.shadowBlur = 10; drawingContext.shadowColor = '#00d2ff';
    beginShape(); trajectory.forEach(p => vertex(p.x, p.y)); endShape();
    drawingContext.shadowBlur = 0;
  }

  // キャラクター描画（共通ヘルパー）
  const drawChar = (x, y, r, color, icon) => {
    fill(color); noStroke(); circle(x, y, r * 2);
    fill(255); textSize(18); textAlign(CENTER, CENTER); textStyle(NORMAL);
    text(icon, x, y);
  };

  drawChar(hx, hy, 20, draggingObj === 'hunter' ? '#0099ff' : '#3b82f6', '🔫');
  drawChar(mx, my, 20, draggingObj === 'monkey' ? '#ff7f0e' : '#ff9f43', '🐵');

  // 弾丸（発射前はハンター前方の固定位置に表示）
  const [dbx, dby] = isFired
    ? [bx, by]
    : [hx + Math.cos(ang) * 28, hy + Math.sin(ang) * 28];
  fill('#58cc02'); noStroke(); circle(dbx, dby, 20);

  // 当たり判定（サル↔弾）
  if (isFired && dist(bx, by, mx, my) < 30) lastHitTime = millis();
  if (lastHitTime > 0 && millis() - lastHitTime < 1500) {
    fill(88, 204, 2); textSize(48); textStyle(BOLD); textAlign(CENTER);
    text('あたり！', width / 2, height / 2);
  }
}

// ─── ウィンドウリサイズ ───────────────────────────────────
function windowResized() {
  const container = document.getElementById('canvas-container');
  resizeCanvas(container.offsetWidth, container.offsetHeight);
  resetSimulation();
  updateAngleFromPositions();
}
