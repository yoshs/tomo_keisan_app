(() => {
  "use strict";
  const $ = (id) => {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Missing element: ${id}`);
    return el;
  };

  function clampInt(value, min, max, fallback) {
    const n = Number.parseInt(value, 10);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  function toHalfWidthDigits(text) {
    return String(text).replace(
      /[０-９]/g,
      (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
    );
  }

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function shuffleInPlace(arr) {
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = randInt(0, i);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function pickOne(items) {
    return items[randInt(0, items.length - 1)];
  }

  function formatMs(ms) {
    const total = Math.max(0, ms);
    const minutes = Math.floor(total / 60000);
    const seconds = Math.floor((total % 60000) / 1000);
    const centi = Math.floor((total % 1000) / 10);
    return `${minutes}:${String(seconds).padStart(2, "0")}.${String(centi).padStart(2, "0")}`;
  }

  function difficultyToMax(difficulty) {
    // 1〜3年のざっくり難易度。
    // たし算: a+b <= max
    // ひき算: a-b >= 0
    if (difficulty === 1) return 20;
    if (difficulty === 2) return 100;
    return 1000;
  }

  function startTicker(update) {
    const raf = window.requestAnimationFrame;
    const caf = window.cancelAnimationFrame;

    if (typeof raf !== "function" || typeof caf !== "function") {
      const id = window.setInterval(update, 16);
      return () => window.clearInterval(id);
    }

    let rafId = 0;
    const loop = () => {
      update();
      rafId = raf(loop);
    };
    rafId = raf(loop);
    return () => caf(rafId);
  }

  function nowMs() {
    const p = window.performance;
    if (p && typeof p.now === "function") return p.now();
    return Date.now();
  }

  const comboReward = (combo) => 100 + 10 * combo;

  let celebration;
  let celebrationTimeout;
  const mascots = ["🐰", "🐱", "🐶", "🐼", "🐻", "🦊", "🐨", "🐸", "🐧", "🐹"];
  const cheers = ["できた！", "すごい！", "やったね！", "いいね！", "そのちょうし！", "ばっちり！", "よくできたね！", "ナイス！", "がんばってるね！", "すてき！"];
  let lastMascot;
  let lastCheer;
  let lastEncouragement;
  const encouragements = ["おしい！", "もういっかい！", "だいじょうぶ！", "ゆっくりでいいよ！", "つぎはできるよ！", "あきらめないで！", "いっしょにがんばろう！", "あとすこし！", "もういちどかんがえよう！", "おうえんしてるよ！"];
  function showReaction(correct, combo = 0) {
    if (!celebration) {
      celebration = document.createElement("div");
      celebration.className = "correct-celebration";
      celebration.setAttribute("aria-hidden", "true");
      document.body.appendChild(celebration);
    }
    window.clearTimeout(celebrationTimeout);
    celebration.classList.toggle("is-encouragement", !correct);
    const mascot = document.createElement("span");
    mascot.className = "celebration-mascot";
    lastMascot = pickOne(mascots.filter(value => value !== lastMascot));
    mascot.textContent = lastMascot;
    if (!correct) {
      const face = document.createElement("span");
      face.className = "encouragement-face";
      face.textContent = "🥺";
      mascot.appendChild(face);
    }
    const praise = document.createElement("span");
    praise.className = "celebration-praise";
    if (correct) {
      lastCheer = pickOne(cheers.filter(value => value !== lastCheer));
      praise.textContent = lastCheer;
    } else {
      lastEncouragement = pickOne(encouragements.filter(value => value !== lastEncouragement));
      praise.textContent = lastEncouragement;
    }
    const stars = Array.from({ length: correct ? 5 : 0 }, (_, index) => {
      const star = document.createElement("span");
      star.className = "celebration-star";
      star.textContent = index % 2 === 0 ? "⭐" : "💗";
      star.style.setProperty("--star-index", index);
      return star;
    });
    // 子要素を入れ替えて、連続正解でも一度ずつ再生する。
    const streak = document.createElement("span");
    streak.className = "celebration-combo";
    streak.textContent = combo > 0 ? `${combo} コンボ！（＋${comboReward(combo)}てん）` : "＋100てん";
    if (correct) praise.appendChild(streak);
    celebration.replaceChildren(mascot, praise, ...stars);
    celebration.hidden = false;
    celebrationTimeout = window.setTimeout(() => { celebration.hidden = true; }, 1000);
  }

  function celebrateCorrect(combo = 0) {
    showReaction(true, combo);
  }

  function encourageWrong() {
    showReaction(false);
  }

  function createScoreboard() {
    const rankings = window.TomoRankings.create();
    let points = 0;
    let streak = 0;
    let combo = 0;
    let maxCombo = 0;
    const pointsEl = $("livePoints");
    const comboEl = $("liveCombo");
    const multiplierEl = $("liveMultiplier");
    const resultPointsEl = $("resultPoints");
    const resultComboEl = $("resultMaxCombo");
    function render() {
      pointsEl.textContent = String(points);
      comboEl.textContent = String(combo);
      multiplierEl.textContent = `×${(1 + combo / 10).toFixed(1)}`;
      resultPointsEl.textContent = String(points);
      resultComboEl.textContent = String(maxCombo);
    }
    return {
      reset() {
        rankings.start();
        points = 0; streak = 0; combo = 0; maxCombo = 0;
        if (celebration) celebration.hidden = true;
        window.clearTimeout(celebrationTimeout);
        render();
      },
      finish(options) { rankings.finish({ points, maxCombo }, options); },
      record(correct) {
        streak = correct ? streak + 1 : 0;
        combo = Math.max(0, streak - 1);
        points += correct ? comboReward(combo) : -50;
        maxCombo = Math.max(maxCombo, combo);
        render();
        return { points, combo, maxCombo };
      },
    };
  }

  let audioCtx;
  function beep(ok) {
    try {
      audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
      const ctx = audioCtx;
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.value = ok ? 880 : 220;
      const now = ctx.currentTime;

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.16);
      osc.onended = () => { osc.disconnect(); gain.disconnect(); };
    } catch (e) {
      // 無音でもOK
    }
  }

  function mountNumpad(options) {
    const inputEl = options && options.inputEl;
    const containerEl = options && options.containerEl;

    if (!inputEl || !containerEl) return;
    containerEl.classList.add("numpad");

    const handle = (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      const btn = target.closest("button");
      if (!(btn instanceof HTMLButtonElement)) return;

      const value = btn.dataset.value;
      const action = btn.dataset.action;

      if (options.isDisabled && options.isDisabled()) return;
      inputEl.focus();

      if (value != null) {
        inputEl.value = String(inputEl.value || "") + value;
        inputEl.dispatchEvent(new Event("input", { bubbles: true }));
        return;
      }

      if (action === "backspace") {
        inputEl.value = String(inputEl.value || "").slice(0, -1);
        inputEl.dispatchEvent(new Event("input", { bubbles: true }));
        return;
      }

      if (action === "clear") {
        inputEl.value = "";
        inputEl.dispatchEvent(new Event("input", { bubbles: true }));
        return;
      }

      // enter は使わない（OKボタン無し）
    };

    // 二重バインド防止
    if (!containerEl.dataset.numpadBound) {
      containerEl.dataset.numpadBound = "1";
      containerEl.addEventListener("click", handle);
    }
  }

  window.TomoCommon = {
    $,
    clampInt,
    toHalfWidthDigits,
    randInt,
    shuffleInPlace,
    pickOne,
    formatMs,
    difficultyToMax,
    startTicker,
    nowMs,
    beep,
    celebrateCorrect,
    encourageWrong,
    createScoreboard,
    mountNumpad,
    showFatalError,
    createTransition,
  };

  function createTransition() {
    let pending;
    return {
      cancel() { window.clearTimeout(pending); pending = null; },
      schedule(callback, delay) {
        this.cancel();
        pending = window.setTimeout(() => { pending = null; callback(); }, delay);
      },
    };
  }

  function showFatalError(message) {
    try {
      const existing = document.getElementById("fatalError");
      if (existing) {
        existing.textContent = message;
        return;
      }

      const box = document.createElement("div");
      box.id = "fatalError";
      box.textContent = message;
      box.style.whiteSpace = "pre-wrap";
      box.style.background = "#ffecec";
      box.style.border = "1px solid #ffbdbd";
      box.style.color = "#7a1f1f";
      box.style.padding = "10px 12px";
      box.style.borderRadius = "12px";
      box.style.margin = "12px 0";
      box.style.fontWeight = "700";

      const container = document.querySelector(".container");
      if (container) {
        container.prepend(box);
      } else {
        document.body.prepend(box);
      }
    } catch (e) {
      // ignore
    }
  }

  window.addEventListener("error", (e) => {
    if (!e) return;
    const msg = e.message || "エラーが発生しました";
    const lineno = typeof e.lineno === "number" ? e.lineno : 0;
    const file = e.filename ? `\n${e.filename}:${lineno}` : "";
    const stack = e.error && e.error.stack ? `\n\n${e.error.stack}` : "";
    showFatalError(`ERROR: ${msg}${file}${stack}`);
  });

  window.addEventListener("unhandledrejection", (e) => {
    const reason = e && "reason" in e ? e.reason : undefined;
    const msg =
      reason instanceof Error
        ? reason.stack || reason.message
        : typeof reason === "string"
          ? reason
          : "Promiseエラーが発生しました";
    showFatalError(`ERROR: ${msg}`);
  });

})();
