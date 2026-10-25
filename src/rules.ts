// Механика и математика — по ГДД «Юбиляры» (docs.google.com/document/d/1ou7nhQEKkDQL2PtS4-d8vaEvoT9VpHI3cwVd0_km5ac)
export type Stat = "sat" | "mood" | "energy";
export type Act = "feed" | "play" | "talk";

export const STAT_OF: Record<Act, Stat> = { feed: "sat", play: "mood", talk: "energy" };   // Покормить → Сытость, Поиграть → Настроение, Поговорить → Энергия
export const GAIN = 4;                       // прирост параметра за успешное действие
export const MAX = 100;                      // параметры 0…100
export const DECAY = 5;                      // каждые 24 ч все параметры −5, не ниже 0
export const COOLDOWN = 6 * 3600_000;        // восстановление действия после успешного — 6 ч, у каждого своё
export const DAY = 24 * 3600_000;
export const ACTION_POINTS = 10;             // Победные очки за успешное действие (и при параметре 100)
export const GIFT_BASE = 20;                 // базовые очки ежедневного Подарка
export const MULT = [1.5, 2, 2.5, 3, 3.5];   // множитель Дружбы, уровни 1–5
// ponytail: пороги-заглушки (сколько очков Дружбы накоплено к уровню 1–5) — в ГДД они «в таблице с математикой», её пока нет
export const LEVELS = [0, 10, 30, 60, 100];
export const FRIEND_CAP = LEVELS[LEVELS.length - 1];   // на 5-м уровне очки Дружбы больше не копятся

export const levelOf = (friend: number) => LEVELS.filter(t => friend >= t).length;

/** Подарок = (20 + по 1 очку за каждые полные 10 единиц каждого параметра) × множитель Дружбы, округление вверх */
export const giftPoints = (s: Record<Stat, number>, level: number) =>
  Math.ceil((GIFT_BASE + (Object.values(s) as number[]).reduce((a, v) => a + Math.floor(v / 10), 0)) * MULT[level - 1]);

// пример из ГДД: Настроение 23, Сытость 35, Энергия 14, ×2 → (20 + 6) × 2 = 52
console.assert(giftPoints({ mood: 23, sat: 35, energy: 14 }, 2) === 52, "giftPoints: пример из ГДД");
