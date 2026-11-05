(() => {
  "use strict";
  const PREFIX = "tomo_keisan_rankings_v1:";
  const LIMIT = 10;

  function captureSettings() {
    const settings = {};
    const captions = [];
    document.querySelectorAll("#screen-setup select, #screen-setup input").forEach(el => {
      if (!el.id || el.disabled || (el.type === "checkbox" && !el.checked)) return;
      settings[el.id] = el.value;
      if (el.tagName === "SELECT") captions.push(el.selectedOptions[0]?.textContent.trim() || el.value);
      else if (el.type === "range") captions.push(`むずかしさ ${el.value}`);
      else if (el.type === "checkbox") captions.push(el.value);
    });
    return { settings, caption: captions.join("・") };
  }

  function validRecord(record) {
    return record && typeof record.id === "string" &&
      Number.isSafeInteger(record.points) && Number.isSafeInteger(record.maxCombo) && record.maxCombo >= 0 &&
      typeof record.date === "string" && Number.isFinite(Date.parse(record.date)) &&
      (record.elapsedMs === null || (Number.isFinite(record.elapsedMs) && record.elapsedMs >= 0));
  }

  function compare(a, b) {
    return b.points - a.points || b.maxCombo - a.maxCombo ||
      (a.elapsedMs ?? Number.MAX_VALUE) - (b.elapsedMs ?? Number.MAX_VALUE) ||
      Date.parse(b.date) - Date.parse(a.date);
  }

  function element(tag, className, text) {
    const el = document.createElement(tag);
    el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }

  window.TomoRankings = {
    create() {
      const section = document.getElementById("rankingsResult") || element("section", "rankings");
      section.id = "rankingsResult";
      section.setAttribute("aria-label", "このブラウザのランキング");
      if (!section.isConnected) document.querySelector("#screen-result .result-summary").after(section);
      let context;
      let finished = false;

      return {
        start() {
          context = captureSettings();
          finished = false;
          section.replaceChildren(element("h3", "rankings-title", "ランキング"), element("p", "rankings-caption", "けっかを しゅうけいしています…"));
        },
        finish(score, { elapsedMs = null, completedCount = 0 } = {}) {
          if (finished || !context) return;
          finished = true;
          const settings = { ...context.settings };
          let caption = context.caption;
          // むげんモードも同じ問題数を解いた記録同士で比較する。
          if (settings.count === "0") {
            settings.completedCount = completedCount;
            caption += `・${completedCount}もん せいかい`;
          }
          const mode = document.body.dataset.mode;
          const key = PREFIX + JSON.stringify({ scoring: "combo-after-second-v1", mode, settings });
          let records = [];
          let canSave = true;
          try {
            const raw = localStorage.getItem(key);
            if (raw) {
              try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) records = parsed.filter(validRecord).sort(compare).slice(0, LIMIT);
              } catch { /* 壊れた記録があっても、新しい記録を保存できる */ }
            }
          } catch { canSave = false; }

          const current = {
            id: window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
            points: score.points,
            maxCombo: score.maxCombo,
            elapsedMs,
            date: new Date().toISOString(),
          };
          records = [current, ...records].sort(compare).slice(0, LIMIT);
          if (canSave) {
            try { localStorage.setItem(key, JSON.stringify(records)); }
            catch { canSave = false; }
          }

          const heading = element("h3", "rankings-title", "このブラウザの ランキング");
          const description = element("p", "rankings-caption", `おなじ せっていの トップ10：${caption}`);
          const list = element("ol", "ranking-list");
          records.forEach((record, index) => {
            const row = element("li", "ranking-entry");
            const isCurrent = record.id === current.id;
            row.classList.toggle("is-current", isCurrent);
            const rank = element("span", "ranking-position", `${index + 1}い`);
            const content = element("div", "ranking-content");
            const points = element("strong", "ranking-points", `${record.points}てん${isCurrent ? "（こんかい）" : ""}`);
            const date = new Date(record.date).toLocaleString("ja-JP", {
              year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit",
            });
            let detail = `${date}・さいこう ${record.maxCombo}コンボ`;
            if (record.elapsedMs !== null) detail += `・${window.TomoCommon.formatMs(record.elapsedMs)}`;
            content.append(points, element("div", "ranking-details", detail));
            row.append(rank, content);
            list.appendChild(row);
          });
          const inTopTen = records.some(record => record.id === current.id);
          let message = inTopTen ? "こんかいの きろくを のこしたよ！" : "こんかいは トップ10のそと。つぎも チャレンジ！";
          if (!canSave) message = "こんかいの きろくは ほぞんできません。このがめんで けっかを みてね。";
          const note = element("p", "rankings-note", message);
          const scope = element("p", "rankings-caption", "この端末の同じブラウザに保存します。得点・最大コンボ・タイムの順で順位を決めます。");
          section.replaceChildren(heading, description, note, list, scope);
        },
      };
    },
  };
})();
