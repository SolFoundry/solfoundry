'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { 
  DollarSign, 
  Trophy, 
  Clock, 
  TrendingUp, 
  Bell, 
  Plus, 
  Eye, 
  GitBranch,
  Star,
  Calendar,
  ArrowRight,
  Target,
  Award
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts'

const summaryData = {
  totalEarnings: 2450.75,
  activeBounties: 8,
  completedBounties: 23,
  winRate: 76
}

const earningsData = [
  { month: 'Jan', earnings: 400 },
  { month: 'Feb', earnings: 600 },
  { month: 'Mar', earnings: 800 },
  { month: 'Apr', earnings: 1200 },
  { month: 'May', earnings: 950 },
  { month: 'Jun', earnings: 1400 }
]

const bountyData = [
  { month: 'Jan', completed: 2, active: 3 },
  { month: 'Feb', completed: 4, active: 2 },
  { month: 'Mar', completed: 3, active: 4 },
  { month: 'Apr', completed: 6, active: 3 },
  { month: 'May', completed: 5, active: 4 },
  { month: 'Jun', completed: 7, active: 2 }
]

const activeBounties = [
  {
    id: 1,
    title: "Fix authentication bug in user dashboard",
    reward: 250,
    difficulty: "Medium",
    deadline: "2024-01-15",
    status: "In Progress",
    company: "TechCorp",
    tags: ["React", "Authentication", "Bug Fix"]
  },
  {
    id: 2,
    title: "Implement dark mode toggle component",
    reward: 150,
    difficulty: "Easy",
    deadline: "2024-01-20",
    status: "Available",
    company: "DesignCo",
    tags: ["CSS", "React", "UI"]
  },
  {
    id: 3,
    title: "Optimize database query performance",
    reward: 400,
    difficulty: "Hard",
    deadline: "2024-01-25",
    status: "In Review",
    company: "DataSoft",
    tags: ["SQL", "Performance", "Backend"]
  }
]

const recentActivity = [
  {
    id: 1,
    type: "bounty_completed",
    title: "API Integration Enhancement",
    reward: 300,
    timestamp: "2 hours ago",
    status: "approved"
  },
  {
    id: 2,
    type: "bounty_started",
    title: "Mobile App Bug Fix",
    reward: 200,
    timestamp: "1 day ago",
    status: "in_progress"
  },
  {
    id: 3,
    type: "payout_received",
    title: "Payment processed",
    reward: 450,
    timestamp: "3 days ago",
    status: "completed"
  },
  {
    id: 4,
    type: "bounty_submitted",
    title: "Frontend Component Update",
    reward: 175,
    timestamp: "5 days ago",
    status: "under_review"
  }
]

const notifications = [
  {
    id: 1,
    type: "new_bounty",
    title: "New bounty matches your skills",
    message: "React Developer needed for e-commerce platform",
    timestamp: "30 minutes ago",
    read: false
  },
  {
    id: 2,
    type: "bounty_approved",
    title: "Your submission was approved!",
    message: "Payment of $300 has been processed",
    timestamp: "2 hours ago",
    read: false
  },
  {
    id: 3,
    type: "deadline_reminder",
    title: "Bounty deadline approaching",
    message: "Authentication bug fix due in 2 days",
    timestamp: "1 day ago",
    read: true
  }
]

