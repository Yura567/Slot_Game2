const stageElement = document.getElementById('pixi-stage');
const spinButton = document.getElementById('spin-button');
const maxBetButton = document.getElementById('max-bet');
const betRange = document.getElementById('bet-range');
const betValue = document.getElementById('bet-value');
const balanceValue = document.getElementById('balance-value');
const lastWin = document.getElementById('last-win');
const winMessage = document.getElementById('win-message');
const toast = document.getElementById('toast');
const winOverlay = document.getElementById('win-overlay');

const symbols = [
  { icon: '♆', name: 'trident', color: 0x62c8f1, multiplier: 8 },
  { icon: '⚡', name: 'bolt', color: 0xf5a04a, multiplier: 6 },
  { icon: '◆', name: 'gem', color: 0x8d75e9, multiplier: 5 },
  { icon: '♜', name: 'tower', color: 0x75d8b0, multiplier: 4 },
  { icon: '✦', name: 'sun', color: 0xffd158, multiplier: 3 },
  { icon: '✧', name: 'star', color: 0xff78a9, multiplier: 2 }
];

let balance = 840.5;
let spinning = false;
let currentReels = [];
let app;
let slots = [];
let particles = [];

const money = (value) => `€${value.toFixed(2)}`;
const randomBetween = (min, max) => Math.random() * (max - min) + min;
const randomSymbol = () => symbols[Math.floor(Math.random() * symbols.length)];

function drawRoundedRect(graphics, x, y, width, height, radius, fill, alpha = 1) {
  graphics.roundRect(x, y, width, height, radius).fill({ color: fill, alpha });
}

function makeSymbolText(symbol, size) {
  const text = new PIXI.Text({
    text: symbol.icon,
    style: {
      fontFamily: 'Georgia',
      fontSize: size,
      fontWeight: '700',
      fill: symbol.color,
      stroke: { color: 0x3b1b13, width: 3 },
      align: 'center'
    }
  });
  text.anchor.set(0.5);
  return text;
}

function addTileDepth(tile, x, y, width, height, isCenter) {
  const shadow = new PIXI.Graphics();
  drawRoundedRect(shadow, x + 5, y + 7, width, height, 13, 0x160d18, 0.42);
  app.stage.addChild(shadow);

  const gloss = new PIXI.Graphics();
  gloss.roundRect(x + 3, y + 3, width - 6, height * 0.34, 10).fill({
    color: isCenter ? 0xfff0bd : 0xc77b54,
    alpha: isCenter ? 0.14 : 0.09
  });
  gloss.roundRect(x + 3, y + height - 7, width - 6, 4, 2).fill({ color: 0x170c17, alpha: 0.3 });
  app.stage.addChild(gloss);
  tile.depthShadow = shadow;
  tile.gloss = gloss;
}

function addAmbientDetails(width, height) {
  const light = new PIXI.Graphics();
  light.circle(width * 0.5, -16, 118).fill({ color: 0xffd76d, alpha: 0.18 });
  app.stage.addChild(light);

  for (let i = 0; i < 16; i += 1) {
    const sparkle = new PIXI.Graphics();
    sparkle.star(0, 0, 4, randomBetween(2, 4.5), 0.8).fill({
      color: i % 2 ? 0xffd96d : 0xfff1c1,
      alpha: randomBetween(0.32, 0.72)
    });
    sparkle.x = randomBetween(18, width - 18);
    sparkle.y = randomBetween(18, height - 18);
    sparkle.phase = randomBetween(0, Math.PI * 2);
    sparkle.baseX = sparkle.x;
    sparkle.baseY = sparkle.y;
    sparkle.scale.set(randomBetween(0.55, 1));
    app.stage.addChild(sparkle);
    sparkle.ambient = true;
  }
}

