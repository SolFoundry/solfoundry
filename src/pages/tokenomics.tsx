'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, AreaChart, Area } from 'recharts'
import { TrendingUp, DollarSign, Users, Lock, ArrowRight, Coins, BarChart3, Shield, Target } from 'lucide-react'

const distributionData = [
  { name: 'Ecosystem', value: 35, color: '#3B82F6' },
  { name: 'Team & Advisors', value: 15, color: '#10B981' },
  { name: 'Public Sale', value: 25, color: '#F59E0B' },
  { name: 'Private Sale', value: 15, color: '#EF4444' },
  { name: 'Treasury', value: 10, color: '#8B5CF6' }
]

const priceData = [
  { time: '00:00', price: 0.85, volume: 1200000 },
  { time: '04:00', price: 0.92, volume: 1800000 },
  { time: '08:00', price: 0.88, volume: 1500000 },
  { time: '12:00', price: 0.95, volume: 2100000 },
  { time: '16:00', price: 1.12, volume: 2800000 },
  { time: '20:00', price: 1.08, volume: 2200000 },
  { time: '24:00', price: 1.15, volume: 1900000 }
]

const treasuryStats = [
  { label: 'Total Treasury', value: '$12.5M', change: '+8.2%' },
  { label: 'Staking Rewards Pool', value: '$8.2M', change: '+12.1%' },
  { label: 'Development Fund', value: '$3.1M', change: '+5.7%' },
  { label: 'Marketing Fund', value: '$1.2M', change: '+15.3%' }
]

const tokenMetrics = [
  { label: 'Total Supply', value: '100,000,000 VAULT' },
  { label: 'Circulating Supply', value: '45,000,000 VAULT' },
  { label: 'Market Cap', value: '$51.75M' },
  { label: 'Fully Diluted Valuation', value: '$115M' }
]

export default function TokenomicsPage() {
  const [activeTab, setActiveTab] = useState('distribution')

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-xl">
          <p className="text-white font-medium">{`${payload[0].name}: ${payload[0].value}%`}</p>
        </div>
      )
    }
    return null
  }

  const PriceTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-xl">
          <p className="text-white font-medium">{`Time: ${label}`}</p>
          <p className="text-blue-400">{`Price: $${payload[0].value}`}</p>
          <p className="text-green-400">{`Volume: $${payload[1]?.value?.toLocaleString()}`}</p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black text-white pt-20">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
            Tokenomics
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Discover the economic model behind VAULT token, designed for sustainable growth and community value
          </p>
        </motion.div>

        {/* Token Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 rounded-2xl p-8 mb-12 border border-gray-700"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {tokenMetrics.map((metric, index) => (
              <div key={index} className="text-center">
                <p className="text-gray-400 text-sm mb-2">{metric.label}</p>
                <p className="text-2xl font-bold text-white">{metric.value}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Current Price & Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-1"
          >
            <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">VAULT Token</h3>
                <div className="flex items-center text-green-400">
                  <TrendingUp className="w-4 h-4 mr-1" />
                  +12.5%
                </div>
              </div>
              <div className="mb-6">
                <p className="text-3xl font-bold text-white mb-1">$1.15</p>
                <p className="text-gray-400">+$0.13 (24h)</p>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">24h Volume</span>
                  <span className="text-white">$2.8M</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">24h High</span>
                  <span className="text-white">$1.18</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">24h Low</span>
                  <span className="text-white">$0.85</span>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-2"
          >
            <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700">
              <h3 className="text-xl font-bold mb-6">Price Chart (24h)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={priceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="time" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip content={<PriceTooltip />} />
                  <Area type="monotone" dataKey="price" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap justify-center mb-8">
          {[
            { id: 'distribution', label: 'Token Distribution', icon: BarChart3 },
            { id: 'buyback', label: 'Buyback Mechanics', icon: Target },
            { id: 'treasury', label: 'Treasury Stats', icon: Shield }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center px-6 py-3 mr-4 mb-4 rounded-lg font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <tab.icon className="w-5 h-5 mr-2" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'distribution' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16"
          >
            <div className="bg-gray-800/50 rounded-2xl p-8 border border-gray-700">
              <h3 className="text-2xl font-bold mb-6">Token Distribution</h3>
              <ResponsiveContainer width="100%" height={400}>
                <PieChart>
                  <Pie
                    data={distributionData}
                    cx="50%"
                    cy="50%"
                    outerRadius={120}
                    innerRadius={60}
                    dataKey="value"
                    strokeWidth={2}
                    stroke="#1F2937"
                  >
                    {distributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-gray-800/50 rounded-2xl p-8 border border-gray-700">
              <h3 className="text-2xl font-bold mb-6">Supply Breakdown</h3>
              <div className="space-y-6">
                {distributionData.map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div 
                        className="w-4 h-4 rounded-full mr-3"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-gray-300">{item.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-medium">{item.value}%</p>
                      <p className="text-sm text-gray-400">{(item.value * 1000000).toLocaleString()} VAULT</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'buyback' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-16"
          >
            <div className="bg-gray-800/50 rounded-2xl p-8 border border-gray-700">
              <h3 className="text-2xl font-bold mb-8">Buyback & Burn Mechanics</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="text-center">
                  <div className="bg-blue-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <DollarSign className="w-8 h-8" />
                  </div>
                  <h4 className="text-xl font-bold mb-2">Revenue Collection</h4>
                  <p className="text-gray-400">30% of platform revenue allocated to buyback program</p>
                </div>
                
                <div className="text-center">
                  <div className="bg-green-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Coins className="w-8 h-8" />
                  </div>
                  <h4 className="text-xl font-bold mb-2">Token Buyback</h4>
                  <p className="text-gray-400">Tokens purchased from open market weekly</p>
                </div>
                
                <div className="text-center">
                  <div className="bg-red-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Lock className="w-8 h-8" />
                  </div>
                  <h4 className="text-xl font-bold mb-2">Burn Mechanism</h4>
                  <p className="text-gray-400">50% burned, 50% redistributed to stakers</p>
                </div>
              </div>
              
              <div className="mt-8 p-6 bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-xl border border-gray-600">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-300">Total Burned to Date</p>
                    <p className="text-2xl font-bold text-white">2,500,000 VAULT</p>
                  </div>
                  <div>
                    <p className="text-gray-300">Next Buyback</p>
                    <p className="text-lg font-medium text-blue-400">In 3 days</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'treasury' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-16"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {treasuryStats.map((stat, index) => (
                <div key={index} className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700">
                  <p className="text-gray-400 text-sm mb-2">{stat.label}</p>
                  <p className="text-2xl font-bold text-white mb-1">{stat.value}</p>
                  <p className="text-green-400 text-sm">{stat.change}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Utility Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 rounded-2xl p-8 border border-gray-700"
        >
          <h3 className="text-2xl font-bold mb-6">Token Utility</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-600">
              <Users className="w-8 h-8 text-blue-400 mb-3" />
              <h4 className="text-lg font-bold mb-2">Governance Rights</h4>
              <p className="text-gray-400">Vote on protocol upgrades and treasury allocation</p>
            </div>
            
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-600">
              <TrendingUp className="w-8 h-8 text-green-400 mb-3" />
              <h4 className="text-lg font-bold mb-2">Staking Rewards</h4>
              <p className="text-gray-400">Earn up to 15% APY by staking VAULT tokens</p>
            </div>
            
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-600">
              <Shield className="w-8 h-8 text-purple-400 mb-3" />
              <h4 className="text-lg font-bold mb-2">Platform Access</h4>
              <p className="text-gray-400">Reduced fees and premium features</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}