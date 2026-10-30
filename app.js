const STORAGE_KEYS = {
  naver: "eomland.search.naver.v1",
  google: "eomland.search.google.v1",
  comments: "eomland.comments.v2",
  hideCopied: "eomland.comments.hideCopied.v1",
};

const main = document.querySelector("#app-main");
const clock = document.querySelector("#seoul-clock");
const clockDate = document.querySelector("#seoul-date");
const settingsDialog = document.querySelector("#settings-dialog");
const musicFrame = document.querySelector("#music-frame");
const musicToggle = document.querySelector("#music-toggle");
const musicLabel = document.querySelector("#music-label");
const musicPlayer = document.querySelector(".music-player");
const musicPlaylistPanel = document.querySelector("#music-playlist-panel");
const acaiEffects = document.querySelector("#acai-effects");
const musicTracks = [
  "g8NVwN0_mks",
  "LlN8MPS7KQs",
  "Z7-3_h0vxXA",
  "cPAbx5kgCJo",
  "6jZVsr7q-tE",
  "ILRs2r6lcHY",
  "eitDnP0_83k",
  "YsKKuCUYUMU",
  "vScUbKoE-qs",
  "diLa-gpHRKc",
  "md7dK5-qvHc",
];
const soundcloudPlaylistUrl = "https://soundcloud.com/ph-ng-anh-33-544958085/sets/thich-thi-nghe-thoi";
const maxAcaiParticles = 40;
const acaiParticles = [];
let musicOn = false;
let activeMusicPlaylist = null;
let musicPanelOpen = false;
let ignoreMusicToggleHover = false;
let audioContext;
let particleFrame = 0;
let lastTrailPoint = null;
let lastTrailSpawn = null;
let data;
let activeView = "home";
let copyInProgress = false;
let commentSetPickerOpen = false;
let commentPickerOpenedByHover = false;
let selectedCommentSetId = null;
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

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function playPop() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return;
  }
  try {
    audioContext = audioContext || new AudioContextClass();
    if (audioContext.state === "suspended") {
      audioContext.resume().catch((error) => console.warn("Unable to resume pop audio", error));
    }
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const volume = audioContext.createGain();
    const pitch = randomBetween(540, 760);
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(pitch, now);
    oscillator.frequency.exponentialRampToValueAtTime(pitch * 0.52, now + 0.075);
    volume.gain.setValueAtTime(0.0001, now);
    volume.gain.exponentialRampToValueAtTime(0.055, now + 0.008);
    volume.gain.exponentialRampToValueAtTime(0.0001, now + 0.095);
    oscillator.connect(volume);
    volume.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.1);
  } catch (error) {
    console.warn("Unable to play pop audio", error);
  }
}

function animateAcaiParticles(now) {
  particleFrame = 0;
  for (let index = acaiParticles.length - 1; index >= 0; index -= 1) {
    const particle = acaiParticles[index];
    const elapsed = Math.min((now - particle.lastUpdated) / 1000, 0.04);
    particle.lastUpdated = now;
    particle.age = now - particle.createdAt;
    if (particle.age >= particle.lifetime) {
      particle.element.remove();
      acaiParticles.splice(index, 1);
      continue;
    }
    particle.vy += particle.gravity * elapsed;
    particle.x += particle.vx * elapsed;
    particle.y += particle.vy * elapsed;
    if (!particle.bounced && particle.vy > 0 && particle.y >= particle.bounceY) {
      particle.y = particle.bounceY;
      particle.vy *= -0.32;
      particle.bounced = true;
    }
    const progress = particle.age / particle.lifetime;
    const sway = Math.sin(particle.age * particle.swaySpeed + particle.phase) * particle.sway;
    particle.element.style.opacity = String(Math.min(1, progress * 5, (1 - progress) * 3));
    particle.element.style.transform = `translate3d(${particle.x + sway}px, ${particle.y}px, 0) rotate(${particle.rotation + particle.spin * particle.age / 1000}deg) scale(${1 - progress * 0.18})`;
  }
  if (acaiParticles.length > 0) {
    particleFrame = window.requestAnimationFrame(animateAcaiParticles);
  }
}

