export type Settings = {
  style: 'silhouette' | 'engraved' | 'blight' | 'ruin'
  level: 'whisper' | 'present' | 'bold'
  speed: 'real' | 'fast'
  glass: 'on' | 'off'
}

declare module 'claude-code' {
  interface PluginState {
    'warren-prototype': { settings: Shaped<Settings> }
  }
}
