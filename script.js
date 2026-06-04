const COST_SINGLE = 600;
const COST_TEN = 6000;
const INITIAL_CURRENCY = 60000;

const classes = {
  Vanguard: "先",
  Guard: "近",
  Defender: "重",
  Sniper: "狙",
  Caster: "术",
  Medic: "医",
  Supporter: "辅",
  Specialist: "特",
};

const operators = [
  { name: "霜棘", rarity: 6, role: "Guard", code: "RS-01", featured: true },
  { name: "烬航", rarity: 6, role: "Sniper", code: "RS-02", featured: true },
  { name: "白昼协议", rarity: 6, role: "Supporter", code: "RS-03" },
  { name: "阈限", rarity: 6, role: "Caster", code: "RS-04" },
  { name: "棘石", rarity: 5, role: "Defender", code: "EL-11", featured: true },
  { name: "雨巷", rarity: 5, role: "Medic", code: "EL-12", featured: true },
  { name: "渡鸦钟", rarity: 5, role: "Specialist", code: "EL-13" },
  { name: "照明弹", rarity: 5, role: "Sniper", code: "EL-14" },
  { name: "破门锤", rarity: 5, role: "Guard", code: "EL-15" },
  { name: "灰轴", rarity: 4, role: "Vanguard", code: "AN-21" },
  { name: "细雨", rarity: 4, role: "Medic", code: "AN-22" },
  { name: "旧城", rarity: 4, role: "Defender", code: "AN-23" },
  { name: "蓝线", rarity: 4, role: "Caster", code: "AN-24" },
  { name: "短潮", rarity: 4, role: "Specialist", code: "AN-25" },
  { name: "巡哨", rarity: 4, role: "Sniper", code: "AN-26" },
  { name: "临时队员 A1", rarity: 3, role: "Vanguard", code: "TR-31" },
  { name: "临时队员 B2", rarity: 3, role: "Guard", code: "TR-32" },
  { name: "临时队员 C3", rarity: 3, role: "Medic", code: "TR-33" },
  { name: "临时队员 D4", rarity: 3, role: "Caster", code: "TR-34" },
];

const defaultState = {
  currency: INITIAL_CURRENCY,
  totalPulls: 0,
  sinceSix: 0,
  sixCount: 0,
  fiveCount: 0,
  bannerPulls: 0,
  firstTenHighObtained: false,
  history: [],
};

let state = loadState();
let currentRevealTimers = [];
let revealToken = 0;

const els = {
  currency: document.querySelector("#currency"),
  sinceSix: document.querySelector("#sinceSix"),
  pityFill: document.querySelector("#pityFill"),
  pityHint: document.querySelector("#pityHint"),
  totalPulls: document.querySelector("#totalPulls"),
  sixCount: document.querySelector("#sixCount"),
  fiveCount: document.querySelector("#fiveCount"),
  historyList: document.querySelector("#historyList"),
  resultGrid: document.querySelector("#resultGrid"),
  bagStage: document.querySelector("#bagStage"),
  bagPrompt: document.querySelector("#bagPrompt"),
  singlePull: document.querySelector("#singlePull"),
  tenPull: document.querySelector("#tenPull"),
  skipReveal: document.querySelector("#skipReveal"),
  resetButton: document.querySelector("#resetButton"),
  featuredOperators: document.querySelector("#featuredOperators"),
  template: document.querySelector("#operatorTemplate"),
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem("arkSimState"));
    return { ...defaultState, ...saved };
  } catch {
    return { ...defaultState };
  }
}

