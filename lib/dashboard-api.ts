import { ApiResponse } from '@/types/api'
import { User, Bounty, Earning, Activity, Notification } from '@/types/dashboard'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api'

export interface UserStats {
  totalEarnings: number
  completedBounties: number
  activeBounties: number
  reputation: number
  rank: string
  completionRate: number
}

export interface DashboardFilters {
  dateRange?: 'week' | 'month' | 'quarter' | 'year'
  status?: 'active' | 'completed' | 'pending'
  category?: string
  limit?: number
  offset?: number
}

export async function fetchUserStats(userId: string): Promise<ApiResponse<UserStats>> {
  try {
    const response = await fetch(`${API_BASE}/dashboard/stats/${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch user stats: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch user stats'
    }
  }
}

export async function fetchActiveBounties(
  userId: string, 
  filters: DashboardFilters = {}
): Promise<ApiResponse<Bounty[]>> {
  try {
    const params = new URLSearchParams({
      userId,
      ...Object.fromEntries(
        Object.entries(filters).map(([key, value]) => [key, String(value)])
      )
    })

    const response = await fetch(`${API_BASE}/dashboard/bounties/active?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch active bounties: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch active bounties'
    }
  }
}

export async function fetchEarningsHistory(
  userId: string,
  filters: DashboardFilters = {}
): Promise<ApiResponse<Earning[]>> {
  try {
    const params = new URLSearchParams({
      userId,
      ...Object.fromEntries(
        Object.entries(filters).map(([key, value]) => [key, String(value)])
      )
    })

    const response = await fetch(`${API_BASE}/dashboard/earnings?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch earnings history: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch earnings history'
    }
  }
}

export async function fetchActivityFeed(
  userId: string,
  filters: DashboardFilters = {}
): Promise<ApiResponse<Activity[]>> {
  try {
    const params = new URLSearchParams({
      userId,
      limit: String(filters.limit || 20),
      offset: String(filters.offset || 0),
      ...(filters.dateRange && { dateRange: filters.dateRange })
    })

    const response = await fetch(`${API_BASE}/dashboard/activity?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch activity feed: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch activity feed'
    }
  }
}

export async function fetchNotifications(
  userId: string,
  unreadOnly: boolean = false
): Promise<ApiResponse<Notification[]>> {
  try {
    const params = new URLSearchParams({
      userId,
      ...(unreadOnly && { unread: 'true' })
    })

    const response = await fetch(`${API_BASE}/dashboard/notifications?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch notifications: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch notifications'
    }
  }
}

export async function markNotificationAsRead(notificationId: string): Promise<ApiResponse<void>> {
  try {
    const response = await fetch(`${API_BASE}/dashboard/notifications/${notificationId}/read`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to mark notification as read: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to mark notification as read'
    }
  }
}

export async function markAllNotificationsAsRead(userId: string): Promise<ApiResponse<void>> {
  try {
    const response = await fetch(`${API_BASE}/dashboard/notifications/read-all`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
      },
      body: JSON.stringify({ userId })
    })

    if (!response.ok) {
      throw new Error(`Failed to mark all notifications as read: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to mark all notifications as read'
    }
  }
}