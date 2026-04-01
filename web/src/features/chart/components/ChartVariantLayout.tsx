import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import type { ChartType } from '../../../shared/types/widget'
import type { BtcTrendRange, DailyPnlRange } from '../../../types/dashboard'
import type {
  ChartVariantFlags,
  DailyPnlMetrics,
  LineTrendMetrics,
} from '../lib/chartWidgetModel'

type ChartVariantLayoutProps = {
  chartType: ChartType
  variantFlags: ChartVariantFlags
  lineMetrics: LineTrendMetrics
  dailyPnlMetrics: DailyPnlMetrics
  rangeLabels: string[]
  selectedRange?: BtcTrendRange
  onRangeChange?: (range: BtcTrendRange) => void
  isRangeUpdating?: boolean
  liveStatus?: 'connecting' | 'live' | 'offline'
  selectedVolumeTimeframe?: BtcTrendRange
  onVolumeTimeframeChange?: (range: BtcTrendRange) => void
  isVolumeUpdating?: boolean
  totalVolume?: number
  dailyPnlRange?: DailyPnlRange
  onDailyPnlRangeChange?: (range: DailyPnlRange) => void
  isDailyPnlUpdating?: boolean
  onControlPointerDown: (event: ReactPointerEvent<HTMLElement>) => void
  children: ReactNode
}

type ChartPresenterProps = Omit<ChartVariantLayoutProps, 'chartType'>

function ChartLayoutFrame({
  containerClassName,
  children,
}: {
  containerClassName: string
  children: ReactNode
}) {
  return (
    <div
      className={`relative flex h-full min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden ${containerClassName}`}
    >
      {children}
    </div>
  )
}

function MarketTrendHeader({
  rangeLabels,
  selectedRange,
  onRangeChange,
  isRangeUpdating,
  liveStatus,
  lineMetrics,
  onControlPointerDown,
}: {
  rangeLabels: string[]
  selectedRange?: BtcTrendRange
  onRangeChange?: (range: BtcTrendRange) => void
  isRangeUpdating?: boolean
  liveStatus?: 'connecting' | 'live' | 'offline'
  lineMetrics: LineTrendMetrics
  onControlPointerDown: (event: ReactPointerEvent<HTMLElement>) => void
}) {
  const rangeKeys: BtcTrendRange[] = ['15m', '1h', '4h', '1d']
  const liveToneClass =
    liveStatus === 'live'
      ? 'text-emerald-300'
      : liveStatus === 'connecting'
        ? 'text-amber-300'
        : 'text-slate-500'
  const liveDotClass =
    liveStatus === 'live'
      ? 'bg-emerald-300'
      : liveStatus === 'connecting'
        ? 'bg-amber-300'
        : 'bg-slate-500/80'

  return (
    <div className="relative z-[1] mb-1 flex items-center justify-between gap-4 px-0.5">
      <div className="inline-flex rounded-lg border border-white/6 bg-white/[0.03] p-0.5 self-start">
        {rangeLabels.map((rangeLabel, index) => {
          const rangeKey = rangeKeys[index] ?? '1h'
          const isActive = selectedRange === rangeKey

          return (
          <button
            key={rangeLabel}
            type="button"
            onPointerDown={onControlPointerDown}
            onClick={() => {
              if (!onRangeChange || isActive) {
                return
              }

              onRangeChange(rangeKey)
            }}
            disabled={isRangeUpdating && !isActive}
            className={`rounded-md px-3.5 py-1.5 text-[11px] font-medium transition ${
              isActive
                ? 'bg-white/[0.14] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                : 'text-slate-400 hover:text-slate-200'
            } ${isRangeUpdating && !isActive ? 'cursor-wait opacity-70' : ''}`}
          >
            {rangeLabel}
          </button>
        )})}
      </div>
      <div className="flex min-w-[112px] flex-col items-end justify-center text-right">
        <div className="flex items-center gap-2 text-[0.62rem] uppercase tracking-[0.22em]">
          <span className="text-slate-500">Live Price</span>
          <span
            data-testid="btc-live-status"
            className={`inline-flex items-center gap-1.5 ${liveToneClass}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${liveDotClass}`} />
            <span>{liveStatus === 'live' ? 'Live' : liveStatus === 'connecting' ? 'Syncing' : 'Offline'}</span>
          </span>
        </div>
        <div
          data-testid="btc-live-price"
          className="mt-0.5 text-[1.15rem] font-semibold leading-none text-[#E5E7EB]"
        >
          {lineMetrics.latestValue !== null
            ? `$${Math.round(lineMetrics.latestValue).toLocaleString()}`
            : '--'}
        </div>
        <div
          className={`mt-1 text-[0.74rem] font-medium leading-none ${lineMetrics.trendColorClass}`}
        >
          {lineMetrics.formattedChange} ({lineMetrics.formattedChangePercent})
        </div>
      </div>
    </div>
  )
}

