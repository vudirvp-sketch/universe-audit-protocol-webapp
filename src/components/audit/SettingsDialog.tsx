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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Settings, Eye, EyeOff, Key, Check, Trash2, Sparkles, Zap, Globe, Server } from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';
import {
  LLM_PROVIDERS,
  AVAILABLE_PROVIDERS,
  type LLMProvider,
} from '@/lib/llm-client';
import { t } from '@/lib/i18n/ru';

interface SettingsDialogProps {
  onSettingsChange?: (settings: { provider: LLMProvider; apiKey: string | null; model: string | null }) => void;
}

export function SettingsDialog({ onSettingsChange }: SettingsDialogProps) {
  const { provider, apiKey, model, proxyUrl, isLoaded, setProvider, setApiKey, setModel, setProxyUrl, loadSettings, clearSettings } = useSettings();
  const [open, setOpen] = React.useState(false);
  const [inputKey, setInputKey] = React.useState('');
  const [inputModel, setInputModel] = React.useState('');
  const [inputProxyUrl, setInputProxyUrl] = React.useState('');
  const [showKey, setShowKey] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  // Load settings on mount
  React.useEffect(() => {
    if (!isLoaded) {
      loadSettings();
    }
  }, [isLoaded, loadSettings]);

  // Sync inputs with stored settings when dialog opens
  React.useEffect(() => {
    if (open) {
      setInputKey(apiKey || '');
      setInputModel(model || '');
      setInputProxyUrl(proxyUrl || '');
      setSaved(false);
    }
  }, [open, apiKey, model, proxyUrl]);

  // Update model input when provider changes
  React.useEffect(() => {
    if (open) {
      const defaultModel = LLM_PROVIDERS[provider]?.defaultModel || '';
      setInputModel(model || defaultModel);
    }
  }, [provider, open, model]);

  const handleProviderChange = (newProvider: LLMProvider) => {
    setProvider(newProvider);
    const defaultModel = LLM_PROVIDERS[newProvider]?.defaultModel || '';
    setInputModel(defaultModel);
    setModel(null);
  };

  const handleSave = () => {
    const trimmedKey = inputKey.trim();
    const trimmedModel = inputModel.trim();
    const trimmedProxyUrl = inputProxyUrl.trim();

    if (trimmedKey) {
      setApiKey(trimmedKey);
    } else {
      setApiKey(null);
    }

    if (trimmedModel) {
      setModel(trimmedModel);
    } else {
      setModel(null);
    }

    if (trimmedProxyUrl) {
      setProxyUrl(trimmedProxyUrl);
    }

    onSettingsChange?.({
      provider,
      apiKey: trimmedKey || null,
      model: trimmedModel || null,
    });

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClear = () => {
    setInputKey('');
    setInputModel('');
    setInputProxyUrl('');
    clearSettings();
    onSettingsChange?.({ provider: 'zai', apiKey: null, model: null });
    setSaved(false);
  };

  const hasKey = !!apiKey;
  const currentProvider = LLM_PROVIDERS[provider];
  const hasFreeTier = ['google', 'groq', 'huggingface', 'openrouter', 'together'].includes(provider);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title={t.app.settings}>
          <Settings className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {t.settings.title}
          </DialogTitle>
          <DialogDescription>
            {t.settings.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Provider Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              {t.settings.provider}
            </Label>
            <Select value={provider} onValueChange={(v) => handleProviderChange(v as LLMProvider)}>
              <SelectTrigger>
                <SelectValue placeholder={t.settings.providerSelect} />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {AVAILABLE_PROVIDERS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <div className="flex items-center gap-2">
                      <span>{p.name}</span>
                      {p.hasFreeTier && (
                        <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 px-1.5 py-0.5 rounded">
                          {t.settings.freeTier}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasFreeTier && (
              <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                <Zap className="h-3 w-3" />
                {t.settings.freeTierAvailable}
              </p>
            )}
          </div>

          {/* Model Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              {t.settings.model}
            </Label>
            <Input
              placeholder={currentProvider?.defaultModel || 'model-name'}
              value={inputModel}
              onChange={(e) => setInputModel(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {t.settings.modelDefault.replace('{model}', currentProvider?.defaultModel || '')}
            </p>
          </div>

          {/* API Key Input */}
          <div className="space-y-2">
            <Label htmlFor="api-key" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              {t.settings.apiKey}
            </Label>
            <div className="relative">
              <Input
                id="api-key"
                type={showKey ? 'text' : 'password'}
                placeholder={
                  currentProvider?.apiKeyPrefix
                    ? `${currentProvider.apiKeyPrefix}...`
                    : t.settings.apiKeyPlaceholder
                }
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
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

          {/* Proxy URL */}
          <div className="space-y-2">
            <Label htmlFor="proxy-url" className="flex items-center gap-2">
              <Server className="h-4 w-4" />
              {t.settings.proxyUrl}
            </Label>
            <Input
              id="proxy-url"
              type="url"
              placeholder="https://audit-proxy.your-subdomain.workers.dev"
              value={inputProxyUrl}
              onChange={(e) => setInputProxyUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {t.settings.proxyUrlHint}
            </p>
          </div>

          {/* Status indicator */}
          {hasKey && (
            <Alert className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900">
              <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-700 dark:text-green-300 text-sm">
                {t.settings.apiKeyConfigured.replace('{provider}', currentProvider?.name || '')}
              </AlertDescription>
            </Alert>
          )}

          {/* Instructions */}
          <div className="rounded-lg bg-muted p-4 space-y-3">
            <h4 className="text-sm font-medium">{t.settings.howToGetKey}</h4>

            <div className="text-sm text-muted-foreground space-y-2">
              {provider === 'google' && (
                <ol className="list-decimal list-inside space-y-1">
                  <li>Go to <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" className="text-blue-500 hover:underline">Google AI Studio</a></li>
                  <li>Create a new API key</li>
                  <li>Free tier: 15 RPM, 1M tokens/day</li>
                </ol>
              )}

              {provider === 'groq' && (
                <ol className="list-decimal list-inside space-y-1">
                  <li>Go to <a href="https://console.groq.com/keys" target="_blank" rel="noopener" className="text-blue-500 hover:underline">Groq Console</a></li>
                  <li>Create an API key (starts with gsk_)</li>
                  <li>Very fast inference, generous free tier</li>
                </ol>
              )}

              {provider === 'openrouter' && (
                <ol className="list-decimal list-inside space-y-1">
                  <li>Go to <a href="https://openrouter.ai/keys" target="_blank" rel="noopener" className="text-blue-500 hover:underline">OpenRouter</a></li>
                  <li>Create an API key</li>
                  <li>Access to many models, some free</li>
                </ol>
              )}

              {provider === 'huggingface' && (
                <ol className="list-decimal list-inside space-y-1">
                  <li>Go to <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noopener" className="text-blue-500 hover:underline">Hugging Face Settings</a></li>
                  <li>Create an Access Token</li>
                  <li>Free inference API (rate limited)</li>
                </ol>
              )}

              {provider === 'together' && (
                <ol className="list-decimal list-inside space-y-1">
                  <li>Go to <a href="https://api.together.xyz/settings/api-keys" target="_blank" rel="noopener" className="text-blue-500 hover:underline">Together AI</a></li>
                  <li>Create an API key</li>
                  <li>$1 free credit on signup</li>
                </ol>
              )}

              {provider === 'openai' && (
                <ol className="list-decimal list-inside space-y-1">
                  <li>Go to <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener" className="text-blue-500 hover:underline">OpenAI Platform</a></li>
                  <li>Create an API key (starts with sk-)</li>
                  <li>Pay-as-you-go pricing</li>
                </ol>
              )}

              {provider === 'anthropic' && (
                <ol className="list-decimal list-inside space-y-1">
                  <li>Go to <a href="https://console.anthropic.com/" target="_blank" rel="noopener" className="text-blue-500 hover:underline">Anthropic Console</a></li>
                  <li>Create an API key (starts with sk-ant-)</li>
                  <li>Pay-as-you-go pricing</li>
                </ol>
              )}

              {provider === 'mistral' && (
                <ol className="list-decimal list-inside space-y-1">
                  <li>Go to <a href="https://console.mistral.ai/" target="_blank" rel="noopener" className="text-blue-500 hover:underline">Mistral Console</a></li>
                  <li>Create an API key</li>
                </ol>
              )}

              {provider === 'deepseek' && (
                <ol className="list-decimal list-inside space-y-1">
                  <li>Go to <a href="https://platform.deepseek.com/" target="_blank" rel="noopener" className="text-blue-500 hover:underline">DeepSeek Platform</a></li>
                  <li>Create an API key</li>
                  <li>Very competitive pricing</li>
                </ol>
              )}

              {provider === 'qwen' && (
                <ol className="list-decimal list-inside space-y-1">
                  <li>Go to <a href="https://dashscope.console.aliyun.com/" target="_blank" rel="noopener" className="text-blue-500 hover:underline">Alibaba DashScope</a></li>
                  <li>Create an API key</li>
                </ol>
              )}

              {provider === 'kimi' && (
                <ol className="list-decimal list-inside space-y-1">
                  <li>Go to <a href="https://platform.moonshot.cn/" target="_blank" rel="noopener" className="text-blue-500 hover:underline">Moonshot Platform</a></li>
                  <li>Create an API key</li>
                </ol>
              )}

              {provider === 'xai' && (
                <ol className="list-decimal list-inside space-y-1">
                  <li>Go to <a href="https://console.x.ai/" target="_blank" rel="noopener" className="text-blue-500 hover:underline">xAI Console</a></li>
                  <li>Create an API key</li>
                </ol>
              )}

              {provider === 'zai' && (
                <ol className="list-decimal list-inside space-y-1">
                  <li>Contact Z.AI for API access</li>
                  <li>Enter your API key here</li>
                </ol>
              )}
            </div>

            <p className="text-xs text-muted-foreground pt-2 border-t">
              {t.settings.keySecurityNote}
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleClear}
            disabled={!inputKey && !hasKey}
            className="w-full sm:w-auto"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {t.app.clear}
          </Button>
          <Button
            onClick={handleSave}
            disabled={saved}
            className="w-full sm:w-auto"
          >
            {saved ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                {t.app.saved}
              </>
            ) : (
              t.app.save
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
