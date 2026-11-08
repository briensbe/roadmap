export type User = {
  id: string;
  email?: string;
  phone?: string;
  user_metadata: {
    displayName?: string;
  };
};

export type SignupPayload = {
  name: string;
  email: string;
  password: string;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type RoadmapRole = 'viewer' | 'editor' | 'admin';

export interface RoadmapUserProfile {
  id: string;
  email?: string | null;
  role: RoadmapRole;
  created_at?: string;
  updated_at?: string;
}
