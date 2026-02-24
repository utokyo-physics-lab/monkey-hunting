const { Engine, World, Bodies, Body } = Matter;
let engine, world, bullet, monkey, hunter, isFired = false;
let trajectory = [];
let draggingObj = null;
let lastHitTime = 0;

const UI = {
  getVal: (id) => parseFloat(document.getElementById(id).value),
  setVal: (id, val) => { document.getElementById(id).value = Math.round(val); },
  getGravity: () => parseFloat(document.querySelector('input[name="gravity"]:checked').value),
  isChecked: (id) => document.getElementById(id).checked
};

function setup() {
  const container = document.getElementById('canvas-container');
  const canvas = createCanvas(container.offsetWidth, container.offsetHeight);
  canvas.parent(container);
  engine = Engine.create();
  world = engine.world;

  ['angle', 'monkeyX', 'monkeyY', 'bulletX', 'bulletY', 'speed'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => { if (!isFired) resetSimulation(); });
  });
  document.querySelectorAll('input[name="gravity"]').forEach(el => {
    el.addEventListener('change', () => { engine.gravity.y = UI.getGravity(); });
  });
  document.getElementById('hunterFall').addEventListener('change', () => { if (!isFired) resetSimulation(); });

  document.getElementById('fireBtn').onclick = fire;
  document.getElementById('resetBtn').onclick = resetSimulation;
  resetSimulation();
}

function resetSimulation() {
  World.clear(world);
  isFired = false;
  trajectory = [];
  lastHitTime = 0;
  engine.gravity.y = UI.getGravity();

  const mx = (UI.getVal('monkeyX') / 100) * width;
  const my = (UI.getVal('monkeyY') / 100) * height;
  monkey = Bodies.circle(mx, my, 20, { isStatic: true });

  // ハンター（弾丸の位置に描画・サイズはサルと同じ）
  const bx = (UI.getVal('bulletX') / 100) * width;
  const by = (UI.getVal('bulletY') / 100) * height;
  hunter = Bodies.circle(bx, by, 20, { isStatic: true });

  bullet = Bodies.circle(bx, by, 10, { isStatic: true });

  World.add(world, [monkey, hunter, bullet]);
}

function fire() {
  if (isFired) return;
  isFired = true;
  Body.setStatic(monkey, false);
  Body.setStatic(bullet, false);

  // ハンターも落下させる場合
  if (UI.isChecked('hunterFall')) {
    Body.setStatic(hunter, false);
  }

  const angle = radians(-UI.getVal('angle')), speed = UI.getVal('speed');
  Body.setVelocity(bullet, { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed });
}

function mousePressed() {
  if (isFired) return;
  const dMonkey = dist(mouseX, mouseY, monkey.position.x, monkey.position.y);
  const dBullet = dist(mouseX, mouseY, bullet.position.x, bullet.position.y);

  if (dMonkey < 40) {
    draggingObj = 'monkey';
  } else if (dBullet < 40) {
    draggingObj = 'bullet';
  }
}

function mouseDragged() {
  if (!draggingObj || isFired) return;

  if (draggingObj === 'monkey') {
    const xPct = constrain((mouseX / width) * 100, 40, 95);
    const yPct = constrain((mouseY / height) * 100, 5, 80);
    UI.setVal('monkeyX', xPct);
    UI.setVal('monkeyY', yPct);
  } else if (draggingObj === 'bullet') {
    const xPct = constrain((mouseX / width) * 100, 2, 95);
    const yPct = constrain((mouseY / height) * 100, 5, 95);
    UI.setVal('bulletX', xPct);
    UI.setVal('bulletY', yPct);
  }

  if (!isFired) {
    const mx = (UI.getVal('monkeyX') / 100) * width;
    const my = (UI.getVal('monkeyY') / 100) * height;
    const bx = (UI.getVal('bulletX') / 100) * width;
    const by = (UI.getVal('bulletY') / 100) * height;

    if (draggingObj === 'monkey') {
      Body.setPosition(monkey, { x: mx, y: my });
    } else if (draggingObj === 'bullet') {
      Body.setPosition(bullet, { x: bx, y: by });
      Body.setPosition(hunter, { x: bx, y: by });
    }
  }
}

function mouseReleased() {
  draggingObj = null;
}

function draw() {
  background(255);
  Engine.update(engine);

  const bx = bullet.position.x;
  const by = bullet.position.y;
  const mx = monkey.position.x;
  const my = monkey.position.y;
  const hx = hunter.position.x;
  const hy = hunter.position.y;

  // 1. 照準線（大砲の角度に合わせた赤い破線直線）
  if (!isFired) {
    const ang = radians(-UI.getVal('angle'));
    const dx = cos(ang);
    const dy = sin(ang);
    // 画面端まで両方向に延ばした直線
    const extend = max(width, height) * 2;
    stroke(255, 0, 0, 220);
    strokeWeight(3);
    drawingContext.setLineDash([10, 5]);
    line(bx - dx * extend, by - dy * extend, bx + dx * extend, by + dy * extend);
    drawingContext.setLineDash([]);
  }

  // 2. ハンターとサルを結ぶ「直線」（画面端まで伸ばした真の直線）
  if (UI.isChecked('showLine')) {
    const dx = mx - hx;
    const dy = my - hy;
    const len = sqrt(dx * dx + dy * dy);
    if (len > 0) {
      const ux = dx / len, uy = dy / len;
      const extend = max(width, height) * 2;
      stroke(100, 100, 100, 200);
      strokeWeight(2);
      line(hx - ux * extend, hy - uy * extend, hx + ux * extend, hy + uy * extend);
    }
  }

  // 3. 通り道（軌道ビーム）
  if (isFired && UI.isChecked('showTrajectory')) {
    trajectory.push({ x: bx, y: by });
    if (trajectory.length > 100) trajectory.shift();
    noFill(); stroke(0, 150, 255, 180); strokeWeight(4);
    drawingContext.shadowBlur = 10; drawingContext.shadowColor = '#00d2ff';
    beginShape(); trajectory.forEach(p => vertex(p.x, p.y)); endShape();
    drawingContext.shadowBlur = 0;
  }

  // 描画：ハンター（青い円）
  fill(draggingObj === 'bullet' ? '#0099ff' : '#3b82f6');
  noStroke(); circle(hx, hy, 40);
  // ハンターのアイコン文字
  fill(255); textSize(18); textAlign(CENTER, CENTER); textStyle(NORMAL);
  text('🔫', hx, hy);

  // 描画：サル
  fill(draggingObj === 'monkey' ? '#ff7f0e' : '#ff9f43');
  noStroke(); circle(mx, my, 40);
  fill(255); textSize(18); textAlign(CENTER, CENTER);
  text('🐵', mx, my);

  // 描画：弾丸
  fill('#58cc02'); noStroke(); circle(bx, by, 20);

  // 当たり判定
  if (dist(bx, by, mx, my) < 30) {
    lastHitTime = millis();
  }

  if (millis() - lastHitTime < 1500 && lastHitTime !== 0) {
    fill(88, 204, 2);
    textSize(48);
    textStyle(BOLD);
    textAlign(CENTER);
    text("あたり！", width / 2, height / 2);
  }
}

function windowResized() {
  const container = document.getElementById('canvas-container');
  resizeCanvas(container.offsetWidth, container.offsetHeight);
  resetSimulation();
}
