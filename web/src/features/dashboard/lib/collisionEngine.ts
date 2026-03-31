import type { ResizeDirection } from '../../../shared/types/resize'
import {
  GRID_MARGIN,
  clamp,
  getPanelBottom,
  getPanelRight,
  type PanelRect,
  type PanelSnapshot,
} from './dashboardLayout.shared'

type HorizontalResolution = { x: number; width: number }
type VerticalResolution = { y: number; height: number }
type CollisionMode = 'drag' | 'resize'
type RowOccupant = { id: string; x: number; width: number }

function intersects(a: PanelRect, b: PanelRect) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

function getHorizontalResolution(activePanel: PanelRect, targetPanel: PanelRect) {
  const targetRight = targetPanel.x + targetPanel.width
  const activeRight = activePanel.x + activePanel.width
  const options: HorizontalResolution[] = []

  if (activePanel.x > targetPanel.x) {
    const nextWidth = activePanel.x - targetPanel.x
    if (nextWidth >= targetPanel.minWidth) options.push({ x: targetPanel.x, width: nextWidth })
  }

  if (activeRight < targetRight) {
    const nextX = activeRight
    const nextWidth = targetRight - nextX
    if (nextWidth >= targetPanel.minWidth) options.push({ x: nextX, width: nextWidth })
  }

  return options.length === 0 ? null : options.sort((left, right) => left.width - right.width)[0]
}

function getVerticalResolution(activePanel: PanelRect, targetPanel: PanelRect) {
  const targetBottom = targetPanel.y + targetPanel.height
  const activeBottom = activePanel.y + activePanel.height
  const options: VerticalResolution[] = []

  if (activePanel.y > targetPanel.y) {
    const nextHeight = activePanel.y - targetPanel.y
    if (nextHeight >= targetPanel.minHeight) options.push({ y: targetPanel.y, height: nextHeight })
  }

  if (activeBottom < targetBottom) {
    const nextY = activeBottom
    const nextHeight = targetBottom - nextY
    if (nextHeight >= targetPanel.minHeight) options.push({ y: nextY, height: nextHeight })
  }

  return options.length === 0 ? null : options.sort((top, bottom) => top.height - bottom.height)[0]
}

function resolveActiveDragCollision(activePanel: PanelRect, targetPanel: PanelRect, canvasWidth: number) {
  const options = [
    { distance: Math.abs(activePanel.x - (targetPanel.x - activePanel.width)), apply: () => { activePanel.x = clamp(targetPanel.x - activePanel.width, 0, Math.max(canvasWidth - activePanel.width, 0)) } },
    { distance: Math.abs(activePanel.x - (targetPanel.x + targetPanel.width)), apply: () => { activePanel.x = clamp(targetPanel.x + targetPanel.width, 0, Math.max(canvasWidth - activePanel.width, 0)) } },
    { distance: Math.abs(activePanel.y - (targetPanel.y - activePanel.height)), apply: () => { activePanel.y = Math.max(targetPanel.y - activePanel.height, 0) } },
    { distance: Math.abs(activePanel.y - (targetPanel.y + targetPanel.height)), apply: () => { activePanel.y = Math.max(targetPanel.y + targetPanel.height, 0) } },
  ]

  options.sort((left, right) => left.distance - right.distance)[0]?.apply()
}

