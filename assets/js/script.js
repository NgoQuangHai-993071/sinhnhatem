/* =========================================================
   Web sinh nhật — logic tương tác
   ========================================================= */
(() => {
  "use strict";

  /* ---------- cấu hình nhóm ảnh: lời dẫn + nhạc + thời lượng mỗi ảnh (ms) ---------- */
  const GROUPS = {
    1: {
      folder: "nhom1", count: 8, audio: "audio-1", label: "Đời thường",
      durMin: 2000, durMax: 5000, audioStart: 23,
      caption: "Một cô gái biết cách ăn mặc rất phù hợp với đời thường.",
    },
    2: {
      folder: "nhom2", count: 11, audio: "audio-2", label: "Xinh & Cute",
      durMin: 3000, durMax: 5000,
      caption: "Và rất biết cách lộng lẫy, yêu kiều đúng thời điểm.",
    },
    3: {
      folder: "nhom3", count: 6, audio: "audio-3", label: "Ảnh bựa",
      durMin: 2000, durMax: 5000,
      caption: "Tất nhiên, không thiếu khoảnh khắc hài hước.",
    },
    4: {
      folder: "nhom4", count: 9, audio: "audio-romantic", label: "Hai đứa mình",
      durMin: 3000, durMax: 5000,
      caption: "Cùng anh bạn đồng hành.",
    },
  };
  const STORY_ORDER = [1, 2, 3, 4];
  const CAPTION_HOLD_MS = 4500; // lời dẫn hiện ~4.5s trước khi vào ảnh
  const ALL_AUDIO_IDS = ["audio-1", "audio-2", "audio-3", "audio-romantic", "audio-ending"];
  const ENDING_AUDIO_ID = "audio-ending";

  // Điểm bắt đầu phát mặc định của mỗi track (vd. nhạc nhóm 1 luôn bắt đầu từ giây 23) —
  // dùng chung cho cả playAudioId() lẫn unlockAudio() để 2 nơi không "giành" currentTime của nhau.
  const AUDIO_START = {};
  Object.values(GROUPS).forEach((g) => { if (g.audioStart) AUDIO_START[g.audio] = g.audioStart; });

  /* ---------- hiệu ứng vào ảnh + hình khung, theo từng nhóm ---------- */
  const FX_BY_GROUP = {
    1: ["fx-slide-left", "fx-slide-right", "fx-slide-up"],
    2: ["fx-glam"],
    3: ["fx-funny-pop", "fx-funny-flip"],
    4: ["fx-heart-in"],
  };
  const SHAPE_BY_GROUP = {
    4: ["shape-circle"],
  };
  const ALL_FX_CLASSES = ["fx-slide-left", "fx-slide-right", "fx-slide-up", "fx-glam", "fx-funny-pop", "fx-funny-flip", "fx-heart-in"];
  const ALL_SHAPE_CLASSES = ["shape-circle", "shape-heart"];

  /* ---------- lời chúc (nội dung đã được duyệt) ---------- */
  const LETTER_PARAGRAPHS = [
    "Nhân dịp sinh nhật của vk iu, ck chỉ có một điều ước duy nhất: mong em, khi ở bên anh sẽ luôn vui vẻ, hạnh phúc và mọi điều tiêu cực từ trước giờ đều tan biến.",
    "Tuổi mới của em, và anh vẫn thấy mình may mắn biết bao khi có em bên cạnh — cùng cười, cùng đi qua bao ngày vui buồn, thử thách. Mỗi khoảnh khắc bên em, với anh, đều đáng giá.",
    "Anh chúc em, bé yêu của anh, tuổi mới này sẽ luôn rạng rỡ như chính nụ cười của em. Mong mọi điều em ước sẽ thành hiện thực, mong em luôn khỏe mạnh, bình an, không ngừng yêu đời và mãi yêu anh.",
    "Dù ngày mai có ra sao, anh vẫn ở đây, đồng hành cùng em trên chặng đường phía trước.",
    "Chúc mừng sinh nhật em. Mãi hạnh phúc bên anh, em nhé.",
  ];

  let muted = false;
  let currentGroup = 1;
  let audioUnlocked = false;
  let giftOpened = false;
  let currentAudioId = null;

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const pad2 = (n) => String(n).padStart(2, "0");
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const randBetween = (min, max) => Math.floor(min + Math.random() * (max - min));
  const randFloat = (min, max) => min + Math.random() * (max - min);
  const audioEl = (id) => document.getElementById(id);

  // Ẩn một lớp ngay lập tức (bỏ qua transition) rồi khôi phục transition —
  // dùng để tắt lớp cũ tức thì, tránh nó lộ mờ chồng lên lớp mới đang fade-in.
  function hideNow(el, cls) {
    if (!el.classList.contains(cls)) return;
    el.style.transition = "none";
    el.classList.remove(cls);
    void el.offsetHeight; // ép reflow để transition:none có hiệu lực trước khi khôi phục
    el.style.transition = "";
  }

  /* ---------- điều hướng màn hình ---------- */
  function showScreen(id) {
    const target = document.getElementById(id);
    $$(".screen").forEach((s) => { if (s !== target) hideNow(s, "active"); });
    target.classList.add("active");
    target.scrollTop = 0;
  }

  /* ---------- hạt trang trí dùng chung (lấp lánh / trái tim / vui nhộn / confetti...) ---------- */
  function spawnParticles(container, icons, count, opts = {}) {
    if (!container) return;
    const { spread = 140, baseDist = 90, life = 1300, top = "45%", className = "sparkle" } = opts;
    for (let i = 0; i < count; i++) {
      const s = document.createElement("span");
      s.className = className;
      s.textContent = icons[Math.floor(Math.random() * icons.length)];
      const angle = Math.random() * Math.PI * 2;
      const dist = baseDist + Math.random() * spread;
      const x = Math.cos(angle) * dist;
      const y = Math.sin(angle) * dist - 40;
      s.style.setProperty("--fly", `translate(${x}px, ${y}px)`);
      s.style.left = "50%";
      s.style.top = top;
      s.style.animationDelay = `${Math.random() * 0.15}s`;
      container.appendChild(s);
      setTimeout(() => s.remove(), life);
    }
  }

  /* ---------- nền lãng mạn: hạt sáng trôi lên toàn màn hình ---------- */
  function initAmbient() {
    const wrap = $("#ambient");
    if (!wrap) return;
    const icons = ["✨", "💫", "♡", "·"];
    const total = 16;
    for (let i = 0; i < total; i++) {
      const p = document.createElement("span");
      p.className = "ambient-p";
      p.textContent = icons[Math.floor(Math.random() * icons.length)];
      p.style.left = `${Math.random() * 100}%`;
      p.style.setProperty("--dur", `${14 + Math.random() * 16}s`);
      p.style.setProperty("--delay", `${-Math.random() * 20}s`);
      p.style.setProperty("--drift", `${Math.round(randFloat(-40, 40))}px`);
      p.style.setProperty("--size", `${(0.5 + Math.random() * 0.9).toFixed(2)}rem`);
      p.style.setProperty("--peak-op", `${(0.25 + Math.random() * 0.35).toFixed(2)}`);
      wrap.appendChild(p);
    }
  }
  initAmbient();

  /* ---------- quản lý nhạc ---------- */
  function unlockAudio() {
    if (audioUnlocked) return;
    audioUnlocked = true;
    ALL_AUDIO_IDS.forEach((id) => {
      const a = audioEl(id);
      a.volume = 0;
      a.play()
        .then(() => {
          a.pause();
          a.currentTime = AUDIO_START[id] || 0;
          a.volume = 1;
        })
        .catch(() => {
          /* file chưa có / trình duyệt chặn — bỏ qua, không chặn trải nghiệm */
        });
    });
  }

  function stopAllAudio() {
    ALL_AUDIO_IDS.forEach((id) => {
      const a = audioEl(id);
      a.pause();
    });
  }

  function fadeIn(a, target = 0.9, ms = 700) {
    a.volume = 0;
    const steps = 14;
    let i = 0;
    const iv = setInterval(() => {
      i++;
      a.volume = Math.min(target, (target * i) / steps);
      if (i >= steps) clearInterval(iv);
    }, ms / steps);
  }

  function fadeOutAndPause(a, ms = 500) {
    return new Promise((resolve) => {
      const startVol = a.volume || 0;
      if (a.paused || startVol <= 0) { a.pause(); resolve(); return; }
      const steps = 10;
      let i = 0;
      const iv = setInterval(() => {
        i++;
        a.volume = Math.max(0, startVol * (1 - i / steps));
        if (i >= steps) { clearInterval(iv); a.pause(); resolve(); }
      }, ms / steps);
    });
  }

  // Đặt vị trí bắt đầu phát cho một track (vd. nhạc nhóm 1 bắt đầu từ giây 23) —
  // chờ metadata sẵn sàng nếu cần, tránh set currentTime khi trình duyệt chưa nạp xong.
  function seekTo(a, seconds) {
    const apply = () => { try { a.currentTime = seconds; } catch (_) { /* bỏ qua */ } };
    if (a.readyState >= 1) apply();
    else a.addEventListener("loadedmetadata", apply, { once: true });
  }

  // Phát nhạc theo id — nếu bài này đang phát rồi thì để nguyên (nhạc chạy liên tục
  // xuyên suốt từ nhóm ảnh 4 sang phần lời chúc vì dùng chung 1 bài romantic).
  async function playAudioId(id, startAt = 0) {
    if (!id) return;
    if (id === currentAudioId) {
      const a = audioEl(id);
      if (!muted && a.paused) a.play().then(() => fadeIn(a)).catch(() => {});
      return;
    }
    const prevId = currentAudioId;
    currentAudioId = id;
    if (prevId) await fadeOutAndPause(audioEl(prevId));
    const a = audioEl(id);
    if (startAt) seekTo(a, startAt);
    if (muted) return;
    a.play().then(() => fadeIn(a)).catch(() => {});
  }

  function toggleMute() {
    muted = !muted;
    $("#mute-btn").textContent = muted ? "🔇" : "🔊";
    if (muted) {
      stopAllAudio();
    } else if (currentAudioId) {
      const a = audioEl(currentAudioId);
      a.play().then(() => fadeIn(a)).catch(() => {});
    }
  }

  /* ---------- 1. màn hình mở đầu ---------- */
  $("#start-btn").addEventListener("click", () => {
    unlockAudio();
    showScreen("screen-gift");
  });

  /* ---------- 2. hộp quà bí mật: kéo ruy băng để mở ---------- */
  const giftBox = $("#gift-box");
  const ribbonTail = $("#ribbon-tail");
  const giftHint = $("#gift-hint");
  const MAX_DRAG = 90;
  const OPEN_THRESHOLD = 66;
  let dragStartY = 0;
  let dragging = false;

  function onDragStart(e) {
    if (giftOpened) return;
    dragging = true;
    dragStartY = (e.touches ? e.touches[0].clientY : e.clientY);
    ribbonTail.classList.add("dragging");
    if (e.pointerId !== undefined) {
      try { ribbonTail.setPointerCapture(e.pointerId); } catch (_) {}
    }
  }

  function onDragMove(e) {
    if (!dragging || giftOpened) return;
    const y = (e.touches ? e.touches[0].clientY : e.clientY);
    let delta = y - dragStartY;
    delta = Math.max(0, Math.min(MAX_DRAG, delta));
    ribbonTail.style.transform = `translate(-50%, ${delta}px)`;
    giftBox.style.transform = `rotate(${delta / 14}deg)`;
    if (delta >= OPEN_THRESHOLD) {
      finishDrag(true);
    }
  }

  function onDragEnd() {
    if (!dragging) return;
    dragging = false;
    ribbonTail.classList.remove("dragging");
    if (!giftOpened) {
      ribbonTail.style.transform = "";
      giftBox.style.transform = "";
    }
  }

  function finishDrag(opened) {
    dragging = false;
    ribbonTail.classList.remove("dragging");
    if (opened) openGift();
  }

  ribbonTail.addEventListener("pointerdown", onDragStart);
  window.addEventListener("pointermove", onDragMove);
  window.addEventListener("pointerup", onDragEnd);
  window.addEventListener("pointercancel", onDragEnd);
  // dự phòng cảm ứng cũ
  ribbonTail.addEventListener("touchstart", onDragStart, { passive: true });
  window.addEventListener("touchmove", onDragMove, { passive: true });
  window.addEventListener("touchend", onDragEnd);

  function spawnSparkles() {
    spawnParticles($("#sparkles"), ["✨", "⭐", "💛", "🎊"], 16, { spread: 140, baseDist: 90, life: 1600 });
  }

  function openGift() {
    if (giftOpened) return;
    giftOpened = true;
    giftBox.style.transform = "";
    giftBox.classList.add("opening", "lid-open");
    $("#glow-burst").classList.add("burst");
    spawnSparkles();
    giftHint.textContent = "Đã mở rồi 🎉 đang dẫn em đến kho kỷ niệm...";

    setTimeout(() => {
      showScreen("screen-gallery");
      playStory();
    }, 1300);
  }

  /* ---------- 3. các nhóm ảnh: lời dẫn → ảnh tự chạy → nhóm tiếp theo ---------- */
  const captionLayer = $("#caption-layer");
  const captionText = $("#caption-text");
  const photoLayer = $("#photo-layer");
  const photoFrame = $("#photo-frame");
  const photoImg = $("#photo-current");
  const storyParticles = $("#story-particles");

  async function showCaption(text) {
    hideNow(photoLayer, "show"); // tắt ảnh nhóm trước ngay lập tức, tránh lộ chồng
    captionText.textContent = text;
    captionLayer.classList.add("show");
    await sleep(CAPTION_HOLD_MS);
    hideNow(captionLayer, "show");
    await sleep(200);
  }

  let lastFx = null;
  function pickFx(n) {
    const opts = FX_BY_GROUP[n] || ["fx-slide-up"];
    if (opts.length === 1) return opts[0];
    let choice;
    do { choice = opts[Math.floor(Math.random() * opts.length)]; } while (choice === lastFx);
    lastFx = choice;
    return choice;
  }
  function pickShape(n) {
    const opts = SHAPE_BY_GROUP[n];
    if (!opts) return null;
    return opts[Math.floor(Math.random() * opts.length)];
  }

  function showPhoto(n, src, durMs) {
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;

        // hiệu ứng khung ảnh: chọn kiểu vào ảnh + hình khung theo từng nhóm
        photoFrame.classList.remove(...ALL_FX_CLASSES, ...ALL_SHAPE_CLASSES);
        photoFrame.style.setProperty("--tilt", `${Math.round(randFloat(-7, 7))}deg`);
        void photoFrame.offsetWidth; // ép reflow để animation chạy lại từ đầu
        const fx = pickFx(n);
        const shape = pickShape(n);
        photoFrame.classList.add(fx);
        if (shape) photoFrame.classList.add(shape);

        // hiệu ứng zoom Ken Burns trên chính ảnh
        void photoImg.offsetWidth;
        photoImg.classList.remove("kenburns");
        void photoImg.offsetWidth;
        photoImg.style.animationDuration = `${durMs + 500}ms`;
        photoImg.classList.add("kenburns");
        requestAnimationFrame(() => { photoImg.style.opacity = 1; });

        // hạt trang trí vui nhộn / trái tim bay quanh ảnh cho nhóm 3, nhóm 4
        if (n === 3) spawnParticles(storyParticles, ["😂", "🤣", "✨", "🎉"], 6, { spread: 120, baseDist: 70, life: 1200 });
        if (n === 4) spawnParticles(storyParticles, ["💛", "💕", "✨"], 6, { spread: 110, baseDist: 60, life: 1400 });

        resolve();
      };
      photoImg.style.opacity = 0;
      photoImg.onload = finish;
      photoImg.onerror = finish; // ảnh thật chưa có cũng không chặn tiến trình
      photoImg.src = src;
    });
  }

  async function playGroupPhotos(n) {
    currentGroup = n;
    const g = GROUPS[n];
    playAudioId(g.audio, g.audioStart || 0);
    hideNow(captionLayer, "show"); // tắt lời dẫn ngay lập tức, tránh lộ chồng lên ảnh
    photoLayer.classList.add("show");
    for (let i = 1; i <= g.count; i++) {
      const dur = randBetween(g.durMin, g.durMax);
      await showPhoto(n, `assets/images/${g.folder}/${pad2(i)}.jpg`, dur);
      await sleep(dur);
    }
    hideNow(photoLayer, "show");
    await sleep(200);
  }

  let storyToken = 0;
  async function playStory() {
    const myToken = ++storyToken;
    for (const n of STORY_ORDER) {
      if (myToken !== storyToken) return;
      await showCaption(GROUPS[n].caption);
      if (myToken !== storyToken) return;
      await playGroupPhotos(n);
    }
    if (myToken !== storyToken) return;
    // nhạc nhóm 4 (romantic) tiếp tục chạy liền mạch sang phần lời chúc bên dưới
    showScreen("screen-letter");
    runLetter();
  }

  /* ---------- 4. lời chúc viết tay ---------- */
  $("#replay-btn").addEventListener("click", runLetter);
  $("#continue-btn").addEventListener("click", () => {
    showScreen("screen-ending");
    playAudioId(ENDING_AUDIO_ID);
    startEndingCelebration();
  });

  // Đo trước với toàn bộ nội dung để tự thu nhỏ cỡ chữ (nếu cần) cho vừa khít 1 màn hình,
  // không cần cuộn lên/xuống mới đọc hết — rồi giữ cố định chiều cao đó trong lúc gõ từng chữ.
  function fitLetterToScreen(fullText) {
    const screenEl = $("#screen-letter");
    const heading = $(".letter-heading");
    const el = $("#letter-text");
    const sign = $(".letter-sign");

    [heading, el, sign].forEach((n) => { n.style.fontSize = ""; });
    el.style.lineHeight = "";
    el.style.minHeight = "";

    el.textContent = fullText;
    void screenEl.offsetHeight;

    const available = screenEl.clientHeight;

    // co dần vài vòng cho khít — reflow theo dòng không tuyến tính hoàn toàn với cỡ chữ,
    // nên ước lượng 1 lần có thể chưa đủ sát, thử thêm tối đa vài vòng để chính xác hơn.
    for (let pass = 0; pass < 4; pass++) {
      const needed = screenEl.scrollHeight;
      if (needed <= available || needed <= 0) break;
      const ratio = Math.max(0.45, Math.min(0.97, available / needed));
      [heading, el, sign].forEach((n) => {
        const base = parseFloat(getComputedStyle(n).fontSize);
        n.style.fontSize = `${(base * ratio).toFixed(2)}px`;
      });
      void screenEl.offsetHeight;
    }

    void screenEl.offsetHeight;
    el.style.minHeight = `${el.scrollHeight}px`; // giữ cố định, tránh giấy co giãn khi gõ dở
    el.textContent = "";
  }

  let letterRunToken = 0;
  async function runLetter() {
    const myToken = ++letterRunToken;
    const el = $("#letter-text");
    const sign = $(".letter-sign");
    const continueBtn = $("#continue-btn");
    sign.classList.remove("show");
    continueBtn.classList.remove("show");

    const cursor = document.createElement("span");
    cursor.className = "cursor";
    cursor.textContent = " ";

    const full = LETTER_PARAGRAPHS.join("\n\n");
    fitLetterToScreen(full);
    let buffer = "";
    for (let i = 0; i < full.length; i++) {
      if (myToken !== letterRunToken) return; // đã bấm đọc lại, hủy lượt cũ
      const ch = full[i];
      buffer += ch;
      el.textContent = buffer;
      el.appendChild(cursor);
      let delay = 24;
      if (",.—!?".includes(ch)) delay = 220;
      if (ch === "\n") delay = 380;
      await sleep(delay);
    }
    cursor.remove();
    if (myToken === letterRunToken) {
      sign.classList.add("show");
      continueBtn.classList.add("show");
    }
  }

  /* ---------- 5. kết — Happy Birthday ---------- */
  let endingStarted = false;
  function spawnConfettiBurst(count = 40) {
    const wrap = $("#ending-confetti");
    if (!wrap) return;
    const colors = ["#f6c987", "#ffb6c8", "#ff9d7a", "#fffaf3", "#ffe3b3", "#c65b7c"];
    for (let i = 0; i < count; i++) {
      const p = document.createElement("span");
      p.className = "confetti-piece";
      p.style.left = `${Math.random() * 100}%`;
      p.style.background = colors[Math.floor(Math.random() * colors.length)];
      p.style.setProperty("--drift", `${Math.round(randFloat(-80, 80))}px`);
      p.style.setProperty("--spin", `${Math.round(randFloat(220, 520))}deg`);
      const dur = randFloat(2.4, 4.2);
      p.style.animationDuration = `${dur}s`;
      p.style.animationDelay = `${Math.random() * 1.6}s`;
      wrap.appendChild(p);
      setTimeout(() => p.remove(), (dur + 1.6) * 1000);
    }
  }
  function spawnBalloons(count = 6) {
    const wrap = $("#ending-balloons");
    if (!wrap) return;
    const icons = ["🎈", "🎈", "🎈", "🎊"];
    for (let i = 0; i < count; i++) {
      const p = document.createElement("span");
      p.className = "balloon-piece";
      p.textContent = icons[Math.floor(Math.random() * icons.length)];
      p.style.left = `${5 + Math.random() * 90}%`;
      p.style.setProperty("--sway", `${Math.round(randFloat(-30, 30))}px`);
      const dur = randFloat(7, 11);
      p.style.animationDuration = `${dur}s`;
      p.style.animationDelay = `${Math.random() * 3}s`;
      wrap.appendChild(p);
      setTimeout(() => p.remove(), (dur + 3.2) * 1000);
    }
  }
  function startEndingCelebration() {
    if (endingStarted) return;
    endingStarted = true;
    spawnConfettiBurst(50);
    spawnBalloons(8);
    setInterval(() => spawnConfettiBurst(14), 2600);
    setInterval(() => spawnBalloons(3), 4200);
  }

  /* ---------- nút tắt/bật nhạc ---------- */
  $("#mute-btn").addEventListener("click", toggleMute);

})();
