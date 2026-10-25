import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { initPush } from "./engine/push.js";

// Ролики Пуша: VP9 с альфой (Chrome) + HEVC с альфой (Safari). Все начинаются/кончаются в позе ожидания.
export type Clip = "idle" | "feed" | "play" | "talk" | "wake" | "sleep" | "gift" | "levelup";
// согласовано клиентом: бургер; остальное — стикеры как есть или черновики до согласования
const FILES: Record<Clip, string> = { idle: "idle_tongue", feed: "burger_v3", play: "dance", talk: "think_loop", wake: "wake_cheeky", sleep: "sleep_breath", gift: "gift", levelup: "levelup" };

const img = (src: string) => Object.assign(new Image(), { src });
export const ICONS = {
  feed: img("/assets/icon-burger.png"),
  play: img("/assets/icon-ball.png"),
  talk: img("/assets/icon-talk.png"),
  heart: img("/assets/heart.png"),
  gift: img("/assets/gift.png"),
};

function makeVideo(name: string, loop: boolean) {
  const v = document.createElement("video");
  v.muted = true; v.playsInline = true; v.preload = "auto"; v.loop = loop;
  v.innerHTML = `<source src="/video/${name}.mov" type='video/mp4; codecs="hvc1"'><source src="/video/${name}.webm" type="video/webm">`;
  return v;
}

export type PushHandle = {
  /** проиграть ролик действия один раз: «пуф» с иконками → ролик → «пуф» с сердечками обратно в ожидание */
  act(clip: Exclude<Clip, "idle" | "talk" | "sleep">, icon: HTMLImageElement): Promise<void>;
  /** уйти в зацикленный ролик (разговор) */
  loop(clip: Clip, icon: HTMLImageElement): Promise<void>;
  /** вернуться в ожидание с сердечками */
  idle(): Promise<void>;
};

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Живой Пуш на canvas. still — статичный кадр вместо ролика ожидания (сон). */
export const Push = forwardRef<PushHandle, { still?: string; onTap?: () => void }>(function Push({ still, onTap }, ref) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const eng = useRef<any>(null);
  const vids = useRef<Record<Clip, HTMLVideoElement> | null>(null);

  useEffect(() => {
    const v = { idle: makeVideo(FILES.idle, true), feed: makeVideo(FILES.feed, false), play: makeVideo(FILES.play, false), talk: makeVideo(FILES.talk, true), wake: makeVideo(FILES.wake, false), sleep: makeVideo(FILES.sleep, true), gift: makeVideo(FILES.gift, false), levelup: makeVideo(FILES.levelup, false) };
    vids.current = v;
    const start = still === "sleep" ? v.sleep : still ? img(still) : v.idle;
    const go = () => { eng.current = initPush({ canvas: canvas.current, video: start, shadow: "rgb(120, 45, 25)", reflect: false }); };
    if (start instanceof HTMLImageElement) start.onload = go; else go();
    return () => { eng.current?.destroy(); Object.values(v).forEach(x => x.pause()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);   // still читаем только при монтировании: пробуждение уводит со статичного кадра роликом, без пересоздания

  const toIdle = async () => {
    const v = vids.current!, cur = eng.current.video as HTMLVideoElement;
    v.idle.currentTime = 0; await v.idle.play().catch(() => {});
    eng.current.setVideo(v.idle, "poof", ICONS.heart);
    if (cur !== v.idle) cur.pause?.();
  };

  useImperativeHandle(ref, () => ({
    async act(clip, icon) {
      const v = vids.current!, c = v[clip];
      c.currentTime = 0; await c.play().catch(() => {});
      const prev = eng.current.video; eng.current.setVideo(c, "poof", icon); prev.pause?.();
      await new Promise<void>(res => { c.onended = () => res(); });
      await toIdle(); await sleep(500);
    },
    async loop(clip, icon) {
      const v = vids.current!, c = v[clip];
      c.currentTime = 0; await c.play().catch(() => {});
      const prev = eng.current.video; eng.current.setVideo(c, "poof", icon); prev.pause?.(); await sleep(250);
    },
    async idle() { await toIdle(); await sleep(500); },
  }));

  return <canvas ref={canvas} className="push-canvas" onClick={onTap} aria-label="Пуш" />;
});
