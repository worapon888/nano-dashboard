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
  apexType: "line" | "bar" | "pie";
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
      apexType: "line",
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
  const isStockStyleLineChart = chartType === "line";
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
  const lineSeries =
    chartType === "line" && incomingNormalizedChart?.apexType === "line"
      ? (incomingNormalizedChart.apexSeries[0] as CartesianChartSeries)
      : null;
  const incomingChartOptions = buildChartOptions({
    chartId,
    chartType,
    title,
    categories,
    labels: pieLabels,
    values: lineSeries?.data,
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
  const chartHeight = Math.max(height, 220);
  const chartWidth = Math.max(width, 0);
  const isReady = chartWidth > 0 && chartHeight > 0;
  const chartKey = `${chartType}-${width}-${height}`;

  const testChart =
    chartType === "bar"
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
      : chartType === "column"
        ? {
            apexType: "bar" as const,
            apexSeries: [{ name: "Test", data: [5, -3, 8, 2, -1] }],
            chartOptions: {
              chart: {
                id: chartId,
                type: "bar" as const,
                background: "transparent",
              },
              theme: {
                mode: "dark" as const,
              },
              colors: ["#22c55e"],
              tooltip: {
                theme: "dark" as const,
              },
              xaxis: {
                categories: ["Mon", "Tue", "Wed", "Thu", "Fri"],
              },
              plotOptions: {
                bar: {
                  horizontal: false,
                },
              },
            },
          }
        : chartType === "pie"
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

  const normalizedChart = testChart ?? incomingNormalizedChart;
  const chartOptions = testChart?.chartOptions ?? incomingChartOptions;

  if (
    !normalizedChart ||
    normalizedChart.apexType !== getApexChartType(chartType)
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
          className={`h-full min-h-[220px] min-w-0 w-full overflow-hidden ${isStockStyleLineChart ? "bg-[#0a0a0a] px-3 py-3" : "px-1 py-1"}`}
        >
          {isStockStyleLineChart ? (
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="inline-flex rounded-xl border border-white/6 bg-white/[0.03] p-1">
                {["Week", "Month", "Max"].map((rangeLabel, index) => (
                  <button
                    key={rangeLabel}
                    type="button"
                    onMouseDown={stopHeaderMouseEvent}
                    className={`rounded-lg px-5 py-2 text-xs font-medium transition ${
                      index === 2
                        ? "bg-white/[0.14] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {rangeLabel}
                  </button>
                ))}
              </div>
              <div className="text-right">
                <div className="text-[0.72rem] uppercase tracking-[0.24em] text-slate-500">
                  Live Price
                </div>
                <div className="mt-1 text-lg font-semibold text-[#5ef2c5]">
                  {latestLineValue?.toLocaleString() ?? "--"}
                </div>
              </div>
            </div>
          ) : null}
          <div
            ref={ref}
            className={`${isStockStyleLineChart ? "h-[calc(100%-6.75rem)] min-h-[240px]" : "h-full"} min-w-0 w-full overflow-hidden`}
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
          {isStockStyleLineChart ? (
            <div className="mt-5 flex items-end justify-between gap-4 border-t border-white/6 pt-3">
              <div>
                <div className="text-[0.72rem] uppercase tracking-[0.22em] text-slate-500">
                  Total Change
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-3xl font-semibold text-slate-100">
                    {latestLineValue?.toLocaleString() ?? "--"}
                  </span>
                  <span className="text-base font-medium text-[#5ef2c5]">
                    {lineDelta !== null
                      ? `${lineDelta > 0 ? "+" : ""}${lineDelta.toFixed(0)}`
                      : "--"}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[0.72rem] uppercase tracking-[0.22em] text-slate-500">
                  Performance
                </div>
                <div className="mt-1 text-3xl font-semibold text-[#5ef2c5]">
                  {lineDeltaPercent !== null
                    ? `${lineDeltaPercent > 0 ? "+" : ""}${lineDeltaPercent.toFixed(1)}%`
                    : "--"}
                </div>
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
