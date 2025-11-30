import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSettingsStore } from '@/stores/settingsStore';
import api from '@/services/api';

interface FormatStats {
  format: string;
  count: number;
}

const COLORS: Record<string, string> = {
  jpeg: '#3b82f6',
  png: '#10b981',
  tiff: '#f59e0b',
  jpg: '#3b82f6',
};

export function ImageFormatPieChart() {
  const [data, setData] = useState<FormatStats[]>([]);
  const [loading, setLoading] = useState(true);
  const sourceMode = useSettingsStore((state) => state.sourceMode);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        if (sourceMode === 'cloud') {
          // Fetch from cloud API
          const response = await api.get<{ success: boolean; data: FormatStats[] }>(
            '/api/images/format-stats'
          );
          setData(response.data.data);
        } else {
          // Fetch from local database via IPC
          const result = await window.electron.invoke('get-format-stats');
          setData(result);
        }
      } catch (error) {
        console.error('Failed to fetch format stats:', error);
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [sourceMode]);

  const total = data.reduce((acc, item) => acc + item.count, 0);

  const chartData = data.map((item) => ({
    name: item.format.toUpperCase(),
    value: item.count,
    color: COLORS[item.format.toLowerCase()] || '#6366f1',
    percent: (item.count / total) * 100,
  }));

  return (
    <Card className='border-gray-200 dark:border-gray-600'>
      <CardHeader>
        <CardTitle className="text-lg sm:text-xl dark:text-gray-300">Image Formats</CardTitle>
        <CardDescription className="text-xs sm:text-sm dark:text-gray-400">
          Distribution by file format
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-48 sm:h-64">
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        ) : data.length === 0 ? (
          <div className="flex items-center justify-center h-48 sm:h-64">
            <p className="text-sm text-muted-foreground">No images found</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent??0 * 100).toFixed(0)}%`}
                outerRadius={window.innerWidth < 640 ? 60 : 80}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ fontSize: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
