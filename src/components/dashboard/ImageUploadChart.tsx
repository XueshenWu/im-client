import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSettingsStore } from '@/stores/settingsStore';
import api from '@/services/api';

interface DailyStats {
  date: string;
  uploaded: number;
  deleted: number;
}

interface ImageUploadChartProps {
  days?: number;
}

export function ImageUploadChart({ days = 7 }: ImageUploadChartProps) {
  const [data, setData] = useState<DailyStats[]>([]);
  const [loading, setLoading] = useState(true);
  const sourceMode = useSettingsStore((state) => state.sourceMode);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        let result: DailyStats[] = [];

        if (sourceMode === 'cloud') {
          // Fetch from cloud API
          const response = await api.get<{ success: boolean; data: DailyStats[] }>(
            `/api/images/summary?days=${days}`
          );
          result = response.data.data;
        } else {
          // Fetch from local database via IPC
          result = await window.electron.invoke('get-upload-summary', { days });
        }

        // Sort data by date to ensure proper left-to-right ordering
        const sortedData = result.sort((a, b) => {
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        });

        setData(sortedData);
      } catch (error) {
        console.error('Failed to fetch upload chart data:', error);
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [sourceMode, days]);

  return (
    <Card className='border-gray-200'>
      <CardHeader>
        <CardTitle className="text-lg sm:text-xl">Upload Activity</CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          Last {days} days upload and delete counts
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-48 sm:h-64">
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        ) : data.length === 0 ? (
          <div className="flex items-center justify-center h-48 sm:h-64">
            <p className="text-sm text-muted-foreground">No data available</p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <div className="min-w-[300px]">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-50" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      return `${date.getMonth() + 1}/${date.getDate()}`;
                    }}
                  />
                  <YAxis tick={{ fontSize: 11 }} width={40} />
                  <Tooltip
                    labelFormatter={(value) => {
                      const date = new Date(value as string);
                      return date.toLocaleDateString();
                    }}
                    contentStyle={{ fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="uploaded" fill="#10b981" name="Uploaded" />
                  <Bar dataKey="deleted" fill="#ef4444" name="Deleted" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
