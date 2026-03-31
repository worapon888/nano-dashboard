export type ResizeDirection =
  | 'top'
  | 'right'
  | 'bottom'
  | 'left'
  | 'topRight'
  | 'bottomRight'
  | 'bottomLeft'
  | 'topLeft'

export const resizeCursorByDirection: Record<ResizeDirection, string> = {
  top: 'ns-resize',
  right: 'ew-resize',
  bottom: 'ns-resize',
  left: 'ew-resize',
  topRight: 'nesw-resize',
  bottomRight: 'nwse-resize',
  bottomLeft: 'nesw-resize',
  topLeft: 'nwse-resize',
}
