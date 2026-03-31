import { describe, expect, it } from 'vitest'
import { tradingDashboardDefinition } from '../data/dashboardDefinition'
import {
  GRID_MARGIN,
  absorbRowGapAfterResize,
  autoArrangeDashboardPanels,
  createInitialPanels,
  createPanelSnapshot,
  createResponsivePanels,
  parseStoredLayout,
  resolveCollisions,
  resolveInitialLayout,
  resolveResizePanels,
  serializePanelsToLayout,
  type PanelRect,
} from './dashboardLayout'
import {
  togglePanelMaximized,
  togglePanelMinimized,
} from './dashboardPanelState'

const CONTAINER_WIDTH = 1440

function createDashboardPanels() {
  const initialLayout = resolveInitialLayout(
    tradingDashboardDefinition.widgetRegistry,
    tradingDashboardDefinition.layout,
    null,
  )

  return createInitialPanels(CONTAINER_WIDTH, initialLayout)
}

function getPanel(panels: PanelRect[], panelId: string) {
  const panel = panels.find((candidate) => candidate.id === panelId)

  if (!panel) {
    throw new Error(`Panel ${panelId} not found`)
  }

  return panel
}

function clonePanels(panels: PanelRect[]) {
  return panels.map((panel) => ({
    ...panel,
    restoreRect: panel.restoreRect ? { ...panel.restoreRect } : null,
  }))
}

function panelsOverlap(left: PanelRect, right: PanelRect) {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  )
}

function expectNoOverlap(panels: PanelRect[]) {
  const activeCanvasPanels = panels.filter((panel) => panel.windowState !== 'minimized')

  for (let index = 0; index < activeCanvasPanels.length; index += 1) {
    for (let compareIndex = index + 1; compareIndex < activeCanvasPanels.length; compareIndex += 1) {
      expect(panelsOverlap(activeCanvasPanels[index], activeCanvasPanels[compareIndex])).toBe(false)
    }
  }
}

