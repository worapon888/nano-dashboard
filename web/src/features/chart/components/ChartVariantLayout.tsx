import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import type { ChartType } from '../../../shared/types/widget'
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
  lineMetrics,
  onControlPointerDown,
}: {
  rangeLabels: string[]
  lineMetrics: LineTrendMetrics
  onControlPointerDown: (event: ReactPointerEvent<HTMLElement>) => void
}) {
  return (
    <div className="relative z-[1] mb-1 flex items-center justify-between gap-4 px-0.5">
      <div className="inline-flex rounded-lg border border-white/6 bg-white/[0.03] p-0.5 self-start">
        {rangeLabels.map((rangeLabel, index) => (
          <button
            key={rangeLabel}
            type="button"
            onPointerDown={onControlPointerDown}
            className={`rounded-md px-3.5 py-1.5 text-[11px] font-medium transition ${
              index === 0
                ? 'bg-white/[0.14] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {rangeLabel}
          </button>
        ))}
      </div>
      <div className="flex min-w-[112px] flex-col items-end justify-center text-right">
        <div className="text-[0.62rem] uppercase tracking-[0.22em] text-slate-500">
          Live Price
        </div>
        <div className="mt-0.5 text-[1.15rem] font-semibold leading-none text-[#E5E7EB]">
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

function DailyPnlHeader({ dailyPnlMetrics }: { dailyPnlMetrics: DailyPnlMetrics }) {
  return (
    <div className="mb-1.5 flex items-center justify-between gap-4">
      <div>
        <div className="text-[0.64rem] uppercase tracking-[0.24em] text-slate-500">
          Weekly Net
        </div>
        <div
          className={`mt-1 text-[0.95rem] font-medium ${
            dailyPnlMetrics.total >= 0 ? 'text-[#22C55E]' : 'text-[#f0a2a2]'
          }`}
        >
          {`${dailyPnlMetrics.total >= 0 ? '+' : ''}${dailyPnlMetrics.total.toLocaleString()}`}
        </div>
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
      {variantFlags.isDailyPnlWidget ? (
        <DailyPnlHeader dailyPnlMetrics={dailyPnlMetrics} />
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
  onControlPointerDown,
  children,
}: ChartVariantLayoutProps) {
  const Presenter = chartPresenterMap[chartType]

  return Presenter({
    variantFlags,
    lineMetrics,
    dailyPnlMetrics,
    rangeLabels,
    onControlPointerDown,
    children,
  })
}

export default ChartVariantLayout
