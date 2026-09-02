import type { PublicSnapshot } from "./types";

const now = Date.now();

export const demoSnapshot: PublicSnapshot = {
  asOf: new Date(now).toISOString(),
  sales: {
    grossCnyEstimate: 1286.42,
    paidUnits: 421,
    reportThrough: new Date(now - 86_400_000).toISOString(),
    estimated: true,
  },
  leaderboard: [
    ["Morrow", "mo***@icloud.com", 38, 912_248, now - 7_231_000],
    ["Yun", "yu***@gmail.com", 119, 842_913, now - 3_902_000],
    ["Quiet North", "qi***@outlook.com", 7, 729_312, null],
    ["Rin", "ri***@hey.com", 164, 688_020, now - 1_239_000],
    ["Kite", "ki***@gmail.com", 82, 612_744, null],
    ["Moss", "mo***@qq.com", 142, 578_289, now - 982_000],
  ].map(([nickname, maskedEmail, avatarId, creditedSeconds, activeStartedAt], index) => ({
    userId: `demo-${index}`,
    nickname: String(nickname),
    maskedEmail: String(maskedEmail),
    avatarId: Number(avatarId),
    creditedSeconds: Number(creditedSeconds),
    activeStartedAt: activeStartedAt ? new Date(Number(activeStartedAt)).toISOString() : null,
  })),
};