function DailyPnlHeader({
  dailyPnlMetrics,
  dailyPnlRange,
  onDailyPnlRangeChange,
  isDailyPnlUpdating,
  onControlPointerDown,
}: {
  dailyPnlMetrics: DailyPnlMetrics
  dailyPnlRange?: DailyPnlRange
  onDailyPnlRangeChange?: (range: DailyPnlRange) => void
  isDailyPnlUpdating?: boolean
  onControlPointerDown: (event: ReactPointerEvent<HTMLElement>) => void
}) {
  const rangeKeys: DailyPnlRange[] = ['week', 'month', 'year']
  const rangeLabels = ['Week', 'Month', 'Year']
  const netLabel =
    dailyPnlRange === 'month' ? 'Monthly Net' : dailyPnlRange === 'year' ? 'Yearly Net' : 'Weekly Net'

  return (
    <div className="mb-1.5 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="text-[0.64rem] uppercase tracking-[0.24em] text-slate-500">
          {netLabel}
        </div>
        <div
          className={`mt-1 text-[0.95rem] font-medium ${
            dailyPnlMetrics.total >= 0 ? 'text-[#22C55E]' : 'text-[#f0a2a2]'
          }`}
        >
          {`${dailyPnlMetrics.total >= 0 ? '+' : ''}${dailyPnlMetrics.total.toLocaleString()}`}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="inline-flex rounded-lg border border-white/6 bg-white/[0.03] p-0.5">
          {rangeLabels.map((rangeLabel, index) => {
            const rangeKey = rangeKeys[index] ?? 'week'
            const isActive = dailyPnlRange === rangeKey

            return (
              <button
                key={rangeKey}
                type="button"
                onPointerDown={onControlPointerDown}
                onClick={() => {
                  if (!onDailyPnlRangeChange || isActive) {
                    return
                  }

                  onDailyPnlRangeChange(rangeKey)
                }}
                disabled={isDailyPnlUpdating && !isActive}
                className={`rounded-md px-3 py-1.5 text-[11px] font-medium transition ${
                  isActive
                    ? 'bg-white/[0.14] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                    : 'text-slate-400 hover:text-slate-200'
                } ${isDailyPnlUpdating && !isActive ? 'cursor-wait opacity-70' : ''}`}
              >
                {rangeLabel}
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-2 text-[0.68rem] uppercase tracking-[0.22em] text-slate-500">
          <span>Win</span>
          <span className="text-sm font-semibold tracking-normal text-[#22C55E]">
            {dailyPnlMetrics.positiveDays}
          </span>
          <span className="text-white/20">|</span>
          <span>Loss</span>
          <span className="text-sm font-semibold tracking-normal text-[#ff5c5c]">
            {dailyPnlMetrics.negativeDays}
          </span>
        </div>
      </div>
    </div>
  )
}

function VolumeProfileHeader({
  rangeLabels,
  selectedVolumeTimeframe,
  onVolumeTimeframeChange,
  isVolumeUpdating,
  totalVolume,
  onControlPointerDown,
}: {
  rangeLabels: string[]
  selectedVolumeTimeframe?: BtcTrendRange
  onVolumeTimeframeChange?: (range: BtcTrendRange) => void
  isVolumeUpdating?: boolean
  totalVolume?: number
  onControlPointerDown: (event: ReactPointerEvent<HTMLElement>) => void
}) {
  const rangeKeys: BtcTrendRange[] = ['15m', '1h', '4h', '1d']
  const formattedTotalVolume =
    totalVolume && totalVolume > 0
      ? totalVolume.toLocaleString(undefined, {
          maximumFractionDigits: totalVolume >= 1000 ? 0 : 2,
        })
      : '--'

  return (
    <div className="mb-2 flex items-center justify-between gap-3">
      <div className="inline-flex rounded-lg border border-white/6 bg-white/[0.03] p-0.5">
        {rangeLabels.map((rangeLabel, index) => {
          const rangeKey = rangeKeys[index] ?? '1h'
          const isActive = selectedVolumeTimeframe === rangeKey

          return (
            <button
              key={rangeLabel}
              type="button"
              onPointerDown={onControlPointerDown}
              onClick={() => {
                if (!onVolumeTimeframeChange || isActive) {
                  return
                }

                onVolumeTimeframeChange(rangeKey)
              }}
              disabled={isVolumeUpdating && !isActive}
              className={`rounded-md px-3 py-1.5 text-[11px] font-medium transition ${
                isActive
                  ? 'bg-white/[0.14] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                  : 'text-slate-400 hover:text-slate-200'
              } ${isVolumeUpdating && !isActive ? 'cursor-wait opacity-70' : ''}`}
            >
              {rangeLabel}
            </button>
          )
        })}
      </div>
      <div className="text-right">
        <div className="text-[0.62rem] uppercase tracking-[0.22em] text-slate-500">
          Total Volume
        </div>
        <div className="mt-1 text-sm font-semibold text-slate-200">
          {formattedTotalVolume === '--' ? formattedTotalVolume : `${formattedTotalVolume} BTC`}
        </div>
      </div>
    </div>
  )
}

function DailyPnlFooter({ dailyPnlMetrics }: { dailyPnlMetrics: DailyPnlMetrics }) {
  return (
    <div className="mt-3 flex items-end justify-between gap-4 border-t border-white/6 pt-2">
      <div>
        <div className="text-[0.64rem] uppercase tracking-[0.22em] text-slate-500">Best</div>
        <div className="mt-1 text-sm font-semibold text-[#22C55E]">
          {dailyPnlMetrics.strongestValue !== null
            ? `${dailyPnlMetrics.strongestValue >= 0 ? '+' : ''}${dailyPnlMetrics.strongestValue.toLocaleString()}`
            : '--'}
        </div>
      </div>
      <div className="text-center">
        <div className="text-[0.64rem] uppercase tracking-[0.22em] text-slate-500">Avg</div>
        <div className="mt-1 text-sm font-semibold text-white/70">
          {dailyPnlMetrics.averageValue !== null
            ? `${dailyPnlMetrics.averageValue >= 0 ? '+' : ''}${dailyPnlMetrics.averageValue.toFixed(0)}`
            : '--'}
        </div>
      </div>
      <div className="text-right">
        <div className="text-[0.64rem] uppercase tracking-[0.22em] text-slate-500">Worst</div>
        <div className="mt-1 text-sm font-semibold text-[#ff5c5c]">
          {dailyPnlMetrics.weakestValue !== null
            ? `${dailyPnlMetrics.weakestValue >= 0 ? '+' : ''}${dailyPnlMetrics.weakestValue.toLocaleString()}`
            : '--'}
        </div>
      </div>
    </div>
  )
}

function LineTrendFooter({
  variantFlags,
  lineMetrics,
}: {
  variantFlags: ChartVariantFlags
  lineMetrics: LineTrendMetrics
}) {
  return (
    <div className="relative z-[1] mt-3 flex items-end justify-between gap-3 border-t border-white/6 pt-2.5">
      <div>
        {variantFlags.isMarketTrendWidget ? (
          <div className="text-[0.64rem] uppercase tracking-[0.2em] text-slate-500">
            Intraday Trend
          </div>
        ) : (
          <>
            <div className="text-[0.72rem] uppercase tracking-[0.22em] text-slate-500">
              Total Change
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-semibold text-slate-100">
                {lineMetrics.latestValue?.toLocaleString() ?? '--'}
              </span>
              <span className={`text-base font-medium ${lineMetrics.trendColorClass}`}>
                {lineMetrics.formattedChange}
              </span>
            </div>
          </>
        )}
      </div>
      <div className="text-right">
        <div className="text-[0.64rem] uppercase tracking-[0.2em] text-slate-500">
          {variantFlags.isMarketTrendWidget ? '24H Change' : 'Performance'}
        </div>
        {variantFlags.isMarketTrendWidget ? (
          <div className={`mt-1 text-[0.92rem] font-semibold leading-none ${lineMetrics.trendColorClass}`}>
            {lineMetrics.formattedChange} ({lineMetrics.formattedChangePercent})
          </div>
        ) : (
          <div className={`mt-1 text-3xl font-semibold ${lineMetrics.trendColorClass}`}>
            {lineMetrics.deltaPercent !== null
              ? `${lineMetrics.deltaPercent > 0 ? '+' : ''}${lineMetrics.deltaPercent.toFixed(1)}%`
              : '--'}
          </div>
        )}
      </div>
    </div>
  )
}

function LineChartPresenter({
  variantFlags,
  lineMetrics,
  rangeLabels,
  selectedRange,
  onRangeChange,
  isRangeUpdating,
  liveStatus,
  onControlPointerDown,
  children,
}: ChartPresenterProps) {
  const containerClassName = variantFlags.isMarketTrendWidget
    ? 'rounded-[1.35rem] bg-[#0a0a0a] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_24px_50px_rgba(0,0,0,0.35)]'
    : 'bg-[#0a0a0a] px-3 py-3'

  return (
    <ChartLayoutFrame containerClassName={containerClassName}>
      {variantFlags.isStockStyleLineChart ? (
        <MarketTrendHeader
          rangeLabels={rangeLabels}
          selectedRange={selectedRange}
          onRangeChange={onRangeChange}
          isRangeUpdating={isRangeUpdating}
          liveStatus={liveStatus}
          lineMetrics={lineMetrics}
          onControlPointerDown={onControlPointerDown}
        />
      ) : null}
      {children}
      {variantFlags.isStockStyleLineChart ? (
        <LineTrendFooter variantFlags={variantFlags} lineMetrics={lineMetrics} />
      ) : null}
    </ChartLayoutFrame>
  )
}

function BarChartPresenter({
  variantFlags,
  dailyPnlMetrics,
  rangeLabels,
  selectedVolumeTimeframe,
  onVolumeTimeframeChange,
  isVolumeUpdating,
  totalVolume,
  dailyPnlRange,
  onDailyPnlRangeChange,
  isDailyPnlUpdating,
  onControlPointerDown,
  children,
}: ChartPresenterProps) {
  let containerClassName = 'px-1 py-1'

  if (variantFlags.isDailyPnlWidget) {
    containerClassName =
      'rounded-[1.35rem] bg-[#0a0a0a] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_24px_50px_rgba(0,0,0,0.35)]'
  } else if (variantFlags.isVolumeProfileWidget) {
    containerClassName =
      'rounded-[1.2rem] bg-[#0a0a0a] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_20px_40px_rgba(0,0,0,0.3)]'
  }

  return (
    <ChartLayoutFrame containerClassName={containerClassName}>
      {variantFlags.isVolumeProfileWidget ? (
        <VolumeProfileHeader
          rangeLabels={rangeLabels}
          selectedVolumeTimeframe={selectedVolumeTimeframe}
          onVolumeTimeframeChange={onVolumeTimeframeChange}
          isVolumeUpdating={isVolumeUpdating}
          totalVolume={totalVolume}
          onControlPointerDown={onControlPointerDown}
        />
      ) : null}
      {variantFlags.isDailyPnlWidget ? (
        <DailyPnlHeader
          dailyPnlMetrics={dailyPnlMetrics}
          dailyPnlRange={dailyPnlRange}
          onDailyPnlRangeChange={onDailyPnlRangeChange}
          isDailyPnlUpdating={isDailyPnlUpdating}
          onControlPointerDown={onControlPointerDown}
        />
      ) : null}
      {children}
      {variantFlags.isDailyPnlWidget ? (
        <DailyPnlFooter dailyPnlMetrics={dailyPnlMetrics} />
      ) : null}
    </ChartLayoutFrame>
  )
}

function PieChartPresenter({
  variantFlags,
  children,
}: ChartPresenterProps) {
  const containerClassName = variantFlags.isPortfolioBreakdownWidget
    ? 'rounded-[1.25rem] bg-[#0a0a0a] px-2.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_22px_44px_rgba(0,0,0,0.32)]'
    : 'px-1 py-1'

  return <ChartLayoutFrame containerClassName={containerClassName}>{children}</ChartLayoutFrame>
}

const chartPresenterMap: Record<ChartType, (props: ChartPresenterProps) => ReactNode> = {
  line: LineChartPresenter,
  bar: BarChartPresenter,
  column: BarChartPresenter,
  pie: PieChartPresenter,
}

function ChartVariantLayout({
  chartType,
  variantFlags,
  lineMetrics,
  dailyPnlMetrics,
  rangeLabels,
  selectedRange,
  onRangeChange,
  isRangeUpdating,
  liveStatus,
  selectedVolumeTimeframe,
  onVolumeTimeframeChange,
  isVolumeUpdating,
  totalVolume,
  dailyPnlRange,
  onDailyPnlRangeChange,
  isDailyPnlUpdating,
  onControlPointerDown,
  children,
}: ChartVariantLayoutProps) {
  const Presenter = chartPresenterMap[chartType]

  return Presenter({
    variantFlags,
    lineMetrics,
    dailyPnlMetrics,
    rangeLabels,
    selectedRange,
    onRangeChange,
    isRangeUpdating,
    liveStatus,
    selectedVolumeTimeframe,
    onVolumeTimeframeChange,
    isVolumeUpdating,
    totalVolume,
    dailyPnlRange,
    onDailyPnlRangeChange,
    isDailyPnlUpdating,
    onControlPointerDown,
    children,
  })
}

export default ChartVariantLayout
