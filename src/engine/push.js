// Живой Пуш для превью-экранов: видео с альфой → canvas (Пуш + тень из силуэта + опц. отражение),
// плюс элемент (плашка очков), который повторяет покачивание Пуша.
//   initPush({ canvas, video, shadow: "rgb(..)", reflect: bool, follow: el, followBase: "translateX(-50%)" })
const FEET = 0.835;   // лапы в кадре idle_tongue / BASE v2 (доля высоты)

export function initPush({ canvas, video, shadow, reflect = false, follow = null, followBase = "" }) {
  // setVideo с перетеканием: старый ролик (на своём последнем кадре) плавно уступает новому — без «щелчка» на стыке
  const FADE = 250;   // мс
  // «Пуф» — переход между роликами в разных позах без мостов: старая поза сжимается и смазывается (POOF_OUT),
  // новая выстреливает вытянутой и пружинит на место (POOF_IN). Пивот — точка лап, Пуш не отрывается от пола.
  const POOF_OUT = 160, POOF_IN = 340;  // мс; ponytail: на глаз, подбирать по ощущению
  let prev = null, fade0 = 0, mode = "fade";
  const api = { video, tracking: true,
    setVideo(v, how = "fade", img = null) {    // img — иконка нажатой кнопки: при «пуфе» вылетает стикерами вместо дыма
      prev = video; fade0 = performance.now(); mode = how; video = v; api.video = v; fxImg = img;
      if (img) fxSprite = img.complete && img.naturalWidth ? outlined(img) : null;
      if (how === "poof") img ? makeStickers() : makePuffs(); } };
  const x = canvas.getContext("2d");
  const sil = document.createElement("canvas"), sx = sil.getContext("2d");
  const T = 160, trk = document.createElement("canvas"), tx = trk.getContext("2d", { willReadFrequently: true });
  trk.width = trk.height = T;
  const PX = canvas.getBoundingClientRect().width / T;
  let base = null, dx = 0, dy = 0;

  function track() {
    tx.clearRect(0, 0, T, T); tx.drawImage(video, 0, 0, T, T);
    const a = tx.getImageData(0, 0, T, T).data;
    let n = 0, sxs = 0, top = T;
    for (let y = 0; y < T; y++) for (let i = 0; i < T; i++)
      if (a[(y * T + i) * 4 + 3] > 128) { n++; sxs += i; if (y < top) top = y; }
    if (!n) return;
    const cx = sxs / n;
    base ??= { cx, top };
    dx = dx * 0.8 + (cx - base.cx) * PX * 0.2;   // сглаживание: шаг трекинга ~2.7 px
    dy = dy * 0.8 + (top - base.top) * PX * 0.2;
    follow.style.transform = `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) ${followBase}`;
  }

  // VFX поверх «пуфа» — прячет момент смены позы. Сравнить: ?fx=smoke (по умолчанию) | flash | none
  const FX = new URLSearchParams(location.search).get("fx") || "smoke";
  const SMOKE_T = 650;
  let puffs = [];
  const rnd = (a, b) => a + Math.random() * (b - a);
  // клочок неправильной формы: 2–5 кругов разного размера вокруг центра
  const tuft = () => Array.from({ length: 2 + Math.floor(Math.random() * 4) }, () =>
    ({ a: rnd(0, Math.PI * 2), o: rnd(0.3, 0.8), k: rnd(0.45, 0.85) }));
  const makePuffs = () => {                           // плотный дым из клочков разного размера и темпа
    puffs = [];
    for (let i = 0; i < 16; i++) {                    // вокруг тела, два слоя: ближний мельче, дальний крупнее
      const a = -Math.PI / 2 + (i / 16) * Math.PI * 2 + rnd(-0.2, 0.2), far = i % 2;
      puffs.push({ a, d: (far ? 0.25 : 0.15) + rnd(-0.02, 0.03), r: (far ? 0.08 : 0.055) * rnd(0.7, 1.4),
                   delay: rnd(0, 80), sub: tuft() });
    }
    for (let i = 0; i < 5; i++)                       // мелкие клочки, отлетающие дальше
      puffs.push({ a: rnd(0, Math.PI * 2), d: rnd(0.3, 0.36), r: rnd(0.025, 0.04), delay: rnd(40, 120), sub: tuft() });
    for (const side of [-1, 1]) for (const k of [0.08, 0.18, 0.3])   // у пола, разлетаются в стороны
      puffs.push({ floor: side * k, r: rnd(0.045, 0.08), delay: rnd(10, 80), sub: tuft() });
  };
  // стикеры нажатой кнопки: разлетаются веером от тела, крутятся, падают под гравитацией и сдуваются
  const STICK_T = 900;
  let fxImg = null, fxSprite = null, stickers = [];
  // стикерная белая обводка вокруг иконки — контраст на красном Пуше и любом фоне (готовится один раз на картинку)
  const OUTLINE = 10, SPR = 256;
  const outlined = img => {
    const k = (img.naturalHeight || 1) / (img.naturalWidth || 1), w = SPR, h = Math.round(SPR * k), p = OUTLINE;
    const sil = document.createElement("canvas"); sil.width = w + 2 * p; sil.height = h + 2 * p;
    const s = sil.getContext("2d"); s.drawImage(img, p, p, w, h); s.globalCompositeOperation = "source-in"; s.fillStyle = "#fff"; s.fillRect(0, 0, sil.width, sil.height);
    const c = document.createElement("canvas"); c.width = sil.width; c.height = sil.height; const o = c.getContext("2d");
    for (let a = 0; a < 16; a++) o.drawImage(sil, Math.cos(a / 16 * 2 * Math.PI) * p, Math.sin(a / 16 * 2 * Math.PI) * p);
    o.drawImage(img, p, p, w, h); return c;
  };
  const makeStickers = () => {
    stickers = Array.from({ length: 9 }, (_, i) => ({
      a: -Math.PI / 2 + (i / 9 - 0.5) * Math.PI * 1.5 + rnd(-0.15, 0.15),   // веер вверх и в стороны
      v: rnd(0.32, 0.5), r: rnd(0.09, 0.16), rot: rnd(-0.6, 0.6), spin: rnd(-2.5, 2.5), delay: rnd(0, 90) }));
  };
  function stickersFx(t, S) {
    const cx = S / 2, cy = FEET * S - 0.3 * S;
    for (const p of stickers) {
      const u = (t - p.delay) / STICK_T; if (u <= 0 || u >= 1) continue;
      const e = 1 - (1 - u) ** 2.5;
      const px = cx + Math.cos(p.a) * p.v * S * e;
      const py = cy + Math.sin(p.a) * p.v * S * e + 0.35 * S * u * u;           // гравитация
      const pop = u < 0.18 ? Math.sin((u / 0.18) * Math.PI / 2) * 1.2 : 1.2 - 0.2 * Math.min(1, (u - 0.18) / 0.12);
      const shrink = u > 0.65 ? 1 - ((u - 0.65) / 0.35) ** 1.5 : 1;
      const R = p.r * S * pop * shrink; if (R < 1) continue;
      x.save(); x.translate(px, py); x.rotate(p.rot + p.spin * u);
      const spr = fxSprite || fxImg, k = (spr.height || spr.naturalHeight || 1) / (spr.width || spr.naturalWidth || 1);   // без искажения пропорций
      x.shadowColor = "rgba(70, 12, 0, 0.35)"; x.shadowBlur = 0.03 * S; x.shadowOffsetY = 0.012 * S;   // мягкая тень — отрыв от Пуша
      x.drawImage(spr, -R, -R * k, 2 * R, 2 * R * k); x.restore();
    }
  }
  function smoke(t, S) {
    const cx = S / 2, cy = FEET * S - 0.27 * S;
    for (const p of puffs) {
      const u = (t - p.delay) / SMOKE_T; if (u <= 0 || u >= 1) continue;
      const e = 1 - (1 - u) ** 3;
      let px, py;
      if (p.floor) { px = cx + p.floor * S * (0.8 + 0.7 * e); py = FEET * S - 0.03 * S - 0.02 * S * e; }
      else { const d = (0.6 + 0.5 * e) * p.d * S; px = cx + Math.cos(p.a) * d; py = cy + Math.sin(p.a) * d * 1.2 - 0.04 * S * e; }
      // пружинный «бум» вверх, потом клуб сдувается в точку — не прозрачнеет (мультяшно)
      const pop = u < 0.25 ? Math.sin((u / 0.25) * Math.PI / 2) * 1.15 : 1.15 - 0.15 * Math.min(1, (u - 0.25) / 0.15);
      const shrink = u > 0.55 ? 1 - ((u - 0.55) / 0.45) ** 1.5 : 1;
      const R = p.r * S * pop * shrink; if (R < 1) continue;
      const circles = [[px, py, R], ...p.sub.map(c => [px + Math.cos(c.a) * R * c.o, py + Math.sin(c.a) * R * c.o, R * c.k])];
      x.fillStyle = "rgba(205,150,130,0.9)";          // тень снизу-справа — объём, как у рисованного дыма
      for (const [a, b, r] of circles) { x.beginPath(); x.arc(a + r * 0.08, b + r * 0.12, r, 0, 7); x.fill(); }
      x.fillStyle = "#fff4ea";
      for (const [a, b, r] of circles) { x.beginPath(); x.arc(a, b, r, 0, 7); x.fill(); }
    }
  }
  function flash(t, S) {
    const u = t / 260; if (u >= 1) return;
    const al = Math.sin(Math.PI * Math.min(1, u * 1.6)) * 0.85 * (1 - u);
    const cx = S / 2, cy = FEET * S - 0.3 * S, r = S * (0.25 + 0.2 * u);
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgba(255,252,240,${al})`); g.addColorStop(1, "rgba(255,252,240,0)");
    x.save(); x.globalCompositeOperation = "lighter"; x.fillStyle = g; x.fillRect(0, 0, S, S); x.restore();
  }
  function draw() {
    const S = video.videoWidth || video.naturalWidth || 1024;   // видео или картинка (сон — статичный кадр)
    if (canvas.width !== S) { canvas.width = S; canvas.height = 2 * S; sil.width = sil.height = S; }
    x.clearRect(0, 0, S, 2 * S);
    if (reflect) {
      x.save(); x.translate(0, 2 * FEET * S); x.scale(1, -1); x.globalAlpha = 0.5; x.filter = "blur(2px)"; x.drawImage(video, 0, 0, S, S); x.restore();
      x.globalCompositeOperation = "destination-out";
      const g = x.createLinearGradient(0, FEET * S, 0, FEET * S + 0.6 * S);
      g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,1)");
      x.fillStyle = g; x.fillRect(0, FEET * S, S, S * (2 - FEET)); x.globalCompositeOperation = "source-over";
    }
    sx.globalCompositeOperation = "source-over"; sx.clearRect(0, 0, S, S); sx.drawImage(video, 0, 0, S, S);
    sx.globalCompositeOperation = "source-in"; sx.fillStyle = shadow; sx.fillRect(0, 0, S, S);
    for (const [q, b, al] of [[0.10, 18, 0.45], [0.035, 4, 0.75]]) {   // мягкая широкая + плотная у лап
      x.save(); x.globalAlpha = al; x.filter = `blur(${b}px)`; x.translate(0, FEET * S * (1 - q)); x.scale(1, q); x.drawImage(sil, 0, 0, S, S); x.restore();
    }
    const t = performance.now() - fade0;
    if (prev && mode === "poof") {
      // мягкий «пуф»: старая поза слегка приседает и тает, новая в это же время проявляется из лёгкого
      // вытягивания и с одним плавным перелётом садится на место. Пивот — точка лап.
      const T = POOF_OUT + POOF_IN;
      if (t >= Math.max(T, fxImg ? STICK_T + 120 : FX === "smoke" ? SMOKE_T + 120 : 0)) prev = null;
      else {
        const draw1 = (src, sxk, syk, alpha, blur) => {
          x.save(); x.globalAlpha = alpha;
          x.translate(S / 2, FEET * S); x.scale(sxk, syk); x.translate(-S / 2, -FEET * S);
          if (blur > 0.3) x.filter = `blur(${blur.toFixed(1)}px)`;
          x.drawImage(src, 0, 0, S, S); x.restore();
        };
        const ease = u => u * u * (3 - 2 * u);                              // smoothstep
        const ko = Math.min(1, t / POOF_OUT);                               // уход старой позы
        const ki = Math.min(1, Math.max(0, (t - POOF_OUT * 0.4) / (T - POOF_OUT * 0.4))); // приход новой (с перекрытием)
        const sq = Math.sin(Math.PI * ko);                                  // присед старой: 0 → 1 → 0
        const sp = Math.sin(ki * Math.PI * 1.2) * Math.exp(-3 * ki) * (1 - ki); // мягкая пружина, один перелёт
        // старая поза остаётся непрозрачной под новой, пока новая не проявилась полностью → нет «окна прозрачности»
        const ain = ease(Math.min(1, ki * 2.2));
        if (ain < 1) draw1(prev, 1 + 0.06 * sq, 1 - 0.08 * sq, 1, 1.5 * sq);
        draw1(video, 1 - 0.05 * sp, 1 + 0.07 * sp, ain, 1.5 * (1 - ki));
      }
      if (!prev) x.drawImage(video, 0, 0, S, S);
      if (fxImg) stickersFx(t, S); else if (FX === "flash") flash(t, S); else if (FX === "smoke") smoke(t, S);
    } else {
      const k = prev ? Math.min(1, t / FADE) : 1;
      if (k < 1) { x.drawImage(prev, 0, 0, S, S); x.globalAlpha = k * k * (3 - 2 * k); }   // smoothstep
      else prev = null;
      x.drawImage(video, 0, 0, S, S); x.globalAlpha = 1;
    }
    if (follow && api.tracking && video.readyState >= 2) track();
    if (alive) requestAnimationFrame(draw);
  }
  let alive = true; api.destroy = () => { alive = false; };
  video.play?.()?.catch?.(() => {});
  addEventListener("pointerdown", () => api.video.paused && api.video.loop && api.video.play());   // если браузер заблокировал автозапуск
  draw();
  return api;
}
