import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ICONS, Push, type PushHandle } from "./Push";
import { type Act, type Stat, STAT_OF, GAIN, MAX, DECAY, COOLDOWN, DAY, ACTION_POINTS, MULT, LEVELS, FRIEND_CAP, levelOf, giftPoints } from "./rules";

// Макеты: Figma «Альфа Юбиляры» → страница «Диз», секция 178:263. Экран 393×852, позиции — из макета.
type Scene = "game" | "rating" | "faq";   // экраны входа пока не нужны
type Onb = "hello" | "q1" | "q2" | "howto" | "info" | null;
type Sheet = null | "fact" | "cd-feed" | "cd-play" | "cd-talk" | "lvl";

const FACTS = [
  "Альфа-Банк был основан 20 декабря 1990 года и стал одним из первых частных коммерческих банков в современной России",
  // ponytail: заглушки, реальные реплики — из таблицы реплик клиента
  "Между нами: люблю театры, особенно буфет",
  "Если надоел — моргните",
];
// ponytail: реплики-заглушки, копирайт — из таблицы реплик клиента
const FULL: Record<Act, string> = { feed: "Ого, я сыт до кончиков ушей!", play: "Ого, я наигрался на неделю вперёд!", talk: "Ого, у меня столько сил, что хоть горы сворачивай!" };
const CD: Record<Act, string> = {
  feed: "Спасибо, я недавно поел! Но наверняка проголодаюсь через несколько часов. Хочешь, пока расскажу тебе о Банке?",
  play: "Я ещё не отдышался после игры! Давай чуть позже. Хочешь, пока расскажу тебе о Банке?",
  talk: "Я пока рассказал всё, что вспомнил. Загляни через несколько часов — придумаю новые истории!",
};
const SLEEP = new URLSearchParams(location.search).get("screen") === "sleep";
// выбор флоу для теста — сбоку от экрана; флоу задаётся ?screen= и стартует с чистого состояния
const FLOWS = [["", "Онбординг"], ["game", "Игра"], ["sleep", "Сон → пробуждение"], ["rating", "Рейтинг"], ["faq", "Вопросы"]] as const;

/* ───────── мелкие компоненты ───────── */

function Btn({ kind = "primary", children, onClick, fill, className = "" }:
  { kind?: "primary" | "peach" | "white" | "secondary"; children: React.ReactNode; onClick?: () => void; fill?: boolean; className?: string }) {
  return <button className={`btn btn-${kind} t-button ${fill ? "fill" : ""} ${className}`} onClick={onClick}>{children}</button>;
}

function Bars({ bars }: { bars: [number, number, number, number, string?][] }) {
  return <>{bars.map(([l, t, w, h, r], i) => <i key={i} style={{ left: l, top: t, width: w, height: h, borderRadius: r }} />)}</>;
}

function TopBar({ gift, time, onGift, onMenu, onRating }:
  { gift: "claim" | "timer"; time: string; onGift: () => void; onMenu: () => void; onRating: () => void }) {
  return <>
    <div className="round" style={{ left: 16 }}><img src="/assets/icon-profile.svg" alt="Профиль" /></div>
    <button className="round" style={{ left: 72 }} onClick={onRating} aria-label="Рейтинг">
      <span className="ic"><Bars bars={[[5, 24, 18, 2, "32px"], [13, 9, 2, 15], [5, 2, 18, 17, "0 0 100px 100px"], [1, 6, 3, 8, "32px"], [24, 6, 3, 8, "32px"]]} /></span>
    </button>
    <button className="gift" onClick={onGift} aria-label="Подарок">
      <span className="gift-art"><img className="star" src="/assets/star-gift.svg" alt="" /><img className="box" src="/assets/gift.png" alt="" /></span>
      <span className={`gift-pill t-caption ${gift === "claim" ? "claim" : ""}`}>{gift === "claim" ? "Забрать" : time}</span>
    </button>
    <button className="round" style={{ left: 273 }} aria-label="Звук">
      <span className="ic"><Bars bars={[[1, 17, 10, 10, "32px"], [17, 14, 8, 8, "32px"], [7, 6, 4, 16], [21, 6, 4, 12], [7, 2, 18, 4, "16px 16px 0 0"]]} /></span>
    </button>
    <button className="round" style={{ left: 329 }} onClick={onMenu} aria-label="Меню">
      <span className="ic ic-menu"><Bars bars={[[3, 8, 26, 3, "12.8px"], [3, 14, 26, 3, "12.8px"], [3, 21, 26, 3, "12.8px"]]} /></span>
    </button>
  </>;
}

