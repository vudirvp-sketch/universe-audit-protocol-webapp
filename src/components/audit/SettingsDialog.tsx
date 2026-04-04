'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Settings, Eye, EyeOff, Key, ExternalLink, Check, Trash2 } from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';

interface SettingsDialogProps {
  onApiKeyChange?: (key: string | null) => void;
}

export function SettingsDialog({ onApiKeyChange }: SettingsDialogProps) {
  const { apiKey, isLoaded, setApiKey, clearApiKey, loadApiKey } = useSettings();
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState('');
  const [showKey, setShowKey] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  // Load API key on mount
  React.useEffect(() => {
    if (!isLoaded) {
      loadApiKey();
    }
  }, [isLoaded, loadApiKey]);

  // Sync input with stored key when dialog opens
  React.useEffect(() => {
    if (open) {
      setInputValue(apiKey || '');
      setSaved(false);
    }
  }, [open, apiKey]);

  const handleSave = () => {
    const trimmedKey = inputValue.trim();
    
    if (trimmedKey) {
      setApiKey(trimmedKey);
      onApiKeyChange?.(trimmedKey);
    } else {
      clearApiKey();
      onApiKeyChange?.(null);
    }
    
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClear = () => {
    setInputValue('');
    clearApiKey();
    onApiKeyChange?.(null);
    setSaved(false);
  };

  const hasKey = !!apiKey;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Settings">
          <Settings className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Settings
          </DialogTitle>
          <DialogDescription>
            Configure your AI SDK API key for the audit analysis.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* API Key Input */}
          <div className="space-y-2">
            <Label htmlFor="api-key" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              API Key
            </Label>
            <div className="relative">
              <Input
                id="api-key"
                type={showKey ? 'text' : 'password'}
                placeholder="Enter your API key..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>

          {/* Status indicator */}
          {hasKey && (
            <Alert className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900">
              <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-700 dark:text-green-300 text-sm">
                API key is configured
              </AlertDescription>
            </Alert>
          )}

          {/* Instructions */}
          <div className="rounded-lg bg-muted p-4 space-y-2">
            <h4 className="text-sm font-medium">How to get your API key:</h4>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Sign up for an AI SDK account</li>
              <li>Navigate to the API keys section in your dashboard</li>
              <li>Create a new API key and copy it here</li>
            </ol>
            <p className="text-xs text-muted-foreground mt-2">
              Your API key is stored locally in your browser and is never sent to any server except the AI API.
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleClear}
            disabled={!inputValue && !hasKey}
            className="w-full sm:w-auto"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear
          </Button>
          <Button
            onClick={handleSave}
            disabled={saved}
            className="w-full sm:w-auto"
          >
            {saved ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Saved!
              </>
            ) : (
              'Save'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
