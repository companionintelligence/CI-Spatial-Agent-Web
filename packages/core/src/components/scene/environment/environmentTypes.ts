export type EnvironmentPreset = 'none' | 'datacenter-1970s'

export const ENVIRONMENT_PRESETS: Record<EnvironmentPreset, string> = {
  none: 'Studio (default)',
  'datacenter-1970s': '1970s Research Datacenter'
}
