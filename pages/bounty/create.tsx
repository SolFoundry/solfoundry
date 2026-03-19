import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { NextPage } from 'next'
import { useUser } from '@auth0/nextjs-auth0/client'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import BountyCreationWizard from '@/components/bounty/BountyCreationWizard'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Wallet, Shield } from 'lucide-react'

const CreateBountyPage: NextPage = () => {
  const { user, isLoading: userLoading } = useUser()
  const { connected, connecting } = useWallet()
  const router = useRouter()
  const [showWizard, setShowWizard] = useState(false)

  useEffect(() => {
    // Auto-show wizard if all requirements are met
    if (user && connected && !userLoading && !connecting) {
      setShowWizard(true)
    }
  }, [user, connected, userLoading, connecting])

  const handleBackToHome = () => {
    router.push('/')
  }

  if (userLoading || connecting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600">Initializing bounty creation...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4">
        <div className="max-w-2xl mx-auto pt-20">
          <Button 
            variant="ghost" 
            onClick={handleBackToHome}
            className="mb-8 hover:bg-gray-200"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
          
          <Card className="shadow-lg">
            <CardHeader className="text-center pb-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-blue-600" />
              </div>
              <CardTitle className="text-2xl">Authentication Required</CardTitle>
              <CardDescription className="text-lg">
                You need to be signed in to create bounties
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-gray-600 mb-6">
                Creating bounties requires user authentication to ensure secure transactions 
                and proper attribution of rewards.
              </p>
              <Button 
                onClick={() => router.push('/api/auth/login')}
                size="lg"
                className="w-full sm:w-auto"
              >
                Sign In to Continue
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (!connected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4">
        <div className="max-w-2xl mx-auto pt-20">
          <Button 
            variant="ghost" 
            onClick={handleBackToHome}
            className="mb-8 hover:bg-gray-200"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
          
          <Card className="shadow-lg">
            <CardHeader className="text-center pb-6">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Wallet className="w-8 h-8 text-purple-600" />
              </div>
              <CardTitle className="text-2xl">Wallet Connection Required</CardTitle>
              <CardDescription className="text-lg">
                Connect your Solana wallet to create bounties
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-gray-600 mb-6">
                A connected wallet is required to fund bounties and handle reward distributions. 
                Your wallet will be used to sign transactions securely.
              </p>
              
              <Alert className="mb-6 text-left">
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  <strong>Security Note:</strong> We never store your private keys. 
                  All transactions are signed directly through your wallet.
                </AlertDescription>
              </Alert>
              
              <div className="flex justify-center">
                <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-700" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <Button 
              variant="ghost" 
              onClick={handleBackToHome}
              className="mb-4 hover:bg-gray-200"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
            
            <div className="text-center">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Create New Bounty
              </h1>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Set up a bounty to incentivize contributions to your project. 
                Define requirements, set rewards, and let the community help you build.
              </p>
            </div>
          </div>

          {showWizard ? (
            <BountyCreationWizard />
          ) : (
            <Card className="shadow-lg">
              <CardContent className="p-8 text-center">
                <LoadingSpinner size="lg" />
                <p className="mt-4 text-gray-600">Preparing bounty creation wizard...</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

export default CreateBountyPage