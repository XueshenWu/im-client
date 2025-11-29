import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CheckCircle2, XCircle, AlertCircle, ArrowUpRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface SyncStatusData {
  localSequence: number;
  remoteSequence: number;
  isInSync: boolean;
  lastSyncTime: string | null;
}

export function SyncStatus() {
  const [status, setStatus] = useState<SyncStatusData>({
    localSequence: 0,
    remoteSequence: 0,
    isInSync: false,
    lastSyncTime: null,
  });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchStatus = async () => {
      setLoading(true);
      try {
        const result = await window.electron.invoke('get-sync-status');
        setStatus(result);
      } catch (error) {
        console.error('Failed to fetch sync status:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();

    // Poll for updates every 10 seconds
    const interval = setInterval(fetchStatus, 10000);

    return () => clearInterval(interval);
  }, []);

  const formatLastSync = (timestamp: string | null): string => {
    if (!timestamp) return 'Never synced';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  const getSyncIcon = () => {
    if (loading) return <AlertCircle className="h-5 w-5 text-muted-foreground" />;
    if (status.isInSync) return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    return <XCircle className="h-5 w-5 text-yellow-500" />;
  };

  const getSyncStatusText = () => {
    if (loading) return 'Checking...';
    if (status.isInSync) return 'In Sync';
    const behind = status.remoteSequence - status.localSequence;
    return `${Math.abs(behind)} operation${Math.abs(behind) > 1 ? 's' : ''} behind`;
  };

  return (
    <TooltipProvider>
      <Card className='border-gray-200  hover:shadow-lg transition-shadow' >
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              {getSyncIcon()}
              Sync Status
            </CardTitle>
            <Tooltip>
              <TooltipTrigger asChild>
                <div onClick={() => navigate('/sync')} className="cursor-pointer w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100 transition-colors">
                  <ArrowUpRight className="h-3 w-3 text-gray-600" />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Go to Sync</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <CardDescription className="text-xs sm:text-sm">
            Local synchronization state
          </CardDescription>
        </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Loading sync status...</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-between items-center gap-2">
              <span className="text-xs sm:text-sm font-medium">Status:</span>
              <span className={`text-xs sm:text-sm font-semibold ${status.isInSync ? 'text-green-600' : 'text-yellow-600'}`}>
                {getSyncStatusText()}
              </span>
            </div>

            <div className="flex justify-between items-center gap-2">
              <span className="text-xs sm:text-sm font-medium">Local Sequence:</span>
              <span className="text-xs sm:text-sm">{status.localSequence}</span>
            </div>

            <div className="flex justify-between items-center gap-2">
              <span className="text-xs sm:text-sm font-medium">Remote Sequence:</span>
              <span className="text-xs sm:text-sm">{status.remoteSequence}</span>
            </div>

            <div className="flex justify-between items-center gap-2">
              <span className="text-xs sm:text-sm font-medium">Last Sync:</span>
              <span className="text-xs sm:text-sm text-muted-foreground">
                {formatLastSync(status.lastSyncTime)}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
    </TooltipProvider>
  );
}