function buildReels() {
  const width = stageElement.clientWidth;
  const height = stageElement.clientHeight;
  app.stage.removeChildren();
  slots = [];
  particles = [];
  currentReels = Array.from({ length: 5 }, () => Array.from({ length: 3 }, randomSymbol));

  const background = new PIXI.Graphics();
  drawRoundedRect(background, 0, 0, width, height, 8, 0xf1dfb5);
  background.rect(0, height * 0.5, width, height * 0.5).fill({ color: 0xe5ce98, alpha: 0.45 });
  app.stage.addChild(background);
  addAmbientDetails(width, height);

  const gap = Math.max(8, width * 0.014);
  const reelWidth = (width - gap * 6) / 5;
  const tileHeight = (height - gap * 4) / 3;

  currentReels.forEach((reel, column) => {
    const columnSlots = [];
    const x = gap + column * (reelWidth + gap);

    reel.forEach((symbol, row) => {
      const tileY = gap + row * (tileHeight + gap);
      const tile = new PIXI.Graphics();
      drawRoundedRect(tile, x, tileY, reelWidth, tileHeight, 13, row === 1 ? 0x5d3428 : 0x4d281e, 0.96);
      tile.stroke({ color: 0xeab557, width: row === 1 ? 3 : 2, alpha: 0.95 });
      app.stage.addChild(tile);
      addTileDepth(tile, x, tileY, reelWidth, tileHeight, row === 1);

      const symbolText = makeSymbolText(symbol, Math.min(61, tileHeight * 0.62));
      const finalY = tileY + tileHeight / 2;
      symbolText.x = x + reelWidth / 2;
      symbolText.y = finalY;
      app.stage.addChild(symbolText);
      columnSlots.push({
        tile,
        text: symbolText,
        x: x + reelWidth / 2,
        finalY,
        row,
        falling: false,
        velocity: 0
      });
    });
    slots.push(columnSlots);
  });
}

function updateAmbient(time) {
  app.stage.children.forEach((child, index) => {
    if (!child.ambient) return;
    child.x = child.baseX + Math.sin(time * 0.001 + index) * 10;
    child.y = child.baseY + Math.cos(time * 0.0012 + index) * 8;
    child.alpha = 0.3 + (Math.sin(time * 0.002 + child.phase) + 1) * 0.28;
    child.rotation += 0.01;
  });
}

function tileHeightForStage() {
  return stageElement.clientHeight / 3;
}

function setColumnSymbols(column, drop) {
  currentReels[column] = Array.from({ length: 3 }, randomSymbol);
  slots[column].forEach((slot, row) => {
    const symbol = currentReels[column][row];
    slot.text.text = symbol.icon;
    slot.text.style.fill = symbol.color;
    slot.text.scale.set(1.12, 0.9);
    slot.text.rotation = randomBetween(-0.12, 0.12);
    slot.falling = drop;
    slot.velocity = randomBetween(7, 11) + row * 1.4;
    if (drop) slot.text.y = -tileHeightForStage() - row * 24;
  });
}

function animateSlots(time) {
  updateAmbient(time);
  slots.forEach((columnSlots) => {
    columnSlots.forEach((slot) => {
      if (slot.falling) {
        slot.text.y += slot.velocity;
        slot.velocity += 0.55;
        slot.text.skew.x = Math.sin(time * 0.025 + slot.row) * 0.08;
        slot.text.alpha = 0.78;
        if (slot.text.y >= slot.finalY) {
          slot.text.y = slot.finalY;
          slot.falling = false;
          slot.text.scale.set(1.16, 0.86);
          slot.text.skew.x = 0;
          slot.text.alpha = 1;
          emitBurst(slot.x, slot.finalY, [0xffd978, 0xfff0ae], 4, 1.4);
        }
      }
      slot.text.x += (slot.x - slot.text.x) * 0.22;
      slot.text.rotation += (0 - slot.text.rotation) * 0.16;
      slot.text.scale.x += (1 - slot.text.scale.x) * 0.16;
      slot.text.scale.y += (1 - slot.text.scale.y) * 0.16;
    });
  });
  updateParticles();
}

function emitBurst(x, y, palette, amount = 42, force = 4) {
  for (let i = 0; i < amount; i += 1) {
    const spark = new PIXI.Graphics();
    const size = randomBetween(2, 5);
    spark.star(0, 0, 4, size, size * 0.45).fill({ color: palette[i % palette.length], alpha: 0.95 });
    spark.x = x;
    spark.y = y;
    spark.vx = randomBetween(-force, force);
    spark.vy = randomBetween(-force, force);
    spark.gravity = 0.12;
    spark.life = randomBetween(28, 52);
    spark.fade = randomBetween(0.025, 0.055);
    spark.spin = randomBetween(-0.14, 0.14);
    app.stage.addChild(spark);
    particles.push(spark);
  }
}

function updateParticles() {
  for (let index = particles.length - 1; index >= 0; index -= 1) {
    const spark = particles[index];
    spark.x += spark.vx;
    spark.y += spark.vy;
    spark.vy += spark.gravity;
    spark.rotation += spark.spin;
    spark.alpha -= spark.fade;
    spark.life -= 1;
    if (spark.life <= 0 || spark.alpha <= 0) {
      spark.destroy();
      particles.splice(index, 1);
    }
  }
}