function spawnAcai(x, y, options = {}) {
  const now = performance.now();
  const count = options.count ?? 1;
  for (let index = 0; index < count; index += 1) {
    if (acaiParticles.length >= maxAcaiParticles) {
      const oldest = acaiParticles.shift();
      oldest.element.remove();
    }
    const element = document.createElement("span");
    element.className = "acai-particle";
    element.innerHTML = '<span class="acai-shine"></span>';
    const size = randomBetween(options.burst ? 8 : 7, options.burst ? 14 : 11);
    element.style.width = `${size}px`;
    element.style.height = `${size}px`;
    acaiEffects.append(element);

    const jitter = options.spread || 0;
    const angle = randomBetween(0, Math.PI * 2);
    const speed = options.burst ? randomBetween(75, 210) : randomBetween(20, 70);
    const particle = {
      element,
      x: x + randomBetween(-jitter, jitter),
      y: y + randomBetween(-jitter, jitter),
      vx: Math.cos(angle) * speed + (options.velocityX || 0),
      vy: Math.sin(angle) * speed - (options.burst ? randomBetween(35, 110) : 0) + (options.velocityY || 0),
      gravity: options.burst ? randomBetween(230, 390) : randomBetween(-22, 35),
      createdAt: now,
      lastUpdated: now,
      age: 0,
      lifetime: randomBetween(options.burst ? 600 : 680, options.burst ? 1000 : 1250),
      bounceY: y + randomBetween(22, 46),
      bounced: false,
      rotation: randomBetween(-180, 180),
      spin: randomBetween(-300, 300),
      sway: randomBetween(2, 8),
      swaySpeed: randomBetween(0.004, 0.01),
      phase: randomBetween(0, Math.PI * 2),
    };
    acaiParticles.push(particle);
  }
  if (!particleFrame) {
    particleFrame = window.requestAnimationFrame(animateAcaiParticles);
  }
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
    { currentIndex: 0, copiedCount: 0, copied: [] },
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
      const copied = [];
      if (Array.isArray(savedSet.copied)) {
        savedSet.copied.forEach((value) => {
          if (Number.isInteger(value) && value >= 0 && value < set.keywords.length) {
            if (!copied.includes(value)) {
              copied.push(value);
            }
            return;
          }
          if (typeof value === "string") {
            const legacyIndex = set.keywords.findIndex((keyword, index) => keyword === value && !copied.includes(index));
            if (legacyIndex >= 0) {
              copied.push(legacyIndex);
            }
          }
        });
      }
      let copiedIndexes = copied;
      if (copiedIndexes.length === set.keywords.length) {
        copiedIndexes = [];
      }
      let currentIndex = savedSet.currentIndex;
      if (copiedIndexes.includes(currentIndex)) {
        const candidates = set.keywords
          .map((_, index) => index)
          .filter((index) => !copiedIndexes.includes(index));
        currentIndex = candidates[randomIndex(candidates.length)];
      }
      state.sets[set.id] = {
        currentIndex,
        copiedCount: Number.isInteger(savedSet.copiedCount) && savedSet.copiedCount >= 0 ? savedSet.copiedCount : 0,
        copied: copiedIndexes,
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
        copied: [],
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

function loadGoogleState() {
  const saved = readStored(STORAGE_KEYS.google, null);
  const copied = saved && Array.isArray(saved.copied)
    ? [...new Set(saved.copied.filter((index) => Number.isInteger(index) && index >= 0 && index < data.googleKeywords.length))]
    : [];
  const candidates = data.googleKeywords.map((_, index) => index).filter((index) => !copied.includes(index));
  const savedIndexIsValid = saved
    && Number.isInteger(saved.currentIndex)
    && saved.currentIndex >= 0
    && saved.currentIndex < data.googleKeywords.length;
  let currentIndex = savedIndexIsValid ? saved.currentIndex : randomIndex(data.googleKeywords.length);
  if (candidates.length === 0) {
    currentIndex = null;
  } else if (!savedIndexIsValid || copied.includes(currentIndex)) {
    currentIndex = candidates[randomIndex(candidates.length)];
  }
  const state = { copied, currentIndex };
  writeStored(STORAGE_KEYS.google, state);
  return state;
}

function loadCommentsState() {
  const saved = readStored(STORAGE_KEYS.comments, null);
  const savedSets = saved && saved.sets && typeof saved.sets === "object" ? saved.sets : {};
  const defaultHideCopied = readStored(STORAGE_KEYS.hideCopied, true) !== false;
  const sets = Object.fromEntries(data.commentSets.map((set) => {
    const savedSet = savedSets[set.id];
    const copied = savedSet && Array.isArray(savedSet.copied)
      ? [...new Set(savedSet.copied.filter((index) => Number.isInteger(index)
        && index >= 0 && index < set.comments.length))]
      : [];
    const hideSetCopied = savedSet && typeof savedSet.hideCopied === "boolean"
      ? savedSet.hideCopied
      : defaultHideCopied;
    const allIndexes = set.comments.map((_, index) => index);
    const remaining = allIndexes.filter((index) => !copied.includes(index));
    const options = hideSetCopied ? remaining : allIndexes;
    const savedIndexIsValid = savedSet
      && Number.isInteger(savedSet.currentIndex)
      && savedSet.currentIndex >= 0
      && savedSet.currentIndex < set.comments.length;
    let currentIndex = savedIndexIsValid ? savedSet.currentIndex : null;
    if (options.length === 0) {
      currentIndex = null;
    } else if (!savedIndexIsValid || (hideSetCopied && copied.includes(currentIndex))) {
      currentIndex = options[randomIndex(options.length)];
    }
    return [set.id, { copied, currentIndex, hideCopied: hideSetCopied }];
  }));
  const state = { sets };
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

function currentCommentSet() {
  return data.commentSets.find((set) => set.id === selectedCommentSetId) || null;
}

function currentCommentSetState() {
  return selectedCommentSetId === null ? null : commentsState.sets[selectedCommentSetId];
}

function updateCommentSetPicker() {
  const trigger = main.querySelector(".comment-picker-trigger");
  const picker = main.querySelector("#comment-set-picker");
  if (!trigger || !picker) {
    return;
  }
  trigger.setAttribute("aria-expanded", String(commentSetPickerOpen));
  picker.hidden = !commentSetPickerOpen;
  if (!commentSetPickerOpen) {
    return;
  }

  const rect = trigger.getBoundingClientRect();
  const sideSpace = 12;
  const availableRight = window.innerWidth - sideSpace - rect.right;
  const availableLeft = rect.left - sideSpace;
  const opensRight = availableRight >= Math.min(180, availableLeft) || availableLeft < 180;
  const availableWidth = opensRight ? availableRight : availableLeft;
  const width = Math.min(280, Math.max(0, availableWidth));
  const height = Math.min(360, window.innerHeight - 24);
  picker.style.width = `${width}px`;
  picker.style.maxHeight = `${height}px`;
  picker.style.left = `${opensRight ? rect.right : rect.left - width}px`;
  const pickerHeight = picker.getBoundingClientRect().height;
  const centeredTop = rect.top + (rect.height - pickerHeight) / 2;
  const top = Math.max(12, Math.min(centeredTop, window.innerHeight - pickerHeight - 12));
  picker.style.top = `${top}px`;
}

function openCommentSetPicker() {
  commentSetPickerOpen = true;
  commentPickerOpenedByHover = false;
  copyMessage = "";
  manualCopyText = "";
  render();
}

function closeCommentSetPicker(restoreFocus = false) {
  commentSetPickerOpen = false;
  commentPickerOpenedByHover = false;
  updateCommentSetPicker();
  if (restoreFocus) {
    main.querySelector(".comment-picker-trigger")?.focus();
  }
}

function selectCommentSet(setId) {
  if (!data.commentSets.some((set) => set.id === setId)) {
    return;
  }
  selectedCommentSetId = setId;
  commentSetPickerOpen = false;
  commentPickerOpenedByHover = false;
  activeView = "comments";
  copyMessage = "";
  copyMessageKind = "";
  manualCopyText = "";
  render();
}

function naverKeywordCount(set) {
  return set.keywords.length;
}

function naverKeywordIndex(set, state) {
  let options = set.keywords
    .map((_, index) => index)
    .filter((index) => !state.copied.includes(index));
  if (options.length === 0) {
    state.copied = [];
    options = set.keywords.map((_, index) => index);
  }
  const alternatives = options.filter((index) => index !== state.currentIndex);
  if (alternatives.length > 0) {
    options = alternatives;
  }
  return options[randomIndex(options.length)];
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
  if (copied) {
    state.copiedCount += 1;
    if (!state.copied.includes(state.currentIndex)) {
      state.copied.push(state.currentIndex);
    }
    if (state.copied.length === naverKeywordCount(set)) {
      state.copied = [];
    }
  }
  state.currentIndex = naverKeywordIndex(set, state);
  saveNaver();
}

function randomizeNaver() {
  advanceNaver(selectedNaverSetId);
  copyMessage = "";
  manualCopyText = "";
  render();
}

function advanceGoogle() {
  const options = data.googleKeywords.map((_, index) => index)
    .filter((index) => !googleState.copied.includes(index) && index !== googleState.currentIndex);
  if (options.length === 0 && googleState.currentIndex !== null
    && !googleState.copied.includes(googleState.currentIndex)) {
    options.push(googleState.currentIndex);
  }
  googleState.currentIndex = options.length > 0 ? options[randomIndex(options.length)] : null;
  saveGoogle();
}

function randomizeGoogle() {
  if (googleState.currentIndex === null) {
    copyMessage = "Bạn đã copy hết 50 từ khóa. Xóa lịch sử trong Cài đặt để bắt đầu lại.";
    copyMessageKind = "";
    render();
    return;
  }
  advanceGoogle();
  copyMessage = "";
  manualCopyText = "";
  render();
}

function eligibleComments(set, state) {
  const indexes = set.comments.map((_, index) => index);
  return state.hideCopied ? indexes.filter((index) => !state.copied.includes(index)) : indexes;
}

function chooseNextComment(set, state) {
  const remaining = set.comments.map((_, index) => index)
    .filter((index) => !state.copied.includes(index));
  if (remaining.length > 0) {
    state.currentIndex = remaining[randomIndex(remaining.length)];
  } else {
    state.currentIndex = null;
  }
}

function randomizeComment() {
  const set = currentCommentSet();
  const state = currentCommentSetState();
  if (!set || !state) {
    return;
  }
  const options = eligibleComments(set, state);
  if (options.length === 0) {
    state.currentIndex = null;
    copyMessage = "";
    copyMessageKind = "";
  } else {
    state.currentIndex = options[randomIndex(options.length)];
    copyMessage = "";
  }
  manualCopyText = "";
  saveComments();
  render();
}

function updateClock() {
  const now = new Date();
  clock.textContent = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(now);
  clock.dateTime = now.toISOString();
  clockDate.textContent = new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Seoul",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now).replace(/^./u, (character) => character.toLocaleUpperCase("vi-VN"));
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
        <a class="menu-card" href="https://docs.google.com/document/d/1tkfTdS3wmofCjxJrUeCC8msttzdh2ftWXud4jnJY8Go/edit?tab=t.1ybrojudcvru" target="_blank" rel="noopener noreferrer">
          <span class="menu-card-copy"><strong>TỔNG HỢP SEARCH GUIDE</strong><small>Hướng dẫn tìm kiếm hằng ngày</small></span>
          <span class="menu-arrow" aria-hidden="true">↗</span>
        </a>
        <button class="menu-card" type="button" data-view="naver">
          <span class="menu-card-copy"><strong>NAVER SEARCH</strong><small>Từ khóa theo từng set</small></span>
          <span class="menu-arrow" aria-hidden="true">›</span>
        </button>
        <button class="menu-card" type="button" data-view="comment-sets">
          <span class="menu-card-copy"><strong>NAVER COMMENTS</strong><small>Chọn bộ bình luận tiếng Hàn</small></span>
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
      <div class="view-heading"><p class="eyebrow">7 BỘ TỪ KHÓA</p><h1>NAVER SEARCH</h1></div>
      <nav class="menu-list set-list" aria-label="Chọn bộ từ khóa Naver">
        ${data.naverSets.map((set) => `
          <button class="menu-card" type="button" data-naver-set="${set.id}">
            <span class="menu-card-copy"><strong>SET ${set.id}</strong><small>${escapeHtml(set.title)} · ${naverKeywordCount(set)} từ khóa</small></span>
            <span class="menu-arrow" aria-hidden="true">›</span>
          </button>`).join("")}
      </nav>
    </section>`;
}

function renderCommentSets() {
  return `
    <section class="view-screen">
      <button class="back-button" type="button" data-view="home">← <span>Trang chủ</span></button>
      <div class="view-heading"><p class="eyebrow">7 BỘ BÌNH LUẬN</p><h1>NAVER COMMENTS</h1></div>
      <nav class="menu-list set-list" aria-label="Chọn bộ bình luận Naver">
        ${data.commentSets.map((set) => `
          <button class="menu-card" type="button" data-comment-set="${set.id}">
            <span class="menu-card-copy"><strong>SET ${set.id}</strong><small>${escapeHtml(set.title)} · ${set.comments.length} bình luận</small></span>
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
      <div class="view-heading"><p class="eyebrow">TỪ KHÓA NAVER SEARCH</p><h1>SET ${set.id}</h1></div>
      <article class="keyword-panel">
        <p class="set-name">Set ${set.id} · ${escapeHtml(set.title)}</p>
        <p class="keyword-text" lang="ko">${escapeHtml(keyword)}</p>
        <p class="counter-line">Đã copy ${state.copiedCount} lần hôm nay · ${naverKeywordCount(set)} từ khóa</p>
        ${renderCopyStatus()}
      </article>
      ${renderManualCopy()}
      <button class="action-button full-width-action" type="button" data-copy="naver" ${copyInProgress ? "disabled" : ""}>COPY KEY</button>
      <div class="button-row">
        <button class="action-button comment-picker-trigger" type="button" data-action="toggle-comment-picker" aria-expanded="${commentSetPickerOpen}" aria-controls="comment-set-picker">MỞ NAVER COMMENTS</button>
        <button class="action-button" type="button" data-action="random-naver" ${copyInProgress ? "disabled" : ""}>ĐỔI TỪ KHÓA</button>
      </div>
    </section>`;
}

function renderGoogle() {
  const currentKeyword = googleState.currentIndex === null
    ? null
    : data.googleKeywords[googleState.currentIndex];
  return `
    <section class="view-screen">
      <button class="back-button" type="button" data-view="home">← <span>Trang chủ</span></button>
      <div class="view-heading"><p class="eyebrow">50 TỪ KHÓA</p><h1>GOOGLE SEARCH</h1></div>
      <article class="keyword-panel">
        ${currentKeyword === null
          ? '<div class="empty-comments">Bạn đã copy hết 50 từ khóa.<br />Xóa lịch sử Google trong Cài đặt để bắt đầu lại.</div>'
          : `<p class="keyword-text">${escapeHtml(currentKeyword)}</p>`}
        <p class="counter-line">Đã copy ${googleState.copied.length} · Còn lại ${data.googleKeywords.length - googleState.copied.length}</p>
        ${renderCopyStatus()}
      </article>
      ${renderManualCopy()}
      <div class="button-row">
        <button class="action-button" type="button" data-copy="google" ${copyInProgress || currentKeyword === null ? "disabled" : ""}>COPY KEY</button>
        <button class="action-button" type="button" data-action="random-google" ${copyInProgress || currentKeyword === null ? "disabled" : ""}>TỪ KHÓA TIẾP</button>
      </div>
    </section>`;
}

function renderComments() {
  const set = currentCommentSet();
  const state = currentCommentSetState();
  if (!set || !state) {
    return '<section class="view-screen"><button class="back-button" type="button" data-view="home">← <span>Trang chủ</span></button><h1>NAVER COMMENTS</h1></section>';
  }
  const remaining = set.comments.length - state.copied.length;
  const comment = state.currentIndex === null ? null : set.comments[state.currentIndex];
  const isComplete = state.copied.length === set.comments.length;
  const setNavigationButton = selectedNaverSetId !== null
    ? `<button class="action-button" type="button" data-naver-set="${selectedNaverSetId}">QUAY LẠI SET ${selectedNaverSetId}</button>`
    : '<button class="action-button" type="button" data-view="comment-sets">CHỌN SET</button>';
  return `
    <section class="view-screen">
      <button class="back-button" type="button" data-view="home">← <span>Trang chủ</span></button>
      <div class="view-heading"><h1>NAVER COMMENTS</h1><p class="comment-set-title">${escapeHtml(set.title)}</p></div>
      <label class="checkbox-row"><input id="hide-copied" type="checkbox" ${state.hideCopied ? "checked" : ""} /><span>Ẩn câu đã copy trong set này</span></label>
      <article class="comment-panel">
        ${comment
          ? `<p class="comment-text" lang="ko">${escapeHtml(comment.ko)}</p><p class="translation">${escapeHtml(comment.vi)}</p><p class="comment-hashtags" lang="ko">${escapeHtml(comment.hashtags)}</p>`
          : `<div class="empty-comments">${isComplete
            ? `Bạn đã hoàn thành Set ${set.id}.${state.hideCopied ? '<br />Bỏ chọn “Ẩn câu đã copy” để xem lại.' : "<br />Nhấn RANDOM để xem lại câu đã copy."}`
            : "Không còn câu nào để hiển thị trong set này."}</div>`}
        <div class="comment-stats"><span>Đã copy <strong>${state.copied.length}</strong></span><span>Còn lại <strong>${remaining}</strong></span></div>
        ${renderCopyStatus()}
      </article>
      ${renderManualCopy()}
      <div class="button-row comment-copy-actions">
        <button class="action-button" type="button" data-copy="comment-plain" ${copyInProgress || !comment ? "disabled" : ""}>COPY KHÔNG HASHTAG</button>
        <button class="action-button" type="button" data-copy="comment-with-hashtag" ${copyInProgress || !comment ? "disabled" : ""}>COPY CÓ HASHTAG</button>
      </div>
      <div class="button-row comment-navigation-actions">
        ${setNavigationButton}
        <button class="action-button" type="button" data-action="random-comment" ${copyInProgress ? "disabled" : ""}>RANDOM</button>
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
    "comment-sets": renderCommentSets,
    "naver-set": renderNaverSet,
    google: renderGoogle,
    comments: renderComments,
  };
  main.innerHTML = screens[activeView]();
  main.insertAdjacentHTML("beforeend", `
    <nav class="comment-set-picker" id="comment-set-picker" aria-label="Chọn bộ bình luận" ${commentSetPickerOpen ? "" : "hidden"}>
      ${data.commentSets.map((set) => `
        <button class="comment-set-option" type="button" data-comment-set="${set.id}" aria-label="Set ${set.id}: ${escapeHtml(set.title)}">
          <span class="comment-set-number">SET ${set.id}</span>
          <span>${escapeHtml(set.title)}</span>
        </button>`).join("")}
    </nav>`);
  updateCommentSetPicker();
  if (toastMessage) {
    const message = document.createElement("p");
    message.className = "copy-status";
    message.setAttribute("role", "status");
    message.textContent = toastMessage;
    main.prepend(message);
  }
}

function toggleMusic() {
  if (musicOn) {
    stopMusic();
  } else {
    startMusicPlaylist(activeMusicPlaylist || "chill");
  }
}

function updateMusicControls() {
  musicToggle.setAttribute("aria-pressed", String(musicOn));
  musicToggle.setAttribute("aria-expanded", String(musicPanelOpen));
  musicLabel.textContent = musicOn ? "Music off" : "Music on";
  musicToggle.classList.toggle("is-playing", musicOn);
  musicPlayer.classList.toggle("is-open", musicPanelOpen);
  musicPlaylistPanel.querySelectorAll("[data-playlist]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.playlist === activeMusicPlaylist && musicOn));
  });
}

function startMusicPlaylist(playlistName) {
  activeMusicPlaylist = playlistName;
  musicOn = true;
  if (playlistName === "pho") {
    const soundcloudUrl = new URL("https://w.soundcloud.com/player/");
    soundcloudUrl.searchParams.set("url", soundcloudPlaylistUrl);
    soundcloudUrl.searchParams.set("auto_play", "true");
    soundcloudUrl.searchParams.set("hide_related", "true");
    soundcloudUrl.searchParams.set("show_comments", "false");
    soundcloudUrl.searchParams.set("show_reposts", "false");
    soundcloudUrl.searchParams.set("show_teaser", "false");
    soundcloudUrl.searchParams.set("visual", "false");
    musicFrame.title = "Danh sách nhạc Phố trên SoundCloud";
    musicFrame.src = soundcloudUrl.toString();
  } else {
    const playlist = musicTracks.join(",");
    musicFrame.title = "Danh sách nhạc Chill trên YouTube";
    musicFrame.src = `https://www.youtube-nocookie.com/embed/${musicTracks[0]}?playlist=${playlist}&autoplay=1&loop=1&controls=1&playsinline=1`;
  }
  updateMusicControls();
}

function stopMusic() {
  musicOn = false;
  musicFrame.removeAttribute("src");
  updateMusicControls();
}

function handleMusicToggle() {
  const isTouchLayout = window.matchMedia("(hover: none), (pointer: coarse)").matches;
  if (isTouchLayout) {
    musicPanelOpen = !musicPanelOpen;
    updateMusicControls();
    return;
  }
  toggleMusic();
}

musicToggle.addEventListener("click", handleMusicToggle);
musicPlaylistPanel.addEventListener("click", (event) => {
  const button = event.target.closest("[data-playlist]");
  if (!button) {
    return;
  }
  const playlistName = button.dataset.playlist;
  if (activeMusicPlaylist === playlistName && musicOn) {
    stopMusic();
  } else {
    startMusicPlaylist(playlistName);
  }
  musicPanelOpen = !window.matchMedia("(hover: none), (pointer: coarse)").matches;
  updateMusicControls();
});
document.addEventListener("click", (event) => {
  if (!musicPlayer.contains(event.target) && musicPanelOpen) {
    musicPanelOpen = false;
    updateMusicControls();
  }
});
musicToggle.addEventListener("pointerenter", (event) => {
  if (event.pointerType === "mouse" && !ignoreMusicToggleHover) {
    musicPanelOpen = true;
    updateMusicControls();
  }
});
musicToggle.addEventListener("pointerleave", (event) => {
  if (event.pointerType === "mouse" && !musicPlaylistPanel.contains(event.relatedTarget)) {
    musicPanelOpen = false;
    updateMusicControls();
  }
});
musicPlaylistPanel.addEventListener("pointerleave", (event) => {
  if (event.pointerType !== "mouse") {
    return;
  }
  ignoreMusicToggleHover = event.relatedTarget === musicToggle;
  musicPanelOpen = false;
  updateMusicControls();
});
musicPlayer.addEventListener("pointerleave", (event) => {
  if (event.pointerType === "mouse") {
    ignoreMusicToggleHover = false;
    musicPanelOpen = false;
    updateMusicControls();
  }
});
musicPlayer.addEventListener("focusin", () => {
  musicPanelOpen = true;
  updateMusicControls();
});
musicPlayer.addEventListener("focusout", (event) => {
  if (!musicPlayer.contains(event.relatedTarget)) {
    musicPanelOpen = false;
    updateMusicControls();
  }
});

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
  let commentSet;
  let commentSetState;
  let commentIndex;
  if (kind === "naver") {
    const set = currentNaverSet();
    text = set.keywords[naverState.sets[set.id].currentIndex];
  } else if (kind === "google") {
    text = data.googleKeywords[googleState.currentIndex];
  } else if (kind === "comment-plain" || kind === "comment-with-hashtag") {
    commentSet = currentCommentSet();
    commentSetState = currentCommentSetState();
    if (!commentSet || !commentSetState || commentSetState.currentIndex === null) {
      return;
    }
    commentIndex = commentSetState.currentIndex;
    const comment = commentSet.comments[commentIndex];
    text = kind === "comment-with-hashtag" ? `${comment.ko}\n${comment.hashtags}` : comment.ko;
  } else {
    return;
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
    copyMessage = "";
    copyMessageKind = "";
    if (kind === "naver") {
      advanceNaver(selectedNaverSetId, true);
    } else if (kind === "google") {
      googleState.copied.push(googleState.currentIndex);
      advanceGoogle();
    } else if (kind === "comment-with-hashtag") {
      if (!commentSetState.copied.includes(commentIndex)) {
        commentSetState.copied.push(commentIndex);
      }
      chooseNextComment(commentSet, commentSetState);
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
  if (view === "comments") {
    openCommentSetPicker();
    return;
  }
  if (["home", "naver", "naver-set", "comment-sets", "google"].includes(view)) {
    activeView = view;
    commentSetPickerOpen = false;
    commentPickerOpenedByHover = false;
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
    google: "Xóa lịch sử từ khóa Google đã copy và bắt đầu lại?",
    comments: "Xóa lịch sử bình luận đã copy trong cả 7 set? Bộ đếm Naver sẽ được giữ nguyên.",
  };
  if (!window.confirm(confirmation[kind])) {
    return;
  }
  if (kind === "naver") {
    naverState = freshNaverState();
    saveNaver();
  } else if (kind === "google") {
    googleState = { copied: [], currentIndex: randomIndex(data.googleKeywords.length) };
    saveGoogle();
  } else {
    commentsState = {
      sets: Object.fromEntries(data.commentSets.map((set) => [
        set.id,
        {
          ...commentsState.sets[set.id],
          copied: [],
          currentIndex: randomIndex(set.comments.length),
        },
      ])),
    };
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
    const validCommentSets = Array.isArray(data.commentSets)
      && data.commentSets.length === 7
      && data.commentSets.every((set, index) => set.id === index + 1
        && Array.isArray(set.comments)
        && set.comments.length === 20
        && set.comments.every((comment) => comment.ko && comment.vi && comment.hashtags));
    if (data.naverSets.length !== 7 || data.googleKeywords.length !== 50 || !validCommentSets) {
      throw new Error("Unexpected data counts in data.json");
    }
    naverState = loadNaverState();
    googleState = loadGoogleState();
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
  if (button.dataset.commentSet) {
    selectCommentSet(Number(button.dataset.commentSet));
  } else if (button.dataset.action === "toggle-comment-picker") {
    if (commentSetPickerOpen && commentPickerOpenedByHover && event.detail > 0) {
      return;
    }
    const shouldOpen = !commentSetPickerOpen;
    if (shouldOpen) {
      openCommentSetPicker();
      if (event.detail === 0) {
        main.querySelector(".comment-set-option")?.focus();
      }
    } else {
      closeCommentSetPicker();
    }
  } else if (button.dataset.naverSet) {
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
  const set = currentCommentSet();
  const state = currentCommentSetState();
  if (!set || !state) {
    return;
  }
  state.hideCopied = event.target.checked;
  if (state.hideCopied && state.currentIndex !== null && state.copied.includes(state.currentIndex)) {
    chooseNextComment(set, state);
  } else if (!state.hideCopied && state.currentIndex === null) {
    state.currentIndex = randomIndex(set.comments.length);
  }
  copyMessage = "";
  saveComments();
  render();
});

main.addEventListener("pointerover", (event) => {
  const trigger = event.target.closest(".comment-picker-trigger");
  if (event.pointerType === "mouse" && trigger && !trigger.contains(event.relatedTarget)) {
    commentSetPickerOpen = true;
    commentPickerOpenedByHover = true;
    updateCommentSetPicker();
  }
});

main.addEventListener("pointerout", (event) => {
  const region = event.target.closest(".comment-picker-trigger, .comment-set-picker");
  const nextRegion = event.relatedTarget instanceof Element
    ? event.relatedTarget.closest(".comment-picker-trigger, .comment-set-picker")
    : null;
  if (event.pointerType === "mouse" && region && !nextRegion) {
    closeCommentSetPicker();
  }
});

main.addEventListener("focusout", (event) => {
  const region = event.target.closest(".comment-picker-trigger, .comment-set-picker");
  const nextRegion = event.relatedTarget instanceof Element
    ? event.relatedTarget.closest(".comment-picker-trigger, .comment-set-picker")
    : null;
  if (region && !nextRegion) {
    closeCommentSetPicker();
  }
});

main.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && commentSetPickerOpen) {
    event.preventDefault();
    closeCommentSetPicker(true);
  }
});

document.addEventListener("click", (event) => {
  const target = event.target;
  const clickedPickerRegion = target.closest(".comment-picker-trigger, .comment-set-picker");
  if (commentSetPickerOpen && !clickedPickerRegion) {
    closeCommentSetPicker();
  }
});

window.addEventListener("resize", updateCommentSetPicker);
window.addEventListener("scroll", updateCommentSetPicker, true);

document.querySelector("#open-settings").addEventListener("click", () => settingsDialog.showModal());
settingsDialog.addEventListener("click", (event) => {
  const button = event.target.closest("[data-clear]");
  if (button) {
    clearHistory(button.dataset.clear);
  }
});
document.querySelector(".brand").addEventListener("click", () => setView("home"));

initialize();

document.addEventListener("pointermove", (event) => {
  if (event.pointerType !== "mouse" && event.pointerType !== "touch") {
    return;
  }
  const point = { x: event.clientX, y: event.clientY, time: event.timeStamp };
  if (lastTrailPoint) {
    const dx = point.x - lastTrailPoint.x;
    const dy = point.y - lastTrailPoint.y;
    const distance = Math.hypot(dx, dy);
    const elapsed = Math.max(1, point.time - lastTrailPoint.time);
    const speed = distance / elapsed;
    const threshold = Math.max(16, 38 - speed * 12);
    const trailDistance = lastTrailSpawn
      ? Math.hypot(point.x - lastTrailSpawn.x, point.y - lastTrailSpawn.y)
      : distance;
    if (trailDistance >= threshold) {
      const count = speed > 1.15 ? 2 : 1;
      spawnAcai(point.x, point.y, {
        count,
        spread: Math.min(22, 4 + speed * 8),
        velocityX: dx / elapsed * 10,
        velocityY: dy / elapsed * 10,
      });
      lastTrailSpawn = point;
    }
  }
  lastTrailPoint = point;
});

document.addEventListener("pointerleave", () => {
  lastTrailPoint = null;
  lastTrailSpawn = null;
});

document.addEventListener("click", (event) => {
  const target = event.target.closest("button:not(:disabled), a");
  if (!target) {
    return;
  }
  playPop();
  spawnAcai(event.clientX, event.clientY, {
    count: Math.floor(randomBetween(5, 10)),
    burst: true,
    spread: 3,
  });
});
