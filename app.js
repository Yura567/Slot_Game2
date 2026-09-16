const stageElement = document.getElementById('pixi-stage');
const spinButton = document.getElementById('spin-button');
const maxBetButton = document.getElementById('max-bet');
const betRange = document.getElementById('bet-range');
const betValue = document.getElementById('bet-value');
const balanceValue = document.getElementById('balance-value');
const lastWin = document.getElementById('last-win');
const winMessage = document.getElementById('win-message');
const freeSpins = document.getElementById('free-spins');
const toast = document.getElementById('toast');

const symbols = [
  { icon: '☼', name: 'sun', color: 0xf0ad24, multiplier: 8 },
  { icon: '⚡', name: 'bolt', color: 0xf4c84e, multiplier: 6 },
  { icon: '♆', name: 'trident', color: 0x5dbfe7, multiplier: 5 },
  { icon: '★', name: 'star', color: 0xff6c99, multiplier: 4 },
  { icon: '◆', name: 'gem', color: 0x8b6af3, multiplier: 3 },
  { icon: '♜', name: 'tower', color: 0x4e47ad, multiplier: 2 }
];

let balance = 840.50;
let spinning = false;
let currentReels = [];
let app;
let reelTexts = [];
let reelContainers = [];

const money = (value) => `€${value.toFixed(2)}`;

function randomSymbol() {
  return symbols[Math.floor(Math.random() * symbols.length)];
}

function drawRoundedRect(graphics, x, y, width, height, radius, fill, alpha = 1) {
  graphics.roundRect(x, y, width, height, radius).fill({ color: fill, alpha });
}

function makeSymbolText(symbol, size) {
  const text = new PIXI.Text({
    text: symbol.icon,
    style: {
      fontFamily: 'Space Grotesk',
      fontSize: size,
      fontWeight: '700',
      fill: symbol.color,
      align: 'center'
    }
  });
  text.anchor.set(0.5);
  return text;
}

function buildReels() {
  const width = stageElement.clientWidth;
  const height = stageElement.clientHeight;
  app.stage.removeChildren();
  reelContainers = [];
  reelTexts = [];
  currentReels = Array.from({ length: 5 }, () => Array.from({ length: 3 }, randomSymbol));

  const gap = Math.max(5, width * 0.012);
  const reelWidth = (width - gap * 6) / 5;
  const tileHeight = (height - gap * 4) / 3;

  const backdrop = new PIXI.Graphics();
  drawRoundedRect(backdrop, 0, 0, width, height, 10, 0xfffdfd);
  app.stage.addChild(backdrop);

  currentReels.forEach((reel, column) => {
    const container = new PIXI.Container();
    const x = gap + column * (reelWidth + gap);
    const texts = [];
    reel.forEach((symbol, row) => {
      const tile = new PIXI.Graphics();
      drawRoundedRect(tile, x, gap + row * (tileHeight + gap), reelWidth, tileHeight, 8, row === 1 ? 0xf5f1ff : 0xf9f7ff);
      if (row === 1) {
        tile.stroke({ color: 0xe3dcfb, width: 1, alpha: 0.9 });
      }
      app.stage.addChild(tile);

      const symbolText = makeSymbolText(symbol, Math.min(54, tileHeight * 0.54));
      symbolText.x = x + reelWidth / 2;
      symbolText.y = gap + row * (tileHeight + gap) + tileHeight / 2 - 2;
      app.stage.addChild(symbolText);
      texts.push(symbolText);
    });
    reelContainers.push(container);
    reelTexts.push(texts);
  });
}

function updateReelColumn(column) {
  currentReels[column] = Array.from({ length: 3 }, randomSymbol);
  currentReels[column].forEach((symbol, row) => {
    const text = reelTexts[column][row];
    text.text = symbol.icon;
    text.style.fill = symbol.color;
  });
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 2200);
}

function resolveSpin() {
  const middleRow = currentReels.map((reel) => reel[1]);
  const counts = middleRow.reduce((result, symbol) => {
    result[symbol.name] = (result[symbol.name] || 0) + 1;
    return result;
  }, {});
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const bet = Number(betRange.value);
  let win = 0;

  if (best[1] >= 3) {
    const symbol = symbols.find((item) => item.name === best[0]);
    win = bet * symbol.multiplier * (best[1] - 2);
    balance += win;
    lastWin.textContent = money(win);
    winMessage.innerHTML = `<span class="message-icon">✦</span><span>${best[1]} ${symbol.icon} on the payline · ${money(win)} WIN</span>`;
    showToast(`Divine hit! You won ${money(win)}`);
  } else {
    lastWin.textContent = money(0);
    winMessage.innerHTML = '<span class="message-icon">✦</span><span>The gods are watching. Spin again.</span>';
  }
  balanceValue.textContent = money(balance);
}

function spin() {
  if (spinning) return;
  const bet = Number(betRange.value);
  if (balance < bet) {
    showToast('Not enough balance for this bet.');
    return;
  }

  spinning = true;
  balance -= bet;
  balanceValue.textContent = money(balance);
  spinButton.classList.add('is-spinning');
  spinButton.querySelector('span').textContent = 'SPINNING';
  winMessage.innerHTML = '<span class="message-icon">✦</span><span>The oracle is choosing...</span>';

  const started = performance.now();
  const stopTimes = [420, 570, 720, 870, 1020];
  const stopped = Array(5).fill(false);
  const timer = window.setInterval(() => {
    const elapsed = performance.now() - started;
    for (let column = 0; column < 5; column += 1) {
      if (!stopped[column] && elapsed > stopTimes[column]) {
        stopped[column] = true;
        updateReelColumn(column);
      } else if (!stopped[column]) {
        updateReelColumn(column);
      }
    }
    if (stopped.every(Boolean)) {
      window.clearInterval(timer);
      spinning = false;
      spinButton.classList.remove('is-spinning');
      spinButton.querySelector('span').textContent = 'SPIN';
      resolveSpin();
    }
  }, 85);
}

async function init() {
  app = new PIXI.Application();
  await app.init({
    resizeTo: stageElement,
    antialias: true,
    backgroundAlpha: 0
  });
  stageElement.appendChild(app.canvas);
  buildReels();
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
document.getElementById('paytable-button').addEventListener('click', () => {
  showToast('3 matching symbols on the payline trigger a win.');
});
document.addEventListener('keydown', (event) => {
  if (event.code === 'Enter') spin();
});

init().catch((error) => {
  console.error(error);
  stageElement.textContent = 'PIXI failed to load. Please refresh the page.';
});
