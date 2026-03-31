import { Fragment, memo, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import WidgetShell from '../base/WidgetShell'
import useColumnResize from '../../hooks/useColumnResize'
import type { OrderRow } from '../../types/widget'
import type { ResizeDirection } from '../../types/resize'

// ─── Column definitions ──────────────────────────────────────────────────────

type ColumnAlign = 'left' | 'right' | 'center'

type ColumnDef = {
  key: string
  label: string
  defaultWidth: number
  align: ColumnAlign
}

const COLUMNS: ColumnDef[] = [
  { key: 'symbol',    label: 'Pair',         defaultWidth: 110, align: 'left'   },
  { key: 'side',      label: 'Side',         defaultWidth: 76,  align: 'left'   },
  { key: 'type',      label: 'Type',         defaultWidth: 104, align: 'left'   },
  { key: 'price',     label: 'Price',        defaultWidth: 130, align: 'right'  },
  { key: 'amount',    label: 'Amount',       defaultWidth: 108, align: 'right'  },
  { key: 'filledPct', label: 'Filled',       defaultWidth: 128, align: 'right'  },
  { key: 'total',     label: 'Total (USDT)', defaultWidth: 140, align: 'right'  },
  { key: 'status',    label: 'Status',       defaultWidth: 100, align: 'left'   },
  { key: 'createdAt', label: 'Time',         defaultWidth: 138, align: 'left'   },
]

const EXPAND_COL_WIDTH = 40
const COL_MIN_WIDTH = 60

const INITIAL_WIDTHS: Record<string, number> = Object.fromEntries(
  COLUMNS.map((col) => [col.key, col.defaultWidth]),
)

const STORAGE_KEY = 'nanodashboard:trading-table:column-widths'

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

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

// ─── Atoms ───────────────────────────────────────────────────────────────────

function SideBadge({ side }: { side: OrderRow['side'] }) {
  return (
    <span
      className={[
        'inline-flex items-center rounded px-1.5 py-0.5 text-[0.66rem] font-bold uppercase tracking-[0.1em]',
        side === 'buy'
          ? 'bg-emerald-400/10 text-emerald-300'
          : 'bg-rose-400/10 text-rose-300',
      ].join(' ')}
    >
      {side}
    </span>
  )
}

function TypeBadge({ type }: { type: OrderRow['type'] }) {
  const cfg: Record<OrderRow['type'], { label: string; cls: string }> = {
    market:        { label: 'Market', cls: 'bg-slate-600/20 text-slate-400'  },
    limit:         { label: 'Limit',  cls: 'bg-sky-400/10  text-sky-300'     },
    'stop-limit':  { label: 'Stop',   cls: 'bg-amber-400/10 text-amber-300'  },
    'take-profit': { label: 'TP',     cls: 'bg-teal-400/10  text-teal-300'   },
  }
  const { label, cls } = cfg[type]
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[0.66rem] font-medium ${cls}`}>
      {label}
    </span>
  )
}

function StatusBadge({ status }: { status: OrderRow['status'] }) {
  const cfg: Record<OrderRow['status'], { label: string; textCls: string; dotCls: string }> = {
    open:      { label: 'Open',      textCls: 'text-emerald-300',  dotCls: 'bg-emerald-400'    },
    partial:   { label: 'Partial',   textCls: 'text-amber-300',    dotCls: 'bg-amber-400'      },
    filled:    { label: 'Filled',    textCls: 'text-slate-300',    dotCls: 'bg-slate-400'      },
    cancelled: { label: 'Cancelled', textCls: 'text-rose-400/60',  dotCls: 'bg-rose-400/50'    },
  }
  const { label, textCls, dotCls } = cfg[status]
  return (
    <span className={`inline-flex items-center gap-1.5 text-[0.75rem] font-medium ${textCls}`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotCls}`} />
      {label}
    </span>
  )
}

