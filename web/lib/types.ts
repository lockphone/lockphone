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

