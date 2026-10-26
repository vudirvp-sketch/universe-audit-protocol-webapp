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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Settings, Eye, EyeOff, Key, Check, Trash2, Sparkles, Zap, Globe, ChevronDown, ChevronRight, Server, ShieldCheck, RefreshCw } from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  LLM_PROVIDERS,
  AVAILABLE_PROVIDERS,
  type LLMProvider,
  type LLMTransport,
  createLLMClient,
  getModelCapabilities,
  validateApiKey,
  validateRelayUrl,
  normalizeCustomBaseUrl,
  PROVIDER_BROWSER_CORS,
  RELAY_URL_DEFAULT,
} from '@/lib/llm-client';
import {
  getStaticModels,
  isPublicModelList,
  loadModelCatalog,
  type ModelCatalogResult,
} from '@/lib/model-catalog';
import { t } from '@/lib/i18n/ru';

interface SettingsDialogProps {
  onSettingsChange?: (settings: { provider: LLMProvider; apiKey: string | null; model: string | null }) => void;
}

export function SettingsDialog({ onSettingsChange }: SettingsDialogProps) {
  const provider = useSettings((s) => s.provider);
  const apiKey = useSettings((s) => s.apiKey);
  const model = useSettings((s) => s.model);
  const transport = useSettings((s) => s.transport);
  const relayUrl = useSettings((s) => s.relayUrl);
  const rpmLimit = useSettings((s) => s.rpmLimit);
  const setProvider = useSettings((s) => s.setProvider);
  const setApiKey = useSettings((s) => s.setApiKey);
  const setModel = useSettings((s) => s.setModel);
  const setTransport = useSettings((s) => s.setTransport);
  const setRelayUrl = useSettings((s) => s.setRelayUrl);
  const setRpmLimit = useSettings((s) => s.setRpmLimit);
  const setCustomContextWindow = useSettings((s) => s.setCustomContextWindow);
  const setCustomMaxOutputTokens = useSettings((s) => s.setCustomMaxOutputTokens);
  const setCustomSupportsJSONMode = useSettings((s) => s.setCustomSupportsJSONMode);
  const setBaseUrl = useSettings((s) => s.setBaseUrl);
  const baseUrl = useSettings((s) => s.baseUrl);
  const customContextWindow = useSettings((s) => s.customContextWindow);
  const customMaxOutputTokens = useSettings((s) => s.customMaxOutputTokens);
  const customSupportsJSONMode = useSettings((s) => s.customSupportsJSONMode);
  const keyMemoryOnly = useSettings((s) => s.keyMemoryOnly);
  const setKeyMemoryOnly = useSettings((s) => s.setKeyMemoryOnly);
  const clearSettings = useSettings((s) => s.clearSettings);

  const isMobile = useIsMobile();
  const [open, setOpen] = React.useState(false);
  const [inputKey, setInputKey] = React.useState('');
  const [inputModel, setInputModel] = React.useState('');
  const [inputRelayUrl, setInputRelayUrl] = React.useState(RELAY_URL_DEFAULT);
  const [inputTransport, setInputTransport] = React.useState<LLMTransport>('direct');
  const [inputRpmLimit, setInputRpmLimit] = React.useState('');
  const [inputBaseUrl, setInputBaseUrl] = React.useState('');
  const [showKey, setShowKey] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [inputContextWindow, setInputContextWindow] = React.useState('');
  const [inputMaxOutputTokens, setInputMaxOutputTokens] = React.useState('');
  const [testConnection, setTestConnection] = React.useState<{ loading: boolean; success: boolean; error: string | null }>({
    loading: false,
    success: false,
    error: null,
  });
  // Live model catalog: fetched from the provider's own API, cached for a day.
  const [catalog, setCatalog] = React.useState<ModelCatalogResult | null>(null);
  const [catalogLoading, setCatalogLoading] = React.useState(false);

  type CatalogInputs = { key: string; transport: LLMTransport; relay: string };

  const refreshCatalog = React.useCallback(async (force: boolean, inputs: CatalogInputs) => {
    // Yield first: the effect that calls this must not set state synchronously.
    await Promise.resolve();
    const trimmedKey = inputs.key.trim() || apiKey || '';

    if (inputs.transport === 'direct' && !trimmedKey && !isPublicModelList(provider)) {
      setCatalog({
        ids: getStaticModels(provider),
        source: 'fallback',
        fetchedAt: null,
        error: 'Сначала укажите API-ключ — пока показан встроенный список моделей.',
      });
      return;
    }

    setCatalogLoading(true);
    try {
      const result = await loadModelCatalog({
        provider,
        apiKey: trimmedKey,
        transport: inputs.transport,
        relayUrl: inputs.relay,
        // Opening the dialog trusts a fresh cache; the refresh button does not.
        preferCache: !force,
      });
      setCatalog(result);
    } finally {
      setCatalogLoading(false);
    }
  }, [provider, apiKey]);

  const currentCatalogInputs: CatalogInputs = {
    key: inputKey,
    transport: inputTransport,
    relay: inputRelayUrl || RELAY_URL_DEFAULT,
  };

  // Refresh when the dialog opens or the provider/transport changes. A fresh
  // cache answers immediately; a stale one is re-fetched in the background.
  // Typing a key must not refetch on every keystroke — the button does that.
  React.useEffect(() => {
    if (!open) return;
    // Deferred so the refresh never sets state synchronously inside the effect.
    const timer = setTimeout(() => {
      void refreshCatalog(false, currentCatalogInputs);
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, provider, inputTransport]);

  // Sync inputs with stored settings when dialog opens
  React.useEffect(() => {
    if (open) {
      setInputKey(apiKey || '');
      setInputModel(model || '');
      setInputRelayUrl(relayUrl || RELAY_URL_DEFAULT);
      setInputTransport(transport);
      setInputRpmLimit(String(rpmLimit));
      setInputBaseUrl(baseUrl || '');
      setInputContextWindow(customContextWindow != null ? String(customContextWindow) : '');
      setInputMaxOutputTokens(customMaxOutputTokens != null ? String(customMaxOutputTokens) : '');
      setSaved(false);
    }
  }, [open, apiKey, model, transport, relayUrl, rpmLimit, customContextWindow, customMaxOutputTokens, baseUrl]);

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
    // Clear custom capabilities when provider changes (will auto-detect from new provider)
    setCustomContextWindow(null);
    setCustomMaxOutputTokens(null);
    setCustomSupportsJSONMode(null);
    setBaseUrl(null);
    setInputContextWindow('');
    setInputMaxOutputTokens('');
    setInputBaseUrl('');
  };

  const handleSave = () => {
    const trimmedKey = inputKey.trim();
    const trimmedModel = inputModel.trim();
    const trimmedRelayUrl = inputRelayUrl.trim();

    // Validate the relay endpoint only when it is actually used.
    if (inputTransport === 'relay') {
      const relayCheck = validateRelayUrl(trimmedRelayUrl);
      if (!relayCheck.valid) {
        setFormError(relayCheck.error || t.settings.invalidRelayUrl);
        return;
      }
    }
    if (provider === 'custom' && inputBaseUrl.trim()) {
      const baseCheck = normalizeCustomBaseUrl(inputBaseUrl.trim());
      if (!baseCheck.valid) {
        setFormError(baseCheck.error || t.settings.invalidBaseUrl);
        return;
      }
    }
    setFormError(null);

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

    setTransport(inputTransport);
    setRelayUrl(trimmedRelayUrl || RELAY_URL_DEFAULT);

    const parsedRpm = parseInt(inputRpmLimit, 10);
    if (!isNaN(parsedRpm) && parsedRpm > 0) {
      setRpmLimit(parsedRpm);
    }

    // Save custom capabilities (empty = null = auto-detect)
    const parsedContextWindow = parseInt(inputContextWindow, 10);
    setCustomContextWindow(!isNaN(parsedContextWindow) && parsedContextWindow > 0 ? parsedContextWindow : null);

    const parsedMaxOutputTokens = parseInt(inputMaxOutputTokens, 10);
    setCustomMaxOutputTokens(!isNaN(parsedMaxOutputTokens) && parsedMaxOutputTokens > 0 ? parsedMaxOutputTokens : null);

    // Save base URL for custom providers
    const trimmedBaseUrl = inputBaseUrl.trim();
    setBaseUrl(trimmedBaseUrl || null);

    onSettingsChange?.({
      provider,
      apiKey: trimmedKey || null,
      model: trimmedModel || null,
    });

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClear = () => {
    const confirmed = typeof window === 'undefined'
      || window.confirm(t.settings.clearSettingsConfirm);
    if (!confirmed) return;

    setInputKey('');
    setInputModel('');
    setInputRelayUrl(RELAY_URL_DEFAULT);
    setInputTransport('direct');
    setInputRpmLimit('');
    setInputBaseUrl('');
    setInputContextWindow('');
    setInputMaxOutputTokens('');
    setFormError(null);
    clearSettings();
    onSettingsChange?.({ provider: 'google', apiKey: null, model: null });
    setSaved(false);
    setTestConnection({ loading: false, success: false, error: null });
  };

  const handleTestConnection = async () => {
    const trimmedKey = inputKey.trim();
    const trimmedRelayUrl = inputRelayUrl.trim();
    const trimmedModel = inputModel.trim() || LLM_PROVIDERS[provider]?.defaultModel || '';
    // In relay mode the key may live in the relay's env (LLM_API_KEY), so a
    // placeholder is enough for the request to reach the relay.
    const effectiveKey = trimmedKey || (inputTransport === 'relay' ? 'env' : '');

    if (!effectiveKey) {
      setTestConnection({ loading: false, success: false, error: 'Сначала укажите API-ключ.' });
      return;
    }

    if (inputTransport === 'relay') {
      const relayCheck = validateRelayUrl(trimmedRelayUrl);
      if (!relayCheck.valid) {
        setTestConnection({ loading: false, success: false, error: relayCheck.error || t.settings.invalidRelayUrl });
        return;
      }
    }

    setTestConnection({ loading: true, success: false, error: null });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
      const client = createLLMClient({
        provider,
        apiKey: effectiveKey,
        model: trimmedModel,
        transport: inputTransport,
        relayUrl: trimmedRelayUrl,
        baseUrl: provider === 'custom' ? (inputBaseUrl.trim() || undefined) : undefined,
      });
      await client.chatCompletion({
        messages: [
          { role: 'user', content: 'Ответь одним словом: работает' },
        ],
        max_tokens: 10,
        signal: controller.signal, // Real fetch cancellation on timeout
      });
      clearTimeout(timeoutId);
      setTestConnection({ loading: false, success: true, error: null });
    } catch (err) {
      clearTimeout(timeoutId);
      let msg = err instanceof Error ? err.message : String(err);

      if (controller.signal.aborted) {
        msg = inputTransport === 'relay'
          ? 'Таймаут — локальный релей не ответил за 20 секунд. Проверьте, что `node relay/relay.mjs` запущен.'
          : 'Таймаут — провайдер не ответил за 20 секунд. Проверьте интернет и доступность API.';
      }

      setTestConnection({ loading: false, success: false, error: msg });
    }
  };

  const hasKey = !!apiKey;
  const currentProvider = LLM_PROVIDERS[provider];
  const hasFreeTier = ['google', 'groq', 'huggingface', 'openrouter', 'together'].includes(provider);
  const maskedKey = apiKey
    ? (apiKey.length <= 8 ? '••••' : `••••${apiKey.slice(-4)}`)
    : null;
  const keyFormatWarning = inputKey.trim()
    ? validateApiKey(provider, inputKey.trim()).error ?? null
    : null;
  const relayWarning = inputTransport === 'relay' && inputRelayUrl.trim()
    ? validateRelayUrl(inputRelayUrl.trim()).error ?? null
    : null;
  const corsSupport = PROVIDER_BROWSER_CORS[provider];
  const baseUrlWarning = provider === 'custom' && inputBaseUrl.trim()
    ? normalizeCustomBaseUrl(inputBaseUrl.trim()).error ?? null
    : null;

  // Model picker: live provider catalog, falling back to the bundled list.
  const staticModels = getStaticModels(provider);
  const catalogIds = catalog?.ids ?? [];
  const modelOptions = Array.from(new Set([
    ...catalogIds,
    ...staticModels,
    ...(inputModel.trim() ? [inputModel.trim()] : []),
  ]));
  const catalogFetchedAt = catalog?.fetchedAt
    ? new Date(catalog.fetchedAt).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;
  const modelMissingFromCatalog = Boolean(
    catalog?.source === 'api' && inputModel.trim() && !catalogIds.includes(inputModel.trim()),
  );
  const catalogStatusText = catalogLoading
    ? 'Запрашиваем список моделей у провайдера…'
    : !catalog
      ? ''
      : catalog.source === 'api'
        ? `Список из API: ${catalogIds.length} моделей, обновлён ${catalogFetchedAt}`
        : catalog.source === 'cache'
          ? `Список из кэша: ${catalogIds.length} моделей (${catalogFetchedAt})`
          : `Встроенный список: ${staticModels.length} моделей. ${catalog.error ?? ''}`.trim();

  // The settings form body — shared between Dialog (desktop) and Sheet (mobile)
  const settingsForm = (
    <>
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
                        <span className="text-xs bg-severity-success/10 text-severity-success px-1.5 py-0.5 rounded">
                          {t.settings.freeTier}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasFreeTier && (
              <p className="text-sm text-severity-success flex items-center gap-1">
                <Zap className="h-3 w-3" />
                {t.settings.freeTierAvailable}
              </p>
            )}
          </div>

          {/* Transport: direct browser calls or a local relay */}
          <div className="space-y-2">
            <Label htmlFor="transport" className="flex items-center gap-2">
              <Server className="h-4 w-4" />
              {t.settings.transport}
            </Label>
            <Select value={inputTransport} onValueChange={(v) => setInputTransport(v as LLMTransport)}>
              <SelectTrigger id="transport">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="direct">{t.settings.transportDirect}</SelectItem>
                <SelectItem value="relay">{t.settings.transportRelay}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">{t.settings.transportHint}</p>

            {inputTransport === 'direct' && corsSupport !== 'yes' && (
              <Alert className="bg-severity-warning/10 border-severity-warning/30">
                <AlertDescription className="text-severity-warning text-sm">
                  {(corsSupport === 'no' ? t.settings.corsBlocked : t.settings.corsUnknown)
                    .replace('{provider}', currentProvider?.name || '')}
                </AlertDescription>
              </Alert>
            )}

            {inputTransport === 'relay' && (
              <div className="space-y-2 pt-1">
                <Label htmlFor="relay-url" className="flex items-center gap-2 text-sm">
                  <Server className="h-3 w-3" />
                  {t.settings.relayUrl}
                </Label>
                <Input
                  id="relay-url"
                  type="url"
                  placeholder={RELAY_URL_DEFAULT}
                  value={inputRelayUrl}
                  onChange={(e) => setInputRelayUrl(e.target.value)}
                  className="text-sm h-8"
                />
                <p className="text-sm text-muted-foreground">{t.settings.relayUrlHint}</p>
                {relayWarning && (
                  <p className="text-sm text-severity-critical">{relayWarning}</p>
                )}
              </div>
            )}
          </div>

          {/* Model Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              {t.settings.model}
            </Label>
            <div className="flex gap-2">
              <Input
                placeholder={currentProvider?.defaultModel || 'model-name'}
                value={inputModel}
                onChange={(e) => setInputModel(e.target.value)}
                list={`model-list-${provider}`}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={() => void refreshCatalog(true, currentCatalogInputs)}
                disabled={catalogLoading}
                title={t.settings.refreshModels}
                aria-label={t.settings.refreshModels}
              >
                <RefreshCw className={`h-4 w-4 ${catalogLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            {/* Datalist from the provider's live catalog (cached for a day) */}
            <datalist id={`model-list-${provider}`}>
              {modelOptions.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            <p className="text-sm text-muted-foreground">
              {t.settings.modelDefault.replace('{model}', currentProvider?.defaultModel || '')}
            </p>
            {catalogStatusText && (
              <p className={`text-sm ${catalog?.source === 'fallback' ? 'text-severity-warning' : 'text-muted-foreground'}`}>
                {catalogStatusText}
              </p>
            )}
            {modelMissingFromCatalog && (
              <p className="text-sm text-severity-warning">
                {t.settings.modelNotInCatalog}
              </p>
            )}
            <p className="text-sm text-muted-foreground">{t.settings.modelListHint}</p>
            {currentProvider?.modelDocsUrl && (
              <p className="text-sm">
                <a
                  href={currentProvider.modelDocsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline"
                >
                  {t.settings.modelDocsLink}
                </a>
              </p>
            )}
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
            {!inputKey.trim() && inputTransport === 'direct' && (
              <Alert className="bg-severity-critical/10 border-severity-critical/30">
                <AlertDescription className="text-severity-critical text-sm">
                  API-ключ обязателен для запуска аудита. Без ключа запросы к LLM вернут ошибку 400.
                </AlertDescription>
              </Alert>
            )}
            {!inputKey.trim() && inputTransport === 'relay' && (
              <Alert className="bg-muted border-border">
                <AlertDescription className="text-muted-foreground text-sm">
                  {t.settings.relayKeyOptional}
                </AlertDescription>
              </Alert>
            )}
            {keyFormatWarning && (
              <p className="text-sm text-severity-warning">{keyFormatWarning}</p>
            )}
            {maskedKey && (
              <p className="text-sm text-muted-foreground">
                {t.settings.keyMasked.replace('{masked}', maskedKey)}
              </p>
            )}
            <div className="rounded-lg border p-3 space-y-1">
              <div className="flex items-start gap-2">
                <input
                  id="key-memory-only"
                  type="checkbox"
                  checked={keyMemoryOnly}
                  onChange={(e) => setKeyMemoryOnly(e.target.checked)}
                  className="mt-1 rounded border-gray-300"
                />
                <Label htmlFor="key-memory-only" className="text-sm flex items-center gap-2">
                  <ShieldCheck className="h-3 w-3" />
                  {t.settings.keyMemoryOnly}
                </Label>
              </div>
              <p className="text-sm text-muted-foreground">{t.settings.keyMemoryOnlyHint}</p>
            </div>
          </div>

          {/* Advanced Settings (collapsible) */}
          <div className="border rounded-lg">
            <button
              type="button"
              className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <span>{t.settings.advancedSettings}</span>
              {showAdvanced ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>

            {showAdvanced && (
              <div className="px-3 pb-3 space-y-4">
                {/* Base URL for Custom Provider */}
                {provider === 'custom' && (
                  <div className="space-y-2">
                    <Label htmlFor="base-url" className="flex items-center gap-2 text-sm">
                      <Globe className="h-3 w-3" />
                      Base URL провайдера
                    </Label>
                    <Input
                      id="base-url"
                      type="url"
                      placeholder="https://api.example.com/v1"
                      value={inputBaseUrl}
                      onChange={(e) => setInputBaseUrl(e.target.value)}
                      className="text-sm h-8"
                    />
                    <p className="text-sm text-muted-foreground">
                      Базовый URL API для кастомного провайдера (без /chat/completions)
                    </p>
                    {baseUrlWarning && (
                      <p className="text-sm text-severity-warning">{baseUrlWarning}</p>
                    )}
                  </div>
                )}

                {/* RPM Limit */}
                <div className="space-y-2">
                  <Label htmlFor="rpm-limit" className="flex items-center gap-2 text-sm">
                    <Zap className="h-3 w-3" />
                    {t.settings.rpmLimit}
                  </Label>
                  <Input
                    id="rpm-limit"
                    type="number"
                    min={1}
                    max={120}
                    placeholder={String(rpmLimit || 10)}
                    value={inputRpmLimit}
                    onChange={(e) => setInputRpmLimit(e.target.value)}
                    className="text-sm h-8"
                  />
                  <p className="text-sm text-muted-foreground">
                    {t.settings.rpmLimitHint}
                  </p>
                </div>

                {/* Model Capabilities Override (11.2) */}
                <div className="space-y-3 pt-2 border-t">
                  <p className="text-sm text-muted-foreground font-medium">
                    {t.settings.capabilitiesHint}
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="context-window" className="text-sm">
                      {t.settings.contextWindow}
                    </Label>
                    <Input
                      id="context-window"
                      type="number"
                      min={0}
                      placeholder={String(getModelCapabilities(provider, inputModel || currentProvider?.defaultModel || '').contextWindow)}
                      value={inputContextWindow}
                      onChange={(e) => setInputContextWindow(e.target.value)}
                      className="text-sm h-8"
                    />
                    <p className="text-sm text-muted-foreground">
                      {t.settings.contextWindowHint}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max-output-tokens" className="text-sm">
                      {t.settings.maxOutputTokens}
                    </Label>
                    <Input
                      id="max-output-tokens"
                      type="number"
                      min={0}
                      placeholder={String(getModelCapabilities(provider, inputModel || currentProvider?.defaultModel || '').maxOutputTokens)}
                      value={inputMaxOutputTokens}
                      onChange={(e) => setInputMaxOutputTokens(e.target.value)}
                      className="text-sm h-8"
                    />
                    <p className="text-sm text-muted-foreground">
                      {t.settings.maxOutputTokensHint}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id="json-mode"
                      type="checkbox"
                      checked={customSupportsJSONMode ?? getModelCapabilities(provider, inputModel || currentProvider?.defaultModel || '').supportsJSONMode}
                      onChange={(e) => setCustomSupportsJSONMode(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor="json-mode" className="text-sm">
                      {t.settings.supportsJSONMode}
                    </Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t.settings.supportsJSONModeHint}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Audit Feature Flags */}
          <div className="space-y-3 border rounded-lg p-3">
            <p className="text-sm font-medium text-muted-foreground">Параметры аудита</p>
            <div className="flex items-center gap-2">
              <input
                id="reference-comparison"
                type="checkbox"
                checked={useSettings((s) => s.referenceComparison)}
                onChange={(e) => useSettings.getState().setReferenceComparison(e.target.checked)}
                className="rounded border-gray-300"
              />
              <Label htmlFor="reference-comparison" className="text-sm">
                Сравнить с референсами (Disco Elysium, Expedition 33, Pathologic 2, Атака Титанов)
              </Label>
            </div>
            <p className="text-sm text-muted-foreground">
              Добавляет сравнение с эталонными примерами в финальный синтез (Блок 5)
            </p>
          </div>

          {/* Test Connection Button — fails fast (20s timeout) */}
          <div className="space-y-2">
            {formError && (
              <p className="text-sm text-severity-critical">{formError}</p>
            )}
            <Button
              variant="outline"
              className="w-full"
              onClick={handleTestConnection}
              disabled={(!inputKey.trim() && inputTransport !== 'relay') || testConnection.loading}
            >
              {testConnection.loading ? (
                <>
                  <span className="animate-spin mr-2">&#9203;</span>
                  {t.settings.testing}
                </>
              ) : testConnection.success ? (
                <>
                  <Check className="h-4 w-4 mr-2 text-severity-success" />
                  {t.settings.testSuccess}
                </>
              ) : testConnection.error ? (
                <>
                  {t.settings.testFailed}
                </>
              ) : (
                t.settings.testConnection
              )}
            </Button>
            {testConnection.loading && (
              <p className="text-sm text-muted-foreground text-center">
                Проверяем подключение (таймаут 20 сек)...
              </p>
            )}
            {testConnection.error && (
              <p className="text-sm text-severity-critical">{testConnection.error}</p>
            )}
          </div>

          {/* Status indicator */}
          {hasKey && !testConnection.loading && (
            <Alert className="bg-severity-success/10 border-severity-success/30">
              <Check className="h-4 w-4 text-severity-success" />
              <AlertDescription className="text-severity-success text-sm">
                {t.settings.apiKeyConfigured.replace('{provider}', currentProvider?.name || '')}
              </AlertDescription>
            </Alert>
          )}

          {/* Instructions */}
          <div className="rounded-lg bg-muted p-4 space-y-3">
            <h4 className="text-sm font-medium">{t.settings.howToGetKey}</h4>

            <div className="text-sm text-muted-foreground space-y-2">
              {(() => {
                const instructions = t.settings.providerInstructions[provider as keyof typeof t.settings.providerInstructions];
                if (!instructions) return null;
                return (
                  <ol className="list-decimal list-inside space-y-1">
                    <li>
                      {instructions.step1Text}
                      {instructions.step1Url && (
                        <>
                          {' '}
                          <a href={instructions.step1Url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                            {instructions.step1Url.replace(/https?:\/\//, '').split('/')[0]}
                          </a>
                        </>
                      )}
                    </li>
                    <li>{instructions.step2}</li>
                    {instructions.step3 && <li>{instructions.step3}</li>}
                  </ol>
                );
              })()}
            </div>

            <p className="text-sm text-muted-foreground pt-2 border-t">
              {t.settings.keySecurityNote}
            </p>
          </div>
      </div>

    </>
  );

  // Desktop: Dialog (modal), Mobile: Sheet (fullscreen side panel)
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon">
            <Settings className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[95vh] rounded-t-xl p-0">
          <SheetHeader className="px-4 pt-4 pb-0">
            <SheetTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              {t.settings.title}
            </SheetTitle>
            <SheetDescription>
              {t.settings.description}
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1 overflow-y-auto px-4">
            {settingsForm}
          </ScrollArea>
          <div className="flex flex-col gap-2 px-4 py-3 border-t">
            <Button
              variant="outline"
              onClick={handleClear}
              disabled={!inputKey && !hasKey}
              className="w-full"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {t.app.clear}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saved}
              className="w-full"
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
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Settings className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto max-w-[95vw] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {t.settings.title}
          </DialogTitle>
          <DialogDescription>
            {t.settings.description}
          </DialogDescription>
        </DialogHeader>
        {settingsForm}
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
