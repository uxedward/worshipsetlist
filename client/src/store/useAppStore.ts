import { create } from 'zustand'
import type { PresentationFontSize, Theme } from '@shared/types.ts'

export type MainView = 'setlist' | 'library'
export type MobileTab = 'setlist' | 'library' | 'song'
export type SaveStatus = 'saved' | 'saving' | 'failed'

export interface ConfirmState {
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
}

interface AppState {
  mainView: MainView
  mobileTab: MobileTab
  activeSetlistId: string | null
  activeSetlistSongId: string | null
  lyricsOnly: boolean
  activeSectionIndex: number
  presentationOpen: boolean
  presentationSection: number
  editorOpen: boolean
  editorSongId: string | null
  setlistModalId: string | 'new' | null
  contextMenu: { id: string; x: number; y: number } | null
  bulkImportOpen: boolean
  exportOpen: boolean
  drawerOpen: boolean
  sidebarHover: boolean
  saveStatus: SaveStatus
  offline: boolean
  confirm: ConfirmState | null
  playing: boolean
  elapsed: number
  theme: Theme
  fontSize: PresentationFontSize

  setMainView: (v: MainView) => void
  setMobileTab: (v: MobileTab) => void
  setActiveSetlistId: (id: string | null) => void
  setActiveSetlistSongId: (id: string | null) => void
  setLyricsOnly: (v: boolean) => void
  setActiveSectionIndex: (n: number) => void
  openPresentation: () => void
  closePresentation: () => void
  setPresentationSection: (n: number) => void
  openEditor: (songId: string | null) => void
  closeEditor: () => void
  openSetlistModal: (id: string | 'new' | null) => void
  closeSetlistModal: () => void
  setContextMenu: (v: AppState['contextMenu']) => void
  setBulkImportOpen: (v: boolean) => void
  setExportOpen: (v: boolean) => void
  setDrawerOpen: (v: boolean) => void
  setSidebarHover: (v: boolean) => void
  setSaveStatus: (s: SaveStatus) => void
  setOffline: (v: boolean) => void
  askConfirm: (c: ConfirmState) => void
  closeConfirm: () => void
  setPlaying: (v: boolean) => void
  setElapsed: (n: number | ((p: number) => number)) => void
  setTheme: (t: Theme) => void
  setFontSize: (s: PresentationFontSize) => void
}

export const useAppStore = create<AppState>((set) => ({
  mainView: 'setlist',
  mobileTab: 'setlist',
  activeSetlistId: null,
  activeSetlistSongId: null,
  lyricsOnly: false,
  activeSectionIndex: 0,
  presentationOpen: false,
  presentationSection: 0,
  editorOpen: false,
  editorSongId: null,
  setlistModalId: null,
  contextMenu: null,
  bulkImportOpen: false,
  exportOpen: false,
  drawerOpen: false,
  sidebarHover: false,
  saveStatus: 'saved',
  offline: false,
  confirm: null,
  playing: false,
  elapsed: 0,
  theme: 'dark',
  fontSize: 'medium',

  setMainView: (mainView) => set({ mainView, mobileTab: mainView === 'library' ? 'library' : 'setlist' }),
  setMobileTab: (mobileTab) =>
    set({
      mobileTab,
      mainView: mobileTab === 'library' ? 'library' : 'setlist',
      drawerOpen: mobileTab === 'song',
    }),
  setActiveSetlistId: (activeSetlistId) => set({ activeSetlistId, activeSetlistSongId: null, elapsed: 0, playing: false }),
  setActiveSetlistSongId: (activeSetlistSongId) =>
    set({ activeSetlistSongId, elapsed: 0, activeSectionIndex: 0, drawerOpen: true, mobileTab: 'song' }),
  setLyricsOnly: (lyricsOnly) => set({ lyricsOnly }),
  setActiveSectionIndex: (activeSectionIndex) => set({ activeSectionIndex }),
  openPresentation: () => set({ presentationOpen: true, presentationSection: 0 }),
  closePresentation: () => set({ presentationOpen: false }),
  setPresentationSection: (presentationSection) => set({ presentationSection }),
  openEditor: (editorSongId) => set({ editorOpen: true, editorSongId }),
  closeEditor: () => set({ editorOpen: false, editorSongId: null }),
  openSetlistModal: (setlistModalId) => set({ setlistModalId: setlistModalId, contextMenu: null }),
  closeSetlistModal: () => set({ setlistModalId: null }),
  setContextMenu: (contextMenu) => set({ contextMenu }),
  setBulkImportOpen: (bulkImportOpen) => set({ bulkImportOpen }),
  setExportOpen: (exportOpen) => set({ exportOpen }),
  setDrawerOpen: (drawerOpen) => set({ drawerOpen }),
  setSidebarHover: (sidebarHover) => set({ sidebarHover }),
  setSaveStatus: (saveStatus) => set({ saveStatus }),
  setOffline: (offline) => set({ offline }),
  askConfirm: (confirm) => set({ confirm }),
  closeConfirm: () => set({ confirm: null }),
  setPlaying: (playing) => set({ playing }),
  setElapsed: (n) =>
    set((s) => ({ elapsed: typeof n === 'function' ? n(s.elapsed) : n })),
  setTheme: (theme) => set({ theme }),
  setFontSize: (fontSize) => set({ fontSize }),
}))
