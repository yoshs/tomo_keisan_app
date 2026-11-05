(() => {
  "use strict";
  const themes = ["dots", "stars", "hearts", "flowers", "clouds", "gingham"];
  const storageKey = "tomo_keisan_last_background";
  let lastTheme;

  function chooseBackground() {
    try {
      lastTheme = sessionStorage.getItem(storageKey) || lastTheme;
    } catch { /* 保存できない環境でも背景を表示する */ }
    const choices = themes.filter(theme => theme !== lastTheme);
    lastTheme = choices[Math.floor(Math.random() * choices.length)];
    document.documentElement.dataset.background = lastTheme;
    try { sessionStorage.setItem(storageKey, lastTheme); } catch { /* 保存は任意 */ }
  }

  chooseBackground();
  window.addEventListener("pageshow", event => {
    if (event.persisted) chooseBackground();
  });
})();