export default function Dashboard() {
  const [selectedTab, setSelectedTab] = useState("overview")

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'easy': return 'bg-green-100 text-green-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'hard': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'available': return 'bg-blue-100 text-blue-800'
      case 'in progress': return 'bg-purple-100 text-purple-800'
      case 'in review': return 'bg-orange-100 text-orange-800'
      case 'completed': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'bounty_completed': return <Trophy className="h-4 w-4 text-green-600" />
      case 'bounty_started': return <GitBranch className="h-4 w-4 text-blue-600" />
      case 'payout_received': return <DollarSign className="h-4 w-4 text-green-600" />
      case 'bounty_submitted': return <Eye className="h-4 w-4 text-orange-600" />
      default: return <Star className="h-4 w-4 text-gray-600" />
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Welcome back! Here's your bounty hunting progress.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifications
            {notifications.filter(n => !n.read).length > 0 && (
              <Badge variant="destructive" className="ml-1">
                {notifications.filter(n => !n.read).length}
              </Badge>
            )}
          </Button>
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Browse Bounties
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${summaryData.totalEarnings}</div>
            <p className="text-xs text-muted-foreground">
              <TrendingUp className="inline h-3 w-3 mr-1" />
              +12% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Bounties</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryData.activeBounties}</div>
            <p className="text-xs text-muted-foreground">
              3 in progress, 5 available
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Bounties</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryData.completedBounties}</div>
            <p className="text-xs text-muted-foreground">
              +3 this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryData.winRate}%</div>
            <p className="text-xs text-muted-foreground">
              Above average (68%)
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="bounties">My Bounties</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Earnings Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Earnings Overview</CardTitle>
                <CardDescription>Your earnings over the last 6 months</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={earningsData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`$${value}`, 'Earnings']} />
                    <Line 
                      type="monotone" 
                      dataKey="earnings" 
                      stroke="#2563eb" 
                      strokeWidth={2}
                      dot={{ fill: '#2563eb', r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>Your latest bounty activities</CardDescription>
                </div>
                <Button variant="ghost" size="sm">
                  View All <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {recentActivity.slice(0, 4).map((activity) => (
                  <div key={activity.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                    <div className="flex-shrink-0">
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {activity.title}
                      </p>
                      <p className="text-xs text-gray-500">{activity.timestamp}</p>
                    </div>
                    <div className="text-sm font-semibold text-green-600">
                      ${activity.reward}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common tasks and shortcuts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Button variant="outline" className="h-20 flex-col gap-2">
                  <Plus className="h-5 w-5" />
                  Find Bounties
                </Button>
                <Button variant="outline" className="h-20 flex-col gap-2">
                  <Eye className="h-5 w-5" />
                  View Submissions
                </Button>
                <Button variant="outline" className="h-20 flex-col gap-2">
                  <DollarSign className="h-5 w-5" />
                  Earnings Report
                </Button>
                <Button variant="outline" className="h-20 flex-col gap-2">
                  <Bell className="h-5 w-5" />
                  Notifications
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bounties" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Active Bounties</CardTitle>
                <CardDescription>Bounties you're currently working on or can apply for</CardDescription>
              </div>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Browse More
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activeBounties.map((bounty) => (
                  <div key={bounty.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg mb-1">{bounty.title}</h3>
                        <p className="text-sm text-gray-600 mb-2">by {bounty.company}</p>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {bounty.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-green-600 mb-1">
                          ${bounty.reward}
                        </div>
                        <Badge className={getDifficultyColor(bounty.difficulty)}>
                          {bounty.difficulty}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          Due: {new Date(bounty.deadline).toLocaleDateString()}
                        </div>
                        <Badge className={getStatusColor(bounty.status)}>
                          {bounty.status}
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4 mr-1" />
                          View Details
                        </Button>
                        {bounty.status === 'Available' && (
                          <Button size="sm">
                            Apply Now
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Bounty Completion Trends</CardTitle>
                <CardDescription>Completed vs Active bounties over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={bountyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="completed" fill="#10b981" name="Completed" />
                    <Bar dataKey="active" fill="#3b82f6" name="Active" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
                <CardDescription>Your key performance indicators</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium">Average Completion Time</span>
                  <span className="font-bold">4.2 days</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium">Success Rate</span>
                  <span className="font-bold text-green-600">76%</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium">Average Reward</span>
                  <span className="font-bold">$218</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium">Total Projects</span>
                  <span className="font-bold">31</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="activity" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Activity Feed</CardTitle>
                  <CardDescription>Your complete bounty activity history</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {recentActivity.map((activity) => (
                      <div key={activity.id} className="flex items-start gap-4 p-4 border rounded-lg">
                        <div className="flex-shrink-0 mt-1">
                          {getActivityIcon(activity.type)}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{activity.title}</h4>
                          <p className="text-sm text-gray-600 mt-1">
                            Reward: <span className="font-semibold text-green-600">${activity.reward}</span>
                          </p>
                          <p className="text-xs text-gray-500 mt-2">{activity.timestamp}</p>
                        </div>
                        <Badge className={getStatusColor(activity.status)}>
                          {activity.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div>
              <Card>
                <CardHeader>
                  <CardTitle>Notifications</CardTitle>
                  <CardDescription>Stay updated with latest news</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {notifications.map((notification) => (
                      <div 
                        key={notification.id} 
                        className={`p-3 rounded-lg border-l-4 ${
                          !notification.read 
                            ? 'bg-blue-50 border-blue-400' 
                            : 'bg-gray-50 border-gray-300'
                        }`}
                      >
                        <h5 className={`text-sm font-medium ${
                          !notification.read ? 'text-blue-900' : 'text-gray-900'
                        }`}>
                          {notification.title}
                        </h5>
                        <p className="text-xs text-gray-600 mt-1">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-500 mt-2">
                          {notification.timestamp}
                        </p>
                      </div>
                    ))}
                  </div>
                  <Button variant="ghost" className="w-full mt-4">
                    View All Notifications
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}