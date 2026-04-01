import { memo, useMemo, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import WidgetShell from '../../../shared/components/WidgetShell'
import useColumnResize from '../hooks/useColumnResize'
import type { ResizeDirection } from '../../../shared/types/resize'
import type { OpenOrderItem, OpenOrdersSummary } from '../../../types/dashboard'

// ─── Column definitions ──────────────────────────────────────────────────────

type ColumnAlign = 'left' | 'right' | 'center'

type ColumnDef = {
  key: string
  label: string
  defaultWidth: number
  align: ColumnAlign
}

const COLUMNS: ColumnDef[] = [
  { key: 'pair',      label: 'Pair',         defaultWidth: 110, align: 'left'   },
  { key: 'side',      label: 'Side',         defaultWidth: 76,  align: 'left'   },
  { key: 'type',      label: 'Type',         defaultWidth: 104, align: 'left'   },
  { key: 'price',     label: 'Price',        defaultWidth: 130, align: 'right'  },
  { key: 'amount',    label: 'Amount',       defaultWidth: 108, align: 'right'  },
  { key: 'filledPercent', label: 'Filled',   defaultWidth: 128, align: 'right'  },
  { key: 'totalUsd',  label: 'Total (USDT)', defaultWidth: 140, align: 'right'  },
  { key: 'status',    label: 'Status',       defaultWidth: 100, align: 'left'   },
  { key: 'createdAtLabel', label: 'Time',    defaultWidth: 138, align: 'left'   },
]

const COL_MIN_WIDTH = 60

const INITIAL_WIDTHS: Record<string, number> = Object.fromEntries(
  COLUMNS.map((col) => [col.key, col.defaultWidth]),
)

const STORAGE_KEY = 'nanodashboard:trading-table:column-widths'

function getColumnWidthVarName(columnKey: string) {
  return `--table-col-${columnKey}`
}

function getOrderDetails(row: OpenOrderItem) {
  const fee = Math.max(0.45, row.totalUsd * 0.0008)
  const notes =
    row.status === 'Partial'
      ? 'Partially filled and still waiting on matching liquidity.'
      : row.status === 'Open'
        ? 'Order is resting on the book and can still be edited or cancelled.'
        : row.status === 'Filled'
          ? 'Execution completed successfully and is ready for settlement review.'
          : 'Order was cancelled before completion. Review the trigger conditions.'

  return {
    fee,
    createdAt: row.createdAtLabel,
    notes,
  }
}

// ─── Formatters ──────────────────────────────────────────────────────────────

function formatPrice(price: number): string {
  if (price === 0) return '—'
  if (price < 1) return price.toFixed(4)
  if (price < 100) return price.toFixed(2)
  return price.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatAmount(amount: number): string {
  if (amount === 0) return '—'
  if (amount >= 1_000) return amount.toLocaleString('en-US')
  if (amount < 1) return amount.toFixed(4)
  return amount.toFixed(2)
}

function formatUpdatedAtLabel(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Unknown update'
  }
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

// ─── Atoms ───────────────────────────────────────────────────────────────────

function SideBadge({ side }: { side: OpenOrderItem['side'] }) {
  return (
    <span
      className={[
        'inline-flex items-center rounded px-1.5 py-0.5 text-[0.66rem] font-bold uppercase tracking-[0.1em]',
        side === 'BUY'
          ? 'bg-emerald-400/10 text-emerald-300'
          : 'bg-rose-400/10 text-rose-300',
      ].join(' ')}
    >
      {side}
    </span>
  )
}

function TypeBadge({ type }: { type: OpenOrderItem['type'] }) {
  const cfg: Record<string, { label: string; cls: string }> = {
    Market: { label: 'Market', cls: 'bg-slate-600/20 text-slate-400' },
    Limit: { label: 'Limit', cls: 'bg-sky-400/10  text-sky-300' },
    Stop: { label: 'Stop', cls: 'bg-amber-400/10 text-amber-300' },
    TP: { label: 'TP', cls: 'bg-teal-400/10  text-teal-300' },
  }
  const { label, cls } = cfg[type] ?? { label: type, cls: 'bg-white/10 text-slate-300' }
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[0.66rem] font-medium ${cls}`}>
      {label}
    </span>
  )
}

function StatusBadge({ status }: { status: OpenOrderItem['status'] }) {
  const cfg: Record<OpenOrderItem['status'], { label: string; textCls: string; dotCls: string }> = {
    Open: { label: 'Open', textCls: 'text-emerald-300', dotCls: 'bg-emerald-400' },
    Partial: { label: 'Partial', textCls: 'text-amber-300', dotCls: 'bg-amber-400' },
    Filled: { label: 'Filled', textCls: 'text-slate-300', dotCls: 'bg-slate-400' },
    Cancelled: { label: 'Cancelled', textCls: 'text-rose-400/60', dotCls: 'bg-rose-400/50' },
  }
  const { label, textCls, dotCls } = cfg[status]
  return (
    <span className={`inline-flex items-center gap-1.5 text-[0.75rem] font-medium ${textCls}`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotCls}`} />
      {label}
    </span>
  )
}

