export type UserRole = 'creator' | 'approver' | 'admin' | 'super_admin'
export type Tone = 'professional' | 'casual' | 'witty' | 'informative' | 'inspirational'
export type Platform = 'facebook' | 'twitter' | 'linkedin'
export type FacebookProvider = 'buffer' | 'facebook_api'
export type TwitterProvider = 'buffer' | 'twitter_api'
export type LinkedInProvider = 'buffer' | 'linkedin_api'
export type PublishingProvider = 'buffer' | 'facebook_api' | 'twitter_api' | 'linkedin_api'
export type BriefStatus = 'pending_generation' | 'generated' | 'in_review' | 'approved' | 'rejected'
export type PostStatus = 'pending_review' | 'approved' | 'rejected' | 'scheduled' | 'published'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  avatar_url: string | null
  facebook_provider?: FacebookProvider
  twitter_provider?: TwitterProvider
  linkedin_provider?: LinkedInProvider
  created_at: string
  updated_at: string
}

export interface Brief {
  id: string
  user_id: string
  topic: string
  description: string | null
  tone: Tone
  platforms: Platform[]
  target_date: string | null
  status: BriefStatus
  created_at: string
  updated_at: string
  // joined
  profile?: Profile
}

export interface Post {
  id: string
  brief_id: string
  user_id: string
  platform: Platform
  variant_index: number
  content: string
  status: PostStatus
  reviewed_by: string | null
  reviewed_at: string | null
  reviewer_note: string | null
  scheduled_at: string | null
  published_at: string | null
  buffer_post_id: string | null
  facebook_post_id?: string | null
  twitter_post_id?: string | null
  linkedin_post_id?: string | null
  published_provider?: PublishingProvider | null
  metrics?: {
    reactions?: number
    clicks?: number
    reposts?: number
    comments?: number
    updated_at?: string
  }
  created_at: string
  updated_at: string
  // joined
  brief?: Brief
  profile?: Profile
  reviewer?: Profile
}

export interface BufferConnection {
  id: string
  user_id: string
  access_token: string
  profile_ids: {
    facebook?: string
    twitter?: string
    linkedin?: string
  }
  connected_at: string
  updated_at: string
}

export interface FacebookConnection {
  id: string
  user_id: string
  access_token: string
  page_id: string
  page_name: string | null
  page_access_token: string
  connected_at: string
  updated_at: string
}

export interface TwitterConnection {
  id: string
  user_id: string
  access_token: string
  refresh_token?: string | null
  expires_at?: string | null
  twitter_user_id?: string | null
  twitter_username?: string | null
  connected_at: string
  updated_at: string
}

export interface LinkedInConnection {
  id: string
  user_id: string
  access_token: string
  refresh_token?: string | null
  expires_at?: string | null
  account_id: string // person URN or organization URN
  account_name: string | null
  account_type: 'organization' | 'person'
  connected_at: string
  updated_at: string
}

// API response wrappers
export interface ApiSuccess<T> {
  data: T
  error: null
}

export interface ApiError {
  data: null
  error: string
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError

