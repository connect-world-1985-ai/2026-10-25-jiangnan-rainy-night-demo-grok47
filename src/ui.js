const MODES = [
  ['bridge', '一', '石桥'],
  ['boat', '二', '舟行'],
  ['alley', '三', '深巷'],
  ['roof', '四', '飞檐'],
  ['walk', '五', '徐行'],
  ['orbit', '六', '环视'],
  ['fly', '七', '游目'],
];

export function createUI(root, handlers) {
  root.innerHTML = `
    <header class="inscription">
      <div class="seal" aria-hidden="true"><b>烟</b><b>雨</b></div>
      <div class="titles">
        <h1>烟雨江南</h1>
        <p>夜泊</p>
      </div>
    </header>
    <section class="quality" aria-label="画质">
      <span>画质</span>
      <div class="row">
        <button type="button" data-quality="low">淡墨</button>
        <button type="button" data-quality="medium">润墨</button>
        <button type="button" data-quality="high">浓墨</button>
      </div>
    </section>
    <section class="sliders">
      <label>雨势 <input id="rain" type="range" min="0" max="1" step="0.01" value="0.72" /></label>
      <label>雾气 <input id="fog" type="range" min="0" max="1" step="0.01" value="0.42" /></label>
      <label>更次 <input id="night" type="range" min="0" max="1" step="0.01" value="0.62" /></label>
      <div class="ticks"><span>黄昏</span><span>亥时</span><span>子夜</span></div>
    </section>
    <nav class="modes" aria-label="择景">
      ${MODES.map(([id, key, label]) => `<button type="button" data-mode="${id}"><i>${key}</i>${label}</button>`).join('')}
    </nav>
    <footer class="corner">
      <button type="button" id="sound">听雨</button>
      <button type="button" id="help-toggle">释</button>
      <span id="fps">帧 --</span>
    </footer>
    <p id="hint">一至七择景，H 开笺</p>
    <aside id="help" hidden>
      <p>「一」石桥　「二」舟行　「三」深巷　「四」飞檐</p>
      <p>「五」徐行　W A S D 移步，鼠看四周，点按凝视，按住 Shift 缓步</p>
      <p>「六」环视　拖转，滚轮远近</p>
      <p>「七」游目　W A S D 浮行，Q E 升降</p>
      <p>M 声寂　　H 此笺　　Esc 释视</p>
      <p class="touch-line">左钮移步，右屏环顾</p>
    </aside>
    <div id="stick" hidden><div id="knob"></div></div>
    <p id="bench" hidden></p>
  `;

  const soundBtn = root.querySelector('#sound');
  const help = root.querySelector('#help');
  const helpBtn = root.querySelector('#help-toggle');
  const hint = root.querySelector('#hint');
  const stick = root.querySelector('#stick');
  const knob = root.querySelector('#knob');

  root.querySelectorAll('[data-mode]').forEach((button) => {
    button.addEventListener('click', () => handlers.onMode(button.dataset.mode));
  });
  root.querySelectorAll('[data-quality]').forEach((button) => {
    button.addEventListener('click', () => handlers.onQuality(button.dataset.quality));
  });
  root.querySelector('#rain').addEventListener('input', (event) => handlers.onRain(Number(event.target.value)));
  root.querySelector('#fog').addEventListener('input', (event) => handlers.onFog(Number(event.target.value)));
  root.querySelector('#night').addEventListener('input', (event) => handlers.onNight(Number(event.target.value)));
  soundBtn.addEventListener('click', () => handlers.onSound());
  helpBtn.addEventListener('click', () => {
    help.hidden = !help.hidden;
  });

  return {
    setMode(mode, locked, coarse) {
      root.querySelectorAll('[data-mode]').forEach((button) => {
        button.classList.toggle('active', button.dataset.mode === mode);
      });
      const interactive = mode === 'walk' || mode === 'fly';
      stick.hidden = !(coarse && interactive);
      if (mode === 'walk' && !locked && !coarse) hint.textContent = '点按凝视，Esc 释视';
      else if (mode === 'walk') hint.textContent = 'W A S D 移步，按住 Shift 缓步';
      else if (mode === 'fly') hint.textContent = 'W A S D 浮行，Q E 升降';
      else if (mode === 'orbit') hint.textContent = '拖转，滚轮远近';
      else hint.textContent = '一至七择景，H 开笺';
    },
    setQuality(quality) {
      root.querySelectorAll('[data-quality]').forEach((button) => {
        button.classList.toggle('active', button.dataset.quality === quality);
      });
    },
    setSound(started, muted) {
      if (!started) soundBtn.textContent = '听雨';
      else soundBtn.textContent = muted ? '寂' : '声';
      soundBtn.classList.toggle('active', started && !muted);
    },
    setFps(value) {
      root.querySelector('#fps').textContent = `帧 ${value}`;
    },
    setStick(x, y, active) {
      knob.style.transform = `translate(${x * 28}px, ${-y * 28}px)`;
      stick.classList.toggle('live', active);
    },
    note(text) {
      hint.textContent = text;
    },
    toggleHelp() {
      help.hidden = !help.hidden;
    },
    setClean(clean) {
      root.classList.toggle('clean', clean);
    },
    bench(text) {
      const node = root.querySelector('#bench');
      node.hidden = false;
      node.textContent = text;
    },
  };
}