const STAT_UI: Record<Stat, { label: string; bg: string }> = {
  sat: { label: "Сытость", bg: "var(--feed)" }, mood: { label: "Настроение", bg: "var(--play)" }, energy: { label: "Энергия", bg: "var(--talk)" },
};
function StatBar({ k, v }: { k: Stat; v: number }) {
  return <div className="stat"><span className="t-caption">{STAT_UI[k].label}</span>
    <div className="track"><div className="fill" style={{ width: `${Math.max(16, v)}%`, background: STAT_UI[k].bg }} /></div></div>;
}

const ACT = [
  { k: "feed", label: "Покормить", bg: "var(--feed)", icon: "/assets/icon-burger.png" },
  { k: "play", label: "Поиграть", bg: "var(--play)", icon: "/assets/icon-ball.png" },
  { k: "talk", label: "Поговорить", bg: "var(--talk)", icon: "/assets/icon-talk.png" },
] as const;

function Room() { return <img className="room" src="/assets/bg-room.png" alt="" />; }

function Sheet({ children, actions }: { children: React.ReactNode; actions: React.ReactNode }) {
  return <div className="sheet" role="dialog"><div className="sheet-body">{children}</div><div className="row">{actions}</div></div>;
}

function Modal({ top, children }: { top: number; children: React.ReactNode }) {
  return <><div className="overlay" /><div className="modal" role="dialog" style={{ top }}>{children}</div></>;
}

function Bubble({ top, text }: { top: number; text: string }) {
  return <div className="bubble t-body" style={{ top }}>{text}<img className="tail" src="/assets/bubble-tail.svg" alt="" /></div>;
}

function useCountdown(start = 23 * 3600 + 45 * 60 + 12) {
  const [s, setS] = useState(start);
  useEffect(() => { const t = setInterval(() => setS(x => Math.max(0, x - 1)), 1000); return () => clearInterval(t); }, []);
  return [s / 3600, (s % 3600) / 60, s % 60].map(n => String(Math.floor(n)).padStart(2, "0")).join(":");
}

/* ───────── приложение ───────── */

