import type { AnyWidgetConfig } from '../../../shared/types/widget'

export const GRID_COLUMNS = 12
export const GRID_ROW_HEIGHT = 56
export const GRID_MARGIN = 24
export const MOBILE_BREAKPOINT = 640
export const TABLET_BREAKPOINT = 1180
export const RESPONSIVE_BASE_LAYOUT_WIDTH = 1280
export const PANEL_MIN_WIDTH = 320
export const PANEL_MIN_HEIGHT = 260
export const CANVAS_BOTTOM_PADDING = 24
export const PANEL_MINIMIZED_HEIGHT = 76
export const PANEL_MAXIMIZED_MIN_HEIGHT = 720
export const MINIMIZED_PANEL_WIDTH = 288
export const MINIMIZED_PANEL_MAX_WIDTH = 380
export const DASHBOARD_LAYOUT_STORAGE_KEY_PREFIX = 'nanodashboard:dashboard-layout:v1'

export type PanelWindowState = 'normal' | 'minimized' | 'maximized'
export type DashboardViewportMode = 'desktop' | 'tablet' | 'mobile'
export type PanelSnapshot = { id: string; x: number; y: number; width: number; height: number; minWidth: number; minHeight: number; windowState: PanelWindowState }
export type PanelRect = PanelSnapshot & { restoreRect: PanelSnapshot | null }
export type DashboardLayoutItem = { id: string; x: number; y: number; w: number; h: number; minWidth: number; minHeight: number; windowState: PanelWindowState; restoreLayout: DashboardLayoutItem | null }
export type DashboardLayoutModel = { version: 1; panels: DashboardLayoutItem[] }
export type DashboardLayoutConfigItem = { widgetId: string; x: number; y: number; w: number; h: number; minWidth?: number; minHeight?: number }
export type WidgetRegistry = Record<string, AnyWidgetConfig>
export type DashboardDefinition = { id: string; widgetRegistry: WidgetRegistry; layout: DashboardLayoutConfigItem[] }

function roundLayoutValue(value: number) { return Number(value.toFixed(4)) }

export function clamp(value: number, min: number, max: number) { return Math.min(Math.max(value, min), max) }
export function getColumnWidth(containerWidth: number) { return (containerWidth - GRID_MARGIN * (GRID_COLUMNS - 1)) / GRID_COLUMNS }
export function getPanelRight(panel: Pick<PanelRect, 'x' | 'width'>) { return panel.x + panel.width }
export function getPanelBottom(panel: Pick<PanelRect, 'y' | 'height'>) { return panel.y + panel.height }

export function createPanelSnapshot(panel: PanelRect): PanelSnapshot {
  return { id: panel.id, x: panel.x, y: panel.y, width: panel.width, height: panel.height, minWidth: panel.minWidth, minHeight: panel.minHeight, windowState: panel.windowState }
}

export function buildWidgetRegistry(widgets: AnyWidgetConfig[]): WidgetRegistry {
  return Object.fromEntries(widgets.map((widget) => [widget.id, widget]))
}

export function layoutItemToPanelRect(item: DashboardLayoutItem, containerWidth: number): PanelRect {
  const columnWidth = getColumnWidth(containerWidth)
  return {
    id: item.id,
    x: Math.round(item.x * (columnWidth + GRID_MARGIN)),
    y: Math.round(item.y * (GRID_ROW_HEIGHT + GRID_MARGIN)),
    width: Math.round(item.w * columnWidth + Math.max(item.w - 1, 0) * GRID_MARGIN),
    height: Math.round(item.h * GRID_ROW_HEIGHT + Math.max(item.h - 1, 0) * GRID_MARGIN),
    minWidth: item.minWidth,
    minHeight: item.minHeight,
    windowState: item.windowState,
    restoreRect: item.restoreLayout && containerWidth > 0 ? layoutItemToPanelSnapshot(item.restoreLayout, containerWidth) : null,
  }
}

export function layoutItemToPanelSnapshot(item: DashboardLayoutItem, containerWidth: number): PanelSnapshot {
  const panel = layoutItemToPanelRect(item, containerWidth)
  return { id: panel.id, x: panel.x, y: panel.y, width: panel.width, height: panel.height, minWidth: panel.minWidth, minHeight: panel.minHeight, windowState: panel.windowState }
}

export function panelSnapshotToLayoutItem(snapshot: PanelSnapshot, containerWidth: number): DashboardLayoutItem {
  const columnWidth = getColumnWidth(containerWidth)
  const unitWidth = columnWidth + GRID_MARGIN
  const unitHeight = GRID_ROW_HEIGHT + GRID_MARGIN
  return {
    id: snapshot.id,
    x: roundLayoutValue(snapshot.x / unitWidth),
    y: roundLayoutValue(snapshot.y / unitHeight),
    w: roundLayoutValue((snapshot.width + GRID_MARGIN) / unitWidth),
    h: roundLayoutValue((snapshot.height + GRID_MARGIN) / unitHeight),
    minWidth: snapshot.minWidth,
    minHeight: snapshot.minHeight,
    windowState: snapshot.windowState,
    restoreLayout: null,
  }
}
