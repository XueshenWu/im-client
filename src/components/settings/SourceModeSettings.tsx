/**
 * Source Mode Settings Component
 * Allows users to switch between cloud and local mode
 * and configure sync policy for local mode
 */

import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Cloud, HardDrive, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { syncService } from '@/services/sync.service';

const SourceModeSettings: React.FC = () => {
  const { t } = useTranslation();
  const {
    sourceMode,
    syncPolicy,
    exportOnConflict,
    setSourceMode,
    setSyncPolicy,
    setExportOnConflict,
  } = useSettingsStore();

  const [cloudAvailable, setCloudAvailable] = useState(true);
  const [checkingCloud, setCheckingCloud] = useState(false);

  // Check cloud availability when trying to switch to cloud mode
  const checkCloudAvailability = async () => {
    setCheckingCloud(true);
    try {
      await syncService.getSyncStatus();
      setCloudAvailable(true);
      return true;
    } catch (error) {
      console.error('Cloud unavailable:', error);
      setCloudAvailable(false);
      return false;
    } finally {
      setCheckingCloud(false);
    }
  };

  const handleSourceModeChange = async (newMode: 'cloud' | 'local') => {
    if (newMode === 'cloud') {
      // Check if cloud is available before switching
      const available = await checkCloudAvailability();
      if (!available) {
        alert(t('settings.cloudUnavailable', 'Cannot connect to cloud server. Please check your connection.'));
        return;
      }
    }

    setSourceMode(newMode);
  };

  const handleSyncModeChange = (mode: 'manual' | 'auto') => {
    setSyncPolicy({ mode });
  };

  const handleSyncIntervalChange = (intervalSeconds: number) => {
    setSyncPolicy({ intervalSeconds });
  };
  return (
    <div className="space-y-6 *:border-gray-200 dark:text-gray-300">
      {/* Source Mode Selection */}
      
       
  
          <RadioGroup value={sourceMode} onValueChange={handleSourceModeChange as any}>
            <div className={"flex items-center space-x-3 p-4 border rounded-lg hover:bg-accent transition-colors "+`${sourceMode==='cloud'?"border-blue-400":"border-gray-200"}`}>
              <RadioGroupItem value="cloud" id="cloud-mode" />
              <Label htmlFor="cloud-mode" className={"flex items-center gap-2 flex-1 cursor-pointer " } >
                <Cloud className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="font-medium">{t('settings.cloudMode', 'Cloud Mode')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('settings.cloudModeDesc', 'All operations go directly to the server')}
                  </p>
                </div>
              </Label>
            </div>

            <div className={"flex items-center space-x-3 p-4 border rounded-lg hover:bg-accent transition-colors "+`${sourceMode==='local'?"border-blue-400":"border-gray-200"}`}>
              <RadioGroupItem value="local" id="local-mode" />
              <Label htmlFor="local-mode" className="flex items-center gap-2 flex-1 cursor-pointer">
                <HardDrive className="h-5 w-5 text-green-500" />
                <div>
                  <p className="font-medium">{t('settings.localMode', 'Local Mode')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('settings.localModeDesc', 'Work offline, sync when ready')}
                  </p>
                </div>
              </Label>
            </div>
          </RadioGroup>

          {!cloudAvailable && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {t('settings.cloudUnavailableWarning', 'Cloud server is unreachable. Local mode is available as fallback.')}
              </AlertDescription>
            </Alert>
          )}

          {checkingCloud && (
            <Alert>
              <AlertCircle className="h-4 w-4 animate-spin" />
              <AlertDescription>
                {t('settings.checkingCloud', 'Checking cloud connection...')}
              </AlertDescription>
            </Alert>
          )}
   


      {/* Sync Policy (only shown in local mode) */}
      {sourceMode === 'local' && false&& (
        <Card>
          <CardHeader>
            <CardTitle>{t('settings.syncPolicy', 'Sync Policy')}</CardTitle>
            <CardDescription>
              {t('settings.syncPolicyDescription', 'Configure how local changes are synced to cloud')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Manual/Auto Sync Toggle */}
            <div className="flex items-center justify-between ">
              <div className="space-y-0.5">
                <Label htmlFor="auto-sync">
                  {t('settings.autoSync', 'Automatic Sync')}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t('settings.autoSyncDesc', 'Automatically sync changes at regular intervals')}
                </p>
              </div>
              <Switch
                id="auto-sync"
                checked={syncPolicy.mode === 'auto'}
                onCheckedChange={(checked) =>
                  handleSyncModeChange(checked ? 'auto' : 'manual')
                }
              />
            </div>

            {/* Sync Interval (only shown if auto-sync enabled) */}
            {syncPolicy.mode === 'auto' && (
              <div className="space-y-2">
                <Label htmlFor="sync-interval">
                  {t('settings.syncInterval', 'Sync Interval')}
                </Label>
                <Select
                  value={syncPolicy.intervalSeconds.toString()}
                  onValueChange={(value:any) =>
                    handleSyncIntervalChange(parseInt(value))
                  }
                >
                  <SelectTrigger id="sync-interval">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">
                      {t('settings.interval30s', '30 seconds')}
                    </SelectItem>
                    <SelectItem value="60">
                      {t('settings.interval1m', '1 minute')}
                    </SelectItem>
                    <SelectItem value="300">
                      {t('settings.interval5m', '5 minutes')}
                    </SelectItem>
                    <SelectItem value="600">
                      {t('settings.interval10m', '10 minutes')}
                    </SelectItem>
                    <SelectItem value="1800">
                      {t('settings.interval30m', '30 minutes')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Export on Conflict */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="export-conflict">
                  {t('settings.exportOnConflict', 'Export on Conflict')}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t('settings.exportOnConflictDesc', 'Show export dialog before replacing/deleting images')}
                </p>
              </div>
              <Switch
                id="export-conflict"
                checked={exportOnConflict}
                onCheckedChange={setExportOnConflict}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Info */}
      <Alert>
        <CheckCircle2 className="h-4 w-4" />
        <AlertDescription>
          {sourceMode === 'cloud'
            ? t('settings.currentlyCloudMode', 'Currently in Cloud Mode. All changes are saved directly to the server.')
            : t('settings.currentlyLocalMode', 'Currently in Local Mode. Changes are saved locally and synced when you choose.')}
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default SourceModeSettings;