function machineEffect(type) {
  const cabinet = document.querySelector('.reel-cabinet');
  winOverlay.classList.remove('show');
  winOverlay.setAttribute('aria-hidden', 'true');
  cabinet.classList.remove('spin-active');
  cabinet.classList.remove('win-burst', 'loss-burst');
  void cabinet.offsetWidth;
  cabinet.classList.add(type === 'win' ? 'win-burst' : 'loss-burst');
  const palette = type === 'win'
    ? [0xffd86b, 0xfff4bd, 0xffa74f, 0xffffff]
    : [0xc94b3f, 0x6b251d, 0xe68a61, 0x8b6a59];
  emitBurst(stageElement.clientWidth / 2, stageElement.clientHeight / 2, palette, type === 'win' ? 110 : 60, type === 'win' ? 7 : 4.5);
  if (type === 'win') {
    void winOverlay.offsetWidth;
    winOverlay.classList.add('show');
    winOverlay.setAttribute('aria-hidden', 'false');
    window.setTimeout(() => {
      winOverlay.classList.remove('show');
      winOverlay.setAttribute('aria-hidden', 'true');
    }, 2200);
  }
  window.setTimeout(() => cabinet.classList.remove('win-burst', 'loss-burst'), 600);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 2300);
}

function resolveSpin() {
  const middleRow = currentReels.map((reel) => reel[1]);
  const counts = middleRow.reduce((result, symbol) => {
    result[symbol.name] = (result[symbol.name] || 0) + 1;
    return result;
  }, {});
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] || [null, 0];
  const bet = Number(betRange.value);

  if (best[0] && best[1] >= 3) {
    const symbol = symbols.find((item) => item.name === best[0]);
    const win = bet * symbol.multiplier * (best[1] - 2);
    balance += win;
    lastWin.textContent = money(win);
    winMessage.innerHTML = `<span class="message-icon">✦</span><span>${best[1]} ${symbol.icon} on the payline · ${money(win)} WIN</span>`;
    balanceValue.textContent = money(balance);
    showToast(`Olympian win! ${money(win)}`);
    machineEffect('win');
  } else {
    lastWin.textContent = money(0);
    winMessage.innerHTML = '<span class="message-icon">✦</span><span>The gods are silent. Try again.</span>';
    balanceValue.textContent = money(balance);
    showToast('The gods did not answer this time.');
    machineEffect('loss');
  }
}

function spin() {
  if (spinning) return;
  const bet = Number(betRange.value);
  if (balance < bet) {
    showToast('Not enough balance for this bet.');
    return;
  }

  spinning = true;
  spinButton.classList.remove('press-burst');
  void spinButton.offsetWidth;
  spinButton.classList.add('press-burst');
  document.querySelector('.reel-cabinet').classList.add('spin-active');
  balance -= bet;
  balanceValue.textContent = money(balance);
  spinButton.classList.add('is-spinning');
  spinButton.querySelector('span').textContent = 'FALLING';
  winMessage.innerHTML = '<span class="message-icon">✦</span><span>The gates of Olympus open...</span>';

  const started = performance.now();
  const stopTimes = [460, 620, 780, 940, 1100];
  const stopped = Array(5).fill(false);
  const timer = window.setInterval(() => {
    const elapsed = performance.now() - started;
    for (let column = 0; column < 5; column += 1) {
      if (!stopped[column] && elapsed >= stopTimes[column]) {
        stopped[column] = true;
        setColumnSymbols(column, true);
      } else if (!stopped[column]) {
        setColumnSymbols(column, true);
      }
    }
    if (stopped.every(Boolean)) {
      window.clearInterval(timer);
      spinning = false;
      spinButton.classList.remove('is-spinning');
      spinButton.querySelector('span').textContent = 'SPIN';
      window.setTimeout(resolveSpin, 420);
    }
  }, 110);
}

async function init() {
  app = new PIXI.Application();
  await app.init({ resizeTo: stageElement, antialias: true, backgroundAlpha: 0 });
  stageElement.appendChild(app.canvas);
  buildReels();
  app.ticker.add(() => animateSlots(performance.now()));
  window.addEventListener('resize', buildReels);
}

betRange.addEventListener('input', () => {
  betValue.textContent = money(Number(betRange.value));
});
spinButton.addEventListener('click', spin);
maxBetButton.addEventListener('click', () => {
  betRange.value = '10';
  betRange.dispatchEvent(new Event('input'));
  showToast('Maximum bet selected.');
});
document.getElementById('add-funds').addEventListener('click', () => {
  balance += 100;
  balanceValue.textContent = money(balance);
  showToast('€100 added to your balance.');
});
document.getElementById('paytable-button').addEventListener('click', () => showToast('Three matching symbols on the payline trigger a win.'));
document.addEventListener('keydown', (event) => {
  if (event.code === 'Enter') spin();
});

init().catch((error) => {
  console.error(error);
  stageElement.textContent = 'PIXI failed to load. Please refresh the page.';
});
