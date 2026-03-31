import type { MouseEvent as ReactMouseEvent } from "react";
import ReactApexChart from "react-apexcharts";
import useResizeObserver from "../../hooks/useResizeObserver";
import WidgetShell from "../base/WidgetShell";
import type {
  CartesianChartSeries,
  ChartSeries,
  ChartType,
  PieChartSeries,
} from "../../types/widget";
import { buildChartOptions, getApexChartType } from "./chartOptions";

type ChartWidgetProps = {
  title: string;
  chartType: ChartType;
  series: ChartSeries[];
  categories?: string[];
  isMinimized?: boolean;
  isMaximized?: boolean;
  isDragging?: boolean;
  isResizing?: boolean;
  onDragMouseDown?: (event: ReactMouseEvent<HTMLElement>) => void;
  onResizeHandleMouseDown?: (event: ReactMouseEvent<HTMLElement>) => void;
  onResetToDefault?: () => void;
  onMinimizeToggle?: () => void;
  onMaximizeToggle?: () => void;
};

function isPieSeries(series: ChartSeries[]): series is PieChartSeries[] {
  return series.every((item) => "value" in item);
}

function isCartesianSeries(
  series: ChartSeries[],
): series is CartesianChartSeries[] {
  return series.every((item) => "data" in item);
}

