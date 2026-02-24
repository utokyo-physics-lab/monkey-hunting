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

// ハンター→サルの方向から角度（度）を計算してスライダーに反映する
function updateAngleFromPositions() {
  const mx = (UI.getVal('monkeyX') / 100) * width;
  const my = (UI.getVal('monkeyY') / 100) * height;
  const bx = (UI.getVal('bulletX') / 100) * width;
  const by = (UI.getVal('bulletY') / 100) * height;

  // atan2 で方向を計算（p5.js のy軸は下向き正なので符号に注意）
  // dx = mx - bx (右方向正), dy = my - by (下方向正)
  // 表示用の角度は「水平から上向きを正」とする
  const angleDeg = -degrees(Math.atan2(my - by, mx - bx));
  UI.setVal('angle', angleDeg);
}

function setup() {
  const container = document.getElementById('canvas-container');
  const canvas = createCanvas(container.offsetWidth, container.offsetHeight);
  canvas.parent(container);
  engine = Engine.create();
  world = engine.world;

  ['monkeyX', 'monkeyY', 'bulletX', 'bulletY'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      if (!isFired) {
        resetSimulation();
        updateAngleFromPositions();
      }
    });
  });
  // 速さスライダーは角度に影響しない
  document.getElementById('speed').addEventListener('input', () => {
    if (!isFired) resetSimulation();
  });
  // 角度スライダーは読み取り専用表示（手動変更は無効化しない方が柔軟）
  document.getElementById('angle').addEventListener('input', () => {
    if (!isFired) resetSimulation();
  });
  document.querySelectorAll('input[name="gravity"]').forEach(el => {
    el.addEventListener('change', () => { engine.gravity.y = UI.getGravity(); });
  });
  document.getElementById('hunterFall').addEventListener('change', () => { if (!isFired) resetSimulation(); });

  document.getElementById('fireBtn').onclick = fire;
  document.getElementById('resetBtn').onclick = resetSimulation;
  resetSimulation();
  updateAngleFromPositions();
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

  // 発射方向：ハンター→サルへの単位ベクトルを使う（角度スライダーと完全一致）
  const hx = hunter.position.x;
  const hy = hunter.position.y;
  const mx = monkey.position.x;
  const my = monkey.position.y;

  const dx = mx - hx;
  const dy = my - hy;
  const len = Math.sqrt(dx * dx + dy * dy);

  if (len === 0) return;

  const speed = UI.getVal('speed');
  const vx = (dx / len) * speed;
  const vy = (dy / len) * speed;

  Body.setVelocity(bullet, { x: vx, y: vy });
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

    // ドラッグで位置が変わったら角度も自動更新
    updateAngleFromPositions();
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

  // 1. 照準線：ハンター→サルの方向に沿った赤い破線
  if (!isFired) {
    const dx = mx - hx;
    const dy = my - hy;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0) {
      const ux = dx / len;
      const uy = dy / len;
      const extend = max(width, height) * 2;
      stroke(255, 0, 0, 220);
      strokeWeight(3);
      drawingContext.setLineDash([10, 5]);
      // ハンターから猿の方向へ（後方にも少し伸ばす）
      line(hx - ux * extend, hy - uy * extend, hx + ux * extend, hy + uy * extend);
      drawingContext.setLineDash([]);
    }
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
  updateAngleFromPositions();
}
