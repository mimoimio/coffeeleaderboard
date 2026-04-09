export interface LeaderboardRow {
  user_id: string;
  username: string;
  cups_served: number;
  updated_at: string;
}

export interface RobloxServePayload {
  UserId: string;
  Name: string;
  TotalCupsServed: number;
}