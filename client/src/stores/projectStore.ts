/**
 * Project-level settings store.
 *
 * Stores per-project:
 *   - `instructions` — free-text AI rules applied to every tab in this project
 *   - `sources`      — files uploaded at the project level (shared across all tabs)
 *
 * Persisted to localStorage under the key `nuphorm-project-settings`.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nanoid } from 'nanoid';

export interface ProjectSource {
  id: string;
  name: string;
  size: number;     // bytes
  type: string;     // lowercase extension: 'csv' | 'xlsx' | 'pdf' | …
  uploadedAt: number;
  preview?: string; // first ~600 chars of text content (CSV/text), used for AI context
}

export interface ProjectSettings {
  instructions: string;
  sources: ProjectSource[];
}

const DEFAULT_SETTINGS: ProjectSettings = {
  instructions: '',
  sources: [],
};

interface ProjectStoreState {
  /** Per-project settings — keyed by projectId */
  settings: Record<string, ProjectSettings>;

  /**
   * UI signal: updated to `Date.now()` whenever the chat's Attached Sources
   * panel should open (e.g. when the user clicks "Sources Uploaded" in the
   * project section). Not persisted to localStorage.
   */
  sourcesPanelRequestedAt: number | null;

  getSettings: (projectId: string) => ProjectSettings;
  setInstructions: (projectId: string, instructions: string) => void;
  addSource: (projectId: string, source: ProjectSource) => void;
  removeSource: (projectId: string, sourceId: string) => void;
  clearSources: (projectId: string) => void;
  /** Trigger the chat's Attached Sources panel to open. */
  requestOpenSourcesPanel: () => void;
}

export const useProjectStore = create<ProjectStoreState>()(
  persist(
    (set, get) => ({
      settings: {},
      sourcesPanelRequestedAt: null,
      requestOpenSourcesPanel: () => set({ sourcesPanelRequestedAt: Date.now() }),

      getSettings: (projectId) =>
        get().settings[projectId] ?? { ...DEFAULT_SETTINGS },

      setInstructions: (projectId, instructions) =>
        set((state) => ({
          settings: {
            ...state.settings,
            [projectId]: {
              ...(state.settings[projectId] ?? DEFAULT_SETTINGS),
              instructions,
            },
          },
        })),

      addSource: (projectId, source) =>
        set((state) => ({
          settings: {
            ...state.settings,
            [projectId]: {
              ...(state.settings[projectId] ?? DEFAULT_SETTINGS),
              sources: [...(state.settings[projectId]?.sources ?? []), source],
            },
          },
        })),

      removeSource: (projectId, sourceId) =>
        set((state) => ({
          settings: {
            ...state.settings,
            [projectId]: {
              ...(state.settings[projectId] ?? DEFAULT_SETTINGS),
              sources: (state.settings[projectId]?.sources ?? []).filter(
                (s) => s.id !== sourceId
              ),
            },
          },
        })),

      clearSources: (projectId) =>
        set((state) => ({
          settings: {
            ...state.settings,
            [projectId]: {
              ...(state.settings[projectId] ?? DEFAULT_SETTINGS),
              sources: [],
            },
          },
        })),
    }),
    {
      name: 'nuphorm-project-settings',
      // Only persist the settings map — never the ephemeral UI signal
      partialize: (state) => ({ settings: state.settings }),
    }
  )
);

// ── Helper exported for consumers ─────────────────────────────────────────────

// 2 MB — large enough for most clinical trial CSVs while staying safe for localStorage
const MAX_PREVIEW_BYTES = 2 * 1024 * 1024;

/**
 * Build a text snippet from a File object.
 * CSV / plain-text → read and store up to 2 MB (full data for most datasets).
 * Everything else → empty string (no preview).
 */
export function readFilePreview(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!['csv', 'txt', 'tsv'].includes(ext)) return Promise.resolve('');

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) ?? '';
      resolve(text.slice(0, MAX_PREVIEW_BYTES));
    };
    reader.onerror = () => resolve('');
    reader.readAsText(file);
  });
}

/** Format bytes to a human-readable string. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Build a new ProjectSource from a browser File. */
export async function buildProjectSource(file: File): Promise<ProjectSource> {
  const preview = await readFilePreview(file);
  return {
    id: nanoid(),
    name: file.name,
    size: file.size,
    type: file.name.split('.').pop()?.toLowerCase() ?? 'file',
    uploadedAt: Date.now(),
    preview,
  };
}
