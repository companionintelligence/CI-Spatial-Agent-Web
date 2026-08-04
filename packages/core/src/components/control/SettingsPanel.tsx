import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSimpleStore } from '@hexafield/simple-store/react'
import { MonitorCog, Server, Settings as SettingsIcon, SlidersHorizontal } from 'lucide-react'

import {
  COMMON_OLLAMA_MODELS,
  defaultLLMConfig,
  type LLMConfig,
  type LLMProvider
} from '../../services/llm/config/llmConfig'
import { LLMSettingsState } from '../../config/settingsStore'
import { clearLocalOverrides, resolveLLMConfig, writeLocalOverrides } from '../../config/appConfigService'
import { loadRuntimeConfig } from '../../config/runtimeConfig'
import { AppConfigState } from '../../app/appConfig'
import { useHasWebGPU } from '../../utils/useHasWebGPU'
import { useXRLayout } from '../../utils/useXRLayout'

interface SettingsPanelProps {
  isOpen: boolean
  onClose: () => void
}

/** A labeled on/off switch row, token-styled. */
function ToggleRow({
  label,
  hint,
  checked,
  disabled,
  onChange
}: {
  label: string
  hint?: string
  checked: boolean
  disabled?: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
        padding: '0.5rem 0',
        opacity: disabled ? 0.5 : 1
      }}
    >
      <div>
        <div style={{ fontSize: '0.9rem', color: 'var(--card-foreground)' }}>{label}</div>
        {hint && <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>{hint}</div>}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        style={{
          flex: '0 0 auto',
          width: '2.75rem',
          height: '1.5rem',
          borderRadius: '999px',
          border: '0.0625rem solid var(--border)',
          background: checked ? 'var(--primary)' : 'var(--muted)',
          position: 'relative',
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'background 0.15s ease',
          padding: 0
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: '0.125rem',
            left: checked ? '1.375rem' : '0.125rem',
            width: '1.125rem',
            height: '1.125rem',
            borderRadius: '50%',
            background: checked ? 'var(--primary-foreground)' : 'var(--card-foreground)',
            transition: 'left 0.15s ease'
          }}
        />
      </button>
    </div>
  )
}

const PROVIDERS: { value: LLMProvider; label: string }[] = [
  { value: 'proxy', label: 'Proxy (recommended)' },
  { value: 'ollama', label: 'Ollama (direct)' },
  { value: 'openai', label: 'OpenAI-compatible' },
  { value: 'mlc', label: 'On-device (WebLLM)' },
  { value: 'script', label: 'Scripted' }
]

// Which config keys the URL/model inputs map to, per provider.
const FIELD_MAP: Record<LLMProvider, { urlKey?: keyof LLMConfig; modelKey?: keyof LLMConfig }> = {
  proxy: { urlKey: 'proxy_url', modelKey: 'proxy_model' },
  ollama: { urlKey: 'ollama_url', modelKey: 'ollama_model' },
  openai: { urlKey: 'openai_api_url', modelKey: 'openai_model' },
  mlc: { modelKey: 'mlc_model' },
  script: {}
}