function FilledBar({ filledPercent }: { filledPercent: number }) {
  const pct = Math.min(100, Math.max(0, filledPercent))
  const barCls =
    pct === 100 ? 'bg-emerald-400' : pct === 0 ? 'bg-white/10' : 'bg-amber-400'
  const label =
    pct === 0 ? '—' : `${pct % 1 === 0 ? pct : pct.toFixed(1)}%`
  return (
    <div className="inline-flex items-center justify-end gap-2">
      <span className="min-w-[2.8rem] text-right text-[0.75rem] tabular-nums text-slate-300">
        {label}
      </span>
      <div className="h-1 w-8 shrink-0 overflow-hidden rounded-full bg-white/8">
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${barCls}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ─── ResizableColumnHeader ────────────────────────────────────────────────────

type ResizableColumnHeaderProps = {
  col: ColumnDef
  isBeingResized: boolean
  onResizeStart: (key: string, width: number, e: ReactPointerEvent | ReactMouseEvent) => void
  onResetWidth: (key: string) => void
  width: number
}

function ResizableColumnHeader({
  col,
  width,
  isBeingResized,
  onResizeStart,
  onResetWidth,
}: ResizableColumnHeaderProps) {
  const alignCls =
    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'

  return (
    <th
      scope="col"
      style={{ width, textAlign: col.align }}
      className={`
        group/th relative select-none overflow-hidden
        sticky top-0 z-10
        border-b border-white/6
        bg-[#0c0c0c]
        px-3 py-2.5
        text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-slate-500
        ${alignCls}
      `}
    >
      <span className="block truncate">{col.label}</span>

      {/* ── Resize handle ──────────────────────────────────────────────── */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={`Resize ${col.label} column`}
        onPointerDown={(e) => onResizeStart(col.key, width, e)}
        onDoubleClick={() => onResetWidth(col.key)}
        className="absolute inset-y-0 right-0 z-20 w-[5px] cursor-col-resize touch-none"
      >
        {/* Visual indicator: invisible by default, fades in on hover / active */}
        <div
          className={[
            'absolute inset-y-2 right-[2px] w-px rounded-full transition-all duration-150',
            isBeingResized
              ? 'bg-emerald-400/80 opacity-100 shadow-[0_0_4px_rgba(52,211,153,0.5)]'
              : 'bg-white/0 group-hover/th:bg-white/20',
          ].join(' ')}
        />
      </div>
    </th>
  )
}

type TableRowProps = {
  row: OpenOrderItem
  columns: ColumnDef[]
  expanded: boolean
  onToggle: (rowId: string) => void
  colSpan: number
}

const TableRow = memo(function TableRow({
  row,
  columns,
  expanded,
  onToggle,
  colSpan,
}: TableRowProps) {
  const details = getOrderDetails(row)

  return (
    <>
      <tr
        onClick={() => { onToggle(row.id) }}
        aria-expanded={expanded}
        className={[
          'group/row cursor-pointer border-b border-white/[0.04]',
          'outline-none transition-colors duration-100',
          expanded ? 'bg-white/[0.035]' : 'hover:bg-white/[0.025] active:bg-white/[0.04]',
        ].join(' ')}
      >
        {columns.map((col) => {
          const alignCls =
            col.align === 'right'
              ? 'text-right'
              : col.align === 'center'
                ? 'text-center'
                : 'text-left'

          let cell: React.ReactNode

          if (col.key === 'pair') {
            cell = (
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={[
                    'inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/8 bg-white/[0.03] text-[0.62rem] text-slate-400 transition-transform duration-300',
                    expanded ? 'rotate-90 text-slate-200' : '',
                  ].join(' ')}
                >
                  ›
                </span>
                <span className="font-medium tracking-wide text-slate-100">{row.pair}</span>
              </div>
            )
          } else if (col.key === 'side') {
            cell = <SideBadge side={row.side} />
          } else if (col.key === 'type') {
            cell = <TypeBadge type={row.type} />
          } else if (col.key === 'price') {
            cell = (
              <span className="tabular-nums text-slate-200">${formatPrice(row.price)}</span>
            )
          } else if (col.key === 'amount') {
            cell = (
              <span className="tabular-nums text-slate-300">{formatAmount(row.amount)}</span>
            )
          } else if (col.key === 'filledPercent') {
            cell = <FilledBar filledPercent={row.filledPercent} />
          } else if (col.key === 'totalUsd') {
            cell = (
              <span className="tabular-nums text-slate-200">
                ${row.totalUsd.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            )
          } else if (col.key === 'status') {
            cell = <StatusBadge status={row.status} />
          } else if (col.key === 'createdAtLabel') {
            cell = (
              <span className="text-[0.73rem] text-slate-500">{row.createdAtLabel}</span>
            )
          }

          return (
            <td
              key={col.key}
              style={{
                width: `var(${getColumnWidthVarName(col.key)})`,
                maxWidth: `var(${getColumnWidthVarName(col.key)})`,
              }}
              className={`overflow-hidden text-ellipsis whitespace-nowrap px-3 py-2.5 text-sm ${alignCls}`}
            >
              {cell}
            </td>
          )
        })}
      </tr>
      {expanded ? (
        <tr className="border-b border-white/[0.04]">
          <td colSpan={colSpan} className="p-0">
            <div className="grid overflow-hidden transition-all duration-300 ease-out grid-rows-[1fr] opacity-100">
              <div className="min-h-0">
                <div className="border-t border-white/[0.03] bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] px-4 py-4">
                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="rounded-xl border border-white/8 bg-[#0b0f14] px-3 py-3">
                      <p className="text-[0.62rem] uppercase tracking-[0.18em] text-slate-500">Order ID</p>
                      <p className="mt-2 text-sm font-medium text-white">{row.id}</p>
                    </div>
                    <div className="rounded-xl border border-white/8 bg-[#0b0f14] px-3 py-3">
                      <p className="text-[0.62rem] uppercase tracking-[0.18em] text-slate-500">Fee</p>
                      <p className="mt-2 text-sm font-medium text-white">
                        ${details.fee.toFixed(2)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/8 bg-[#0b0f14] px-3 py-3">
                      <p className="text-[0.62rem] uppercase tracking-[0.18em] text-slate-500">Created At</p>
                      <p className="mt-2 text-sm font-medium text-white">{details.createdAt}</p>
                    </div>
                    <div className="rounded-xl border border-white/8 bg-[#0b0f14] px-3 py-3">
                      <p className="text-[0.62rem] uppercase tracking-[0.18em] text-slate-500">Notes</p>
                      <p className="mt-2 text-sm leading-6 text-slate-300">{details.notes}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  )
})

// ─── TableContainer ───────────────────────────────────────────────────────────

type TableContainerProps = {
  rows: OpenOrderItem[]
  isWidgetResizing: boolean
}

function TableContainer({ rows, isWidgetResizing }: TableContainerProps) {
  const { columnWidths, resizingColumn, startResize, resetColumnWidth } = useColumnResize({
    initialWidths: INITIAL_WIDTHS,
    minWidth: COL_MIN_WIDTH,
    storageKey: STORAGE_KEY,
  })
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null)

  const totalMinWidth = COLUMNS.reduce((sum, col) => sum + columnWidths[col.key], 0)
  const tableColumnStyle = useMemo(
    () =>
      ({
        ...Object.fromEntries(
          COLUMNS.map((col) => [getColumnWidthVarName(col.key), `${columnWidths[col.key]}px`]),
        ),
        tableLayout: 'fixed',
        width: '100%',
        minWidth: totalMinWidth,
      }) as CSSProperties,
    [columnWidths, totalMinWidth],
  )

  const colSpan = COLUMNS.length

  function handleToggleRow(rowId: string) {
    if (isWidgetResizing) {
      return
    }

    setExpandedRowId((current) => (current === rowId ? null : rowId))
  }

  return (
    /*
     * h-full fills the body flex item; overflow-auto gives the table
     * its own scroll context so the sticky header stays visible.
     * pointer-events-none during widget resize prevents accidental row clicks.
     */
    <div
      data-lenis-prevent
      className={`h-full overflow-auto ${isWidgetResizing ? 'pointer-events-none' : ''}`}
    >
      <table
        className="border-separate border-spacing-0"
        style={tableColumnStyle}
      >
        <colgroup>
          {COLUMNS.map((col) => (
            <col key={col.key} style={{ width: `var(${getColumnWidthVarName(col.key)})` }} />
          ))}
        </colgroup>

        {/* ── TableHeader ──────────────────────────────────────────────── */}
        <thead>
          <tr>
            {COLUMNS.map((col) => (
              <ResizableColumnHeader
                key={col.key}
                col={col}
                width={columnWidths[col.key]}
                isBeingResized={resizingColumn === col.key}
                onResizeStart={startResize}
                onResetWidth={resetColumnWidth}
              />
            ))}
          </tr>
        </thead>

        {/* ── TableBody ────────────────────────────────────────────────── */}
        <tbody>
          {rows.map((row) => (
            <TableRow
              key={row.id}
              row={row}
              columns={COLUMNS}
              expanded={expandedRowId === row.id}
              onToggle={handleToggleRow}
              colSpan={colSpan}
            />
          ))}

          {rows.length === 0 ? (
            <tr>
              <td colSpan={colSpan} className="py-14 text-center text-sm text-slate-600">
                No orders found
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  )
}

// ─── TradingTable (public API) ────────────────────────────────────────────────

export type TradingTableProps = {
  title: string
  data?: OpenOrdersSummary | null
  loading?: boolean
  error?: string | null
  isMinimized?: boolean
  isMaximized?: boolean
  isDragging?: boolean
  isResizing?: boolean
  onDragPointerDown?: (event: ReactPointerEvent<HTMLElement>) => void
  onResizeHandlePointerDown?: (
    direction: ResizeDirection,
    event: ReactPointerEvent<HTMLElement>,
  ) => void
  onResetToDefault?: () => void
  onMinimizeToggle?: () => void
  onMaximizeToggle?: () => void
}

function TradingTable({
  title,
  data = null,
  loading = false,
  error = null,
  isMinimized = false,
  isMaximized = false,
  isDragging = false,
  isResizing = false,
  onDragPointerDown,
  onResizeHandlePointerDown,
  onResetToDefault,
  onMinimizeToggle,
  onMaximizeToggle,
}: TradingTableProps) {
  function stopEvent(e: ReactPointerEvent<HTMLElement>) {
    e.preventDefault()
    e.stopPropagation()
  }

  function handleControlPointerDown(
    event: ReactPointerEvent<HTMLElement>,
    action?: () => void,
  ) {
    stopEvent(event)
    action?.()
  }

  function handleKeyboardClick(
    event: ReactPointerEvent<HTMLElement> | React.MouseEvent<HTMLElement>,
    action?: () => void,
  ) {
    if (event.detail === 0) {
      action?.()
    }
  }
  const summary = data
  const activeCount = summary?.activeCount ?? 0
  const totalCount = summary?.totalCount ?? 0
  const orderItems = summary?.items ?? []
  const updatedAtLabel = summary ? formatUpdatedAtLabel(summary.updatedAt) : null

  const windowControls = (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label={isMinimized ? `Restore ${title}` : `Minimize ${title}`}
        onPointerDown={(event) => handleControlPointerDown(event, onMinimizeToggle)}
        onClick={(event) => handleKeyboardClick(event, onMinimizeToggle)}
        className="h-3 w-3 rounded-full bg-rose-500/90 transition hover:bg-rose-400"
      />
      <button
        type="button"
        aria-label={`Reset ${title} to default size`}
        onPointerDown={(event) => handleControlPointerDown(event, onResetToDefault)}
        onClick={(event) => handleKeyboardClick(event, onResetToDefault)}
        className="h-3 w-3 rounded-full bg-amber-400/90 transition hover:bg-amber-300"
      />
      <button
        type="button"
        aria-label={isMaximized ? `Restore ${title}` : `Maximize ${title}`}
        onPointerDown={(event) => handleControlPointerDown(event, onMaximizeToggle)}
        onClick={(event) => handleKeyboardClick(event, onMaximizeToggle)}
        className="h-3 w-3 rounded-full bg-emerald-500/90 transition hover:bg-emerald-400"
      />
    </div>
  )

  return (
    <WidgetShell
      title={title}
      subtitle={`${activeCount} active · ${totalCount} total`}
      action={windowControls}
      className={`relative flex h-full flex-col ${isDragging || isResizing ? 'select-none' : ''}`}
      headerClassName={onDragPointerDown ? 'cursor-grab active:cursor-grabbing' : ''}
      bodyClassName={isMinimized ? 'overflow-hidden p-0' : 'flex flex-1 flex-col overflow-hidden'}
      isResizeActive={isResizing}
      onHeaderPointerDown={onDragPointerDown}
      onResizeHandlePointerDown={
        onResizeHandlePointerDown && !isMinimized && !isMaximized
          ? onResizeHandlePointerDown
          : undefined
      }
    >
      {!isMinimized ? (
        loading && orderItems.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6 text-sm text-slate-500">
            Loading open orders...
          </div>
        ) : error && orderItems.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-rose-300/80">
            {error}
          </div>
        ) : orderItems.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6 text-sm text-slate-500">
            No open orders available
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            {updatedAtLabel ? (
              <div className="border-b border-white/6 px-4 py-2 text-[0.66rem] uppercase tracking-[0.2em] text-slate-500">
                Updated {updatedAtLabel}
              </div>
            ) : null}
            <div className="min-h-0 flex-1">
              <TableContainer rows={orderItems} isWidgetResizing={isResizing} />
            </div>
          </div>
        )
      ) : null}
    </WidgetShell>
  )
}

export default TradingTable