function resolveActiveResizeCollision(activePanel: PanelRect, targetPanel: PanelRect, direction: ResizeDirection) {
  const activeRight = activePanel.x + activePanel.width
  const activeBottom = activePanel.y + activePanel.height
  const targetRight = targetPanel.x + targetPanel.width
  const targetBottom = targetPanel.y + targetPanel.height
  const resizeFromLeft = direction === 'left' || direction === 'topLeft' || direction === 'bottomLeft'
  const resizeFromTop = direction === 'top' || direction === 'topLeft' || direction === 'topRight'
  const resizeFromRight = direction === 'right' || direction === 'topRight' || direction === 'bottomRight'
  const resizeFromBottom = direction === 'bottom' || direction === 'bottomLeft' || direction === 'bottomRight'

  if (resizeFromRight) {
    const maxWidthBeforeTarget = targetPanel.x - activePanel.x
    if (maxWidthBeforeTarget >= activePanel.minWidth) activePanel.width = Math.min(activePanel.width, maxWidthBeforeTarget)
  }

  if (resizeFromBottom) {
    const maxHeightBeforeTarget = targetPanel.y - activePanel.y
    if (maxHeightBeforeTarget >= activePanel.minHeight) activePanel.height = Math.min(activePanel.height, maxHeightBeforeTarget)
  }

  if (resizeFromLeft) {
    const nextX = Math.max(activePanel.x, targetRight)
    const nextWidth = activeRight - nextX
    if (nextWidth >= activePanel.minWidth) {
      activePanel.x = nextX
      activePanel.width = nextWidth
    }
  }

  if (resizeFromTop) {
    const nextY = Math.max(activePanel.y, targetBottom)
    const nextHeight = activeBottom - nextY
    if (nextHeight >= activePanel.minHeight) {
      activePanel.y = nextY
      activePanel.height = nextHeight
    }
  }
}

function overlapsVertically(panel: Pick<PanelRect, 'y' | 'height'>, activePanel: Pick<PanelRect, 'y' | 'height'>) {
  return Math.min(getPanelBottom(panel), getPanelBottom(activePanel)) > Math.max(panel.y, activePanel.y)
}

function getRowOccupants(panels: PanelRect[], activePanel: PanelRect) {
  return panels
    .filter((panel) => panel.id !== activePanel.id && panel.windowState === 'normal' && overlapsVertically(panel, activePanel))
    .map((panel) => ({ id: panel.id, x: panel.x, width: panel.width }))
    .sort((left, right) => left.x - right.x)
}

function getLeftAdjacentOccupant(rowOccupants: RowOccupant[], activePanel: PanelRect) {
  return rowOccupants
    .filter((occupant) => getPanelRight(occupant) <= activePanel.x)
    .sort((left, right) => getPanelRight(right) - getPanelRight(left))[0]
}

function getRightAdjacentOccupant(rowOccupants: RowOccupant[], activePanel: PanelRect) {
  return rowOccupants
    .filter((occupant) => occupant.x >= getPanelRight(activePanel))
    .sort((left, right) => left.x - right.x)[0]
}

export function resolveCollisions(
  panels: PanelRect[],
  activePanelId: string,
  canvasWidth: number,
  mode: CollisionMode,
) {
  const nextPanels = panels.map((panel) => ({ ...panel }))
  const activePanel = nextPanels.find((panel) => panel.id === activePanelId)
  const maxPasses = nextPanels.length * 4

  if (!activePanel) return nextPanels

  for (let pass = 0; pass < maxPasses; pass += 1) {
    let resolvedAnyCollision = false

    for (const panel of nextPanels) {
      if (panel.id === activePanelId || !intersects(activePanel, panel)) continue

      const horizontalResolution = getHorizontalResolution(activePanel, panel)
      const verticalResolution = getVerticalResolution(activePanel, panel)

      if (horizontalResolution || verticalResolution) {
        if (horizontalResolution && (!verticalResolution || horizontalResolution.width >= verticalResolution.height)) {
          panel.x = clamp(horizontalResolution.x, 0, Math.max(canvasWidth - horizontalResolution.width, 0))
          panel.width = horizontalResolution.width
        } else if (verticalResolution) {
          panel.y = Math.max(verticalResolution.y, 0)
          panel.height = verticalResolution.height
        }
        resolvedAnyCollision = true
      }

      if (!intersects(activePanel, panel)) continue

      if (mode === 'drag') resolveActiveDragCollision(activePanel, panel, canvasWidth)
      resolvedAnyCollision = true
    }

    if (!resolvedAnyCollision) break
  }

  return nextPanels
}