export const SettingsPanel = ({ isOpen, onClose }: SettingsPanelProps) => {
  const { isXR } = useXRLayout()
  const [settings] = useSimpleStore(LLMSettingsState)
  const [appConfig] = useSimpleStore(AppConfigState)
  const hasWebGPU = useHasWebGPU()

  const [provider, setProvider] = useState<LLMProvider>(settings.llm_provider ?? 'proxy')
  const [url, setUrl] = useState('')
  const [model, setModel] = useState('')

  const fields = FIELD_MAP[provider]

  // Re-hydrate the form whenever it opens or the resolved settings change.
  useEffect(() => {
    if (!isOpen) return
    const p = settings.llm_provider ?? 'proxy'
    setProvider(p)
    const map = FIELD_MAP[p]
    setUrl(map.urlKey ? String(settings[map.urlKey] ?? '') : '')
    setModel(map.modelKey ? String(settings[map.modelKey] ?? '') : '')
  }, [isOpen, settings])

  // When provider changes in the form, reflect that provider's current values.
  const onProviderChange = useCallback(
    (next: LLMProvider) => {
      setProvider(next)
      const map = FIELD_MAP[next]
      setUrl(map.urlKey ? String(settings[map.urlKey] ?? '') : '')
      setModel(map.modelKey ? String(settings[map.modelKey] ?? '') : '')
    },
    [settings]
  )

  const handleSave = useCallback(() => {
    const patch: Partial<LLMConfig> = { llm_provider: provider }
    if (fields.urlKey) patch[fields.urlKey] = url.trim() as never
    if (fields.modelKey) patch[fields.modelKey] = model.trim() as never
    writeLocalOverrides(patch)
    LLMSettingsState.set((prev) => ({ ...prev, ...patch }))
    onClose()
  }, [provider, fields, url, model, onClose])

  const handleReset = useCallback(async () => {
    clearLocalOverrides()
    const runtime = await loadRuntimeConfig()
    LLMSettingsState.set(resolveLLMConfig(runtime, {}))
    onClose()
  }, [onClose])

  const modelOptions = useMemo(() => COMMON_OLLAMA_MODELS, [])

  if (!isOpen) return null

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: isXR ? '0.95rem' : '0.8rem',
    fontWeight: 600,
    marginBottom: '0.35rem',
    color: 'var(--muted-foreground)'
  }
  const inputStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    padding: isXR ? '0.75rem' : '0.55rem 0.7rem',
    borderRadius: 'var(--radius-md)',
    border: '0.0625rem solid var(--input)',
    background: 'var(--popover)',
    color: 'var(--popover-foreground)',
    fontSize: isXR ? '1rem' : '0.9rem',
    fontFamily: 'inherit'
  }
  const sectionHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    fontSize: '0.72rem',
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: 'var(--muted-foreground)',
    margin: '0.5rem 0 0.6rem',
    paddingTop: '0.9rem',
    borderTop: '0.0625rem solid var(--border)'
  }

  const SectionHeader = ({ icon, children }: { icon: ReactNode; children: ReactNode }) => (
    <div style={sectionHeaderStyle}>
      {icon}
      <span>{children}</span>
    </div>
  )

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Connection settings"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 1300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(4, 22, 32, 0.6)',
        backdropFilter: 'blur(6px)'
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          // border-box so maxWidth/maxHeight bound the RENDERED card. With the
          // default content-box the 2.8rem of padding sat outside `width`, so a
          // 24rem card actually drew 26.9rem and blew past both caps: on a
          // 360x640 phone it clipped its own title row and Save/Cancel row off
          // the top and bottom of the screen (measured 708px in a 640px
          // viewport), leaving Save unreachable.
          boxSizing: 'border-box',
          width: isXR ? '30rem' : '24rem',
          maxWidth: '92vw',
          // Never taller than the surface it floats on; scroll the overflow
          // instead of clipping it.
          maxHeight: 'calc(100% - 2rem)',
          overflowY: 'auto',
          padding: isXR ? '1.75rem' : '1.4rem',
          borderRadius: 'var(--radius-xl)',
          background: 'var(--xr-glass-bg)',
          border: '0.0625rem solid var(--xr-glass-border)',
          backdropFilter: 'blur(var(--xr-glass-blur))',
          boxShadow: 'var(--xr-elevation)',
          color: 'var(--card-foreground)'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: isXR ? '1.35rem' : '1.15rem',
            fontWeight: 700,
            marginBottom: '1rem'
          }}
        >
          <SettingsIcon size={isXR ? 22 : 18} aria-hidden />
          <span>Settings</span>
        </div>

        <div style={{ ...sectionHeaderStyle, paddingTop: 0, borderTop: 'none', marginTop: 0 }}>
          <Server size={13} aria-hidden />
          <span>Connection</span>
        </div>

        <div style={{ marginBottom: '0.9rem' }}>
          <label style={labelStyle} htmlFor="settings-provider">
            LLM provider
          </label>
          <select
            id="settings-provider"
            value={provider}
            onChange={(e) => onProviderChange(e.target.value as LLMProvider)}
            style={inputStyle}
          >
            {PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {fields.urlKey && (
          <div style={{ marginBottom: '0.9rem' }}>
            <label style={labelStyle} htmlFor="settings-url">
              {provider === 'proxy' ? 'Proxy URL' : 'Server URL'}
            </label>
            <input
              id="settings-url"
              type="text"
              value={url}
              placeholder={provider === 'proxy' ? '/api/chat' : 'http://localhost:11434'}
              onChange={(e) => setUrl(e.target.value)}
              style={inputStyle}
            />
          </div>
        )}

        {fields.modelKey && (
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={labelStyle} htmlFor="settings-model">
              Model
            </label>
            <input
              id="settings-model"
              type="text"
              list="settings-model-options"
              value={model}
              placeholder={String(defaultLLMConfig[fields.modelKey] ?? '')}
              onChange={(e) => setModel(e.target.value)}
              style={inputStyle}
            />
            <datalist id="settings-model-options">
              {modelOptions.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>
        )}

        <SectionHeader icon={<SlidersHorizontal size={13} aria-hidden />}>Behavior</SectionHeader>
        <ToggleRow
          label="Barge-in"
          hint="Interrupt the avatar when you start speaking"
          checked={appConfig.bargeInEnabled}
          onChange={(v) => AppConfigState.set((prev) => ({ ...prev, bargeInEnabled: v }))}
        />
        <ToggleRow
          label="Auto-submit"
          hint="Send your speech automatically after you pause"
          checked={appConfig.autoSubmitEnabled}
          onChange={(v) => AppConfigState.set((prev) => ({ ...prev, autoSubmitEnabled: v }))}
        />

        <SectionHeader icon={<MonitorCog size={13} aria-hidden />}>Graphics</SectionHeader>
        <ToggleRow
          label="WebGPU rendering"
          hint={hasWebGPU ? 'Faster rendering where supported' : 'Not supported on this device'}
          checked={appConfig.webGPUEnabled}
          disabled={!hasWebGPU}
          onChange={(v) => AppConfigState.set((prev) => ({ ...prev, webGPUEnabled: v }))}
        />

        <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem' }}>
          <button
            onClick={handleReset}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--muted-foreground)',
              fontSize: isXR ? '0.95rem' : '0.85rem',
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: '0.4rem'
            }}
          >
            Reset to defaults
          </button>

          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: '0.0625rem solid var(--border)',
                color: 'var(--card-foreground)',
                padding: isXR ? '0.7rem 1.1rem' : '0.55rem 0.9rem',
                borderRadius: 'var(--radius-md)',
                fontSize: isXR ? '1rem' : '0.9rem',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              style={{
                background: 'var(--primary)',
                border: '0.0625rem solid var(--primary)',
                color: 'var(--primary-foreground)',
                padding: isXR ? '0.7rem 1.25rem' : '0.55rem 1rem',
                borderRadius: 'var(--radius-md)',
                fontSize: isXR ? '1rem' : '0.9rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