export default function App() {
  const q = new URLSearchParams(location.search).get("screen") as Scene | "sleep" | null;
  const [scene, setScene] = useState<Scene>(q === "rating" || q === "faq" ? q : "game");
  const [onb, setOnb] = useState<Onb>(q === "game" || SLEEP ? null : "hello");
  const [asleep, setAsleep] = useState(SLEEP);
  const [gift, setGift] = useState<"claim" | "timer">("claim");
  const [tip, setTip] = useState(false);
  const [modal, setModal] = useState<null | "menu" | "confirm">(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [bubble, setBubble] = useState<string | null>(SLEEP ? "Тебя долго не было. Погладь Пуша, чтобы разбудить" : null);
  const [stats, setStats] = useState<Record<Stat, number>>({ sat: 37, mood: 59, energy: 45 });
  const [points, setPoints] = useState(0);
  const [friend, setFriend] = useState(0);          // накопленные очки Дружбы
  const level = levelOf(friend);
  const [busy, setBusy] = useState(false);
  const [fact, setFact] = useState(0);
  const [choice, setChoice] = useState(0);
  const [clock, setClock] = useState(0);            // сдвиг игрового времени — кнопки «+6 ч» / «Новый день» в панели флоу
  const now = () => Date.now() + clock;
  const [last, setLast] = useState<Partial<Record<Act, number>>>({});   // время последнего успешного действия
  const [giftVal, setGiftVal] = useState(() => giftPoints({ sat: 37, mood: 59, energy: 45 }, 1));
  const [faqOpen, setFaqOpen] = useState(0);
  const push = useRef<PushHandle>(null);
  const screen = useRef<HTMLDivElement>(null);
  const pointsChip = useRef<HTMLDivElement>(null);
  const time = useCountdown();

  // экран 393×852 вписывается в окно целиком
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const fit = () => setScale(Math.min(innerWidth / 393, innerHeight / 852));
    fit(); addEventListener("resize", fit); return () => removeEventListener("resize", fit);
  }, []);

  // «+10» вылетает из Пуша и садится на плашку очков
  const flyPlus = (n: number) => new Promise<void>(res => {
    const el = document.createElement("div"); el.className = "plus t-title"; el.textContent = el.dataset.t = `+${n}`;
    screen.current!.appendChild(el);
    el.animate([{ left: "176px", top: "300px", transform: "scale(.6)", opacity: 0 }, { left: "176px", top: "260px", transform: "none", opacity: 1, offset: .3 },
      { left: "52px", top: "502px", transform: "none", opacity: 1 }], { duration: 900, easing: "cubic-bezier(.3,.7,.4,1)" }).onfinish = () => {
      el.remove(); pointsChip.current?.classList.remove("bump"); void pointsChip.current?.offsetWidth; pointsChip.current?.classList.add("bump"); res();
    };
  });

  // успешное действие: +10 Победных очков, параметр +4 (не выше 100), +1 Дружба (до 5-го уровня)
  const reward = async (stat: Stat) => {
    await flyPlus(ACTION_POINTS);
    setPoints(p => p + ACTION_POINTS);
    setStats(s => ({ ...s, [stat]: Math.min(MAX, s[stat] + GAIN) }));
    const f = Math.min(FRIEND_CAP, friend + 1);
    setFriend(f);
    if (levelOf(f) > level) { await push.current!.act("levelup", ICONS.heart); setSheet("lvl"); }
  };

  const onAction = async (k: Act) => {
    if (busy || asleep) return;
    // во время восстановления Пуш отвечает репликой, без начислений и без перезапуска таймера
    if (now() - (last[k] ?? -Infinity) < COOLDOWN) { setSheet(`cd-${k}`); return; }
    setLast(l => ({ ...l, [k]: now() }));
    setBusy(true); setBubble(null);
    if (k === "talk") { await push.current!.loop("talk", ICONS.talk); setSheet("fact"); return; }
    const full = stats[STAT_OF[k]] >= MAX;   // при 100 действие доступно и награждается, но параметр не растёт
    await push.current!.act(k, ICONS[k]);
    if (full) setBubble(FULL[k]);
    await reward(STAT_OF[k]);
    setBusy(false);
  };

  const leaveTalk = async () => {
    const full = stats.energy >= MAX;
    setSheet(null); await push.current!.idle(); setFact(f => f + 1);
    if (full) setBubble(FULL.talk);
    await reward("energy"); setBusy(false);
  };
  // разбудить — 5 тапов по Пушу, на пятый просыпается
  const WAKE_TAPS = 5;
  const taps = useRef(0);
  const wake = async () => {
    if (!asleep || busy) return;
    if (++taps.current < WAKE_TAPS) return;
    taps.current = 0; setBusy(true); setBubble(null);
    await push.current!.act("wake", ICONS.heart); setAsleep(false); setBusy(false);
  };

  // новый игровой день: Подарок считается по параметрам на конец дня, затем параметры −5
  const newDay = () => {
    setGiftVal(giftPoints(stats, level)); setGift("claim");
    setStats(s => ({ sat: Math.max(0, s.sat - DECAY), mood: Math.max(0, s.mood - DECAY), energy: Math.max(0, s.energy - DECAY) }));
    setClock(c => c + DAY);
  };

  /* ── экраны ── */
  const lvlProgress = level < LEVELS.length ? (friend - LEVELS[level - 1]) / (LEVELS[level] - LEVELS[level - 1]) : 1;
  const scoreTop = sheet || onb === "hello" || onb === "q1" || onb === "q2" ? 484 : 488;

  const game = <>
    <Room />
    <Push ref={push} still={asleep ? "sleep" : undefined} onTap={wake} />
    {asleep && <div className="snore" aria-hidden><i data-z="z">z</i><i data-z="z">z</i><i data-z="Z">Z</i></div>}
    <TopBar gift={gift} time={time} onGift={() => setTip(t => !t)} onMenu={() => setModal("menu")} onRating={() => setScene("rating")} />
    <div className="scorebar" style={{ top: scoreTop }}>
      <div className="chip" ref={pointsChip}><span className="star-gold" /><span className="t-title gold">{points}</span></div>
      <div className="chip"><span className="t-title">50 место</span></div>
    </div>
    <div className="panel" />
    <div className="friend">
      <div className="track" /><div className="fill" style={{ width: 18 + 326 * lvlProgress }} />
      <img className="star" src="/assets/star-friendship.svg" alt="" /><img className="heart" src="/assets/heart.png" alt="" />
      <span className="lvl t-button">{level}</span><span className="prog t-caption">{level < LEVELS.length ? `${friend - LEVELS[level - 1]}/${LEVELS[level] - LEVELS[level - 1]}` : "макс."}</span>
    </div>
    <div className={`stats ${asleep ? "dim" : ""}`}>{(["sat", "mood", "energy"] as Stat[]).map(k => <StatBar key={k} k={k} v={stats[k]} />)}</div>
    <div className={`actions ${asleep ? "dim" : ""}`}>
      {ACT.map(a => <button key={a.k} className="act" style={{ background: a.bg }} disabled={busy || asleep} onClick={() => onAction(a.k)} aria-label={a.label}>
        <img src={a.icon} alt="" /></button>)}
    </div>
    {bubble && <Bubble top={159} text={bubble} />}

    {tip && (gift === "claim"
      ? <div className="tip claim"><div><p className="t-button">Забирайте подарок</p><p className="t2">Пуш приготовил тебе {giftVal} очков</p></div>
          <Btn kind="white" onClick={async () => { setTip(false); setGift("timer"); setBusy(true); await push.current!.act("gift", ICONS.gift); await flyPlus(giftVal); setPoints(p => p + giftVal); setBusy(false); }}>Забрать</Btn></div>
      : <div className="tip timer" onClick={() => setTip(false)}><p className="t-button">Бонус завтра через {time}</p>
          <p className="t2 gray">Заботься о Пуше сегодня, чтобы получить классный приз завтра</p></div>)}

    {/* онбординг */}
    {onb === "hello" && <Sheet actions={<><Btn fill onClick={() => setOnb("q1")}>Поехали</Btn><Btn kind="secondary" onClick={() => setOnb("howto")}>Пропустить опрос</Btn></>}>
      <span className="t-title">Пуш:</span><span className="t-body">А теперь, чтобы познакомиться ближе, я задам тебе пару вопросов</span></Sheet>}
    {onb === "q1" && <Sheet actions={<><Btn fill onClick={() => setOnb("q2")}>Далее</Btn><Btn kind="secondary" onClick={() => setOnb("q2")}>Пропустить</Btn></>}>
      <span className="t-title">Пуш:</span><span className="t-body gray">Как давно ты в компании, какой по счёту это у тебя юбилей?</span>
      <div className="row">{["1й", "2й", "3й", "4й"].map((l, i) => <button key={l} className={`choice t-button ${choice === i ? "on" : ""}`} onClick={() => setChoice(i)}>{l}</button>)}</div></Sheet>}
    {onb === "q2" && <Sheet actions={<><Btn fill onClick={() => setOnb("howto")}>Далее</Btn><Btn kind="secondary" onClick={() => setOnb("howto")}>Пропустить</Btn></>}>
      <span className="t-title">Пуш:</span><span className="t-body gray">Какие яркие моменты запомнились?</span>
      <textarea className="field" placeholder="Напиши своё" /></Sheet>}
    {onb === "howto" && <Modal top={156}>
      <span className="t-title">Как играть?</span><span className="t-body gray">В игре тебе надо следить<br />за параметрами Пуша и прокачивать дружбу с ним</span>
      <div className="mini-stats">{(["sat", "mood", "energy"] as Stat[]).map(k => <StatBar key={k} k={k} v={0} />)}</div>
      <span className="t-body gray">За каждый параметр отвечает своя кнопка:</span>
      <div className="mini-acts">{ACT.map(a => <div key={a.k} className="act" style={{ background: a.bg }}><img src={a.icon} alt="" /></div>)}</div>
      <span className="t-body gray">В конце дня ты получаешь очки<br />за параметры Пуша — а Дружба увеличивает награду</span>
      <Btn onClick={() => setOnb("info")}>Понял. Далее</Btn></Modal>}
    {onb === "info" && <Modal top={298}>
      <span className="t-title">Как играть?</span>
      <span className="t-body gray">Чем больше очков получаешь, тем выше ты в таблице лидеров и тем выше шанс получить призы по итогам розыгрыша</span>
      <Btn onClick={() => { setOnb(null); setTip(true); }}>Отлично</Btn></Modal>}

    {/* реакции на действия */}
    {sheet === "fact" && <Sheet actions={<><Btn fill onClick={() => setFact(f => f + 1)}>Ещё</Btn><Btn kind="peach" fill onClick={leaveTalk}>Оставить Пуша</Btn></>}>
      <span className="t-title">Пуш:</span><span className="t-body">{FACTS[fact % FACTS.length]}</span></Sheet>}
    {sheet?.startsWith("cd-") && (() => { const k = sheet.slice(3) as Act; return <Sheet actions={k === "talk"
        ? <Btn fill onClick={() => setSheet(null)}>Хорошо</Btn>
        : <><Btn fill onClick={() => { setSheet(null); onAction("talk"); }}>Да</Btn><Btn kind="peach" fill onClick={() => setSheet(null)}>Нет</Btn></>}>
      <span className="t-title">Пуш:</span><span className="t-body">{CD[k]}</span></Sheet>; })()}
    {sheet === "lvl" && <Sheet actions={<Btn fill onClick={() => setSheet(null)}>Ура!</Btn>}>
      <div className="lvlbadge"><span className="t-title">Новый уровень!</span><img className="heart" src="/assets/heart.png" alt="" /><span className="n t-button" style={{ color: "#fff" }}>{level}</span></div>
      <span className="t-body gray">Наша дружба стала крепче! Теперь я буду давать тебе больше очков, друг. Дневной бонус за дружбу: x{String(MULT[level - 2]).replace(".", ",")} → x{String(MULT[level - 1]).replace(".", ",")}</span></Sheet>}

    {modal === "menu" && <Modal top={208}>
      <div className="modal-head"><span className="t-display">Меню</span><button className="close" onClick={() => setModal(null)} aria-label="Закрыть"><img src="/assets/icon-close.svg" alt="" /></button></div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Btn onClick={() => setModal(null)}>Продолжить</Btn>
        <Btn kind="peach" onClick={() => setModal(null)}>Главная</Btn>
        <Btn kind="peach" onClick={() => { setModal(null); setScene("rating"); }}>Рейтинг</Btn>
        <Btn kind="peach" onClick={() => { setModal(null); setScene("faq"); }}>Ответы на вопросы</Btn>
        <Btn kind="peach" onClick={() => setModal("confirm")}>Выход</Btn>
      </div></Modal>}
    {modal === "confirm" && <Modal top={333}>
      <span className="t-title">Уверены, что хотите выйти?</span>
      <div className="row"><Btn kind="peach" className="" onClick={() => { setModal(null); location.reload(); }}><span style={{ width: 113 }}>Да</span></Btn><Btn fill onClick={() => setModal(null)}>Нет</Btn></div></Modal>}
  </>;

  const close = <button className="close" onClick={() => setScene("game")} aria-label="Закрыть"><img src="/assets/icon-close.svg" alt="" /></button>;
  const rating = <div className="page">
    <div className="page-head"><span className="t-display">Рейтинг</span>{close}</div>
    <div className="promo"><p className="t-title">Топ-10 получат призы</p><p className="t-caption">Среди лучших разыграем мерч, айфон, шаурму и доширак</p></div>
    <div className="lb-head"><span style={{ width: 46 }}>Место</span><span style={{ flex: 1 }}>Имя</span><span style={{ width: 60, textAlign: "right" }}>Очки</span></div>
    <div className="lb-list">{Array.from({ length: 12 }, (_, i) => <div key={i} className={`lb-row ${i < 4 ? "prize" : ""}`}>
      <span className="rank t-button">{i < 4 && <img src="/assets/heart.png" alt="" />}<b>{i + 1}</b></span>
      <span className="name t-body">Безмолвная Туманность</span><span className="t-button">20 000</span></div>)}</div>
    <div className="lb-me"><span className="t-button" style={{ width: 46, textAlign: "center" }}>50</span><span className="t-body" style={{ flex: 1 }}>Вы</span><span className="t-button">{points}</span></div>
  </div>;

  const QS = ["Как играть?", "Как получить дополнительные баллы?", "Сколько можно выиграть?", "Как заработать больше баллов?", "Сколько длится игра?", "Какие призы будут разыгрывать?"];
  const faq = <div className="page">
    <div className="page-head"><span className="t-display">Ответы<br />на вопросы</span>{close}</div>
    <div className="faq">{QS.map((q, i) => <button key={q} className="faq-item" onClick={() => setFaqOpen(o => o === i ? -1 : i)}>
      <span className="faq-q t-button"><span>{q}</span><i className={`pm ${faqOpen === i ? "open" : ""}`} /></span>
      {faqOpen === i && <span className="t-body gray">Следи за параметрами Пуша: корми, играй и разговаривай с ним. За каждое действие ты получаешь очки и прокачиваешь дружбу.</span>}
    </button>)}</div>
    <Btn className="bottom-btn" onClick={() => { setScene("game"); setOnb("howto"); }}>Посмотреть обучение ещё раз</Btn>
  </div>;

  return <div className="viewport">
    <nav className="flows" aria-label="Флоу">{FLOWS.map(([k, l]) =>
      <a key={k} href={k ? `?screen=${k}` : "/"} className={(q ?? "") === k ? "on" : ""}>{l}</a>)}
      <hr /><button onClick={() => setClock(c => c + COOLDOWN)}>+6 часов</button><button onClick={newDay}>Новый день</button>
      <span>Дружба {friend} · ур. {level} · ×{String(MULT[level - 1]).replace(".", ",")}</span></nav>
    <div className="screen" ref={screen} style={{ transform: `scale(${scale})` }}>
      {scene === "game" ? game : scene === "rating" ? rating : faq}
    </div>
  </div>;
}