function toChartId(title: string, chartType: ChartType) {
  return `${chartType}-${title}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getApexSeries(
  chartType: ChartType,
  series: ChartSeries[],
): {
  apexType: "area" | "line" | "bar" | "pie";
  apexSeries: number[] | CartesianChartSeries[];
} | null {
  if (chartType === "pie") {
    if (!isPieSeries(series)) {
      return null;
    }

    return {
      apexType: "pie",
      apexSeries: series.map((item) => item.value),
    };
  }

  if (!isCartesianSeries(series)) {
    return null;
  }

  if (chartType === "line") {
    return {
      apexType: "area",
      apexSeries: series.map((item) => ({
        name: item.name,
        data: item.data,
      })),
    };
  }

  if (chartType === "bar") {
    return {
      apexType: "bar",
      apexSeries: series.map((item) => ({
        name: item.name,
        data: item.data,
      })),
    };
  }

  return {
    apexType: "bar",
    apexSeries: series.map((item) => ({
      name: item.name,
      data: item.data,
    })),
  };
}

function ChartWidget({
  title,
  chartType,
  series,
  categories,
  isMinimized = false,
  isMaximized = false,
  isDragging = false,
  isResizing = false,
  onDragMouseDown,
  onResizeHandleMouseDown,
  onResetToDefault,
  onMinimizeToggle,
  onMaximizeToggle,
}: ChartWidgetProps) {
  const { ref, width, height } = useResizeObserver<HTMLDivElement>();
  const normalizedTitle = title.trim().toLowerCase();
  const isStockStyleLineChart = chartType === "line";
  const isBtcPriceTrendWidget =
    chartType === "line" && normalizedTitle === "btc price trend";
  const isDailyPnlWidget =
    chartType === "column" && normalizedTitle === "daily pnl";
  const isVolumeProfileWidget =
    chartType === "bar" && normalizedTitle === "volume profile";
  const isPortfolioBreakdownWidget =
    chartType === "pie" && normalizedTitle === "portfolio breakdown";
  const stopHeaderMouseEvent = (event: ReactMouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };
  const windowControls = (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label={isMinimized ? `Restore ${title}` : `Minimize ${title}`}
        onMouseDown={stopHeaderMouseEvent}
        onClick={onMinimizeToggle}
        className="h-3 w-3 rounded-full bg-rose-500/90 transition hover:bg-rose-400"
      />
      <button
        type="button"
        aria-label={`Reset ${title} to default size`}
        onMouseDown={stopHeaderMouseEvent}
        onClick={onResetToDefault}
        className="h-3 w-3 rounded-full bg-amber-400/90 transition hover:bg-amber-300"
      />
      <button
        type="button"
        aria-label={isMaximized ? `Restore ${title}` : `Maximize ${title}`}
        onMouseDown={stopHeaderMouseEvent}
        onClick={onMaximizeToggle}
        className="h-3 w-3 rounded-full bg-emerald-500/90 transition hover:bg-emerald-400"
      />
    </div>
  );
  const chartId = toChartId(title, chartType);
  const pieLabels = isPieSeries(series)
    ? series.map((item) => item.name)
    : undefined;
  const incomingNormalizedChart = getApexSeries(chartType, series);
  const primaryCartesianSeries =
    incomingNormalizedChart &&
    incomingNormalizedChart.apexType !== "pie" &&
    incomingNormalizedChart.apexSeries.length > 0
      ? (incomingNormalizedChart.apexSeries[0] as CartesianChartSeries)
      : null;
  const lineSeries =
    chartType === "line" && incomingNormalizedChart?.apexType === "area"
      ? primaryCartesianSeries
      : null;
  const incomingChartOptions = buildChartOptions({
    chartId,
    chartType,
    title,
    categories,
    labels: pieLabels,
    values:
      isStockStyleLineChart ||
      isDailyPnlWidget ||
      isVolumeProfileWidget ||
      isPortfolioBreakdownWidget
        ? primaryCartesianSeries?.data
          ?? (isPieSeries(series) ? series.map((item) => item.value) : undefined)
        : undefined,
  });
  const latestLineValue =
    lineSeries && lineSeries.data.length > 0
      ? lineSeries.data[lineSeries.data.length - 1]
      : null;
  const firstLineValue =
    lineSeries && lineSeries.data.length > 0 ? lineSeries.data[0] : null;
  const lineDelta =
    latestLineValue !== null && firstLineValue !== null
      ? latestLineValue - firstLineValue
      : null;
  const lineDeltaPercent =
    lineDelta !== null && firstLineValue
      ? (lineDelta / firstLineValue) * 100
      : null;
  const isPositiveLineTrend = lineDelta !== null ? lineDelta >= 0 : true;
  const lineTrendColorClass = isPositiveLineTrend
    ? "text-[#22C55E]"
    : "text-[#ff7b7b]";
  const formattedLineChange =
    lineDelta !== null
      ? `${lineDelta > 0 ? "+" : ""}${Math.round(lineDelta).toLocaleString()}`
      : "--";
  const formattedLineChangePercent =
    lineDeltaPercent !== null
      ? `${lineDeltaPercent > 0 ? "+" : ""}${lineDeltaPercent.toFixed(2)}%`
      : "--";
  const dailyPnlValues = isDailyPnlWidget ? primaryCartesianSeries?.data ?? [] : [];
  const dailyPnlTotal = dailyPnlValues.reduce((sum, value) => sum + value, 0);
  const positivePnlDays = dailyPnlValues.filter((value) => value > 0).length;
  const negativePnlDays = dailyPnlValues.filter((value) => value < 0).length;
  const strongestPnl = dailyPnlValues.length > 0 ? Math.max(...dailyPnlValues) : null;
  const weakestPnl = dailyPnlValues.length > 0 ? Math.min(...dailyPnlValues) : null;
  const chartHeight = Math.max(height, 220);
  const chartWidth = Math.max(width, 0);
  const isReady = chartWidth > 0 && chartHeight > 0;
  const chartKey = `${chartType}-${width}-${height}`;
  const dailyPnlAverage =
    dailyPnlValues.length > 0 ? dailyPnlTotal / dailyPnlValues.length : null;

  const testChart =
    chartType === "bar" && !isVolumeProfileWidget
      ? {
          apexType: "bar" as const,
          apexSeries: [{ name: "Test", data: [10, 20, 30, 40, 50] }],
          chartOptions: {
            chart: {
              id: chartId,
              type: "bar" as const,
              background: "transparent",
            },
            theme: {
              mode: "dark" as const,
            },
            colors: ["#38bdf8"],
            tooltip: {
              theme: "dark" as const,
            },
            xaxis: {
              categories: ["A", "B", "C", "D", "E"],
            },
            plotOptions: {
              bar: {
                horizontal: true,
              },
            },
          },
        }
        : chartType === "pie" && !isPortfolioBreakdownWidget
          ? {
              apexType: "pie" as const,
              apexSeries: [42, 28, 14, 10, 6],
              chartOptions: {
                chart: {
                  id: chartId,
                  type: "pie" as const,
                  background: "transparent",
                },
                theme: {
                  mode: "dark" as const,
                },
                colors: ["#59ffd0", "#34d399", "#14b8a6", "#0ea5a4", "#7dd3fc"],
                tooltip: {
                  theme: "dark" as const,
                },
                labels: ["BTC", "ETH", "SOL", "USDT", "Other"],
              },
            }
          : null;

  const normalizedChart =
    chartType === "column" || isVolumeProfileWidget
      ? incomingNormalizedChart
      : isPortfolioBreakdownWidget
        ? incomingNormalizedChart
        : testChart ?? incomingNormalizedChart;
  const chartOptions =
    chartType === "column" || isVolumeProfileWidget
      ? incomingChartOptions
      : isPortfolioBreakdownWidget
        ? incomingChartOptions
        : testChart?.chartOptions ?? incomingChartOptions;

  if (
    !normalizedChart ||
    normalizedChart.apexType !== getApexChartType(chartType, title)
  ) {
    return (
      <WidgetShell title={title}>
        <div>Invalid chart series</div>
      </WidgetShell>
    );
  }

  return (
    <WidgetShell
      title={title}
      subtitle="Chart"
      action={windowControls}
      className={`relative flex h-full flex-col ${isDragging || isResizing ? "select-none" : ""}`}
      headerClassName={`${onDragMouseDown ? "cursor-grab active:cursor-grabbing" : ""}`}
      bodyClassName={
        isMinimized ? "overflow-hidden p-0" : "flex-1 overflow-hidden"
      }
      onHeaderMouseDown={onDragMouseDown}
    >
      {!isMinimized ? (
        <div
          className={`relative flex h-full min-h-[220px] min-w-0 w-full flex-col overflow-hidden ${
            isStockStyleLineChart
              ? isBtcPriceTrendWidget
                ? "rounded-[1.35rem] bg-[#0a0a0a] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_24px_50px_rgba(0,0,0,0.35)]"
                : "bg-[#0a0a0a] px-3 py-3"
              : isDailyPnlWidget
                ? "rounded-[1.35rem] bg-[#0a0a0a] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_24px_50px_rgba(0,0,0,0.35)]"
                : isVolumeProfileWidget
                  ? "rounded-[1.2rem] bg-[#0a0a0a] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_20px_40px_rgba(0,0,0,0.3)]"
                : isPortfolioBreakdownWidget
                  ? "rounded-[1.25rem] bg-[#0a0a0a] px-2.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_22px_44px_rgba(0,0,0,0.32)]"
                  : "px-1 py-1"
          }`}
        >
          {isStockStyleLineChart ? (
            <div className="relative z-[1] mb-1 flex items-center justify-between gap-4 px-0.5">
              <div className="inline-flex rounded-lg border border-white/6 bg-white/[0.03] p-0.5 self-start">
                {["Day", "Week", "Month"].map((rangeLabel, index) => (
                  <button
                    key={rangeLabel}
                    type="button"
                    onMouseDown={stopHeaderMouseEvent}
                    className={`rounded-md px-3.5 py-1.5 text-[11px] font-medium transition ${
                      index === 0
                        ? "bg-white/[0.14] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                        : "text-slate-400 hover:text-slate-200"
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
                  {latestLineValue !== null
                    ? `$${Math.round(latestLineValue).toLocaleString()}`
                    : "--"}
                </div>
                <div
                  className={`mt-1 text-[0.74rem] font-medium leading-none ${lineTrendColorClass}`}
                >
                  {formattedLineChange} ({formattedLineChangePercent})
                </div>
              </div>
            </div>
          ) : null}
          {isDailyPnlWidget ? (
            <div className="mb-1.5 flex items-center justify-between gap-4">
              <div>
                <div className="text-[0.64rem] uppercase tracking-[0.24em] text-slate-500">
                  Weekly Net
                </div>
                <div
                  className={`mt-1 text-[0.95rem] font-medium ${
                    dailyPnlTotal >= 0 ? "text-[#22C55E]" : "text-[#f0a2a2]"
                  }`}
                >
                  {`${dailyPnlTotal >= 0 ? "+" : ""}${dailyPnlTotal.toLocaleString()}`}
                </div>
              </div>
              <div className="flex items-center gap-2 text-[0.68rem] uppercase tracking-[0.22em] text-slate-500">
                <span>Win</span>
                <span className="text-sm font-semibold tracking-normal text-[#22C55E]">
                  {positivePnlDays}
                </span>
                <span className="text-white/20">|</span>
                <span>Loss</span>
                <span className="text-sm font-semibold tracking-normal text-[#ff5c5c]">
                  {negativePnlDays}
                </span>
              </div>
            </div>
          ) : null}
          <div
            ref={ref}
            className={`${
              isStockStyleLineChart || isDailyPnlWidget || isVolumeProfileWidget
                ? "min-h-[250px] flex-1"
                : isPortfolioBreakdownWidget
                  ? "min-h-[250px] flex-1"
                  : "h-full"
            } relative z-[1] min-w-0 w-full overflow-hidden`}
          >
            {isReady ? (
              <ReactApexChart
                key={chartKey}
                type={normalizedChart.apexType}
                series={normalizedChart.apexSeries}
                options={chartOptions}
                height={chartHeight}
                width={chartWidth}
              />
            ) : null}
          </div>
          {isDailyPnlWidget ? (
            <div className="mt-3 flex items-end justify-between gap-4 border-t border-white/6 pt-2">
              <div>
                <div className="text-[0.64rem] uppercase tracking-[0.22em] text-slate-500">
                  Best
                </div>
                <div className="mt-1 text-sm font-semibold text-[#58ffd6]">
                  {strongestPnl !== null
                    ? `${strongestPnl >= 0 ? "+" : ""}${strongestPnl.toLocaleString()}`
                    : "--"}
                </div>
              </div>
              <div className="text-center">
                <div className="text-[0.64rem] uppercase tracking-[0.22em] text-slate-500">
                  Avg
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-200">
                  {dailyPnlAverage !== null
                    ? `${dailyPnlAverage >= 0 ? "+" : ""}${dailyPnlAverage.toFixed(0)}`
                    : "--"}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[0.64rem] uppercase tracking-[0.22em] text-slate-500">
                  Worst
                </div>
                <div className="mt-1 text-sm font-semibold text-[#ff5c5c]">
                  {weakestPnl !== null
                    ? `${weakestPnl >= 0 ? "+" : ""}${weakestPnl.toLocaleString()}`
                    : "--"}
                </div>
              </div>
            </div>
          ) : null}
          {isStockStyleLineChart ? (
            <div className="relative z-[1] mt-3 flex items-end justify-between gap-3 border-t border-white/6 pt-2.5">
              <div>
                {isBtcPriceTrendWidget ? (
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
                        {latestLineValue?.toLocaleString() ?? "--"}
                      </span>
                      <span className={`text-base font-medium ${lineTrendColorClass}`}>
                        {formattedLineChange}
                      </span>
                    </div>
                  </>
                )}
              </div>
              <div className="text-right">
                <div className="text-[0.64rem] uppercase tracking-[0.2em] text-slate-500">
                  {isBtcPriceTrendWidget ? "24H Change" : "Performance"}
                </div>
                {isBtcPriceTrendWidget ? (
                  <div className={`mt-1 text-[0.92rem] font-semibold leading-none ${lineTrendColorClass}`}>
                    {formattedLineChange} ({formattedLineChangePercent})
                  </div>
                ) : (
                  <div className={`mt-1 text-3xl font-semibold ${lineTrendColorClass}`}>
                    {lineDeltaPercent !== null
                      ? `${lineDeltaPercent > 0 ? "+" : ""}${lineDeltaPercent.toFixed(1)}%`
                      : "--"}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      {onResizeHandleMouseDown && !isMinimized && !isMaximized ? (
        <button
          type="button"
          aria-label={`Resize ${title} widget`}
          onMouseDown={onResizeHandleMouseDown}
          className="widget-resize-handle absolute bottom-3 right-3 z-10 h-4 w-4 cursor-nwse-resize rounded-sm border border-slate-600/70 bg-slate-800/90 shadow-md shadow-black/30 transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-400/70 relative"
        >
          <span
            aria-hidden="true"
            className="absolute inset-0 bg-[linear-gradient(135deg,transparent_0_38%,rgba(148,163,184,0.95)_38_48%,transparent_48_58%,rgba(148,163,184,0.95)_58_68%,transparent_68_100%)]"
          />
        </button>
      ) : null}
    </WidgetShell>
  );
}

export default ChartWidget;
