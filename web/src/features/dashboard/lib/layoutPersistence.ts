import {
  DASHBOARD_LAYOUT_STORAGE_KEY_PREFIX,
  PANEL_MIN_HEIGHT,
  PANEL_MIN_WIDTH,
  createPanelSnapshot,
  layoutItemToPanelRect,
  panelSnapshotToLayoutItem,
  type DashboardLayoutConfigItem,
  type DashboardLayoutItem,
  type DashboardLayoutModel,
  type PanelRect,
  type PanelWindowState,
  type WidgetRegistry,
} from './dashboardLayout.shared'
import { getLayoutSourceWidth } from './responsiveLayout'

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isPanelWindowState(value: unknown): value is PanelWindowState {
  return value === 'normal' || value === 'minimized' || value === 'maximized'
}

function parseLayoutItem(value: unknown): DashboardLayoutItem | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Record<string, unknown>
  if (
    typeof candidate.id !== 'string' ||
    !isFiniteNumber(candidate.x) || !isFiniteNumber(candidate.y) ||
    !isFiniteNumber(candidate.w) || !isFiniteNumber(candidate.h) ||
    !isFiniteNumber(candidate.minWidth) || !isFiniteNumber(candidate.minHeight) ||
    !isPanelWindowState(candidate.windowState)
  ) return null

  return {
    id: candidate.id,
    x: candidate.x,
    y: candidate.y,
    w: candidate.w,
    h: candidate.h,
    minWidth: candidate.minWidth,
    minHeight: candidate.minHeight,
    windowState: candidate.windowState,
    restoreLayout: parseLayoutItem(candidate.restoreLayout),
  }
}

export function getDashboardLayoutStorageKey(dashboardId: string) {
  return `${DASHBOARD_LAYOUT_STORAGE_KEY_PREFIX}:${dashboardId}`
}

export function clearStoredDashboardLayout(storageKey: string) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.removeItem(storageKey)
  } catch {
    // Ignore storage errors so reset still works in memory.
  }
}

export function createSeedLayout(layoutConfig: DashboardLayoutConfigItem[]): DashboardLayoutItem[] {
  return layoutConfig.map((item) => ({
    id: item.widgetId,
    x: item.x,
    y: item.y,
    w: item.w,
    h: item.h,
    minWidth: item.minWidth ?? PANEL_MIN_WIDTH,
    minHeight: item.minHeight ?? PANEL_MIN_HEIGHT,
    windowState: 'normal',
    restoreLayout: null,
  }))
}

export function resolveInitialLayout(
  widgetRegistry: WidgetRegistry,
  layoutConfig: DashboardLayoutConfigItem[],
  storedLayout: DashboardLayoutModel | null,
) {
  const widgetIds = new Set(Object.keys(widgetRegistry))
  const fallbackLayout = createSeedLayout(layoutConfig).filter((panel) => widgetIds.has(panel.id))

  if (!storedLayout) return fallbackLayout

  const storedPanelsById = new Map(
    storedLayout.panels
      .filter((panel) => widgetIds.has(panel.id))
      .map((panel) => [panel.id, panel] as const),
  )

  return fallbackLayout.map((panel) => {
    const storedPanel = storedPanelsById.get(panel.id)

    if (!storedPanel) return panel

    return {
      ...storedPanel,
      minWidth: panel.minWidth,
      minHeight: panel.minHeight,
      restoreLayout: storedPanel.restoreLayout
        ? {
            ...storedPanel.restoreLayout,
            minWidth: panel.minWidth,
            minHeight: panel.minHeight,
          }
        : null,
    }
  })
}

export function createInitialPanels(containerWidth: number, layoutItems: DashboardLayoutItem[]) {
  return layoutItems.map((item) => layoutItemToPanelRect(item, containerWidth))
}

export function createDefaultDashboardPanels(
  containerWidth: number,
  widgetRegistry: WidgetRegistry,
  layoutConfig: DashboardLayoutConfigItem[],
) {
  const sourceWidth = getLayoutSourceWidth(containerWidth)
  const defaultLayout = resolveInitialLayout(widgetRegistry, layoutConfig, null)
  return createInitialPanels(sourceWidth, defaultLayout)
}

export function getDefaultPanelRect(
  panelId: string,
  containerWidth: number,
  seedLayout: DashboardLayoutItem[],
): PanelRect | null {
  return createInitialPanels(containerWidth, seedLayout).find((panel) => panel.id === panelId) ?? null
}

export function serializePanelsToLayout(
  panels: PanelRect[],
  containerWidth: number,
): DashboardLayoutModel | null {
  if (containerWidth <= 0) return null

  return {
    version: 1,
    panels: panels.map((panel) => {
      const layoutItem = panelSnapshotToLayoutItem(createPanelSnapshot(panel), containerWidth)
      return {
        ...layoutItem,
        restoreLayout: panel.restoreRect
          ? panelSnapshotToLayoutItem(panel.restoreRect, containerWidth)
          : null,
      }
    }),
  }
}

export function parseStoredLayout(value: string | null): DashboardLayoutModel | null {
  if (!value) return null

  try {
    const parsed = JSON.parse(value) as { version?: unknown; panels?: unknown }
    if (parsed.version !== 1 || !Array.isArray(parsed.panels)) return null

    const panels = parsed.panels
      .map((panel) => parseLayoutItem(panel))
      .filter((panel): panel is DashboardLayoutItem => panel !== null)

    return panels.length === 0 ? null : { version: 1, panels }
  } catch {
    return null
  }
}
