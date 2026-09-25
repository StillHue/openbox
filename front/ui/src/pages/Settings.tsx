import { useState } from 'react';
import { Save, Loader2, AlertCircle, CheckCircle, Globe, Network, Moon, Sun, Brain, Settings as SettingsIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

export default function Settings() {
  const [activeTab, setActiveTab] = useState<'general' | 'api' | 'appearance' | 'advanced'>('general');
  const [settings, setSettings] = useState({
    // General
    autoRefresh: true,
    refreshInterval: 30,
    defaultTopK: 10,
    // API
    apiBaseUrl: '/api',
    requestTimeout: 30000,
    // Appearance
    theme: 'system' as 'light' | 'dark' | 'system',
    compactMode: false,
    // Advanced
    enableDebug: false,
    logLevel: 'info' as 'debug' | 'info' | 'warn' | 'error',
    maxConcurrentUploads: 3,
  });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    // In a real app, this would persist to localStorage or backend
    await new Promise((resolve) => setTimeout(resolve, 500));
    setSaved(true);
    setSaving(false);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleChange = (key: string, value: unknown) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value as 'general' | 'api' | 'appearance' | 'advanced');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <SettingsIcon className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground">Configure OpenBox preferences</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <Badge variant="default" className="gap-1">
              <CheckCircle className="w-3 h-3" />
              Saved
            </Badge>
          )}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="general">
            <span className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              General
            </span>
          </TabsTrigger>
          <TabsTrigger value="api">
            <span className="flex items-center gap-2">
              <Network className="w-4 h-4" />
              API
            </span>
          </TabsTrigger>
          <TabsTrigger value="appearance">
            <span className="flex items-center gap-2">
              <Moon className="w-4 h-4" />
              <Sun className="w-4 h-4" />
              Appearance
            </span>
          </TabsTrigger>
          <TabsTrigger value="advanced">
            <span className="flex items-center gap-2">
              <Brain className="w-4 h-4" />
              Advanced
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>Configure default behavior for the application</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Globe className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-medium">Auto Refresh</h4>
                    <p className="text-sm text-muted-foreground">Automatically refresh document lists and statuses</p>
                  </div>
                </div>
                <Switch
                  checked={settings.autoRefresh}
                  onCheckedChange={(checked) => handleChange('autoRefresh', checked)}
                />
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="refreshInterval">Refresh Interval (seconds)</Label>
                  <Input
                    id="refreshInterval"
                    type="number"
                    min="5"
                    max="300"
                    value={settings.refreshInterval}
                    onChange={(e) => handleChange('refreshInterval', parseInt(e.target.value) || 5)}
                    disabled={!settings.autoRefresh}
                    className="mt-1"
                  />
                  <p className="text-sm text-muted-foreground mt-1">How often to poll for updates</p>
                </div>
                <div>
                  <Label htmlFor="defaultTopK">Default Top K Results</Label>
                  <Input
                    id="defaultTopK"
                    type="number"
                    min="1"
                    max="100"
                    value={settings.defaultTopK}
                    onChange={(e) => handleChange('defaultTopK', parseInt(e.target.value) || 1)}
                    className="mt-1"
                  />
                  <p className="text-sm text-muted-foreground mt-1">Number of results to return by default</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Data Management</CardTitle>
              <CardDescription>Manage local data and cache</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div>
                  <h4 className="font-medium">Clear Cache</h4>
                  <p className="text-sm text-muted-foreground">Remove all cached data and temporary files</p>
                </div>
                <Button variant="outline">Clear Cache</Button>
              </div>
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div>
                  <h4 className="font-medium">Export Settings</h4>
                  <p className="text-sm text-muted-foreground">Download your current settings as JSON</p>
                </div>
                <Button variant="outline">Export</Button>
              </div>
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div>
                  <h4 className="font-medium">Import Settings</h4>
                  <p className="text-sm text-muted-foreground">Load settings from a JSON file</p>
                </div>
                <Button variant="outline">Import</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>API Configuration</CardTitle>
              <CardDescription>Configure API connection settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="apiBaseUrl">API Base URL</Label>
                <Input
                  id="apiBaseUrl"
                  value={settings.apiBaseUrl}
                  onChange={(e) => handleChange('apiBaseUrl', e.target.value)}
                  className="mt-1"
                  placeholder="/api"
                />
                <p className="text-sm text-muted-foreground mt-1">Base URL for API requests</p>
              </div>

              <Separator />

              <div>
                <Label htmlFor="requestTimeout">Request Timeout (ms)</Label>
                <Input
                  id="requestTimeout"
                  type="number"
                  min="5000"
                  max="120000"
                  value={settings.requestTimeout}
                  onChange={(e) => handleChange('requestTimeout', parseInt(e.target.value) || 5000)}
                  className="mt-1"
                />
                <p className="text-sm text-muted-foreground mt-1">Maximum time to wait for API responses</p>
              </div>

              <Separator />

              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2">Connection Status</h4>
                <div className="flex items-center gap-2 text-sm">
                  <span className="w-2 h-2 bg-green-500 rounded-full" />
                  <span className="text-green-600">Connected to API</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">Last checked: Just now</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>Customize how OpenBox looks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label>Theme</Label>
                <Select
                  value={settings.theme}
                  onValueChange={(value) => handleChange('theme', value as 'light' | 'dark' | 'system')}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select theme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">
                      <span className="flex items-center gap-2">
                        <Sun className="w-4 h-4" />
                        Light
                      </span>
                    </SelectItem>
                    <SelectItem value="dark">
                      <span className="flex items-center gap-2">
                        <Moon className="w-4 h-4" />
                        Dark
                      </span>
                    </SelectItem>
                    <SelectItem value="system">
                      <span className="flex items-center gap-2">
                        <Globe className="w-4 h-4" />
                        System
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground mt-1">Choose your preferred color scheme</p>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Moon className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h4 className="font-medium">Compact Mode</h4>
                    <p className="text-sm text-muted-foreground">Reduce spacing for denser information display</p>
                  </div>
                </div>
                <Switch
                  checked={settings.compactMode}
                  onCheckedChange={(checked) => handleChange('compactMode', checked)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
              <CardDescription>See how your changes will look</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <div>
                    <h4 className="font-medium">Settings Preview</h4>
                    <p className="text-sm text-muted-foreground">Your changes will apply immediately after saving</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Advanced Settings</CardTitle>
              <CardDescription>Experimental and developer options</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <h4 className="font-medium">Debug Mode</h4>
                    <p className="text-sm text-muted-foreground">Enable verbose logging and debug features</p>
                  </div>
                </div>
                <Switch
                  checked={settings.enableDebug}
                  onCheckedChange={(checked) => handleChange('enableDebug', checked)}
                />
              </div>

              <Separator />

              <div>
                <Label htmlFor="logLevel">Log Level</Label>
                <Select
                  value={settings.logLevel}
                  onValueChange={(value) => handleChange('logLevel', value as 'debug' | 'info' | 'warn' | 'error')}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select log level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="debug">Debug - Verbose logging</SelectItem>
                    <SelectItem value="info">Info - Standard logging</SelectItem>
                    <SelectItem value="warn">Warn - Warnings only</SelectItem>
                    <SelectItem value="error">Error - Errors only</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground mt-1">Control logging verbosity</p>
              </div>

              <Separator />

              <div>
                <Label htmlFor="maxConcurrentUploads">Max Concurrent Uploads</Label>
                <Input
                  id="maxConcurrentUploads"
                  type="number"
                  min="1"
                  max="10"
                  value={settings.maxConcurrentUploads}
                  onChange={(e) => handleChange('maxConcurrentUploads', parseInt(e.target.value) || 1)}
                  className="mt-1"
                />
                <p className="text-sm text-muted-foreground mt-1">Maximum simultaneous file uploads</p>
              </div>

              <Separator />

              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium text-amber-900">Warning</h4>
                    <p className="text-sm text-amber-800">
                      Advanced settings can affect application stability. Only change these if you know what you're doing.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>System Information</CardTitle>
              <CardDescription>Version and environment details</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-muted-foreground">Version</dt>
                  <dd className="font-medium">1.0.0</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Build</dt>
                  <dd className="font-medium">Development</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">React</dt>
                  <dd className="font-medium">18.3.0</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Vite</dt>
                  <dd className="font-medium">5.4.0</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Node</dt>
                  <dd className="font-medium">{typeof process !== 'undefined' ? process.version : 'Browser'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Environment</dt>
                  <dd className="font-medium">Development</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}