describe('dashboard layout integration flows', () => {
  it('resolves drag collisions without overlap and snaps the dragged widget to a stable position', () => {
    const panels = createDashboardPanels()
    const dailyPnlPanel = getPanel(panels, 'daily-pnl')

    const draggedPanels = clonePanels(panels).map((panel) =>
      panel.id === 'open-orders'
        ? {
            ...panel,
            y: 40,
          }
        : panel,
    )

    const resolvedPanels = resolveCollisions(
      draggedPanels,
      'open-orders',
      CONTAINER_WIDTH,
      'drag',
    )

    const openOrdersPanel = getPanel(resolvedPanels, 'open-orders')

    expect(openOrdersPanel.y).toBe(dailyPnlPanel.y + dailyPnlPanel.height)
    expect(openOrdersPanel.x).toBe(0)
    expectNoOverlap(resolvedPanels)
  })

  it('resolves resize collisions by pushing the neighboring widget into a non-overlapping slot', () => {
    const panels = createDashboardPanels()

    const resizedPanels = clonePanels(panels).map((panel) =>
      panel.id === 'volume-profile'
        ? {
            ...panel,
            width: 864,
          }
        : panel,
    )

    const resolvedPanels = resolveResizePanels(
      resizedPanels,
      'volume-profile',
      CONTAINER_WIDTH,
      'right',
    )

    const volumeProfilePanel = getPanel(resolvedPanels, 'volume-profile')
    const dailyPnlPanel = getPanel(resolvedPanels, 'daily-pnl')

    expect(volumeProfilePanel.width).toBe(864)
    expect(dailyPnlPanel.x).toBe(volumeProfilePanel.x + volumeProfilePanel.width)
    expect(dailyPnlPanel.width).toBe(576)
    expectNoOverlap(resolvedPanels)
  })

  it('expands the nearest sibling after resize shrink so the row does not keep an empty gap', () => {
    const panels = createDashboardPanels()
    const expandedPanels = resolveResizePanels(
      clonePanels(panels).map((panel) =>
        panel.id === 'volume-profile'
          ? {
              ...panel,
              width: 864,
            }
          : panel,
      ),
      'volume-profile',
      CONTAINER_WIDTH,
      'right',
    )

    const resizeSnapshot = createPanelSnapshot(getPanel(expandedPanels, 'volume-profile'))
    const shrinkedPanels = expandedPanels.map((panel) =>
      panel.id === 'volume-profile'
        ? {
            ...panel,
            width: 360,
          }
        : panel,
    )

    const { panels: absorbedPanels, affectedPanelIds } = absorbRowGapAfterResize(
      shrinkedPanels,
      'volume-profile',
      CONTAINER_WIDTH,
      resizeSnapshot,
    )

    const volumeProfilePanel = getPanel(absorbedPanels, 'volume-profile')
    const dailyPnlPanel = getPanel(absorbedPanels, 'daily-pnl')

    expect(volumeProfilePanel.width).toBe(360)
    expect(dailyPnlPanel.x).toBe(volumeProfilePanel.x + volumeProfilePanel.width + GRID_MARGIN)
    expect(dailyPnlPanel.width).toBe(1056)
    expect(affectedPanelIds).toEqual(['volume-profile', 'daily-pnl'])
    expectNoOverlap(absorbedPanels)
  })

  it('preserves original geometry across minimize, maximize, and restore flows', () => {
    const panels = createDashboardPanels()
    const originalPanel = getPanel(panels, 'btc-price-trend')

    const minimizedPanels = togglePanelMinimized(panels, 'btc-price-trend', CONTAINER_WIDTH)
    const minimizedPanel = getPanel(minimizedPanels, 'btc-price-trend')

    expect(minimizedPanel.windowState).toBe('minimized')
    expect(minimizedPanel.restoreRect).toEqual(createPanelSnapshot(originalPanel))

    const restoredFromMinimized = togglePanelMinimized(
      minimizedPanels,
      'btc-price-trend',
      CONTAINER_WIDTH,
    )
    const restoredMinimizedPanel = getPanel(restoredFromMinimized, 'btc-price-trend')

    expect(restoredMinimizedPanel).toMatchObject({
      x: originalPanel.x,
      y: originalPanel.y,
      width: originalPanel.width,
      height: originalPanel.height,
      windowState: 'normal',
      restoreRect: null,
    })

    const maximizedPanels = togglePanelMaximized(panels, 'btc-price-trend', CONTAINER_WIDTH)
    const maximizedPanel = getPanel(maximizedPanels, 'btc-price-trend')

    expect(maximizedPanel.windowState).toBe('maximized')
    expect(maximizedPanel.x).toBe(0)
    expect(maximizedPanel.y).toBe(0)
    expect(maximizedPanel.width).toBe(CONTAINER_WIDTH)
    expect(maximizedPanel.restoreRect).toEqual(createPanelSnapshot(originalPanel))

    const restoredFromMaximized = togglePanelMaximized(
      maximizedPanels,
      'btc-price-trend',
      CONTAINER_WIDTH,
    )
    const restoredMaximizedPanel = getPanel(restoredFromMaximized, 'btc-price-trend')

    expect(restoredMaximizedPanel).toMatchObject({
      x: originalPanel.x,
      y: originalPanel.y,
      width: originalPanel.width,
      height: originalPanel.height,
      windowState: 'normal',
      restoreRect: null,
    })
  })

  it('restores a persisted layout model without losing geometry or window state', () => {
    const panels = createDashboardPanels()
    const resizedPanels = resolveResizePanels(
      clonePanels(panels).map((panel) =>
        panel.id === 'volume-profile'
          ? {
              ...panel,
              width: 864,
            }
          : panel,
      ),
      'volume-profile',
      CONTAINER_WIDTH,
      'right',
    )
    const minimizedPanels = togglePanelMinimized(
      resizedPanels,
      'portfolio-breakdown',
      CONTAINER_WIDTH,
    )

    const serializedLayout = serializePanelsToLayout(minimizedPanels, CONTAINER_WIDTH)
    expect(serializedLayout).not.toBeNull()

    const parsedLayout = parseStoredLayout(JSON.stringify(serializedLayout))
    const restoredLayout = resolveInitialLayout(
      tradingDashboardDefinition.widgetRegistry,
      tradingDashboardDefinition.layout,
      parsedLayout,
    )
    const restoredPanels = createInitialPanels(CONTAINER_WIDTH, restoredLayout)

    const originalById = new Map(minimizedPanels.map((panel) => [panel.id, panel] as const))

    for (const restoredPanel of restoredPanels) {
      const originalPanel = originalById.get(restoredPanel.id)

      expect(originalPanel).toBeDefined()
      expect(restoredPanel).toMatchObject({
        x: originalPanel?.x,
        y: originalPanel?.y,
        width: originalPanel?.width,
        height: originalPanel?.height,
        windowState: originalPanel?.windowState,
      })
      expect(restoredPanel.restoreRect).toEqual(originalPanel?.restoreRect ?? null)
    }

    expectNoOverlap(restoredPanels)
  })

  it('auto-arranges the current layout into a tidy non-overlapping flow without losing widgets', () => {
    const panels = createDashboardPanels().map((panel, index) => ({
      ...panel,
      x: index % 2 === 0 ? 120 + index * 35 : 40 + index * 20,
      y: 60 + index * 54,
    }))

    const arrangedPanels = autoArrangeDashboardPanels(panels, CONTAINER_WIDTH)
    const normalPanels = arrangedPanels
      .filter((panel) => panel.windowState === 'normal')
      .sort((left, right) => (left.y === right.y ? left.x - right.x : left.y - right.y))

    expect(arrangedPanels.map((panel) => panel.id).sort()).toEqual(
      panels.map((panel) => panel.id).sort(),
    )
    expect(normalPanels[0].x).toBe(0)
    expect(normalPanels[0].y).toBe(0)

    for (let index = 1; index < normalPanels.length; index += 1) {
      const previousPanel = normalPanels[index - 1]
      const currentPanel = normalPanels[index]

      expect(currentPanel.y).toBeGreaterThanOrEqual(previousPanel.y)

      if (currentPanel.y === previousPanel.y) {
        expect(currentPanel.x).toBeGreaterThanOrEqual(previousPanel.x + previousPanel.width)
      }
    }

    expectNoOverlap(arrangedPanels)
  })
})

