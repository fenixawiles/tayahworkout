import type { Database } from '../database.types'
import { supabase } from './supabase'

export interface Person { id: string; name: string; username: string; code: string }
export interface Relationship { id: string; status: 'pending' | 'accepted'; incoming: boolean; person: Person }
export interface Competition {
  id: string; title: string; startsOn: string; endsOn: string
  status: 'pending' | 'accepted' | 'declined' | 'cancelled'; incoming: boolean
  creator: Person; friend: Person; creatorScore: number; friendScore: number
  creatorToday: string; friendToday: string; expired: boolean
}
export interface CaseReceipt { id: string; status: string; reason?: string; kind?: string; response: string; createdAt: string }
export interface CommunityData {
  relationships: Relationship[]; competitions: Competition[]; blocks: Person[]
  reports: CaseReceipt[]; requests: CaseReceipt[]; restricted: boolean; isModerator: boolean
}
export interface AccountSettings { reminderEnabled: boolean; remindersReady: boolean; deletionReady: boolean }
export interface ModerationCase { id: string; reason?: string; kind?: string; details: string; status: string; created_at: string; person?: Person | null }
export interface ModerationQueue { reports: ModerationCase[]; requests: ModerationCase[] }

export const emptyCommunity: CommunityData = { relationships: [], competitions: [], blocks: [], reports: [], requests: [], restricted: false, isModerator: false }
export const emptyAccountSettings: AccountSettings = { reminderEnabled: false, remindersReady: false, deletionReady: false }

export function normalizeUsername(value: string) { return value.trim().replace(/^@/, '').toLowerCase() }
export function usernameError(value: string) {
  if (!value) return ''
  if (!/^[a-z][a-z0-9_]{2,23}$/.test(normalizeUsername(value))) return 'Use 3–24 letters, numbers, or underscores. Start with a letter.'
  if (['admin', 'administrator', 'moderator', 'momentum', 'support', 'help', 'official', 'security', 'privacy', 'deleted', 'system'].includes(normalizeUsername(value))) return 'This username is reserved. Choose another.'
  return ''
}
export function competitionState(item: Competition) {
  if (item.status === 'cancelled') return 'Ended early'
  if (item.status === 'declined') return 'Declined'
  if (item.status === 'pending') return item.expired ? 'Invitation expired' : 'Invitation pending'
  if (item.creatorToday > item.endsOn && item.friendToday > item.endsOn) return 'Finished'
  if (item.creatorToday < item.startsOn && item.friendToday < item.startsOn) return 'Starts soon'
  return 'In progress'
}

type Functions = Database['public']['Functions']
export async function communityRpc<T extends keyof Functions>(name: T, args: Functions[T]['Args'], demo = false) {
  if (!navigator.onLine) throw new Error('Reconnect to make changes. Your last loaded information is view-only.')
  if (demo || !supabase) throw new Error('Sign in to your account to use friends, challenges, and support. Nothing is sent from this preview.')
  const result = await supabase.rpc(name, args)
  if (result.error) throw new Error(result.error.message)
  return result.data
}

export async function loadCommunity(demo: boolean): Promise<CommunityData> {
  if (demo) return emptyCommunity
  return await communityRpc('get_community', {}) as unknown as CommunityData
}
export async function loadAccountSettings(demo: boolean): Promise<AccountSettings> {
  if (demo) return emptyAccountSettings
  return await communityRpc('get_account_settings', {}) as unknown as AccountSettings
}

export function readableError(error: unknown) { return error instanceof Error ? error.message : 'That didn’t save. Please try again.' }
