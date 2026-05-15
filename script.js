"use strict";

const SYMBOLS = ["A", "B", "C", "D"];
const SYMBOL_COLORS = {
  A: "#0f6c81",
  B: "#c05a2b",
  C: "#587b3f",
  D: "#7a5aa6"
};

const DEFAULT_WEIGHTS = [25, 25, 25, 25];
const COMPRESSION_EXAMPLES = [
  {
    title: "Highly ordered",
    sequence: "AAAAAAAAAAAAAAAAAAAA",
    note: "One repeated run is very predictable and easy to describe compactly."
  },
  {
    title: "Repeating pattern",
    sequence: "ABCDABCDABCDABCD",
    note: "Single-symbol entropy is high here, but the visible pattern is still compressible."
  },
  {
    title: "Random-looking",
    sequence: null,
    note: "Near-uniform samples are usually harder to shorten with simple descriptions."
  }
];

function log2(x) {
  return Math.log(x) / Math.LN2;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function informationContent(p) {
  const safeP = clamp(Number(p), 0, 1);
  if (safeP <= 0) {
    return Infinity;
  }
  return -log2(safeP);
}

function entropy(probs) {
  return probs.reduce((sum, p) => {
    const value = Number(p);
    if (!Number.isFinite(value) || value <= 0) {
      return sum;
    }
    return sum - value * log2(value);
  }, 0);
}

function normalizeWeights(weights) {
  const cleaned = weights.map((weight) => {
    const value = Number(weight);
    return Number.isFinite(value) && value > 0 ? value : 0;
  });
  const total = cleaned.reduce((sum, value) => sum + value, 0);
  if (total <= 0) {
    return DEFAULT_WEIGHTS.map((weight) => weight / 100);
  }
  return cleaned.map((value) => value / total);
}

function coinEntropy(p) {
  const heads = clamp(Number(p), 0, 1);
  return entropy([heads, 1 - heads]);
}

function seededRandom(seed) {
  let state = 2166136261;
  const text = String(seed || "entropy");
  for (let index = 0; index < text.length; index += 1) {
    state ^= text.charCodeAt(index);
    state = Math.imul(state, 16777619);
  }
  return function nextRandom() {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateSequence(symbols, probs, length, rng) {
  const count = clamp(Math.floor(Number(length) || 0), 0, 2000);
  const normalized = normalizeWeights(probs);
  const cumulative = [];
  normalized.reduce((sum, probability) => {
    const next = sum + probability;
    cumulative.push(next);
    return next;
  }, 0);

  const sequence = [];
  for (let index = 0; index < count; index += 1) {
    const roll = rng();
    const symbolIndex = cumulative.findIndex((threshold) => roll <= threshold);
    sequence.push(symbols[symbolIndex === -1 ? symbols.length - 1 : symbolIndex]);
  }
  return sequence;
}

function countSymbols(sequence) {
  const counts = {};
  sequence.forEach((symbol) => {
    counts[symbol] = (counts[symbol] || 0) + 1;
  });
  return counts;
}

function empiricalDistribution(sequence, symbols = SYMBOLS) {
  const total = sequence.length;
  const counts = countSymbols(sequence);
  if (total === 0) {
    return symbols.map(() => 0);
  }
  return symbols.map((symbol) => (counts[symbol] || 0) / total);
}

function runLengthEstimate(sequence) {
  if (!sequence.length) {
    return 0;
  }
  let runs = 1;
  for (let index = 1; index < sequence.length; index += 1) {
    if (sequence[index] !== sequence[index - 1]) {
      runs += 1;
    }
  }
  return runs * 2;
}

function repeatedBlockSummary(sequence) {
  const text = Array.isArray(sequence) ? sequence.join("") : String(sequence);
  if (!text.length) {
    return "empty";
  }
  for (let size = 1; size <= Math.floor(text.length / 2); size += 1) {
    if (text.length % size !== 0) {
      continue;
    }
    const block = text.slice(0, size);
    if (block.repeat(text.length / size) === text) {
      return `${block} x ${text.length / size}`;
    }
  }
  return "none";
}

function charFrequencyEntropy(text) {
  const chars = Array.from(text);
  const counts = countSymbols(chars);
  const probs = Object.values(counts).map((count) => count / Math.max(chars.length, 1));
  return entropy(probs);
}

function formatCounts(counts) {
  return Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([symbol, count]) => `${symbol}: ${count}`)
    .join(", ");
}

function formatNumber(value, digits = 3) {
  if (!Number.isFinite(value)) {
    return "∞";
  }
  return value.toFixed(digits);
}

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function resizeCanvas(canvas) {
  const pixelRatio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(320, Math.round(rect.width * pixelRatio));
  const height = Math.max(240, Math.round(rect.height * pixelRatio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  return {
    ctx,
    width: width / pixelRatio,
    height: height / pixelRatio
  };
}

function drawAxes(ctx, area, options) {
  ctx.strokeStyle = "#b8c3ce";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(area.left, area.top);
  ctx.lineTo(area.left, area.bottom);
  ctx.lineTo(area.right, area.bottom);
  ctx.stroke();

  ctx.fillStyle = "#617080";
  ctx.font = "12px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(options.xLabel, (area.left + area.right) / 2, area.bottom + 34);

  ctx.save();
  ctx.translate(14, (area.top + area.bottom) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(options.yLabel, 0, 0);
  ctx.restore();
}

function clearCanvas(ctx, width, height) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
}

function renderInformationPlot(canvas, currentP) {
  const { ctx, width, height } = resizeCanvas(canvas);
  clearCanvas(ctx, width, height);

  const area = { left: 52, right: width - 22, top: 22, bottom: height - 52 };
  const maxY = 10;
  const xForP = (p) => area.left + (p - 0.001) / 0.999 * (area.right - area.left);
  const yForInfo = (info) => area.bottom - Math.min(info, maxY) / maxY * (area.bottom - area.top);

  drawAxes(ctx, area, { xLabel: "probability p", yLabel: "information bits" });

  ctx.strokeStyle = "#e6eaef";
  ctx.fillStyle = "#617080";
  ctx.font = "11px system-ui, sans-serif";
  ctx.textAlign = "right";
  for (let tick = 0; tick <= maxY; tick += 2) {
    const y = yForInfo(tick);
    ctx.beginPath();
    ctx.moveTo(area.left, y);
    ctx.lineTo(area.right, y);
    ctx.stroke();
    ctx.fillText(String(tick), area.left - 8, y + 4);
  }

  ctx.strokeStyle = "#0f6c81";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let index = 0; index <= 260; index += 1) {
    const p = 0.001 + index / 260 * 0.999;
    const x = xForP(p);
    const y = yForInfo(informationContent(p));
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();

  const info = informationContent(currentP);
  const x = xForP(currentP);
  const y = yForInfo(info);
  ctx.fillStyle = "#c05a2b";
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#1f2933";
  ctx.textAlign = "center";
  ctx.fillText(`p=${formatNumber(currentP)}  I=${formatNumber(info)} bits`, x, Math.max(area.top + 14, y - 10));
}

function renderCoinEntropyPlot(canvas, currentP) {
  const { ctx, width, height } = resizeCanvas(canvas);
  clearCanvas(ctx, width, height);

  const area = { left: 52, right: width - 22, top: 22, bottom: height - 52 };
  const xForP = (p) => area.left + p * (area.right - area.left);
  const yForH = (h) => area.bottom - h * (area.bottom - area.top);

  drawAxes(ctx, area, { xLabel: "P(heads)", yLabel: "entropy bits" });

  ctx.strokeStyle = "#e6eaef";
  ctx.fillStyle = "#617080";
  ctx.font = "11px system-ui, sans-serif";
  ctx.textAlign = "right";
  for (let tick = 0; tick <= 1.0001; tick += 0.25) {
    const y = yForH(tick);
    ctx.beginPath();
    ctx.moveTo(area.left, y);
    ctx.lineTo(area.right, y);
    ctx.stroke();
    ctx.fillText(tick.toFixed(2), area.left - 8, y + 4);
  }

  ctx.strokeStyle = "#0f6c81";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let index = 0; index <= 260; index += 1) {
    const p = index / 260;
    const x = xForP(p);
    const y = yForH(coinEntropy(p));
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();

  ctx.strokeStyle = "#a65700";
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(xForP(0.5), area.top);
  ctx.lineTo(xForP(0.5), area.bottom);
  ctx.stroke();
  ctx.setLineDash([]);

  const h = coinEntropy(currentP);
  const x = xForP(currentP);
  const y = yForH(h);
  ctx.fillStyle = "#c05a2b";
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#1f2933";
  ctx.textAlign = "center";
  ctx.fillText(`max at p=0.5`, xForP(0.5), area.top + 14);
  ctx.fillText(`H=${formatNumber(h)} bits`, x, Math.max(area.top + 30, y - 10));
}

function renderDistributionBarChart(canvas, probs) {
  const { ctx, width, height } = resizeCanvas(canvas);
  clearCanvas(ctx, width, height);

  const area = { left: 52, right: width - 22, top: 22, bottom: height - 52 };
  drawAxes(ctx, area, { xLabel: "symbols", yLabel: "probability" });

  ctx.strokeStyle = "#e6eaef";
  ctx.fillStyle = "#617080";
  ctx.font = "11px system-ui, sans-serif";
  ctx.textAlign = "right";
  for (let tick = 0; tick <= 1.0001; tick += 0.25) {
    const y = area.bottom - tick * (area.bottom - area.top);
    ctx.beginPath();
    ctx.moveTo(area.left, y);
    ctx.lineTo(area.right, y);
    ctx.stroke();
    ctx.fillText(tick.toFixed(2), area.left - 8, y + 4);
  }

  const gap = 18;
  const barWidth = (area.right - area.left - gap * (SYMBOLS.length + 1)) / SYMBOLS.length;
  probs.forEach((p, index) => {
    const symbol = SYMBOLS[index];
    const x = area.left + gap + index * (barWidth + gap);
    const barHeight = p * (area.bottom - area.top);
    const y = area.bottom - barHeight;

    ctx.fillStyle = SYMBOL_COLORS[symbol];
    ctx.fillRect(x, y, barWidth, barHeight);

    ctx.fillStyle = "#1f2933";
    ctx.textAlign = "center";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(symbol, x + barWidth / 2, area.bottom + 18);
    ctx.fillText(formatPercent(p), x + barWidth / 2, Math.max(area.top + 12, y - 8));
  });
}

function renderSequenceView(sequence) {
  const sequenceText = document.getElementById("sequenceText");
  const sequenceBlocks = document.getElementById("sequenceBlocks");
  const grouped = sequence.join("").replace(/(.{80})/g, "$1\n");
  sequenceText.textContent = grouped;

  sequenceBlocks.innerHTML = "";
  const fragment = document.createDocumentFragment();
  sequence.slice(0, 600).forEach((symbol) => {
    const block = document.createElement("span");
    block.className = `block-${symbol.toLowerCase()}`;
    block.title = symbol;
    fragment.appendChild(block);
  });
  sequenceBlocks.appendChild(fragment);
}

function getWeightsFromControls() {
  return SYMBOLS.map((symbol) => Number(document.getElementById(`weight${symbol}Number`).value));
}

function setWeights(weights) {
  SYMBOLS.forEach((symbol, index) => {
    const value = Math.max(0, Number(weights[index]) || 0);
    const range = document.getElementById(`weight${symbol}`);
    const number = document.getElementById(`weight${symbol}Number`);
    range.value = String(clamp(value, 0, 100));
    number.value = String(value);
  });
}

function syncWeightControl(symbol, source) {
  const range = document.getElementById(`weight${symbol}`);
  const number = document.getElementById(`weight${symbol}Number`);
  const rawValue = source === "range" ? range.value : number.value;
  const value = Math.max(0, Number(rawValue) || 0);
  if (source === "range") {
    number.value = String(value);
  } else {
    range.value = String(clamp(value, 0, 100));
  }
}

function updateDistributionDisplays(probs) {
  SYMBOLS.forEach((symbol, index) => {
    document.getElementById(`prob${symbol}`).textContent = formatPercent(probs[index]);
  });

  const distEntropy = entropy(probs);
  const activeSymbols = probs.filter((p) => p > 0).length;
  const maxEntropy = activeSymbols > 0 ? log2(activeSymbols) : 0;
  const normalized = maxEntropy > 0 ? distEntropy / maxEntropy : NaN;

  document.getElementById("distEntropyValue").textContent = formatNumber(distEntropy);
  document.getElementById("distMaxEntropyValue").textContent = formatNumber(maxEntropy);
  document.getElementById("distNormalizedValue").textContent = Number.isFinite(normalized)
    ? formatNumber(normalized)
    : "n/a";
}

function updateSingleEvent() {
  const p = Number(document.getElementById("eventP").value);
  document.getElementById("eventPValue").textContent = formatNumber(p);
  document.getElementById("eventInfoBits").textContent = formatNumber(informationContent(p));
  renderInformationPlot(document.getElementById("infoPlot"), p);
}

function updateCoin() {
  const p = Number(document.getElementById("coinP").value);
  document.getElementById("coinHeadsValue").textContent = formatNumber(p);
  document.getElementById("coinTailsValue").textContent = formatNumber(1 - p);
  document.getElementById("coinEntropyValue").textContent = formatNumber(coinEntropy(p));
  renderCoinEntropyPlot(document.getElementById("coinPlot"), p);
}

function updateDistribution() {
  const probs = normalizeWeights(getWeightsFromControls());
  updateDistributionDisplays(probs);
  renderDistributionBarChart(document.getElementById("distributionPlot"), probs);
  return probs;
}

function updateObservedTable(sequence) {
  const table = document.getElementById("observedTable");
  const counts = countSymbols(sequence);
  const total = sequence.length || 1;
  table.innerHTML = "";

  SYMBOLS.forEach((symbol) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><span class="symbol-chip symbol-${symbol.toLowerCase()}">${symbol}</span></td>
      <td>${counts[symbol] || 0}</td>
      <td>${formatPercent((counts[symbol] || 0) / total)}</td>
    `;
    table.appendChild(row);
  });

  const empirical = empiricalDistribution(sequence);
  document.getElementById("empiricalEntropyValue").textContent = formatNumber(entropy(empirical));
}

function regenerateSequence() {
  const probs = normalizeWeights(getWeightsFromControls());
  const length = Number(document.getElementById("sequenceLength").value);
  const seed = document.getElementById("seedInput").value;
  const rng = seededRandom(`${seed}:${length}:${probs.map((p) => p.toFixed(5)).join(",")}`);
  const sequence = generateSequence(SYMBOLS, probs, length, rng);

  renderSequenceView(sequence);
  updateObservedTable(sequence);
}

function compressionMetrics(sequence) {
  const chars = Array.from(sequence);
  const counts = countSymbols(chars);
  const probs = Object.values(counts).map((count) => count / Math.max(chars.length, 1));
  return {
    counts,
    entropyBits: entropy(probs),
    rleLength: runLengthEstimate(chars),
    repeatedBlock: repeatedBlockSummary(chars),
    length: chars.length,
    unique: Object.keys(counts).length
  };
}

function renderCompressionExamples() {
  const container = document.getElementById("compressionExamples");
  const randomSequence = generateSequence(SYMBOLS, [1, 1, 1, 1], 24, seededRandom("compressibility-demo")).join("");
  container.innerHTML = "";

  COMPRESSION_EXAMPLES.forEach((example) => {
    const sequence = example.sequence || randomSequence;
    const metrics = compressionMetrics(sequence);
    const card = document.createElement("article");
    card.className = "example-card";
    card.innerHTML = `
      <h3>${example.title}</h3>
      <p class="example-sequence">${sequence}</p>
      <div class="mini-metrics">
        <span>Length: <strong>${metrics.length}</strong></span>
        <span>Counts: <strong>${formatCounts(metrics.counts)}</strong></span>
        <span>Unique symbols: <strong>${metrics.unique}</strong></span>
        <span>Frequency entropy: <strong>${formatNumber(metrics.entropyBits)} bits/symbol</strong></span>
        <span>RLE estimate: <strong>${metrics.rleLength}</strong> units</span>
        <span>Repeating block: <strong>${metrics.repeatedBlock}</strong></span>
      </div>
      <p class="short-note">${example.note}</p>
    `;
    container.appendChild(card);
  });
}

function renderCustomString() {
  const text = document.getElementById("customString").value;
  const chars = Array.from(text);
  const counts = countSymbols(chars);
  const table = document.getElementById("customFrequencyTable");

  document.getElementById("customLengthValue").textContent = String(chars.length);
  document.getElementById("customUniqueValue").textContent = String(Object.keys(counts).length);
  document.getElementById("customEntropyValue").textContent = formatNumber(charFrequencyEntropy(text));

  table.innerHTML = "";
  Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([symbol, count]) => {
      const pill = document.createElement("span");
      pill.className = "frequency-pill";
      const label = symbol === " " ? "space" : symbol === "\n" ? "\\n" : symbol;
      pill.textContent = `${label}: ${count}`;
      table.appendChild(pill);
    });
}

function updateAll() {
  updateSingleEvent();
  updateCoin();
  updateDistribution();
  regenerateSequence();
  renderCustomString();
}

function bindEvents() {
  document.getElementById("eventP").addEventListener("input", updateSingleEvent);
  document.querySelectorAll("[data-event-p]").forEach((button) => {
    button.addEventListener("click", () => {
      document.getElementById("eventP").value = button.dataset.eventP;
      updateSingleEvent();
    });
  });

  document.getElementById("coinP").addEventListener("input", updateCoin);
  document.querySelectorAll("[data-coin-p]").forEach((button) => {
    button.addEventListener("click", () => {
      document.getElementById("coinP").value = button.dataset.coinP;
      updateCoin();
    });
  });

  SYMBOLS.forEach((symbol) => {
    const range = document.getElementById(`weight${symbol}`);
    const number = document.getElementById(`weight${symbol}Number`);
    range.addEventListener("input", () => {
      syncWeightControl(symbol, "range");
      updateDistribution();
      regenerateSequence();
    });
    number.addEventListener("input", () => {
      syncWeightControl(symbol, "number");
      updateDistribution();
      regenerateSequence();
    });
  });

  document.querySelectorAll("[data-dist-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      const preset = button.dataset.distPreset;
      if (preset === "uniform") {
        setWeights([25, 25, 25, 25]);
      } else if (preset === "concentrated") {
        setWeights([90, 5, 3, 2]);
      } else if (preset === "two") {
        setWeights([50, 50, 0, 0]);
      } else {
        const rng = seededRandom(Date.now().toString());
        setWeights(SYMBOLS.map(() => Math.max(1, Math.round(rng() * 100))));
      }
      updateDistribution();
      regenerateSequence();
    });
  });

  document.getElementById("generateButton").addEventListener("click", regenerateSequence);
  document.getElementById("sequenceLength").addEventListener("input", regenerateSequence);
  document.getElementById("seedInput").addEventListener("input", regenerateSequence);
  document.getElementById("randomSeedButton").addEventListener("click", () => {
    document.getElementById("seedInput").value = Math.random().toString(36).slice(2, 10);
    regenerateSequence();
  });
  document.getElementById("customString").addEventListener("input", renderCustomString);
  window.addEventListener("resize", () => {
    updateSingleEvent();
    updateCoin();
    updateDistribution();
  });
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  window.entropyExplorer = {
    log2,
    informationContent,
    entropy,
    normalizeWeights,
    coinEntropy,
    generateSequence,
    countSymbols,
    empiricalDistribution,
    seededRandom
  };

  document.addEventListener("DOMContentLoaded", () => {
    bindEvents();
    renderCompressionExamples();
    updateAll();
  });
}

if (typeof module !== "undefined") {
  module.exports = {
    log2,
    informationContent,
    entropy,
    normalizeWeights,
    coinEntropy,
    generateSequence,
    countSymbols,
    empiricalDistribution,
    seededRandom,
    runLengthEstimate,
    repeatedBlockSummary,
    charFrequencyEntropy
  };
}
