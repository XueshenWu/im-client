import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useSettingsStore } from '@/stores/settingsStore';
import { getImageStats } from '@/services/images.service';
import {ArrowUpRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Stats {
  totalCount: number;
  totalSize: number;
}

export function StatsCards() {
  const [stats, setStats] = useState<Stats>({ totalCount: 0, totalSize: 0 });
  const [loading, setLoading] = useState(true);
  const sourceMode = useSettingsStore((state) => state.sourceMode);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        if (sourceMode === 'cloud') {
          // Fetch from cloud API
          const data = await getImageStats();
          setStats({
            totalCount: data.totalCount,
            totalSize: data.totalSize,
          });
        } else {
          // Fetch from local database via IPC
          const result = await window.electron.invoke('get-image-stats');
          setStats(result);
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
        setStats({ totalCount: 0, totalSize: 0 });
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [sourceMode]);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  return (
    <TooltipProvider>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 *:border-gray-200 dark:*:border-gray-600">
        <Card className=" hover:shadow-lg transition-shadow" >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xl font-semibold dark:text-gray-300">Total Images</CardTitle>
            <div className="flex items-center gap-2">
            
              <Tooltip>
                <TooltipTrigger asChild>
                  <div onClick={() => navigate('/gallery')} className="cursor-pointer w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100 transition-colors dark:hover:bg-gray-600">
                    <ArrowUpRight className="h-3 w-3 text-gray-600 dark:text-gray-300" />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Go to Gallery</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-2xl font-bold text-muted-foreground dark:text-gray-300">...</p>
            ) : (
              <div className="text-3xl font-bold dark:text-gray-300">{stats.totalCount.toLocaleString()}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1 dark:text-gray-400">
              {sourceMode === 'cloud' ? 'in cloud storage' : 'in local storage'}
            </p>
          </CardContent>
        </Card>

        <Card className=" hover:shadow-lg transition-shadow" >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xl font-semibold dark:text-gray-300">Total Size</CardTitle>
            <div className="flex items-center gap-2">
             
              <Tooltip>
                <TooltipTrigger asChild>
                  <div onClick={() => navigate('/upload')} className="cursor-pointer w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100 transition-colors dark:hover:bg-gray-600">
                    <ArrowUpRight className="h-3 w-3 text-gray-600 dark:text-gray-300" />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Go to Upload</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-2xl font-bold text-muted-foreground dark:text-gray-300">...</p>
            ) : (
              <div className="text-3xl font-bold dark:text-gray-300">{formatBytes(stats.totalSize)}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1 dark:text-gray-400">
              total file size
            </p>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