describe('dashboard layout focused stability coverage', () => {
  it('maps desktop panels into stable tablet and mobile responsive layouts without overlap', () => {
    const desktopPanels: PanelRect[] = [
      {
        id: 'hero',
        x: 0,
        y: 0,
        width: 800,
        height: 320,
        minWidth: 320,
        minHeight: 240,
        windowState: 'normal',
        restoreRect: null,
      },
      {
        id: 'summary',
        x: 824,
        y: 0,
        width: 376,
        height: 320,
        minWidth: 280,
        minHeight: 240,
        windowState: 'normal',
        restoreRect: null,
      },
      {
        id: 'orders',
        x: 0,
        y: 344,
        width: 376,
        height: 300,
        minWidth: 280,
        minHeight: 240,
        windowState: 'normal',
        restoreRect: null,
      },
      {
        id: 'alerts',
        x: 400,
        y: 344,
        width: 376,
        height: 300,
        minWidth: 280,
        minHeight: 240,
        windowState: 'normal',
        restoreRect: null,
      },
    ]

    const tabletPanels = createResponsivePanels(clonePanels(desktopPanels), 900, 'tablet')
    const mobilePanels = createResponsivePanels(clonePanels(desktopPanels), 500, 'mobile')

    expect(tabletPanels.map((panel) => ({
      id: panel.id,
      x: panel.x,
      y: panel.y,
      width: panel.width,
      height: panel.height,
    }))).toEqual([
      { id: 'hero', x: 0, y: 0, width: 900, height: 360 },
      { id: 'summary', x: 0, y: 380, width: 440, height: 374 },
      { id: 'orders', x: 460, y: 380, width: 440, height: 351 },
      { id: 'alerts', x: 460, y: 751, width: 440, height: 351 },
    ])

    expect(mobilePanels.map((panel) => ({
      id: panel.id,
      x: panel.x,
      y: panel.y,
      width: panel.width,
      height: panel.height,
    }))).toEqual([
      { id: 'hero', x: 0, y: 0, width: 500, height: 220 },
      { id: 'summary', x: 0, y: 236, width: 500, height: 426 },
      { id: 'orders', x: 0, y: 678, width: 500, height: 399 },
      { id: 'alerts', x: 0, y: 1093, width: 500, height: 399 },
    ])

    expectNoOverlap(tabletPanels)
    expectNoOverlap(mobilePanels)
  })

  it('resolves multiple drag collisions into a stable non-overlapping layout', () => {
    const panels: PanelRect[] = [
      { id: 'active', x: 150, y: 50, width: 100, height: 100, minWidth: 80, minHeight: 80, windowState: 'normal', restoreRect: null },
      { id: 'left', x: 0, y: 0, width: 200, height: 200, minWidth: 120, minHeight: 120, windowState: 'normal', restoreRect: null },
      { id: 'right', x: 200, y: 0, width: 200, height: 200, minWidth: 120, minHeight: 120, windowState: 'normal', restoreRect: null },
    ]

    const resolvedPanels = resolveCollisions(clonePanels(panels), 'active', 900, 'drag')

    expect(getPanel(resolvedPanels, 'left')).toMatchObject({ x: 0, width: 150 })
    expect(getPanel(resolvedPanels, 'right')).toMatchObject({ x: 250, width: 150 })
    expectNoOverlap(resolvedPanels)
    expect(
      resolveCollisions(clonePanels(resolvedPanels), 'active', 900, 'drag'),
    ).toEqual(resolvedPanels)
  })

  it('keeps unrelated widgets stable during resize resolution and converges cleanly', () => {
    const panels = createDashboardPanels()
    const resizedPanels = clonePanels(panels).map((panel) =>
      panel.id === 'volume-profile'
        ? {
            ...panel,
            width: 864,
          }
        : panel,
    )

    const resolvedPanels = resolveResizePanels(
      resizedPanels,
      'volume-profile',
      CONTAINER_WIDTH,
      'right',
    )
    const stablePanels = resolveResizePanels(
      clonePanels(resolvedPanels),
      'volume-profile',
      CONTAINER_WIDTH,
      'right',
    )

    expect(getPanel(resolvedPanels, 'btc-price-trend')).toEqual(getPanel(panels, 'btc-price-trend'))
    expect(getPanel(resolvedPanels, 'portfolio-breakdown')).toEqual(getPanel(panels, 'portfolio-breakdown'))
    expect(getPanel(resolvedPanels, 'open-orders')).toEqual(getPanel(panels, 'open-orders'))
    expectNoOverlap(resolvedPanels)
    expect(stablePanels).toEqual(resolvedPanels)
  })

  it('auto-arranges panels into a gap-free non-overlapping flow', () => {
    const panels: PanelRect[] = [
      { id: 'wide', x: 180, y: 120, width: 500, height: 200, minWidth: 320, minHeight: 180, windowState: 'normal', restoreRect: null },
      { id: 'tall', x: 30, y: 20, width: 300, height: 260, minWidth: 220, minHeight: 200, windowState: 'normal', restoreRect: null },
      { id: 'compact', x: 420, y: 260, width: 300, height: 240, minWidth: 220, minHeight: 200, windowState: 'normal', restoreRect: null },
    ]

    const arrangedPanels = autoArrangeDashboardPanels(clonePanels(panels), 900)

    expect(arrangedPanels
      .map((panel) => ({
      id: panel.id,
      x: panel.x,
      y: panel.y,
      width: panel.width,
      height: panel.height,
    }))
      .sort((left, right) => left.id.localeCompare(right.id))).toEqual([
      { id: 'compact', x: 0, y: 284, width: 300, height: 240 },
      { id: 'tall', x: 0, y: 0, width: 300, height: 260 },
      { id: 'wide', x: 324, y: 0, width: 500, height: 200 },
    ])

    expectNoOverlap(arrangedPanels)
  })
})
