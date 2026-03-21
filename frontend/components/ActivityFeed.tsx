'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useInView } from 'react-intersection-observer'
import {
  Clock,
  Trophy,
  GitPullRequest,
  MessageCircle,
  User,
  Award,
  Code,
  DollarSign,
  AlertTriangle,
  Loader2,
  RefreshCw
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { formatDistanceToNow } from 'date-fns'

interface ActivityItem {
  id: string
  type: 'bounty_created' | 'bounty_claimed' | 'bounty_completed' | 'pr_submitted' | 'comment_added' | 'user_joined' | 'payment_processed'
  title: string
  description: string
  user: {
    id: string
    username: string
    avatar_url?: string
  }
  metadata?: {
    bounty_id?: string
    pr_number?: number
    amount?: number
    currency?: string
    repository?: string
  }
  created_at: string
}

interface ActivityFeedProps {
  className?: string
  userId?: string
  repositoryId?: string
  limit?: number
}

const ACTIVITY_ICONS = {
  bounty_created: Trophy,
  bounty_claimed: User,
  bounty_completed: Award,
  pr_submitted: GitPullRequest,
  comment_added: MessageCircle,
  user_joined: User,
  payment_processed: DollarSign
}

const ACTIVITY_COLORS = {
  bounty_created: 'text-yellow-500',
  bounty_claimed: 'text-blue-500',
  bounty_completed: 'text-green-500',
  pr_submitted: 'text-purple-500',
  comment_added: 'text-gray-500',
  user_joined: 'text-indigo-500',
  payment_processed: 'text-emerald-500'
}

export function ActivityFeed({ className, userId, repositoryId, limit = 20 }: ActivityFeedProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const { ref, inView } = useInView({
    threshold: 0,
    rootMargin: '100px'
  })

  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isLoading,
    refetch
  } = useInfiniteQuery({
    queryKey: ['activity-feed', userId, repositoryId],
    queryFn: async ({ pageParam = 0 }) => {
      const params = new URLSearchParams({
        offset: pageParam.toString(),
        limit: limit.toString(),
        ...(userId && { user_id: userId }),
        ...(repositoryId && { repository_id: repositoryId })
      })

      const response = await fetch(`/api/activity?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch activity feed')
      }
      return response.json()
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.activities.length < limit) return undefined
      return allPages.length * limit
    },
    refetchInterval: 30000, // Refresh every 30 seconds for real-time feel
    staleTime: 10000
  })

  const activities = useMemo(() =>
    data?.pages.flatMap(page => page.activities) ?? [],
    [data]
  )

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage])

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    await refetch()
    setIsRefreshing(false)
  }, [refetch])

  const formatTimestamp = useCallback((timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true })
    } catch {
      return 'Unknown time'
    }
  }, [])

  const getUserInitials = useCallback((username: string) => {
    return username.slice(0, 2).toUpperCase()
  }, [])

  const ActivityIcon = useCallback(({ type }: { type: ActivityItem['type'] }) => {
    const IconComponent = ACTIVITY_ICONS[type] || Code
    const colorClass = ACTIVITY_COLORS[type] || 'text-gray-500'

    return (
      <div className={cn(
        'flex items-center justify-center w-8 h-8 rounded-full bg-muted',
        'ring-2 ring-background'
      )}>
        <IconComponent className={cn('w-4 h-4', colorClass)} />
      </div>
    )
  }, [])

  const ActivityMetadata = useCallback(({ metadata, type }: {
    metadata?: ActivityItem['metadata']
    type: ActivityItem['type']
  }) => {
    if (!metadata) return null

    const elements = []

    if (metadata.repository) {
      elements.push(
        <Badge key="repo" variant="outline" className="text-xs">
          {metadata.repository}
        </Badge>
      )
    }

    if (metadata.pr_number) {
      elements.push(
        <Badge key="pr" variant="secondary" className="text-xs">
          PR #{metadata.pr_number}
        </Badge>
      )
    }

    if (metadata.amount && metadata.currency) {
      elements.push(
        <Badge key="amount" variant="default" className="text-xs">
          {metadata.amount} {metadata.currency}
        </Badge>
      )
    }

    return elements.length > 0 ? (
      <div className="flex gap-1 mt-1 flex-wrap">
        {elements}
      </div>
    ) : null
  }, [])

  if (error) {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Activity Feed</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn('w-4 h-4 mr-2', isRefreshing && 'animate-spin')} />
            Refresh
          </Button>
        </div>

        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertTriangle className="w-12 h-12 text-muted-foreground mb-4" />
          <h4 className="text-lg font-medium mb-2">Failed to load activity</h4>
          <p className="text-muted-foreground mb-4">
            Unable to fetch the activity feed. Please try again.
          </p>
          <Button onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={cn('w-4 h-4 mr-2', isRefreshing && 'animate-spin')} />
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Activity Feed</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing || isLoading}
        >
          <RefreshCw className={cn('w-4 h-4 mr-2', (isRefreshing || isLoading) && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start space-x-3 animate-pulse">
              <div className="w-10 h-10 bg-muted rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
                <div className="flex gap-2">
                  <div className="h-5 bg-muted rounded w-16" />
                  <div className="h-5 bg-muted rounded w-12" />
                </div>
              </div>
              <div className="h-3 bg-muted rounded w-20" />
            </div>
          ))}
        </div>
      ) : activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Clock className="w-12 h-12 text-muted-foreground mb-4" />
          <h4 className="text-lg font-medium mb-2">No activity yet</h4>
          <p className="text-muted-foreground">
            Activity will appear here as users interact with bounties and projects.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start space-x-3 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="relative mt-1">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={activity.user.avatar_url} />
                    <AvatarFallback>
                      {getUserInitials(activity.user.username)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1">
                    <ActivityIcon type={activity.type} />
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-sm">
                        <span className="font-semibold">{activity.user.username}</span>{' '}
                        {activity.title}
                      </p>
                      <p className="text-muted-foreground text-sm mt-1 line-clamp-2">
                        {activity.description}
                      </p>
                      <ActivityMetadata metadata={activity.metadata} type={activity.type} />
                    </div>
                    <time
                      className="text-xs text-muted-foreground whitespace-nowrap ml-4"
                      dateTime={activity.created_at}
                    >
                      {formatTimestamp(activity.created_at)}
                    </time>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {hasNextPage && (
            <div ref={ref} className="flex justify-center py-4">
              {isFetchingNextPage ? (
                <div className="flex items-center space-x-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Loading more activities...</span>
                </div>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => fetchNextPage()}
                  disabled={!hasNextPage || isFetching}
                >
                  Load More
                </Button>
              )}
            </div>
          )}

          {isFetching && !isFetchingNextPage && (
            <div className="flex justify-center py-2">
              <div className="flex items-center space-x-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Updating feed...</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