function FilledBar({ filledPct }: { filledPct: number }) {
  const pct = Math.min(100, Math.max(0, filledPct))
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
  width: number
  isBeingResized: boolean
  onResizeStart: (key: string, width: number, e: ReactMouseEvent) => void
  onResetWidth: (key: string) => void
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
        onMouseDown={(e) => onResizeStart(col.key, width, e)}
        onDoubleClick={() => onResetWidth(col.key)}
        className="absolute inset-y-0 right-0 z-20 w-[5px] cursor-col-resize"
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

// ─── ExpandableRowContent ────────────────────────────────────────────────────

function DetailField({
  label,
  value,
  mono = false,
  cls = 'text-slate-200',
}: {
  label: string
  value: string
  mono?: boolean
  cls?: string
}) {
  return (
    <div className="min-w-0">
      <div className="text-[0.63rem] uppercase tracking-[0.22em] text-slate-600">{label}</div>
      <div
        className={[
          'mt-0.5 truncate text-[0.78rem] font-medium',
          mono ? 'font-mono' : '',
          cls,
        ].join(' ')}
      >
        {value}
      </div>
    </div>
  )
}

type ExpandableRowContentProps = {
  row: OrderRow
  isExpanded: boolean
  colSpan: number
}

function ExpandableRowContent({ row, isExpanded, colSpan }: ExpandableRowContentProps) {
  const baseCurrency = row.symbol.split('/')[0] ?? ''

  return (
    <tr aria-hidden={!isExpanded} className={isExpanded ? '' : 'pointer-events-none'}>
      <td colSpan={colSpan} className="p-0">
        {/*
         * CSS grid trick: grid-template-rows animates from 0fr → 1fr,
         * giving smooth height expansion without knowing the content height.
         */}
        <div
          style={{
            display: 'grid',
            gridTemplateRows: isExpanded ? '1fr' : '0fr',
            transition: 'grid-template-rows 280ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <div
            style={{
              overflow: 'hidden',
              opacity: isExpanded ? 1 : 0,
              transition: 'opacity 180ms ease 80ms',
            }}
          >
            <div className="border-b border-white/6 bg-[#080808] px-4 py-4 pl-12">
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                <DetailField label="Order ID" value={row.id} mono />
                <DetailField
                  label="Avg Fill Price"
                  value={row.averagePrice > 0 ? `$${formatPrice(row.averagePrice)}` : '—'}
                />
                {row.stopPrice != null ? (
                  <DetailField
                    label="Stop Price"
                    value={`$${formatPrice(row.stopPrice)}`}
                    cls="text-amber-300"
                  />
                ) : null}
                <DetailField
                  label="Fee Paid"
                  value={row.fee > 0 ? `$${row.fee.toFixed(4)}` : '—'}
                />
                <DetailField
                  label={`Filled (${baseCurrency})`}
                  value={row.filled > 0 ? formatAmount(row.filled) : '—'}
                />
                <DetailField label="Last Update" value={formatDateTime(row.updatedAt)} />
              </div>

              {row.notes ? (
                <div className="mt-3 border-t border-white/5 pt-3">
                  <p className="text-[0.64rem] uppercase tracking-[0.22em] text-slate-600">
                    Note
                  </p>
                  <p className="mt-1 text-[0.78rem] italic text-slate-400">{row.notes}</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </td>
    </tr>
  )
}

// ─── TableRow ────────────────────────────────────────────────────────────────

type TableRowProps = {
  row: OrderRow
  columns: ColumnDef[]
  columnWidths: Record<string, number>
  isExpanded: boolean
  onToggle: () => void
}

const TableRow = memo(function TableRow({
  row,
  columns,
  columnWidths,
  isExpanded,
  onToggle,
}: TableRowProps) {
  return (
    <tr
      onClick={onToggle}
      className={[
        'group/row cursor-pointer border-b border-white/[0.04]',
        'outline-none transition-colors duration-100',
        isExpanded ? 'bg-white/[0.045]' : 'hover:bg-white/[0.025] active:bg-white/[0.04]',
      ].join(' ')}
    >
      {/* ── Expand chevron ─── */}
      <td className="w-10 py-2.5 pl-3 pr-1">
        <svg
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
          className={[
            'mx-auto h-3.5 w-3.5 shrink-0 transition-transform duration-200',
            isExpanded
              ? 'rotate-90 text-slate-300'
              : 'text-slate-600 group-hover/row:text-slate-400',
          ].join(' ')}
        >
          <path
            d="M6 3l5 5-5 5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </td>

      {columns.map((col) => {
        const alignCls =
          col.align === 'right'
            ? 'text-right'
            : col.align === 'center'
              ? 'text-center'
              : 'text-left'

        let cell: React.ReactNode

        if (col.key === 'symbol') {
          cell = (
            <span className="font-medium tracking-wide text-slate-100">{row.symbol}</span>
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
        } else if (col.key === 'filledPct') {
          cell = <FilledBar filledPct={row.filledPct} />
        } else if (col.key === 'total') {
          cell = (
            <span className="tabular-nums text-slate-200">
              ${row.total.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          )
        } else if (col.key === 'status') {
          cell = <StatusBadge status={row.status} />
        } else if (col.key === 'createdAt') {
          cell = (
            <span className="text-[0.73rem] text-slate-500">{formatDateTime(row.createdAt)}</span>
          )
        }

        return (
          <td
            key={col.key}
            style={{ width: columnWidths[col.key], maxWidth: columnWidths[col.key] }}
            className={`overflow-hidden text-ellipsis whitespace-nowrap px-3 py-2.5 text-sm ${alignCls}`}
          >
            {cell}
          </td>
        )
      })}
    </tr>
  )
})

// ─── TableContainer ───────────────────────────────────────────────────────────

type TableContainerProps = {
  rows: OrderRow[]
  isWidgetResizing: boolean
}

function TableContainer({ rows, isWidgetResizing }: TableContainerProps) {
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null)

  const { columnWidths, resizingColumn, startResize, resetColumnWidth } = useColumnResize({
    initialWidths: INITIAL_WIDTHS,
    minWidth: COL_MIN_WIDTH,
    storageKey: STORAGE_KEY,
  })

  const totalMinWidth =
    EXPAND_COL_WIDTH + COLUMNS.reduce((sum, col) => sum + columnWidths[col.key], 0)

  const colSpan = COLUMNS.length + 1

  function handleToggle(rowId: string) {
    setExpandedRowId((prev) => (prev === rowId ? null : rowId))
  }

  return (
    /*
     * h-full fills the body flex item; overflow-auto gives the table
     * its own scroll context so the sticky header stays visible.
     * pointer-events-none during widget resize prevents accidental row clicks.
     */
    <div className={`h-full overflow-auto ${isWidgetResizing ? 'pointer-events-none' : ''}`}>
      <table
        className="border-separate border-spacing-0"
        style={{ tableLayout: 'fixed', width: '100%', minWidth: totalMinWidth }}
      >
        <colgroup>
          {/* Expand-chevron column */}
          <col style={{ width: EXPAND_COL_WIDTH }} />
          {COLUMNS.map((col) => (
            <col key={col.key} style={{ width: columnWidths[col.key] }} />
          ))}
        </colgroup>

        {/* ── TableHeader ──────────────────────────────────────────────── */}
        <thead>
          <tr>
            <th
              scope="col"
              style={{ width: EXPAND_COL_WIDTH }}
              className="sticky top-0 z-10 border-b border-white/6 bg-[#0c0c0c]"
            />
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
            <Fragment key={row.id}>
              <TableRow
                row={row}
                columns={COLUMNS}
                columnWidths={columnWidths}
                isExpanded={expandedRowId === row.id}
                onToggle={() => handleToggle(row.id)}
              />
              <ExpandableRowContent
                row={row}
                isExpanded={expandedRowId === row.id}
                colSpan={colSpan}
              />
            </Fragment>
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
  rows: OrderRow[]
  isMinimized?: boolean
  isMaximized?: boolean
  isDragging?: boolean
  isResizing?: boolean
  onDragMouseDown?: (event: ReactMouseEvent<HTMLElement>) => void
  onResizeHandleMouseDown?: (
    direction: ResizeDirection,
    event: ReactMouseEvent<HTMLElement>,
  ) => void
  onResetToDefault?: () => void
  onMinimizeToggle?: () => void
  onMaximizeToggle?: () => void
}

function TradingTable({
  title,
  rows,
  isMinimized = false,
  isMaximized = false,
  isDragging = false,
  isResizing = false,
  onDragMouseDown,
  onResizeHandleMouseDown,
  onResetToDefault,
  onMinimizeToggle,
  onMaximizeToggle,
}: TradingTableProps) {
  function stopEvent(e: ReactMouseEvent<HTMLElement>) {
    e.preventDefault()
    e.stopPropagation()
  }

  const activeCount = rows.filter(
    (r) => r.status === 'open' || r.status === 'partial',
  ).length

  const windowControls = (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label={isMinimized ? `Restore ${title}` : `Minimize ${title}`}
        onMouseDown={stopEvent}
        onClick={onMinimizeToggle}
        className="h-3 w-3 rounded-full bg-rose-500/90 transition hover:bg-rose-400"
      />
      <button
        type="button"
        aria-label={`Reset ${title} to default size`}
        onMouseDown={stopEvent}
        onClick={onResetToDefault}
        className="h-3 w-3 rounded-full bg-amber-400/90 transition hover:bg-amber-300"
      />
      <button
        type="button"
        aria-label={isMaximized ? `Restore ${title}` : `Maximize ${title}`}
        onMouseDown={stopEvent}
        onClick={onMaximizeToggle}
        className="h-3 w-3 rounded-full bg-emerald-500/90 transition hover:bg-emerald-400"
      />
    </div>
  )

  return (
    <WidgetShell
      title={title}
      subtitle={`${activeCount} active · ${rows.length} total`}
      action={windowControls}
      className={`relative flex h-full flex-col ${isDragging || isResizing ? 'select-none' : ''}`}
      headerClassName={onDragMouseDown ? 'cursor-grab active:cursor-grabbing' : ''}
      bodyClassName={isMinimized ? 'overflow-hidden p-0' : 'flex flex-1 flex-col overflow-hidden'}
      isResizeActive={isResizing}
      onHeaderMouseDown={onDragMouseDown}
      onResizeHandleMouseDown={
        onResizeHandleMouseDown && !isMinimized && !isMaximized
          ? onResizeHandleMouseDown
          : undefined
      }
    >
      {!isMinimized ? (
        <TableContainer rows={rows} isWidgetResizing={isResizing} />
      ) : null}
    </WidgetShell>
  )
}

export default TradingTable
