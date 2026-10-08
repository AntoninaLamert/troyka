(() => {
  "use strict";

  const SIZE = 8;
  const TYPES = ["ruby", "amber", "emerald", "sapphire", "amethyst", "aqua"];
  const NAMES = {
    ruby: "рубин", amber: "янтарь", emerald: "изумруд",
    sapphire: "сапфир", amethyst: "аметист", aqua: "аквамарин"
  };
  const GEM_ART = {
    ruby: { shape: "M24 7H76L96 30 84 78 50 96 16 78 4 30Z", colors: ["#fff0e4", "#ff7188", "#dc285a", "#701848"] },
    amber: { shape: "M50 3 91 35 72 93 28 93 9 35Z", colors: ["#fff5c7", "#ffd960", "#e9a72e", "#8b5425"] },
    emerald: { shape: "M19 10H81L96 49 78 91H22L4 49Z", colors: ["#e2ffef", "#76edac", "#20aa77", "#075946"] },
    sapphire: { shape: "M50 4 88 17 97 57 73 93 27 93 3 57 12 17Z", colors: ["#e6fbff", "#70d4ff", "#3979ec", "#202d80"] },
    amethyst: { shape: "M50 3 83 14 97 50 83 86 50 97 17 86 3 50 17 14Z", colors: ["#fff0ff", "#d6a0ff", "#994bdc", "#4c327f"] },
    aqua: { shape: "M25 5H75L95 29 85 73 50 95 15 73 5 29Z", colors: ["#e9ffff", "#83f0ed", "#32bdc8", "#145a7c"] }
  };
  const LEVELS = [
    { name: "Первые искры", objective: "sapphire", targets: { easy: 12, normal: 20, hard: 28 }, title: "Первые искры собраны!" },
    { name: "Лунные грани", objective: "ruby", targets: { easy: 6, normal: 10, hard: 15 }, title: "Лунные грани сияют!" },
    { name: "Корона сумерек", objective: "score", targets: { easy: 1800, normal: 3000, hard: 4500 }, title: "Сокровищница открыта!" }
  ];
  const RECORD_KEY = "twilight-gems-best-v1";
  const STATS_KEY = "twilight-gems-stats-v1";
  const SETTINGS_KEY = "twilight-gems-settings-v1";
  const DIFFICULTY_TYPES = { easy: 3, normal: 5, hard: 6 };
  const THEMES = ["gems", "cosmos", "sweets", "ocean"];
  const appElement = document.getElementById("app");
  const screens = {
    start: document.getElementById("start-screen"),
    game: document.getElementById("game-screen"),
    result: document.getElementById("result-screen"),
    stats: document.getElementById("stats-screen")
  };
  const difficultySelect = document.getElementById("difficulty-select");
  const themeSelect = document.getElementById("theme-select");
  const startStatsButton = document.getElementById("start-stats");
  const resultStatsButton = document.getElementById("result-stats");
  const statsBackButton = document.getElementById("stats-back");
  const playButton = document.getElementById("play-button");
  const resultPrimaryButton = document.getElementById("result-primary");
  const resultMenuButton = document.getElementById("result-menu");
  const startBestElement = document.getElementById("start-best");
  const resultBestElement = document.getElementById("result-best");
  const resultScoreElement = document.getElementById("result-score");
  const resultKickerElement = document.getElementById("result-kicker");
  const resultTitleElement = document.getElementById("result-title");
  const resultDescriptionElement = document.getElementById("result-description");
  const resultPrimaryLabel = resultPrimaryButton.querySelector("span");
  const stageLabelElement = document.getElementById("stage-label");
  const stageNameElement = document.getElementById("stage-name");
  const stageProgressElement = document.getElementById("stage-progress");
  const progressFillElement = document.getElementById("progress-fill");
  const stageObjectiveElement = document.getElementById("stage-objective");
  const stageCountElement = document.getElementById("stage-count");
  const comboIndicator = document.getElementById("combo-indicator");
  const powerButtons = {
    hammer: document.getElementById("power-hammer"),
    shuffle: document.getElementById("power-shuffle"),
    swap: document.getElementById("power-swap")
  };
  const statElements = {
    games: document.getElementById("stat-games"), best: document.getElementById("stat-best"),
    cascade: document.getElementById("stat-cascade"), combo: document.getElementById("stat-combo"),
    gems: document.getElementById("stat-gems")
  };
  const boardElement = document.getElementById("board");
  const scoreElement = document.getElementById("score");
  const statusElement = document.getElementById("status");
  const newGameButton = document.getElementById("new-game");
  const soundToggleButton = document.getElementById("sound-toggle");
  const reactionElement = document.getElementById("combo-reaction");
  const reactionText = reactionElement?.querySelector("strong");
  const gameAudio = typeof window === "undefined" ? null : window.gameSound;

  let board = [];
  let obstacles = Array(SIZE * SIZE).fill(null);
  let score = 0;
  let selected = null;
  let busy = false;
  let gameId = 0;
  let nextGemId = 0;
  let reactionTimer = 0;
  let levelIndex = 0;
  let stageStartScore = 0;
  let currentView = "start";
  let bestScore = readBestScore();
  let stats = readStats();
  let difficulty = "normal";
  let theme = "gems";
  let collected = Object.fromEntries(TYPES.map(type => [type, 0]));
  let stageStartCollected = 0;
  let combo = 1;
  let lastCascade = 0;
  let hintTimer = 0;
  let hintIndex = -1;
  let powerMode = null;
  let powerFirst = null;
  let powers = { hammer: 1, shuffle: 1, swap: 1 };
  let statsReturnView = "start";
  let renderedTiles = [];
  let tileContents = [];
  const gemArtCache = new Map();
  let pointerDrag = null;
  let dragFrame = 0;
  let suppressClickUntil = 0;
  let fitFrame = 0;

  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const waitForAnimation = ms => delay(prefersReducedMotion() ? Math.min(ms, 80) : ms);
  const activeTypes = () => difficulty === "easy" ? ["ruby", "amber", "sapphire"]
    : TYPES.slice(0, DIFFICULTY_TYPES[difficulty] + (difficulty === "normal" && levelIndex > 0 ? 1 : 0));
  const randomType = () => {
    const choices = activeTypes();
    return choices[Math.floor(Math.random() * choices.length)];
  };
  const newGem = (type = randomType(), special = null) => ({ id: ++nextGemId, type, special });
  const indexOf = (row, col) => row * SIZE + col;

  function areAdjacent(a, b) {
    const rowA = Math.floor(a / SIZE);
    const rowB = Math.floor(b / SIZE);
    const colA = a % SIZE;
    const colB = b % SIZE;
    return Math.abs(rowA - rowB) + Math.abs(colA - colB) === 1;
  }

  function swap(a, b) {
    [board[a], board[b]] = [board[b], board[a]];
  }

  function captureGemPositions(indexes = [0, 1]) {
    if (typeof boardElement.querySelectorAll !== "function") return new Map();
    return new Map(indexes.map(index => {
      const tile = renderedTiles[index];
      return tile?.dataset.gemId ? [tile.dataset.gemId, tile.querySelector(".gem").getBoundingClientRect()] : null;
    }).filter(Boolean));
  }

  function boardScale() {
    return boardElement.offsetWidth ? boardElement.getBoundingClientRect().width / boardElement.offsetWidth : 1;
  }

  function animateGemMoves(previousPositions) {
    if (!previousPositions.size || typeof boardElement.querySelectorAll !== "function" || prefersReducedMotion()) return;
    const moves = [];
    const scale = boardScale();
    for (const tile of renderedTiles) {
      const previous = previousPositions.get(tile.dataset.gemId);
      const gem = tile.querySelector(".gem");
      if (!previous || !gem || typeof gem.animate !== "function") continue;
      const current = gem.getBoundingClientRect();
      const dx = (previous.left - current.left) / scale;
      const dy = (previous.top - current.top) / scale;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
      moves.push({ gem, dx, dy });
    }
    // Сначала читаем геометрию, затем запускаем анимации: без чередования layout/write.
    for (const { gem, dx, dy } of moves) {
      gem.animate([{ transform: `translate3d(${dx}px, ${dy}px, 0)` }, { transform: "translate3d(0, 0, 0)" }],
        { duration: 145, easing: "cubic-bezier(.2,.8,.25,1)" });
    }
  }

  function findMatchGroups() {
    const groups = [];
    for (let row = 0; row < SIZE; row++) {
      let start = 0;
      while (start < SIZE) {
        const type = board[indexOf(row, start)]?.type;
        let end = start + 1;
        while (end < SIZE && type && board[indexOf(row, end)]?.type === type) end++;
        if (type && end - start >= 3) groups.push({ indexes: Array.from({ length: end - start }, (_, n) => indexOf(row, start + n)), direction: "row", type });
        start = end;
      }
    }

    for (let col = 0; col < SIZE; col++) {
      let start = 0;
      while (start < SIZE) {
        const type = board[indexOf(start, col)]?.type;
        let end = start + 1;
        while (end < SIZE && type && board[indexOf(end, col)]?.type === type) end++;
        if (type && end - start >= 3) groups.push({ indexes: Array.from({ length: end - start }, (_, n) => indexOf(start + n, col)), direction: "col", type });
        start = end;
      }
    }

    return groups;
  }

  function findPossibleMove() {
    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        const a = indexOf(row, col);
        if (!board[a] || obstacles[a]) continue;
        for (const b of [col + 1 < SIZE ? a + 1 : -1, row + 1 < SIZE ? a + SIZE : -1]) {
          if (b < 0 || !board[b] || obstacles[b]) continue;
          if (board[a].special || board[b].special) return [a, b];
          swap(a, b);
          const valid = findMatchGroups().length > 0;
          swap(a, b);
          if (valid) return [a, b];
        }
      }
    }
    return null;
  }

  const hasPossibleMove = () => Boolean(findPossibleMove());

  function placeObstacles() {
    obstacles = Array(SIZE * SIZE).fill(null);
    if (levelIndex === 0) return;
    const sets = levelIndex === 1 ? { ice: 5, chain: 2 } : { ice: 4, chain: 3, crate: 2, stone: 1 };
    if (difficulty === "easy") { sets.chain = Math.max(0, sets.chain - 1); sets.crate = Math.max(0, (sets.crate || 0) - 1); sets.stone = 0; }
    if (difficulty === "hard") { sets.ice += 2; sets.chain += 2; sets.crate = (sets.crate || 0) + 1; }
    for (const [kind, count] of Object.entries(sets)) for (let n = 0; n < count; n++) {
      let index;
      do { index = indexOf(1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)); } while (obstacles[index]);
      obstacles[index] = { kind, hp: kind === "stone" ? 2 : 1 };
    }
  }

  function makePlayableBoard() {
    do {
      board = [];
      for (let row = 0; row < SIZE; row++) {
        for (let col = 0; col < SIZE; col++) {
          const cell = indexOf(row, col);
          if (["crate", "stone"].includes(obstacles[cell]?.kind)) { board.push(null); continue; }
          const forbidden = new Set();
          if (col >= 2 && board[indexOf(row, col - 1)]?.type && board[indexOf(row, col - 1)].type === board[indexOf(row, col - 2)]?.type) {
            forbidden.add(board[indexOf(row, col - 1)].type);
          }
          if (row >= 2 && board[indexOf(row - 1, col)]?.type && board[indexOf(row - 1, col)].type === board[indexOf(row - 2, col)]?.type) {
            forbidden.add(board[indexOf(row - 1, col)].type);
          }
          const choices = activeTypes().filter(type => !forbidden.has(type));
          board.push(newGem(choices[Math.floor(Math.random() * choices.length)]));
        }
      }
    } while (!hasPossibleMove());
  }

  function render({ matched = new Set(), invalid = new Set(), spawned = new Map(), falling = new Map(), movements = new Map(), cascade = 1 } = {}) {
    const states = board.map((gem, index) => {
      const row = Math.floor(index / SIZE) + 1;
      const col = index % SIZE + 1;
      const obstacle = obstacles[index];
      const classes = ["tile"];
      if (selected === index) classes.push("selected");
      if (hintIndex === index) classes.push("hint");
      if (obstacle) classes.push(`obstacle-${obstacle.kind}`);
      if (gem?.special) classes.push(`special-${gem.special}`);
      if (matched.has(index)) classes.push("matched");
      if (invalid.has(index)) classes.push("invalid");
      if (gem && spawned.has(gem.id)) classes.push("spawned");
      if (gem && falling.has(gem.id)) classes.push("falling");
      const style = [];
      if (gem && falling.has(gem.id)) style.push(`--fall-distance:${-falling.get(gem.id) * 135}%`);
      if (gem && spawned.has(gem.id)) style.push(`--spawn-distance:${-spawned.get(gem.id) * 135}%`);
      if (matched.has(index)) {
        const level = Math.min(cascade, 6);
        style.push(`--burst-distance:${22 + (level - 1) * 6}px`, `--pop-scale:${(1.34 + (level - 1) * 0.055).toFixed(2)}`, `--flash-opacity:${Math.min(0.86, 0.48 + (level - 1) * 0.07).toFixed(2)}`);
      }
      const sparks = matched.has(index) ? `<span class="spark-layer" aria-hidden="true">${sparkMarkup()}</span>` : "";
      const obstruction = obstacle ? `<span class="obstacle-mark" aria-hidden="true">${{ ice: "❄", chain: "⛓", crate: "✕", stone: "◆" }[obstacle.kind]}</span>` : "";
      const special = gem?.special ? `<span class="special-mark" aria-hidden="true">${{ row: "↔", col: "↕", color: "✹" }[gem.special]}</span>` : "";
      const label = obstacle ? `${{ ice: "лёд", chain: "цепь", crate: "ящик", stone: "камень" }[obstacle.kind]}${gem ? `, ${NAMES[gem.type]}` : ""}` : gem ? NAMES[gem.type] : "пусто";
      return { classes: classes.join(" "), style: style.join(";"), gemId: gem ? String(gem.id) : "",
        label: `Ряд ${row}, столбец ${col}: ${label}${gem?.special ? ", усиленный" : ""}`, pressed: String(selected === index),
        content: `${gem ? `<span class="gem ${gem.type}" aria-hidden="true">${gemMarkup(gem)}</span>` : ""}${obstruction}${special}${sparks}` };
    });
    if (!renderedTiles.length) {
      boardElement.innerHTML = states.map((state, index) => `<button class="${state.classes}" type="button" data-index="${index}"${state.gemId ? ` data-gem-id="${state.gemId}"` : ""} aria-label="${state.label}" aria-pressed="${state.pressed}" style="${state.style}">${state.content}</button>`).join("");
      renderedTiles = [...boardElement.querySelectorAll(".tile")];
      tileContents = states.map(state => state.content);
    } else states.forEach((state, index) => {
      const tile = renderedTiles[index];
      if (tile.className !== state.classes) tile.className = state.classes;
      if (tile.getAttribute("style") !== state.style) tile.setAttribute("style", state.style);
      if (tile.dataset.gemId !== state.gemId) {
        if (state.gemId) tile.setAttribute("data-gem-id", state.gemId);
        else tile.removeAttribute("data-gem-id");
      }
      if (tile.getAttribute("aria-label") !== state.label) tile.setAttribute("aria-label", state.label);
      if (tile.getAttribute("aria-pressed") !== state.pressed) tile.setAttribute("aria-pressed", state.pressed);
      if (tileContents[index] !== state.content) { tile.innerHTML = state.content; tileContents[index] = state.content; }
    });
    const currentIds = new Set(board.filter(Boolean).map(gem => gem.id));
    for (const id of gemArtCache.keys()) if (!currentIds.has(id)) gemArtCache.delete(id);
    scoreElement.textContent = score.toLocaleString("ru-RU");
    animateGemMoves(movements);
  }

  function setStatus(message) {
    statusElement.textContent = message;
  }

  function readBestScore() {
    try {
      const saved = Number(window.localStorage?.getItem(RECORD_KEY));
      return Number.isFinite(saved) && saved > 0 ? Math.floor(saved) : 0;
    } catch (error) {
      return 0;
    }
  }

  function readStats() {
    try {
      const saved = JSON.parse(window.localStorage?.getItem(STATS_KEY) || "{}");
      return {
        games: Math.max(0, Number(saved.games) || 0), gems: Math.max(0, Number(saved.gems) || 0),
        cascade: Math.max(0, Number(saved.cascade) || 0), combo: Math.max(1, Number(saved.combo) || 1)
      };
    } catch (error) { return { games: 0, gems: 0, cascade: 0, combo: 1 }; }
  }

  function saveStats() {
    try { window.localStorage?.setItem(STATS_KEY, JSON.stringify(stats)); } catch (error) {}
  }

  function updateStatsScreen() {
    statElements.games.textContent = formatScore(stats.games);
    statElements.best.textContent = formatScore(bestScore);
    statElements.cascade.textContent = formatScore(stats.cascade);
    statElements.combo.textContent = `×${stats.combo}`;
    statElements.gems.textContent = formatScore(stats.gems);
  }

  function loadSettings() {
    try {
      const saved = JSON.parse(window.localStorage?.getItem(SETTINGS_KEY) || "{}");
      if (DIFFICULTY_TYPES[saved.difficulty]) difficulty = saved.difficulty;
      if (THEMES.includes(saved.theme)) theme = saved.theme;
    } catch (error) {}
    difficultySelect.value = difficulty;
    themeSelect.value = theme;
    applyTheme();
  }

  function applyTheme() {
    appElement.dataset.theme = theme;
    document.body.dataset.theme = theme;
    gameAudio?.setTheme?.(theme);
    try { window.localStorage?.setItem(SETTINGS_KEY, JSON.stringify({ difficulty, theme })); } catch (error) {}
  }

  function formatScore(value) {
    return value.toLocaleString("ru-RU");
  }

  function updateRecord() {
    if (score > bestScore) {
      bestScore = score;
      try { window.localStorage?.setItem(RECORD_KEY, String(bestScore)); } catch (error) {}
    }
    startBestElement.textContent = formatScore(bestScore);
    resultBestElement.textContent = formatScore(bestScore);
  }

  function updateStageUI() {
    const level = LEVELS[levelIndex];
    const target = level.targets[difficulty];
    const progress = level.objective === "score" ? Math.max(0, score - stageStartScore)
      : Math.max(0, collected[level.objective] - stageStartCollected);
    stageLabelElement.textContent = `ЭТАП ${levelIndex + 1} / ${LEVELS.length}`;
    stageNameElement.textContent = level.name;
    stageObjectiveElement.textContent = level.objective === "score" ? `Наберите ${formatScore(target)} очков`
      : level.objective === "sapphire" ? `Соберите ${target} синих камней` : `Уничтожьте ${target} красных камней`;
    stageCountElement.textContent = `${formatScore(Math.min(progress, target))} / ${formatScore(target)}`;
    stageProgressElement.setAttribute("aria-valuenow", String(Math.min(progress, target)));
    stageProgressElement.setAttribute("aria-valuemax", String(target));
    stageProgressElement.setAttribute("aria-valuetext", `${Math.min(progress, target)} из ${target}`);
    progressFillElement.style.width = `${Math.min(100, progress / target * 100)}%`;
    appElement.dataset.level = String(levelIndex + 1);
  }

  function stageComplete() {
    const level = LEVELS[levelIndex];
    return (level.objective === "score" ? score - stageStartScore : collected[level.objective] - stageStartCollected) >= level.targets[difficulty];
  }

  function updatePowers() {
    const descriptions = { hammer: "Молоток: удалить один камень", shuffle: "Перемешать поле", swap: "Поменять любые два камня" };
    for (const [name, button] of Object.entries(powerButtons)) {
      button.querySelector("span").textContent = String(powers[name]);
      button.disabled = powers[name] === 0;
      button.setAttribute("aria-pressed", String(powerMode === name));
      button.setAttribute("aria-label", `${descriptions[name]}, осталось ${powers[name]}`);
    }
  }

  function showView(nextView, moveFocus = true) {
    cancelDrag();
    currentView = nextView;
    appElement.dataset.view = nextView;
    for (const [name, screen] of Object.entries(screens)) {
      const active = name === nextView;
      screen.classList.toggle("active", active);
      screen.inert = !active;
      screen.setAttribute("aria-hidden", String(!active));
    }
    if (moveFocus) {
      const focusTarget = nextView === "start" ? playButton : nextView === "result" ? resultTitleElement
        : nextView === "stats" ? document.getElementById("stats-title") : boardElement.querySelector?.(".tile");
      focusTarget?.focus?.({ preventScroll: true });
    }
    if (nextView === "game") scheduleHint();
    else clearHint();
    scheduleScreenFit();
  }

  function scheduleScreenFit() {
    if (fitFrame) cancelAnimationFrame(fitFrame);
    fitFrame = requestAnimationFrame(() => {
      fitFrame = 0;
      const screen = screens[currentView];
      if (currentView === "game" && screen.parentElement) {
        const { clientWidth: width, clientHeight: height } = screen.parentElement;
        const landscape = width / height >= 1.4 && height <= 600;
        const layoutWidth = Math.max(width, landscape ? 520 : 300);
        const layoutHeight = Math.max(height, landscape ? 300 : 460);
        const scale = Math.min(1, width / layoutWidth, height / layoutHeight);
        // Обычные экраны меняют размер сразу через CSS, без ожидания следующего кадра.
        screen.style.setProperty("--game-width", scale < 1 ? `${layoutWidth}px` : "100%");
        screen.style.setProperty("--game-height", scale < 1 ? `${layoutHeight}px` : "100%");
        screen.style.setProperty("--game-scale", String(scale));
        return;
      }
      const card = screen.querySelector(".start-card, .result-card");
      if (!card) return;
      const scale = Math.min(1, screen.clientWidth / card.offsetWidth, screen.clientHeight / card.offsetHeight);
      card.style.setProperty("--card-scale", String(scale));
    });
  }

  function showReaction(cascade, shape = "") {
    if (!reactionElement || !reactionText) return;
    const baseMessages = ["Отлично!", "Супер!"];
    reactionText.textContent = shape ? `${shape}-комбо!` : cascade === 1 ? baseMessages[Math.floor(Math.random() * baseMessages.length)]
      : cascade === 2 ? "Каскад!"
        : cascade === 3 ? "Невероятно!"
          : "Легендарно!";
    if (reactionTimer) clearTimeout(reactionTimer);
    reactionElement.classList.remove("visible");
    void reactionElement.offsetWidth;
    reactionElement.classList.add("visible");
    reactionTimer = setTimeout(() => {
      reactionElement.classList.remove("visible");
      reactionTimer = 0;
    }, 1100);
  }

  function clearReaction() {
    if (reactionTimer) clearTimeout(reactionTimer);
    reactionTimer = 0;
    reactionElement?.classList.remove("visible");
    if (reactionText) reactionText.textContent = "";
  }

  function clearHint() {
    if (hintTimer) clearTimeout(hintTimer);
    hintTimer = 0;
    if (hintIndex >= 0) {
      hintIndex = -1;
      if (currentView === "game") render();
    }
  }

  function scheduleHint() {
    if (hintTimer) clearTimeout(hintTimer);
    hintTimer = 0;
    if (currentView !== "game" || busy || powerMode) return;
    hintTimer = setTimeout(() => {
      if (busy || currentView !== "game" || powerMode) return;
      const move = findPossibleMove();
      if (!move) { shuffleBoard(); return; }
      hintIndex = move[0];
      render();
      setStatus("Подсказка: попробуйте подсвеченный камень");
    }, 10000);
  }

  function shuffleBoard() {
    clearHint();
    const movable = board.map((gem, index) => !obstacles[index] && gem ? index : -1).filter(index => index >= 0);
    const gems = movable.map(index => board[index]);
    let valid = false;
    for (let attempt = 0; attempt < 500 && !valid; attempt++) {
      for (let i = gems.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [gems[i], gems[j]] = [gems[j], gems[i]];
      }
      movable.forEach((index, n) => { board[index] = gems[n]; });
      valid = findMatchGroups().length === 0 && hasPossibleMove();
    }
    if (!valid) makePlayableBoard();
    selected = null;
    render();
    boardElement.classList.remove("reshuffled");
    void boardElement.offsetWidth;
    boardElement.classList.add("reshuffled");
    setStatus("Ходов не осталось — самоцветы перемешаны");
    scheduleHint();
  }

  function finishStage() {
    const finalStage = levelIndex === LEVELS.length - 1;
    clearReaction();
    resultKickerElement.textContent = finalStage ? "КОЛЛЕКЦИЯ СОБРАНА" : `ЭТАП ${levelIndex + 1} ПРОЙДЕН`;
    resultTitleElement.textContent = LEVELS[levelIndex].title;
    resultDescriptionElement.textContent = finalStage
      ? "Все три этапа пройдены. Сможете превзойти свой рекорд?"
      : `Ваше путешествие продолжается: впереди этап «${LEVELS[levelIndex + 1].name}».`;
    resultScoreElement.textContent = formatScore(score);
    updateRecord();
    resultPrimaryLabel.textContent = finalStage ? "Играть снова" : "Следующий этап";
    gameAudio?.complete?.(finalStage);
    showView("result");
  }

  function syncSoundToggle(enabled) {
    if (!soundToggleButton) return;
    const label = enabled ? "Выключить звук" : "Включить звук";
    soundToggleButton.setAttribute("aria-pressed", String(enabled));
    soundToggleButton.setAttribute("aria-label", label);
    soundToggleButton.title = label;
  }

  function gemMarkup(gem) {
    const cached = gemArtCache.get(gem.id);
    if (cached?.theme === theme) return cached.markup;
    const markup = createGemMarkup(gem);
    gemArtCache.set(gem.id, { theme, markup });
    return markup;
  }

  function createGemMarkup(gem) {
    const { shape, colors } = GEM_ART[gem.type];
    const fillId = `gem-fill-${gem.id}`;
    const clipId = `gem-clip-${gem.id}`;
    const paint = `<defs><linearGradient id="${fillId}" x1="10" y1="4" x2="88" y2="94" gradientUnits="userSpaceOnUse"><stop stop-color="${colors[0]}"/><stop offset=".35" stop-color="${colors[1]}"/><stop offset=".7" stop-color="${colors[2]}"/><stop offset="1" stop-color="${colors[3]}"/></linearGradient></defs>`;
    if (theme === "cosmos") return `<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">${paint}<circle cx="50" cy="50" r="39" fill="url(#${fillId})" stroke="#fff" stroke-opacity=".7" stroke-width="2"/><ellipse cx="50" cy="51" rx="49" ry="16" fill="none" stroke="${colors[0]}" stroke-width="5" transform="rotate(-24 50 51)"/><circle cx="35" cy="28" r="10" fill="#fff" opacity=".36"/><path d="M71 22v14m-7-7h14" stroke="#fff" stroke-width="2"/></svg>`;
    if (theme === "sweets") return `<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">${paint}<path d="M18 26 4 40l13 11L4 63l15 12 11-13V38Z" fill="${colors[1]}" stroke="#fff" stroke-opacity=".5"/><path d="m82 26 14 14-13 11 13 12-15 12-11-13V38Z" fill="${colors[1]}" stroke="#fff" stroke-opacity=".5"/><circle cx="50" cy="50" r="37" fill="url(#${fillId})" stroke="#fff" stroke-width="3" stroke-opacity=".8"/><path d="M30 46c8-23 44-19 45 4 1 18-26 30-43 13-12-13-3-31 13-29 14 2 14 19 3 24-8 4-15-4-10-10" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="5" stroke-linecap="round"/></svg>`;
    if (theme === "ocean") return `<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">${paint}<path d="M50 7C78 9 93 35 88 69L50 94 12 69C7 35 22 9 50 7Z" fill="url(#${fillId})" stroke="#eaffff" stroke-opacity=".8" stroke-width="3"/><path d="M50 14v74M24 27l26 61m26-61L50 88M13 51l37 37m37-37L50 88" fill="none" stroke="#fff" stroke-opacity=".38" stroke-width="2"/><ellipse cx="35" cy="29" rx="12" ry="5" fill="#fff" opacity=".55" transform="rotate(-29 35 29)"/></svg>`;
    return `<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false"><defs><linearGradient id="${fillId}" x1="10" y1="4" x2="88" y2="94" gradientUnits="userSpaceOnUse"><stop stop-color="${colors[0]}"/><stop offset=".28" stop-color="${colors[1]}"/><stop offset=".68" stop-color="${colors[2]}"/><stop offset="1" stop-color="${colors[3]}"/></linearGradient><clipPath id="${clipId}"><path d="${shape}"/></clipPath></defs><path d="${shape}" fill="url(#${fillId})" stroke="#fff" stroke-opacity=".66" stroke-width="2.3" stroke-linejoin="round"/><g clip-path="url(#${clipId})"><path d="M4 30 24 7 50 46 16 78Z" fill="#fff" fill-opacity=".19"/><path d="M24 7 76 7 50 46Z" fill="#fff" fill-opacity=".39"/><path d="M76 7 96 30 84 78 50 46Z" fill="#fff" fill-opacity=".11"/><path d="M16 78 50 46 84 78 50 96Z" fill="#05091d" fill-opacity=".2"/><path d="M12 29 27 12 42 31" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M25 85 48 92" fill="none" stroke="#fff" stroke-opacity=".25" stroke-width="2" stroke-linecap="round"/></g><path d="M24 7H76L96 30" fill="none" stroke="#fff" stroke-opacity=".38" stroke-width="1.2" stroke-linejoin="round"/><circle cx="74" cy="25" r="2.4" fill="#fff" fill-opacity=".9"/></svg>`;
  }

  function sparkMarkup() {
    const directions = [["0", "-1"], [".8", "-.75"], ["1", "0"], [".75", ".8"], ["0", "1"], ["-.8", ".75"], ["-1", "0"], ["-.75", "-.8"]];
    return directions.map(([x, y], index) => `<i class="spark" style="--dx:${x}em;--dy:${y}em;animation-delay:${index * 14}ms"></i>`).join("");
  }

  function collapseAndRefill(matches) {
    for (const index of matches) board[index] = null;
    const spawned = new Map();
    const falling = new Map();
    for (let col = 0; col < SIZE; col++) {
      let segmentTop = 0;
      for (let boundary = 0; boundary <= SIZE; boundary++) {
        if (boundary < SIZE && !obstacles[indexOf(boundary, col)]) continue;
        const remaining = [];
        for (let row = boundary - 1; row >= segmentTop; row--) {
          const gem = board[indexOf(row, col)];
          if (gem) remaining.push({ gem, oldRow: row });
        }
        for (let row = boundary - 1, i = 0; row >= segmentTop; row--, i++) {
          if (i < remaining.length) {
            const { gem, oldRow } = remaining[i];
            board[indexOf(row, col)] = gem;
            if (row > oldRow) falling.set(gem.id, row - oldRow);
          } else {
            const gem = newGem();
            board[indexOf(row, col)] = gem;
            spawned.set(gem.id, row - segmentTop + 1);
          }
        }
        segmentTop = boundary + 1;
      }
    }
    return { spawned, falling };
  }

  function shapeBonus(groups) {
    let shape = "";
    let count = 0;
    for (const row of groups.filter(group => group.direction === "row")) {
      for (const col of groups.filter(group => group.direction === "col")) {
        const intersection = row.indexes.find(index => col.indexes.includes(index));
        if (intersection === undefined) continue;
        const rowEnd = intersection === row.indexes[0] || intersection === row.indexes[row.indexes.length - 1];
        const colEnd = intersection === col.indexes[0] || intersection === col.indexes[col.indexes.length - 1];
        shape = rowEnd && colEnd ? "Г" : "Т";
        count++;
      }
    }
    return { shape, bonus: count * 100 };
  }

  function expandSpecials(clear, colorTargets) {
    const examined = new Set();
    const queue = [...clear];
    while (queue.length) {
      const index = queue.pop();
      const gem = board[index];
      if (!gem?.special || examined.has(gem.id)) continue;
      examined.add(gem.id);
      const targets = [];
      if (gem.special === "row") for (let col = 0; col < SIZE; col++) targets.push(indexOf(Math.floor(index / SIZE), col));
      if (gem.special === "col") for (let row = 0; row < SIZE; row++) targets.push(indexOf(row, index % SIZE));
      if (gem.special === "color") {
        const color = colorTargets.get(gem.id) || gem.type;
        for (let cell = 0; cell < board.length; cell++) if (board[cell]?.type === color) targets.push(cell);
      }
      for (const target of targets) if (!clear.has(target)) { clear.add(target); queue.push(target); }
    }
  }

  function createSpecials(groups, clear, preferredIndex) {
    const created = new Map();
    for (const group of [...groups].sort((a, b) => b.indexes.length - a.indexes.length)) {
      if (group.indexes.length < 4) continue;
      const candidate = group.indexes.includes(preferredIndex) && !obstacles[preferredIndex] && !board[preferredIndex]?.special ? preferredIndex
        : group.indexes.find(index => !obstacles[index] && !board[index]?.special && !created.has(index));
      if (candidate === undefined || created.has(candidate)) continue;
      created.set(candidate, group.indexes.length >= 5 ? "color" : group.direction);
      clear.delete(candidate);
    }
    return created;
  }

  function damageObstacles(clear) {
    const touched = new Set();
    for (const index of clear) {
      const row = Math.floor(index / SIZE), col = index % SIZE;
      for (const neighbor of [index, row > 0 ? index - SIZE : -1, row < SIZE - 1 ? index + SIZE : -1,
        col > 0 ? index - 1 : -1, col < SIZE - 1 ? index + 1 : -1]) {
        if (neighbor >= 0 && obstacles[neighbor]) touched.add(neighbor);
      }
    }
    for (const index of touched) {
      obstacles[index].hp--;
      if (obstacles[index].hp <= 0) obstacles[index] = null;
    }
    return touched.size;
  }

  async function resolveCascades(groups, currentGame, forced = new Set(), preferredIndex = -1, colorTargets = new Map()) {
    let cascade = 1;
    let earned = 0;
    while (groups.length || forced.size) {
      const clear = new Set([...forced, ...groups.flatMap(group => group.indexes)]);
      const { shape, bonus } = shapeBonus(groups);
      expandSpecials(clear, colorTargets);
      const created = createSpecials(groups, clear, preferredIndex);
      for (const [index, kind] of created) board[index].special = kind;
      const removed = [...clear].filter(index => board[index]);
      const multiplier = Math.min(4, cascade);
      combo = multiplier;
      comboIndicator.textContent = `Комбо ×${combo}`;
      comboIndicator.classList.toggle("hot", combo > 1);
      stats.combo = Math.max(stats.combo, combo);
      gameAudio?.match(cascade, removed.length);
      showReaction(cascade, shape);
      setStatus(shape ? `${shape}-комбинация! Бонус +${bonus * multiplier}` : cascade === 1 ? "Комбинация!" : `Каскад ×${cascade}!`);
      render({ matched: clear, cascade });
      await waitForAnimation(380);
      if (currentGame !== gameId) return;

      const points = removed.length * 10 * multiplier + bonus * multiplier;
      score += points;
      earned += points;
      for (const index of removed) collected[board[index].type]++;
      stats.gems += removed.length;
      damageObstacles(clear);
      updateRecord();
      updateStageUI();
      saveStats();
      const motion = collapseAndRefill(clear);
      render(motion);
      await waitForAnimation(255);
      if (currentGame !== gameId) return;

      groups = findMatchGroups();
      forced = new Set();
      preferredIndex = -1;
      colorTargets = new Map();
      cascade++;
    }
    lastCascade = cascade - 1;
    stats.cascade = Math.max(stats.cascade, lastCascade);
    saveStats();
    if (stageComplete()) {
      render();
      finishStage();
    } else if (!hasPossibleMove()) {
      shuffleBoard();
    } else {
      render();
      setStatus(`+${earned} очков! Соберите следующую комбинацию`);
      scheduleHint();
    }
  }

  async function attemptSwap(a, b, free = false, dragPositions = null) {
    busy = true;
    selected = null;
    combo = 1;
    comboIndicator.textContent = "Комбо ×1";
    comboIndicator.classList.remove("hot");
    clearHint();
    const currentGame = gameId;
    gameAudio?.swap();
    const previousPositions = dragPositions || captureGemPositions([a, b]);
    swap(a, b);
    render({ movements: previousPositions });
    await waitForAnimation(150);
    if (currentGame !== gameId) return;

    const colorTargets = new Map();
    const forced = new Set();
    if (board[a].special) {
      forced.add(a);
      if (board[a].special === "color") { forced.add(b); colorTargets.set(board[a].id, board[b].type); }
    }
    if (board[b].special) {
      forced.add(b);
      if (board[b].special === "color") { forced.add(a); colorTargets.set(board[b].id, board[a].type); }
    }
    const groups = findMatchGroups();
    if (!groups.length && !forced.size && !free) {
      gameAudio?.invalid();
      setStatus("Комбинация не получилась");
      const swappedPositions = captureGemPositions([a, b]);
      swap(a, b);
      render({ invalid: new Set([a, b]), movements: swappedPositions });
      await waitForAnimation(160);
      if (currentGame !== gameId) return;
      render();
      busy = false;
      scheduleHint();
      return;
    }
    if (groups.length || forced.size) await resolveCascades(groups, currentGame, forced, b, colorTargets);
    else {
      render();
      setStatus("Свободная перестановка выполнена");
      if (!hasPossibleMove()) shuffleBoard();
      else scheduleHint();
    }
    if (currentGame === gameId) {
      busy = false;
      if (currentView === "game") scheduleHint();
    }
  }

  function startNewGame(nextView = "game", countGame = true) {
    cancelDrag();
    gameId++;
    clearReaction();
    clearHint();
    score = 0;
    selected = null;
    busy = false;
    levelIndex = 0;
    stageStartScore = 0;
    stageStartCollected = 0;
    collected = Object.fromEntries(TYPES.map(type => [type, 0]));
    combo = 1;
    comboIndicator.textContent = "Комбо ×1";
    comboIndicator.classList.remove("hot");
    powers = { hammer: 1, shuffle: 1, swap: 1 };
    powerMode = null;
    powerFirst = null;
    updatePowers();
    if (countGame) { stats.games++; saveStats(); }
    placeObstacles();
    makePlayableBoard();
    render();
    updateRecord();
    updateStageUI();
    setStatus("Соберите три одинаковых камня в ряд");
    showView(nextView, nextView !== "start");
  }

  function advanceStage() {
    cancelDrag();
    gameId++;
    clearReaction();
    clearHint();
    levelIndex++;
    stageStartScore = score;
    stageStartCollected = collected[LEVELS[levelIndex].objective] || 0;
    selected = null;
    busy = false;
    combo = 1;
    comboIndicator.textContent = "Комбо ×1";
    comboIndicator.classList.remove("hot");
    for (const name of Object.keys(powers)) powers[name] = Math.min(3, powers[name] + 1);
    updatePowers();
    placeObstacles();
    makePlayableBoard();
    render();
    updateStageUI();
    setStatus(`Этап ${levelIndex + 1}: ${stageObjectiveElement.textContent.toLowerCase()}`);
    showView("game");
    gameAudio?.toggleCue();
  }

  boardElement.addEventListener("click", event => {
    if (event.detail !== 0 && Date.now() < suppressClickUntil) return;
    const tile = event.target.closest("[data-index]");
    if (!tile || busy || currentView !== "game") return;
    const index = Number(tile.dataset.index);
    clearHint();
    if (powerMode === "hammer") {
      if (!board[index] && !obstacles[index]) return;
      powers.hammer--;
      powerMode = null;
      updatePowers();
      busy = true;
      resolveCascades([], gameId, new Set([index])).then(() => {
        busy = false;
        if (currentView === "game") scheduleHint();
      });
      return;
    }
    if (powerMode === "swap") {
      if (!board[index] || obstacles[index]) { setStatus("Выберите свободный камень"); return; }
      if (powerFirst === null) { powerFirst = index; selected = index; render(); return; }
      if (powerFirst === index) { powerFirst = null; selected = null; render(); scheduleHint(); return; }
      if (board[powerFirst].type === board[index].type && !board[powerFirst].special && !board[index].special) {
        setStatus("Для свободной перестановки выберите разные камни");
        return;
      }
      const first = powerFirst;
      powerFirst = null;
      powerMode = null;
      powers.swap--;
      updatePowers();
      attemptSwap(first, index, true);
      return;
    }
    if (obstacles[index] || !board[index]) { setStatus("Этот камень закреплён. Разбейте преграду комбинацией рядом"); scheduleHint(); return; }
    if (selected === null) {
      gameAudio?.select();
      selected = index;
      render();
      scheduleHint();
      return;
    }
    if (selected === index) {
      gameAudio?.select();
      selected = null;
      render();
      scheduleHint();
      return;
    }
    if (areAdjacent(selected, index)) {
      attemptSwap(selected, index);
    } else {
      gameAudio?.select();
      selected = index;
      render();
      scheduleHint();
    }
  });

  function resetDragNeighbor() {
    if (!pointerDrag?.neighbor) return;
    pointerDrag.neighbor.classList.remove("drag-neighbor");
    pointerDrag.neighbor.querySelector(".gem").style.transform = "";
    pointerDrag.neighbor = null;
  }

  function cancelDrag() {
    if (dragFrame) cancelAnimationFrame(dragFrame);
    dragFrame = 0;
    if (!pointerDrag) return;
    resetDragNeighbor();
    const { tile, gem, pointerId } = pointerDrag;
    tile.classList.remove("dragging");
    gem.style.transform = "";
    pointerDrag = null;
    boardElement.classList.remove("drag-active");
    if (tile.hasPointerCapture?.(pointerId)) tile.releasePointerCapture(pointerId);
  }

  function drawDrag() {
    dragFrame = 0;
    const drag = pointerDrag;
    if (!drag?.moved) return;
    const horizontal = Math.abs(drag.dx) >= Math.abs(drag.dy);
    const distance = horizontal ? drag.dx : drag.dy;
    const step = horizontal ? drag.stepX : drag.stepY;
    const delta = Math.sign(distance) * (horizontal ? 1 : SIZE);
    const target = drag.index + delta;
    const valid = target >= 0 && target < SIZE * SIZE && areAdjacent(drag.index, target) && board[target] && !obstacles[target];
    drag.target = valid ? target : -1;
    if (drag.neighbor !== renderedTiles[drag.target]) {
      resetDragNeighbor();
      if (valid) { drag.neighbor = renderedTiles[target]; drag.neighbor.classList.add("drag-neighbor"); }
    }
    const amount = valid ? Math.max(-step, Math.min(step, distance)) : Math.max(-step * .2, Math.min(step * .2, distance * .2));
    const x = horizontal ? amount : 0, y = horizontal ? 0 : amount;
    drag.gem.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    if (drag.neighbor) drag.neighbor.querySelector(".gem").style.transform = `translate3d(${-x}px, ${-y}px, 0)`;
    drag.canSwap = valid && Math.abs(distance) >= step * .25;
  }

  boardElement.addEventListener("pointerdown", event => {
    if (!event.isPrimary || event.button !== 0 || pointerDrag || busy || currentView !== "game" || powerMode) return;
    const tile = event.target.closest(".tile[data-index]");
    if (!tile) return;
    const index = Number(tile.dataset.index);
    if (!board[index] || obstacles[index]) return;
    clearHint();
    const first = renderedTiles[0].getBoundingClientRect(), next = renderedTiles[1].getBoundingClientRect();
    const below = renderedTiles[SIZE].getBoundingClientRect();
    const scale = boardScale();
    pointerDrag = { index, tile, gem: tile.querySelector(".gem"), pointerId: event.pointerId,
      startX: event.clientX, startY: event.clientY, scale, stepX: (next.left - first.left) / scale, stepY: (below.top - first.top) / scale,
      dx: 0, dy: 0, moved: false, target: -1, neighbor: null, canSwap: false };
    tile.setPointerCapture(event.pointerId);
  });
  boardElement.addEventListener("pointermove", event => {
    const drag = pointerDrag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag.dx = (event.clientX - drag.startX) / drag.scale;
    drag.dy = (event.clientY - drag.startY) / drag.scale;
    if (!drag.moved && Math.hypot(drag.dx, drag.dy) < 4) return;
    if (!drag.moved) {
      drag.moved = true;
      drag.tile.classList.add("dragging");
      boardElement.classList.add("drag-active");
    }
    event.preventDefault();
    if (!dragFrame) dragFrame = requestAnimationFrame(drawDrag);
  });
  boardElement.addEventListener("pointerup", event => {
    if (!pointerDrag || pointerDrag.pointerId !== event.pointerId) return;
    pointerDrag.dx = (event.clientX - pointerDrag.startX) / pointerDrag.scale;
    pointerDrag.dy = (event.clientY - pointerDrag.startY) / pointerDrag.scale;
    if (dragFrame) cancelAnimationFrame(dragFrame);
    if (pointerDrag.moved) drawDrag();
    const { index, target, moved, canSwap } = pointerDrag;
    const positions = canSwap ? captureGemPositions([index, target]) : null;
    if (moved) suppressClickUntil = Date.now() + 300;
    cancelDrag();
    if (canSwap) { event.preventDefault(); attemptSwap(index, target, false, positions); }
    else scheduleHint();
  });
  boardElement.addEventListener("pointercancel", () => { if (pointerDrag?.moved) suppressClickUntil = Date.now() + 300; cancelDrag(); scheduleHint(); });
  boardElement.addEventListener("lostpointercapture", () => { cancelDrag(); });
  boardElement.addEventListener("dragstart", event => event.preventDefault());
  window.addEventListener("blur", cancelDrag);
  window.addEventListener("resize", () => { cancelDrag(); scheduleScreenFit(); });
  window.visualViewport?.addEventListener("resize", scheduleScreenFit);
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(scheduleScreenFit).observe(appElement);

  for (const [name, button] of Object.entries(powerButtons)) button.addEventListener("click", () => {
    if (busy || currentView !== "game" || powers[name] <= 0) return;
    clearHint();
    if (name === "shuffle") {
      powers.shuffle--;
      powerMode = null;
      updatePowers();
      shuffleBoard();
      return;
    }
    powerMode = powerMode === name ? null : name;
    powerFirst = null;
    selected = null;
    updatePowers();
    render();
    setStatus(powerMode === "hammer" ? "Выберите камень, который нужно удалить" : powerMode === "swap" ? "Выберите любые два свободных камня" : "Выберите самоцвет");
    scheduleHint();
  });

  playButton.addEventListener("click", () => {
    startNewGame();
    gameAudio?.toggleCue();
  });
  resultPrimaryButton.addEventListener("click", () => {
    if (levelIndex === LEVELS.length - 1) startNewGame();
    else advanceStage();
  });
  resultMenuButton.addEventListener("click", () => showView("start"));
  startStatsButton.addEventListener("click", () => { statsReturnView = "start"; updateStatsScreen(); showView("stats"); });
  resultStatsButton.addEventListener("click", () => { statsReturnView = "result"; updateStatsScreen(); showView("stats"); });
  statsBackButton.addEventListener("click", () => showView(statsReturnView));
  difficultySelect.addEventListener("change", () => { difficulty = difficultySelect.value; applyTheme(); });
  themeSelect.addEventListener("change", () => { theme = themeSelect.value; applyTheme(); render(); });
  newGameButton.addEventListener("click", () => startNewGame());
  if (soundToggleButton) {
    soundToggleButton.addEventListener("click", () => {
      const enabled = gameAudio ? gameAudio.toggle() : false;
      syncSoundToggle(enabled);
      if (enabled) gameAudio?.toggleCue();
    });
    syncSoundToggle(gameAudio?.enabled ?? false);
  }
  loadSettings();
  startNewGame("start", false);
})();