export function resolveResizePanels(
  panels: PanelRect[],
  activePanelId: string,
  canvasWidth: number,
  direction: ResizeDirection,
) {
  const nextPanels = panels.map((panel) => ({ ...panel }))
  const activePanel = nextPanels.find((panel) => panel.id === activePanelId)
  const maxPasses = nextPanels.length * 4

  if (!activePanel) return nextPanels

  for (let pass = 0; pass < maxPasses; pass += 1) {
    let changed = false

    for (const panel of nextPanels) {
      if (panel.id === activePanelId || !intersects(activePanel, panel)) continue

      const horizontalResolution = getHorizontalResolution(activePanel, panel)
      const verticalResolution = getVerticalResolution(activePanel, panel)

      if (horizontalResolution && (!verticalResolution || horizontalResolution.width >= verticalResolution.height)) {
        const nextX = clamp(horizontalResolution.x, 0, Math.max(canvasWidth - horizontalResolution.width, 0))
        const nextWidth = horizontalResolution.width
        if (nextX !== panel.x || nextWidth !== panel.width) {
          panel.x = nextX
          panel.width = nextWidth
          changed = true
        }
      } else if (verticalResolution) {
        const nextY = Math.max(verticalResolution.y, 0)
        const nextHeight = verticalResolution.height
        if (nextY !== panel.y || nextHeight !== panel.height) {
          panel.y = nextY
          panel.height = nextHeight
          changed = true
        }
      }

      if (!intersects(activePanel, panel)) continue

      const previousX = activePanel.x
      const previousY = activePanel.y
      const previousWidth = activePanel.width
      const previousHeight = activePanel.height
      resolveActiveResizeCollision(activePanel, panel, direction)
      if (activePanel.x !== previousX || activePanel.y !== previousY || activePanel.width !== previousWidth || activePanel.height !== previousHeight) changed = true
    }

    if (!changed) break
  }

  return nextPanels
}

export function absorbRowGapAfterResize(
  panels: PanelRect[],
  activePanelId: string,
  canvasWidth: number,
  resizeSnapshot: PanelSnapshot | null,
) {
  if (!resizeSnapshot || canvasWidth <= 0) return { panels, affectedPanelIds: [] as string[] }

  const nextPanels = panels.map((panel) => ({ ...panel }))
  const activePanel = nextPanels.find((panel) => panel.id === activePanelId)
  if (!activePanel || activePanel.windowState !== 'normal') return { panels, affectedPanelIds: [] as string[] }

  const affectedPanelIds = [activePanel.id]
  const widthWasReduced = activePanel.width < resizeSnapshot.width
  const leftEdgeMovedInward = activePanel.x > resizeSnapshot.x
  const rightEdgeMovedInward = getPanelRight(activePanel) < getPanelRight(resizeSnapshot)
  if (!widthWasReduced || (!leftEdgeMovedInward && !rightEdgeMovedInward)) return { panels, affectedPanelIds: [] as string[] }

  const rowOccupants = getRowOccupants(nextPanels, activePanel)
  let changed = false

  if (leftEdgeMovedInward) {
    const leftAdjacentOccupant = getLeftAdjacentOccupant(rowOccupants, activePanel)
    const gapStart = leftAdjacentOccupant ? getPanelRight(leftAdjacentOccupant) + GRID_MARGIN : 0
    const gapWidth = activePanel.x - gapStart

    if (gapWidth > 0 && leftAdjacentOccupant) {
      const leftSibling = nextPanels.find((panel) => panel.id === leftAdjacentOccupant.id)
      if (leftSibling) {
        leftSibling.width += gapWidth
        affectedPanelIds.push(leftSibling.id)
        changed = true
      }
    } else if (gapWidth > 0) {
      activePanel.x = gapStart
      changed = true
    }
  }

  if (!changed && rightEdgeMovedInward) {
    const activeRight = getPanelRight(activePanel)
    const rightAdjacentOccupant = getRightAdjacentOccupant(rowOccupants, activePanel)
    const gapEnd = rightAdjacentOccupant ? rightAdjacentOccupant.x - GRID_MARGIN : canvasWidth
    const gapWidth = gapEnd - activeRight

    if (gapWidth > 0 && rightAdjacentOccupant) {
      const rightSibling = nextPanels.find((panel) => panel.id === rightAdjacentOccupant.id)
      if (rightSibling) {
        rightSibling.x -= gapWidth
        rightSibling.width += gapWidth
        affectedPanelIds.push(rightSibling.id)
        changed = true
      }
    } else if (gapWidth > 0) {
      activePanel.x += gapWidth
      changed = true
    }
  }

  return { panels: changed ? nextPanels : panels, affectedPanelIds: changed ? [...new Set(affectedPanelIds)] : [] }
}
