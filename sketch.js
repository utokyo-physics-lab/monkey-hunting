const { Engine, World, Bodies, Body } = Matter;
let engine, world, bullet, monkey, hunter, isFired = false;
let trajectory = [];
let draggingObj = null;
let lastHitTime = 0;

const UI = {
  getVal: (id) => parseFloat(document.getElementById(id).value),
  // 小数点以下1桁まで保存（角度の0.1度単位対応）
  setVal: (id, val) => {
    const el = document.getElementById(id);
    const step = parseFloat(el.step) || 1;
    const decimals = (step.toString().split('.')[1] || '').length;
    el.value = val.toFixed(decimals);
  },
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
  const angleDeg = -degrees(Math.atan2(my - by, mx - bx));
  UI.setVal('angle', angleDeg);
}

// ハンターの前方（発射方向）に弾を少しオフセットして配置する
// ハンターと弾が重ならないようにするため
function getBulletStartPos(hx, hy) {
  const ang = radians(-UI.getVal('angle'));
  const offsetDist = 28; // ハンターr=20 + 弾r=10 - 数px余裕
  return {
    x: hx + Math.cos(ang) * offsetDist,
    y: hy + Math.sin(ang) * offsetDist
  };
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
        // ハンター側(bulletX/bulletY)が変わった時だけ角度を自動更新
        // サル側の数値入力も同様に更新（UIから直接入力なので両方更新する）
        updateAngleFromPositions();
      }
    });
  });
  document.getElementById('speed').addEventListener('input', () => {
    if (!isFired) resetSimulation();
  });
  // 角度を手動で変えたときもリセットして照準を反映
  document.getElementById('angle').addEventListener('input', () => {
    if (!isFired) resetSimulation();
  });
  document.querySelectorAll('input[name="gravity"]').forEach(el => {
    el.addEventListener('change', () => { engine.gravity.y = UI.getGravity(); });
  });
  document.getElementById('hunterFall').addEventListener('change', () => { if (!isFired) resetSimulation(); });

  document.getElementById('fireBtn').onclick = fire;
  document.getElementById('resetBtn').onclick = resetSimulation;
  document.getElementById('autoAimBtn').onclick = () => {
    updateAngleFromPositions();
    resetSimulation();
  };

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

  // ハンター（当たり判定あり・静止）
  const bx = (UI.getVal('bulletX') / 100) * width;
  const by = (UI.getVal('bulletY') / 100) * height;
  hunter = Bodies.circle(bx, by, 20, { isStatic: true, isSensor: true });

  // 弾丸：ハンターの前方にオフセット配置、isSensor=trueで他物体と衝突しない
  const bpos = getBulletStartPos(bx, by);
  bullet = Bodies.circle(bpos.x, bpos.y, 10, { isStatic: true, isSensor: true });

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

  // 発射方向：角度スライダーの値を使う
  const angle = radians(-UI.getVal('angle'));
  const speed = UI.getVal('speed');
  Body.setVelocity(bullet, { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed });
}

function mousePressed() {
  if (isFired) return;
  const dMonkey = dist(mouseX, mouseY, monkey.position.x, monkey.position.y);
  const dHunter = dist(mouseX, mouseY, hunter.position.x, hunter.position.y);

  if (dMonkey < 40) {
    draggingObj = 'monkey';
  } else if (dHunter < 40) {
    draggingObj = 'hunter';
  }
}

function mouseDragged() {
  if (!draggingObj || isFired) return;

  if (draggingObj === 'monkey') {
    const xPct = constrain((mouseX / width) * 100, 40, 95);
    const yPct = constrain((mouseY / height) * 100, 5, 80);
    UI.setVal('monkeyX', xPct);
    UI.setVal('monkeyY', yPct);
    const mx = (UI.getVal('monkeyX') / 100) * width;
    const my = (UI.getVal('monkeyY') / 100) * height;
    Body.setPosition(monkey, { x: mx, y: my });
    // サルを動かしても照準角度は変えない（ユーザーが意図的にずらして実験できる）
  } else if (draggingObj === 'hunter') {
    const xPct = constrain((mouseX / width) * 100, 2, 95);
    const yPct = constrain((mouseY / height) * 100, 5, 95);
    UI.setVal('bulletX', xPct);
    UI.setVal('bulletY', yPct);
    const bx = (UI.getVal('bulletX') / 100) * width;
    const by = (UI.getVal('bulletY') / 100) * height;
    Body.setPosition(hunter, { x: bx, y: by });
    // ハンターを動かしたときは角度を自動更新し弾位置も更新
    updateAngleFromPositions();
    const bpos = getBulletStartPos(bx, by);
    Body.setPosition(bullet, { x: bpos.x, y: bpos.y });
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

  // 1. 照準線：角度スライダーの値に沿った赤い破線（発射方向と完全一致）
  if (!isFired) {
    const ang = radians(-UI.getVal('angle'));
    const ux = Math.cos(ang);
    const uy = Math.sin(ang);
    const extend = max(width, height) * 2;
    stroke(255, 0, 0, 220);
    strokeWeight(3);
    drawingContext.setLineDash([10, 5]);
    line(hx - ux * extend, hy - uy * extend, hx + ux * extend, hy + uy * extend);
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
  fill(draggingObj === 'hunter' ? '#0099ff' : '#3b82f6');
  noStroke(); circle(hx, hy, 40);
  fill(255); textSize(18); textAlign(CENTER, CENTER); textStyle(NORMAL);
  text('🔫', hx, hy);

  // 描画：サル
  fill(draggingObj === 'monkey' ? '#ff7f0e' : '#ff9f43');
  noStroke(); circle(mx, my, 40);
  fill(255); textSize(18); textAlign(CENTER, CENTER);
  text('🐵', mx, my);

  // 描画：弾丸（発射前はハンターの前方に表示、発射後は物理で動く）
  if (!isFired) {
    // 発射前の弾は照準方向オフセット位置にアイコン描画
    const ang = radians(-UI.getVal('angle'));
    const bDrawX = hx + Math.cos(ang) * 28;
    const bDrawY = hy + Math.sin(ang) * 28;
    fill('#58cc02'); noStroke(); circle(bDrawX, bDrawY, 20);
  } else {
    fill('#58cc02'); noStroke(); circle(bx, by, 20);
  }

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
