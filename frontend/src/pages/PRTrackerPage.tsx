/** PRTrackerPage -- page entry for PR tracker. @module PRTrackerPage */
import { PRStatusTracker } from '../components/pr-tracker';
import { PRStatusList } from '../components/pr-tracker/PRStatusList';
import { usePRStatus } from '../hooks/usePRStatus';
import { mockPRStatuses } from '../data/mockPRStatus';
/** Page component: detail or list view based on URL. */
export function PRTrackerPage(){
  const id=typeof window!=='undefined'?window.location.pathname.match(/\/pr-tracker\/(.+)/)?.[1]:undefined;
  const{prStatus,isLoading,error,isConnected}=usePRStatus({prStatusId:id});
  if(id)return(<div className="mx-auto max-w-4xl space-y-6 p-6">
    <div className="flex items-center justify-between"><h1 className="text-2xl font-bold text-white">PR Review Status</h1>
      {isConnected&&<span className="text-xs text-green-400">Live</span>}</div>
    {isLoading&&<div className="flex justify-center py-20" data-testid="loading-state"><div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent"/></div>}
    {error&&<div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400" role="alert">{error}</div>}
    {prStatus&&!isLoading&&<PRStatusTracker prStatus={prStatus}/>}</div>);
  return(<div className="mx-auto max-w-4xl space-y-6 p-6">
    <div><h1 className="text-2xl font-bold text-white">PR Review Pipeline</h1>
      <p className="mt-1 text-sm text-gray-400">Track submissions through the review pipeline in real time.</p></div>
    <PRStatusList statuses={mockPRStatuses}/></div>);
}
