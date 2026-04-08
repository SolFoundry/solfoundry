export interface User {
  id: string;
  github_id?: string | null;
  username: string;
  email?: string | null;
  avatar_url?: string | null;
  wallet_address?: string | null;
  created_at?: string | null;
}