function saveState() {
  localStorage.setItem("arkSimState", JSON.stringify(state));
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function getSixRate() {
  const pityBonus = Math.max(0, state.sinceSix - 50) * 0.02;
  return Math.min(1, 0.02 + pityBonus);
}

function rollRarity(forceHigh) {
  const sixRate = getSixRate();
  const roll = Math.random();

  if (roll < sixRate) {
    return 6;
  }

  if (forceHigh) {
    return Math.random() < 0.24 ? 6 : 5;
  }

  if (roll < sixRate + 0.08) {
    return 5;
  }

  if (roll < sixRate + 0.58) {
    return 4;
  }

  return 3;
}

function pullOne() {
  const nextBannerPull = state.bannerPulls + 1;
  const forceHigh = nextBannerPull === 10 && !state.firstTenHighObtained;
  const rarity = rollRarity(forceHigh);
  const pool = operators.filter((operator) => operator.rarity === rarity);
  const featuredPool = pool.filter((operator) => operator.featured);
  const useFeatured = featuredPool.length > 0 && rarity >= 5 && Math.random() < 0.5;
  const operator = { ...(useFeatured ? randomItem(featuredPool) : randomItem(pool)) };

  state.currency -= COST_SINGLE;
  state.totalPulls += 1;
  state.bannerPulls += 1;

  if (operator.rarity >= 5) {
    state.firstTenHighObtained = true;
  }

  if (operator.rarity === 6) {
    state.sinceSix = 0;
    state.sixCount += 1;
  } else {
    state.sinceSix += 1;
  }

  if (operator.rarity === 5) {
    state.fiveCount += 1;
  }

  state.history.unshift({
    name: operator.name,
    rarity: operator.rarity,
    pull: state.totalPulls,
  });
  state.history = state.history.slice(0, 18);

  return operator;
}

function canPull(count) {
  return state.currency >= count * COST_SINGLE;
}

function startPull(count) {
  if (!canPull(count)) {
    els.bagPrompt.textContent = "合成玉不足，已无法继续寻访。";
    els.bagStage.classList.add("active");
    return;
  }

  cancelReveal();
  const results = Array.from({ length: count }, () => pullOne());
  saveState();
  renderState();
  playBagAnimation(results);
}

function playBagAnimation(results) {
  revealToken += 1;
  const token = revealToken;
  els.resultGrid.innerHTML = "";
  els.bagPrompt.textContent = "拉开档案袋封条...";
  els.bagStage.classList.add("active");
  els.bagStage.classList.remove("opening");
  els.skipReveal.disabled = false;

  requestAnimationFrame(() => {
    els.bagStage.classList.add("opening");
  });

  currentRevealTimers.push(
    window.setTimeout(() => {
      if (token !== revealToken) {
        return;
      }
      els.bagPrompt.textContent = getLightPrompt(results);
    }, 820),
  );

  currentRevealTimers.push(
    window.setTimeout(() => {
      if (token !== revealToken) {
        return;
      }
      els.bagStage.classList.remove("active", "opening");
      revealCards(results, token);
    }, 1350),
  );
}

function getLightPrompt(results) {
  const maxRarity = Math.max(...results.map((result) => result.rarity));
  if (maxRarity === 6) {
    return "检测到高能金色信号。";
  }
  if (maxRarity === 5) {
    return "紫色识别光谱展开。";
  }
  if (maxRarity === 4) {
    return "蓝色作战档案已解码。";
  }
  return "基础档案确认。";
}

function revealCards(results, token) {
  results.forEach((operator, index) => {
    const card = createOperatorCard(operator);
    els.resultGrid.appendChild(card);
    currentRevealTimers.push(
      window.setTimeout(() => {
        if (token === revealToken) {
          card.classList.add("revealed");
        }
      }, index * 120),
    );
  });

  currentRevealTimers.push(
    window.setTimeout(() => {
      if (token === revealToken) {
        els.skipReveal.disabled = true;
      }
    }, results.length * 120 + 460),
  );
}

function skipReveal() {
  currentRevealTimers.forEach((timer) => window.clearTimeout(timer));
  currentRevealTimers = [];
  revealToken += 1;
  els.bagStage.classList.remove("active", "opening");
  document.querySelectorAll(".operator-card").forEach((card) => {
    card.classList.add("revealed");
  });
  els.skipReveal.disabled = true;
}

function cancelReveal() {
  currentRevealTimers.forEach((timer) => window.clearTimeout(timer));
  currentRevealTimers = [];
  els.skipReveal.disabled = true;
}

function createOperatorCard(operator) {
  const node = els.template.content.firstElementChild.cloneNode(true);
  node.classList.add(`r${operator.rarity}`);
  node.querySelector(".rarity").textContent = "★".repeat(operator.rarity);
  node.querySelector(".class-icon").textContent = classes[operator.role];
  node.querySelector("h3").textContent = operator.name;
  node.querySelector("p").textContent = getRoleLabel(operator.role);
  node.querySelector(".code").textContent = operator.code;
  return node;
}

function getRoleLabel(role) {
  const labels = {
    Vanguard: "先锋 / COST RECOVERY",
    Guard: "近卫 / FRONTLINE",
    Defender: "重装 / DEFENSE",
    Sniper: "狙击 / LONG RANGE",
    Caster: "术师 / ARTS",
    Medic: "医疗 / SUPPORT",
    Supporter: "辅助 / CONTROL",
    Specialist: "特种 / TACTICAL",
  };
  return labels[role];
}

function renderFeatured() {
  els.featuredOperators.innerHTML = "";
  operators
    .filter((operator) => operator.featured)
    .forEach((operator) => {
      const item = document.createElement("div");
      item.className = "mini-operator";
      item.innerHTML = `
        <span class="mini-avatar">${classes[operator.role]}</span>
        <span>
          <strong>${operator.name}</strong><br />
          <small>${getRoleLabel(operator.role)}</small>
        </span>
        <span>${"★".repeat(operator.rarity)}</span>
      `;
      els.featuredOperators.appendChild(item);
    });
}

function renderState() {
  els.currency.textContent = state.currency.toLocaleString("zh-CN");
  els.sinceSix.textContent = state.sinceSix;
  els.totalPulls.textContent = state.totalPulls;
  els.sixCount.textContent = state.sixCount;
  els.fiveCount.textContent = state.fiveCount;

  const sixRate = getSixRate();
  const pityPercent = Math.min(100, (state.sinceSix / 99) * 100);
  els.pityFill.style.width = `${pityPercent}%`;
  els.pityHint.textContent = `当前六星概率 ${(sixRate * 100).toFixed(0)}%，50 抽后每抽 +2%`;

  els.singlePull.disabled = !canPull(1);
  els.tenPull.disabled = !canPull(10);

  els.historyList.innerHTML = "";
  state.history.forEach((item) => {
    const li = document.createElement("li");
    li.className = item.rarity >= 6 ? "high" : "";
    li.textContent = `#${item.pull} ${"★".repeat(item.rarity)} ${item.name}`;
    els.historyList.appendChild(li);
  });
}

function resetState() {
  cancelReveal();
  state = { ...defaultState, history: [] };
  saveState();
  renderState();
  els.resultGrid.innerHTML = "";
  els.bagStage.classList.remove("active", "opening");
}

els.singlePull.addEventListener("click", () => startPull(1));
els.tenPull.addEventListener("click", () => startPull(10));
els.skipReveal.addEventListener("click", skipReveal);
els.resetButton.addEventListener("click", resetState);

renderFeatured();
renderState();
