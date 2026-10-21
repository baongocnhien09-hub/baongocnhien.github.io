const STORAGE_KEYS = {
  naver: "eomland.search.naver.v1",
  google: "eomland.search.google.v1",
  comments: "eomland.comments.v1",
  hideCopied: "eomland.comments.hideCopied.v1",
};

const main = document.querySelector("#app-main");
const clock = document.querySelector("#seoul-clock");
const settingsDialog = document.querySelector("#settings-dialog");
let data;
let activeView = "home";
let copyInProgress = false;
let copyMessage = "";
let copyMessageKind = "";
let manualCopyText = "";
let toastMessage = "";
let toastTimer;

function showNotice(message) {
  toastMessage = message;
  window.clearTimeout(toastTimer);
  render();
  toastTimer = window.setTimeout(() => {
    toastMessage = "";
    render();
  }, 4200);
}

function readStored(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch (error) {
    console.error(`Unable to read ${key} from localStorage`, error);
    toastMessage = "Không thể đọc dữ liệu đã lưu trên thiết bị.";
    return fallback;
  }
}

function writeStored(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Unable to save ${key} to localStorage`, error);
    showNotice("Không thể lưu thay đổi. Hãy kiểm tra cài đặt lưu trữ của trình duyệt.");
    return false;
  }
}

function removeStored(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error(`Unable to remove ${key} from localStorage`, error);
    showNotice("Không thể xóa dữ liệu đã lưu trên thiết bị.");
    return false;
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function randomIndex(length) {
  return Math.floor(Math.random() * length);
}

function seoulDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function freshNaverState() {
  const sets = Object.fromEntries(data.naverSets.map((set) => [
    set.id,
    { currentIndex: 0, copiedCount: 0 },
  ]));
  return {
    date: seoulDate(),
    sets,
  };
}

function loadNaverState() {
  const saved = readStored(STORAGE_KEYS.naver, null);
  if (!saved || saved.date !== seoulDate()) {
    const next = freshNaverState();
    writeStored(STORAGE_KEYS.naver, next);
    return next;
  }
  const state = freshNaverState();
  state.date = saved.date;
  data.naverSets.forEach((set) => {
    const savedSet = saved.sets && saved.sets[set.id];
    if (savedSet && Number.isInteger(savedSet.currentIndex)
      && savedSet.currentIndex >= 0 && savedSet.currentIndex < set.keywords.length) {
      state.sets[set.id] = {
        currentIndex: savedSet.currentIndex,
        copiedCount: Number.isInteger(savedSet.copiedCount) && savedSet.copiedCount >= 0 ? savedSet.copiedCount : 0,
      };
    }
  });
  if (saved.setId && saved.current) {
    const migratedSet = data.naverSets.find((set) => set.id === saved.setId);
    const currentIndex = migratedSet ? migratedSet.keywords.indexOf(saved.current) : -1;
    if (currentIndex >= 0 && !saved.sets?.[saved.setId]) {
      state.sets[saved.setId] = {
        currentIndex,
        copiedCount: 0,
      };
    }
  }
  writeStored(STORAGE_KEYS.naver, state);
  return state;
}

let naverState;
let selectedNaverSetId = null;
let googleState;
let commentsState;
let hideCopied;

function loadGoogleState() {
  const saved = readStored(STORAGE_KEYS.google, null);
  if (saved && Number.isInteger(saved.currentIndex) && saved.currentIndex >= 0 && saved.currentIndex < data.googleKeywords.length) {
    return saved;
  }
  const state = { currentIndex: randomIndex(data.googleKeywords.length) };
  writeStored(STORAGE_KEYS.google, state);
  return state;
}

function loadCommentsState() {
  const saved = readStored(STORAGE_KEYS.comments, null);
  const copied = saved && Array.isArray(saved.copied)
    ? [...new Set(saved.copied.filter((index) => Number.isInteger(index) && index >= 0 && index < data.comments.length))]
    : [];
  const candidates = data.comments.map((_, index) => index).filter((index) => !copied.includes(index));
  const savedIndexIsValid = saved
    && Number.isInteger(saved.currentIndex)
    && saved.currentIndex >= 0
    && saved.currentIndex < data.comments.length;
  let currentIndex = savedIndexIsValid ? saved.currentIndex : randomIndex(data.comments.length);
  if (hideCopied && copied.length === data.comments.length) {
    currentIndex = null;
  } else if (hideCopied && (!savedIndexIsValid || copied.includes(currentIndex))) {
    currentIndex = candidates[randomIndex(candidates.length)];
  }
  const state = {
    copied,
    currentIndex,
  };
  writeStored(STORAGE_KEYS.comments, state);
  return state;
}

function saveNaver() {
  writeStored(STORAGE_KEYS.naver, naverState);
}

function saveGoogle() {
  writeStored(STORAGE_KEYS.google, googleState);
}

function saveComments() {
  writeStored(STORAGE_KEYS.comments, commentsState);
}

function currentNaverSet() {
  return data.naverSets.find((set) => set.id === selectedNaverSetId) || data.naverSets[0];
}

function naverKeywordIndex(set, currentIndex) {
  const current = set.keywords[currentIndex];
  const options = set.keywords
    .map((keyword, index) => ({ keyword, index }))
    .filter(({ keyword }) => keyword !== current);
  return options.length > 0 ? options[randomIndex(options.length)].index : randomIndex(set.keywords.length);
}

function advanceNaver(setId, copied = false) {
  if (naverState.date !== seoulDate()) {
    naverState = freshNaverState();
  }
  const set = data.naverSets.find((item) => item.id === setId);
  if (!set) {
    return;
  }
  const state = naverState.sets[setId];
  state.currentIndex = naverKeywordIndex(set, state.currentIndex);
  if (copied) {
    state.copiedCount += 1;
  }
  saveNaver();
}

function randomizeNaver() {
  advanceNaver(selectedNaverSetId);
  copyMessage = "";
  manualCopyText = "";
  render();
}

function advanceGoogle() {
  const current = data.googleKeywords[googleState.currentIndex];
  const options = data.googleKeywords.filter((keyword) => keyword !== current);
  const next = options[randomIndex(options.length)];
  googleState.currentIndex = data.googleKeywords.indexOf(next);
  saveGoogle();
}

function randomizeGoogle() {
  advanceGoogle();
  copyMessage = "";
  manualCopyText = "";
  render();
}

function eligibleComments() {
  return hideCopied
    ? data.comments.map((_, index) => index).filter((index) => !commentsState.copied.includes(index))
    : data.comments.map((_, index) => index);
}

function chooseNextComment() {
  const remaining = data.comments.map((_, index) => index)
    .filter((index) => !commentsState.copied.includes(index));
  if (remaining.length > 0) {
    commentsState.currentIndex = remaining[randomIndex(remaining.length)];
  } else {
    commentsState.currentIndex = null;
  }
}

function randomizeComment() {
  const options = eligibleComments();
  if (options.length === 0) {
    commentsState.currentIndex = null;
    copyMessage = "Bạn đã copy hết 50 mẫu. Bỏ chọn “Ẩn câu đã copy” để xem lại.";
    copyMessageKind = "";
  } else {
    commentsState.currentIndex = options[randomIndex(options.length)];
    copyMessage = "";
  }
  manualCopyText = "";
  saveComments();
  render();
}

function updateClock() {
  clock.textContent = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());
  clock.dateTime = new Date().toISOString();
  if (naverState.date !== seoulDate()) {
    naverState = freshNaverState();
    saveNaver();
    if (activeView === "naver" || activeView === "naver-set") {
      copyMessage = "";
      render();
    }
  }
}

function renderHome() {
  return `
    <section class="home-screen">
      <div class="home-intro">
        <p class="eyebrow">SEARCH &amp; COMMENTS</p>
        <h1>Chọn mục bạn cần</h1>
        <p>Từ khóa và bình luận được lưu riêng trên thiết bị của bạn.</p>
      </div>
      <nav class="menu-list" aria-label="Các công cụ">
        <button class="menu-card" type="button" data-view="naver">
          <span class="menu-card-copy"><strong>NAVER SEARCH · 한국어</strong><small>Từ khóa theo từng set</small></span>
          <span class="menu-arrow" aria-hidden="true">›</span>
        </button>
        <button class="menu-card" type="button" data-view="comments">
          <span class="menu-card-copy"><strong>NAVER COMMENTS</strong><small>Mẫu bình luận tiếng Hàn</small></span>
          <span class="menu-arrow" aria-hidden="true">›</span>
        </button>
        <button class="menu-card" type="button" data-view="google">
          <span class="menu-card-copy"><strong>GOOGLE SEARCH</strong><small>50 từ khóa tìm kiếm</small></span>
          <span class="menu-arrow" aria-hidden="true">›</span>
        </button>
      </nav>
    </section>`;
}

function renderNaver() {
  return `
    <section class="view-screen">
      <button class="back-button" type="button" data-view="home">← <span>Trang chủ</span></button>
      <div class="view-heading"><p class="eyebrow">7 BỘ TỪ KHÓA</p><h1>NAVER SEARCH · 한국어</h1></div>
      <nav class="menu-list set-list" aria-label="Chọn bộ từ khóa Naver">
        ${data.naverSets.map((set) => `
          <button class="menu-card" type="button" data-naver-set="${set.id}">
            <span class="menu-card-copy"><strong>SET ${set.id}</strong><small>${escapeHtml(set.title)} · ${set.keywords.length} từ khóa</small></span>
            <span class="menu-arrow" aria-hidden="true">›</span>
          </button>`).join("")}
      </nav>
    </section>`;
}

function renderNaverSet() {
  const set = currentNaverSet();
  const state = naverState.sets[set.id];
  const keyword = set.keywords[state.currentIndex];
  return `
    <section class="view-screen">
      <button class="back-button" type="button" data-view="naver">← <span>Danh sách set</span></button>
      <div class="view-heading"><p class="eyebrow">TỪ KHÓA NAVER</p><h1>SET ${set.id}</h1></div>
      <article class="keyword-panel">
        <p class="set-name">Set ${set.id} · ${escapeHtml(set.title)}</p>
        <p class="keyword-text" lang="ko">${escapeHtml(keyword)}</p>
        <p class="counter-line">Đã copy ${state.copiedCount} lần hôm nay · ${set.keywords.length} từ khóa</p>
        ${renderCopyStatus()}
      </article>
      ${renderManualCopy()}
      <div class="button-row">
        <button class="action-button" type="button" data-copy="naver" ${copyInProgress ? "disabled" : ""}>COPY KEY</button>
        <button class="action-button" type="button" data-action="random-naver" ${copyInProgress ? "disabled" : ""}>ĐỔI TỪ KHÓA</button>
      </div>
    </section>`;
}

function renderGoogle() {
  return `
    <section class="view-screen">
      <button class="back-button" type="button" data-view="home">← <span>Trang chủ</span></button>
      <div class="view-heading"><p class="eyebrow">50 TỪ KHÓA</p><h1>GOOGLE SEARCH</h1></div>
      <article class="keyword-panel">
        <p class="keyword-text">${escapeHtml(data.googleKeywords[googleState.currentIndex])}</p>
        ${renderCopyStatus()}
      </article>
      ${renderManualCopy()}
      <div class="button-row">
        <button class="action-button" type="button" data-copy="google" ${copyInProgress ? "disabled" : ""}>COPY KEY</button>
        <button class="action-button" type="button" data-action="random-google" ${copyInProgress ? "disabled" : ""}>TỪ KHÓA TIẾP</button>
      </div>
    </section>`;
}

function renderComments() {
  const remaining = data.comments.length - commentsState.copied.length;
  const comment = commentsState.currentIndex === null ? null : data.comments[commentsState.currentIndex];
  return `
    <section class="view-screen">
      <button class="back-button" type="button" data-view="home">← <span>Trang chủ</span></button>
      <div class="view-heading"><p class="eyebrow">50 MẪU BÌNH LUẬN</p><h1>NAVER COMMENTS</h1></div>
      <label class="checkbox-row"><input id="hide-copied" type="checkbox" ${hideCopied ? "checked" : ""} /><span>Ẩn câu đã copy</span></label>
      <article class="comment-panel">
        ${comment
          ? `<p class="comment-text" lang="ko">${escapeHtml(comment.ko)}</p><p class="comment-hashtags" lang="ko">${escapeHtml(data.commentHashtags)}</p><p class="translation">${escapeHtml(comment.vi)}</p>`
          : `<div class="empty-comments">Bạn đã copy hết 50 mẫu.<br />Bỏ chọn “Ẩn câu đã copy” để xem lại.</div>`}
        <div class="comment-stats"><span>Đã copy <strong>${commentsState.copied.length}</strong></span><span>Còn lại <strong>${remaining}</strong></span></div>
        ${renderCopyStatus()}
      </article>
      ${renderManualCopy()}
      <div class="button-row">
        <button class="action-button" type="button" data-copy="comment" ${copyInProgress || !comment ? "disabled" : ""}>COPY COMMENT</button>
        <button class="action-button" type="button" data-action="random-comment" ${copyInProgress ? "disabled" : ""}>CÂU TIẾP THEO</button>
      </div>
    </section>`;
}

function renderCopyStatus() {
  if (!copyMessage) {
    return '<p class="copy-status" aria-live="polite"></p>';
  }
  return `<p class="copy-status" data-kind="${escapeHtml(copyMessageKind)}" aria-live="polite">${escapeHtml(copyMessage)}</p>`;
}

function renderManualCopy() {
  if (!manualCopyText) {
    return "";
  }
  return `<textarea class="manual-copy" aria-label="Sao chép thủ công" readonly>${escapeHtml(manualCopyText)}</textarea>`;
}

function render() {
  if (!main || !data) {
    return;
  }
  const screens = {
    home: renderHome,
    naver: renderNaver,
    "naver-set": renderNaverSet,
    google: renderGoogle,
    comments: renderComments,
  };
  main.innerHTML = screens[activeView]();
  if (toastMessage) {
    const message = document.createElement("p");
    message.className = "copy-status";
    message.setAttribute("role", "status");
    message.textContent = toastMessage;
    main.prepend(message);
  }
}

function copyWithLegacyClipboard(text) {
  const field = document.createElement("textarea");
  try {
    field.value = text;
    field.setAttribute("readonly", "");
    field.setAttribute("aria-hidden", "true");
    field.style.position = "fixed";
    field.style.top = "0";
    field.style.left = "-9999px";
    document.body.append(field);
    field.focus();
    field.select();
    return document.execCommand("copy");
  } catch (error) {
    console.warn("Legacy clipboard copy failed", error);
    return false;
  } finally {
    field.remove();
  }
}

function writeClipboardText(text) {
  if (copyWithLegacyClipboard(text)) {
    return Promise.resolve(true);
  }
  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    try {
      return navigator.clipboard.writeText(text).then(() => true).catch((error) => {
        console.warn("Clipboard API copy failed", error);
        return false;
      });
    } catch (error) {
      console.warn("Clipboard API copy failed", error);
    }
  }
  return Promise.resolve(false);
}

async function copyCurrent(kind) {
  if (copyInProgress) {
    return;
  }
  let text;
  if (kind === "naver") {
    const set = currentNaverSet();
    text = set.keywords[naverState.sets[set.id].currentIndex];
  } else if (kind === "google") {
    text = data.googleKeywords[googleState.currentIndex];
  } else {
    if (commentsState.currentIndex === null) {
      return;
    }
    text = `${data.comments[commentsState.currentIndex].ko}\n${data.commentHashtags}`;
  }

  copyInProgress = true;
  copyMessage = "";
  manualCopyText = "";
  const clipboardWrite = writeClipboardText(text);
  render();
  try {
    if (!await clipboardWrite) {
      throw new Error("Both clipboard methods were unavailable or denied");
    }
    copyMessage = "Đã sao chép ✓";
    copyMessageKind = "";
    if (kind === "naver") {
      advanceNaver(selectedNaverSetId, true);
    } else if (kind === "google") {
      advanceGoogle();
    } else {
      if (!commentsState.copied.includes(commentsState.currentIndex)) {
        commentsState.copied.push(commentsState.currentIndex);
      }
      chooseNextComment();
      saveComments();
    }
  } catch (error) {
    console.error("Unable to copy text to clipboard", error);
    copyMessage = "Không thể sao chép tự động. Hãy chọn nội dung bên dưới rồi nhấn Ctrl+C (⌘C trên Mac).";
    copyMessageKind = "error";
    manualCopyText = text;
  } finally {
    copyInProgress = false;
    render();
    const manualField = main.querySelector(".manual-copy");
    if (manualField) {
      manualField.focus();
      manualField.select();
    }
  }
}

function setView(view) {
  if (["home", "naver", "naver-set", "comments", "google"].includes(view)) {
    activeView = view;
    if (view === "naver") {
      selectedNaverSetId = null;
    }
    copyMessage = "";
    manualCopyText = "";
    render();
  }
}

function clearHistory(kind) {
  const confirmation = {
    naver: "Xóa bộ đếm và tiến độ Naver hôm nay? Thao tác này không ảnh hưởng đến lịch sử bình luận.",
    google: "Xóa từ khóa Google đang xem?",
    comments: "Xóa danh sách các mẫu bình luận đã copy? Bộ đếm Naver sẽ được giữ nguyên.",
  };
  if (!window.confirm(confirmation[kind])) {
    return;
  }
  if (kind === "naver") {
    naverState = freshNaverState();
    saveNaver();
  } else if (kind === "google") {
    googleState = { currentIndex: randomIndex(data.googleKeywords.length) };
    saveGoogle();
  } else {
    commentsState = { copied: [], currentIndex: randomIndex(data.comments.length) };
    saveComments();
  }
  copyMessage = "";
  manualCopyText = "";
  settingsDialog.close();
  render();
  showNotice("Đã xóa lịch sử mục đã chọn.");
}

async function initialize() {
  try {
    const response = await fetch("data.json");
    if (!response.ok) {
      throw new Error(`Unable to load data.json: ${response.status}`);
    }
    data = await response.json();
    if (data.naverSets.length !== 7 || data.googleKeywords.length !== 50 || data.comments.length !== 50) {
      throw new Error("Unexpected data counts in data.json");
    }
    naverState = loadNaverState();
    googleState = loadGoogleState();
    hideCopied = readStored(STORAGE_KEYS.hideCopied, true) !== false;
    commentsState = loadCommentsState();
    updateClock();
    window.setInterval(updateClock, 1000);
    render();
  } catch (error) {
    console.error("Unable to initialize EOMLAND", error);
    main.innerHTML = '<section class="home-intro"><p class="eyebrow">EOMLAND</p><h1>Không thể tải dữ liệu</h1><p>Hãy làm mới trang để thử lại.</p></section>';
  }
}

main.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) {
    return;
  }
  if (button.dataset.naverSet) {
    selectedNaverSetId = Number(button.dataset.naverSet);
    activeView = "naver-set";
    copyMessage = "";
    manualCopyText = "";
    render();
  } else if (button.dataset.view) {
    setView(button.dataset.view);
  } else if (button.dataset.copy) {
    copyCurrent(button.dataset.copy);
  } else if (button.dataset.action === "random-naver") {
    randomizeNaver();
  } else if (button.dataset.action === "random-google") {
    randomizeGoogle();
  } else if (button.dataset.action === "random-comment") {
    randomizeComment();
  }
});

main.addEventListener("change", (event) => {
  if (event.target.id !== "hide-copied") {
    return;
  }
  hideCopied = event.target.checked;
  writeStored(STORAGE_KEYS.hideCopied, hideCopied);
  if (hideCopied && commentsState.currentIndex !== null && commentsState.copied.includes(commentsState.currentIndex)) {
    chooseNextComment();
  } else if (!hideCopied && commentsState.currentIndex === null) {
    commentsState.currentIndex = randomIndex(data.comments.length);
  }
  copyMessage = "";
  saveComments();
  render();
});

document.querySelector("#open-settings").addEventListener("click", () => settingsDialog.showModal());
settingsDialog.addEventListener("click", (event) => {
  const button = event.target.closest("[data-clear]");
  if (button) {
    clearHistory(button.dataset.clear);
  }
});
document.querySelector(".brand").addEventListener("click", () => setView("home"));

initialize();
