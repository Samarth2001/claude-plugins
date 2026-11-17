/** What the band above the prompt shows. */
export type Band = {
  isOpen: boolean
  /** Which page of tiles is in view, from 0. */
  page: number
  /** The tile under the cursor, by catalog id (or a plugin's name for a group tile). */
  picked: string | null
  /** The theme that was on when the band opened, which Cancel puts back. */
  before: string | null
  /** A step waiting for a yes: removing a theme, or an option that asks first. */
  confirm: { id: string; action: string } | null
  /** True while the picker is running a theme's command. */
  isBusy: boolean
  /** One line on what the last step came to. */
  note: string | null
}

/** Each theme's options as last chosen from the picker: theme id, option name, value. */
export type ThemeSettings = Record<string, Record<string, string>>

declare module 'claude-code' {
  interface PluginState {
    themes: {
      band: Band
      /** The catalog theme on now, as the last theme set says; null for none or a theme outside the catalog. */
      active: string | null
      /** Catalog plugins seen setting a theme and not turned off by the picker since. */
      lit: string[]
      /** Catalog plugins whose commands this session lists. */
      installed: string[]
      /** Plugins installed or removed from the picker, waiting for /reload-plugins. */
      pending: string[]
      settings: ThemeSettings
    }
  }
}
