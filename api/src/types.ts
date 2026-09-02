export type Locale = "en" | "zh-CN";

export type AuthContext = {
  userId: string;
  deviceId: string;
};

export type PublicLeader = {
  userId: string;
  nickname: string;
  maskedEmail: string;
  avatarId: number;
  creditedSeconds: number;
  activeStartedAt: string | null;
};

export type PublicSnapshot = {
  asOf: string;
  sales: {
    grossCnyEstimate: number;
    paidUnits: number;
    reportThrough: string | null;
    estimated: true;
  };
  leaderboard: PublicLeader[];
};

export type Profile = {
  id: string;
  email: string | null;
  maskedEmail: string | null;
  emailVerified: boolean;
  nickname: string;
  avatarId: number;
  totalSeconds: number;
  activeStartedAt: string | null;
};

