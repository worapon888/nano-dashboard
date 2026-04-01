import type { ApexOptions } from "apexcharts";
import type { ChartType, ChartWidgetPresentation } from "../../../shared/types/widget";

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");

  if (normalized.length !== 6) {
    return hex;
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red},${green},${blue},${alpha})`;
}

function blendHexColors(startHex: string, endHex: string, ratio: number) {
  const clampRatio = Math.max(0, Math.min(1, ratio));
  const start = startHex.replace("#", "");
  const end = endHex.replace("#", "");

  if (start.length !== 6 || end.length !== 6) {
    return startHex;
  }

  const channels = [0, 2, 4].map((offset) => {
    const startValue = Number.parseInt(start.slice(offset, offset + 2), 16);
    const endValue = Number.parseInt(end.slice(offset, offset + 2), 16);
    const mixedValue = Math.round(
      startValue + (endValue - startValue) * clampRatio,
    );

    return mixedValue.toString(16).padStart(2, "0");
  });

  return `#${channels.join("")}`;
}

function stripUndefined<T extends object>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [
        k,
        v !== null && typeof v === "object" && !Array.isArray(v)
          ? stripUndefined(v as object)
          : v,
      ]),
  ) as T;
}

type BuildChartOptionsParams = {
  chartId: string;
  chartType: ChartType;
  presentation?: ChartWidgetPresentation;
  categories?: string[];
  labels?: string[];
  values?: number[];
};

const axisChartTypes: ChartType[] = ["line", "bar", "column"];

export function getApexChartType(
  chartType: ChartType,
  presentation?: ChartWidgetPresentation,
): "area" | "line" | "bar" | "pie" {
  if (chartType === "line" && presentation?.variant === "market-trend") {
    return "area";
  }

  if (chartType === "bar" || chartType === "column") {
    return "bar";
  }

  return chartType;
}

export function buildChartOptions({
  chartId,
  chartType,
  presentation,
  categories,
  labels,
  values,
}: BuildChartOptionsParams): ApexOptions {
  const variant = presentation?.variant ?? "default";
  const isBarChart = chartType === "bar";
  const isColumnChart = chartType === "column";
  const isLineChart = chartType === "line";
  const isBtcPriceTrend = variant === "market-trend";
  const isVolumeProfile = variant === "volume-profile";
  const isDailyPnlColumn = variant === "daily-pnl";
  const isPortfolioBreakdown = variant === "portfolio-breakdown";
  const marketTrendChange = presentation?.marketTrendData?.change24h ?? null;
  const isNegativeMarketTrend =
    isBtcPriceTrend && marketTrendChange !== null && marketTrendChange < 0;
  const marketTrendLineColor = isNegativeMarketTrend ? "#F87171" : "#00E5A8";
  const marketTrendGlowColor = isNegativeMarketTrend ? "#EF4444" : "#00E5A8";
  const marketTrendGradientColor = isNegativeMarketTrend
    ? "rgba(239,68,68,0.34)"
    : "#00E5A8";
  const marketTrendGridColor = isNegativeMarketTrend
    ? "rgba(248,113,113,0.12)"
    : "rgba(255,255,255,0.09)";
  const apexChartType = getApexChartType(chartType, presentation);
  const isCartesianChart = axisChartTypes.includes(chartType);
  const minValue =
    values && values.length > 0 ? Math.min(...values) : undefined;
  const maxValue =
    values && values.length > 0 ? Math.max(...values) : undefined;
  const absMaxValue =
    values && values.length > 0
      ? Math.max(...values.map((value) => Math.abs(value)))
      : undefined;
  const valueRange =
    minValue !== undefined && maxValue !== undefined
      ? Math.max(maxValue - minValue, 1)
      : undefined;
  const verticalPadding =
    isLineChart && valueRange !== undefined
      ? valueRange * (isBtcPriceTrend ? 0.32 : 0.45)
      : undefined;
  const dailyPnlPadding =
    isDailyPnlColumn && absMaxValue !== undefined
      ? Math.max(absMaxValue * 0.22, 70)
      : undefined;
  const yAxisMin =
    isDailyPnlColumn && minValue !== undefined && dailyPnlPadding !== undefined
      ? Math.floor(minValue - dailyPnlPadding)
      : isLineChart && minValue !== undefined && verticalPadding !== undefined
        ? Math.floor(minValue - verticalPadding)
        : undefined;
  const yAxisMax =
    isDailyPnlColumn && maxValue !== undefined && dailyPnlPadding !== undefined
      ? Math.ceil(maxValue + dailyPnlPadding)
      : isLineChart && maxValue !== undefined && verticalPadding !== undefined
        ? Math.ceil(maxValue + verticalPadding)
        : undefined;
  const dailyPnlLabelColors = isDailyPnlColumn
    ? values?.map((value) => (value >= 0 ? "#22C55E" : "#F87171"))
    : undefined;
  const dailyPnlBarColors = isDailyPnlColumn
    ? values?.map((value) =>
        value >= 0 ? "rgba(88,255,214,0.7)" : "rgba(239,68,68,0.7)",
      )
    : undefined;
  const dailyPnlGradientToColors = isDailyPnlColumn
    ? values?.map((value) =>
        value >= 0 ? "rgba(13,107,83,0.35)" : "rgba(239,68,68,0.35)",
      )
    : undefined;
  const volumeProfileDirections =
    isVolumeProfile &&
    Array.isArray(presentation?.volumeProfileData?.directions) &&
    values &&
    presentation.volumeProfileData.directions.length === values.length
      ? presentation.volumeProfileData.directions
      : undefined;
  const providedVolumeProfileColors =
    isVolumeProfile &&
    Array.isArray(presentation?.volumeProfileData?.colors) &&
    values &&
    presentation.volumeProfileData.colors.length === values.length
      ? presentation.volumeProfileData.colors
      : undefined;
  const volumeProfileMaxValue =
    isVolumeProfile && values && values.length > 0
      ? Math.max(...values)
      : undefined;
  const volumeProfileBarColors = isVolumeProfile
    ? values?.map((value, index) => {
        const direction =
          volumeProfileDirections?.[index] ??
          (providedVolumeProfileColors?.[index]?.toLowerCase() === "#22c55e"
            ? "bullish"
            : providedVolumeProfileColors?.[index]?.toLowerCase() === "#ef4444"
              ? "bearish"
              : "bullish");

        const normalizedVolume =
          volumeProfileMaxValue && volumeProfileMaxValue > 0
            ? value / volumeProfileMaxValue
            : 0.55;
        const intensity = 0.3 + normalizedVolume * 0.7;

        return direction === "bullish"
          ? blendHexColors("#0b3e38", "#16e2b3", intensity)
          : blendHexColors("#471822", "#f36b7f", intensity);
      })
    : undefined;
  const volumeProfileGradientToColors = isVolumeProfile
    ? values?.map((value, index) => {
        const direction =
          volumeProfileDirections?.[index] ??
          (providedVolumeProfileColors?.[index]?.toLowerCase() === "#22c55e"
            ? "bullish"
            : "bearish");
        const normalizedVolume =
          volumeProfileMaxValue && volumeProfileMaxValue > 0
            ? value / volumeProfileMaxValue
            : 0.55;
        const opacity = 0.2 + normalizedVolume * 0.16;

        return direction === "bullish"
          ? hexToRgba("#0d8d76", opacity)
          : hexToRgba("#9a3047", opacity);
      })
    : undefined;
  const portfolioPalette = [
    "#EAB308",
    "#14B8A6",
    "#38BDF8",
    "#10B981",
    "#64748B",
  ];
  const portfolioGradientToColors = [
    "#A16207",
    "#0F766E",
    "#1D4ED8",
    "#047857",
    "#475569",
  ];
  const portfolioValues = isPortfolioBreakdown && Array.isArray(values) ? values : [];
  const portfolioLabels = isPortfolioBreakdown && Array.isArray(labels) ? labels : [];
  const dominantSliceIndex =
    portfolioValues.length > 0
      ? portfolioValues.reduce(
          (largestIndex, currentValue, currentIndex, source) =>
            currentValue > (source[largestIndex] ?? Number.NEGATIVE_INFINITY)
              ? currentIndex
              : largestIndex,
          0,
        )
      : -1;
  const dominantSliceLabel =
    dominantSliceIndex >= 0
      ? portfolioLabels[dominantSliceIndex] ?? ""
      : "";
  const dominantSliceValue =
    dominantSliceIndex >= 0 ? portfolioValues[dominantSliceIndex] ?? 0 : 0;

  return stripUndefined({
    chart: {
      id: chartId,
      type: apexChartType,
      background: "transparent",
      redrawOnParentResize: false,
      redrawOnWindowResize: false,
      parentHeightOffset: 0,
      fontFamily: isPortfolioBreakdown
        ? "ui-sans-serif, system-ui, sans-serif"
        : undefined,
      dropShadow: isLineChart
        ? {
            enabled: true,
            top: 0,
            left: 0,
            blur: isBtcPriceTrend ? 8 : 10,
            color: isBtcPriceTrend ? marketTrendGlowColor : "#58ffd6",
            opacity: isBtcPriceTrend ? 0.3 : 0.9,
          }
        : isVolumeProfile
          ? {
              enabled: true,
              top: 0,
              left: 0,
              blur: 4,
              color: "rgba(22, 226, 179, 0.14)",
              opacity: 0.16,
            }
        : undefined,
      animations:
        isBtcPriceTrend || isPortfolioBreakdown
          ? {
              enabled: true,
              speed: isBtcPriceTrend ? 700 : 550,
              // animateGradually causes pie segments to appear one-by-one,
              // producing the stacking/jitter glitch on initial mount.
              animateGradually: {
                enabled: false,
                delay: isBtcPriceTrend ? 60 : 70,
              },
              dynamicAnimation: {
                enabled: true,
                speed: isBtcPriceTrend ? 700 : 350,
              },
            }
          : // Explicit disable prevents ApexCharts default animation (bars
            // growing from 0-width) which causes the Volume Profile stutter.
            { enabled: false },
      toolbar: {
        show:
          !isBtcPriceTrend &&
          !isLineChart &&
          !isDailyPnlColumn &&
          !isVolumeProfile &&
          !isPortfolioBreakdown,
      },
      sparkline: {
        enabled: false,
      },
    },
    theme: {
      mode: "dark",
    },
    colors: isLineChart
      ? [isBtcPriceTrend ? marketTrendLineColor : "#58ffd6"]
      : isDailyPnlColumn
        ? dailyPnlBarColors
        : isVolumeProfile
          ? volumeProfileBarColors
        : isPortfolioBreakdown
            ? portfolioPalette
            : chartType === "pie"
              ? ["#59ffd0", "#34d399", "#14b8a6", "#0ea5a4", "#7dd3fc"]
              : ["#3fd8af"],
    fill: isLineChart
      ? {
          type: "gradient",
          gradient: {
            shade: "dark",
            type: "vertical",
            shadeIntensity: 0,
            gradientToColors: [
              isBtcPriceTrend ? marketTrendGradientColor : "#0d6b53",
            ],
            inverseColors: false,
            opacityFrom: isBtcPriceTrend ? 0.4 : 0.7,
            opacityTo: isBtcPriceTrend ? 0 : 0.4,
            stops: isBtcPriceTrend ? [0, 65, 100] : [0, 78, 100],
          },
        }
      : isColumnChart
        ? {
            type: "gradient",
            gradient: {
              shade: "dark",
              type: isBarChart ? "horizontal" : "vertical",
              shadeIntensity: 0,
              gradientToColors: isDailyPnlColumn
                ? dailyPnlGradientToColors
                : ["#123d31"],
              inverseColors: false,
              opacityFrom: isDailyPnlColumn ? 0.82 : 0.96,
              opacityTo: isDailyPnlColumn ? 0.08 : 0.34,
              stops: isDailyPnlColumn ? [0, 42, 100] : [0, 18, 100],
            },
          }
      : isVolumeProfile
        ? {
            type: "gradient",
            gradient: {
              shade: "dark",
              type: "horizontal",
              shadeIntensity: 0,
              gradientToColors: volumeProfileGradientToColors,
              inverseColors: false,
              opacityFrom: 0.94,
              opacityTo: 0.72,
              stops: [0, 76, 100],
            },
          }
          : isPortfolioBreakdown
            ? {
                type: "gradient",
                gradient: {
                  shade: "dark",
                  type: "radial",
                  shadeIntensity: 0.08,
                  gradientToColors: portfolioGradientToColors,
                  inverseColors: false,
                  opacityFrom: 0.96,
                  opacityTo: 0.88,
                  stops: [0, 72, 100],
                },
              }
            : undefined,
    markers: isLineChart
      ? {
          size: 0,
          colors: [isBtcPriceTrend ? marketTrendLineColor : "#58ffd6"],
          strokeColors: isBtcPriceTrend ? marketTrendLineColor : "#dffff7",
          strokeWidth: isBtcPriceTrend ? 2 : 3,
          discrete:
            values && values.length > 0
              ? [
                  {
                    seriesIndex: 0,
                    dataPointIndex: values.length - 1,
                    fillColor: isBtcPriceTrend ? "#0B0F14" : "#081310",
                    strokeColor: isBtcPriceTrend ? marketTrendLineColor : "#58ffd6",
                    size: isBtcPriceTrend ? 6 : 6,
                  },
                ]
              : undefined,
          hover: {
            size: isBtcPriceTrend ? 0 : 6,
            sizeOffset: isBtcPriceTrend ? 0 : 1,
          },
        }
      : { size: 0 },
    dataLabels: {
      enabled: isDailyPnlColumn || isPortfolioBreakdown,
      formatter: isDailyPnlColumn
        ? (value: number) => `${value > 0 ? "+" : ""}${Math.round(value)}`
        : isVolumeProfile
          ? (value: number) => Math.round(value).toLocaleString()
          : isPortfolioBreakdown
            ? (value: number) => `${Math.round(value)}%`
            : undefined,
      offsetY: isDailyPnlColumn ? -16 : isPortfolioBreakdown ? 2 : 0,
      background: {
        enabled: false,
      },
      style: {
        fontSize: isDailyPnlColumn
          ? "12px"
          : isPortfolioBreakdown
              ? "12px"
              : undefined,
        fontWeight:
          isDailyPnlColumn || isPortfolioBreakdown
            ? 700
            : undefined,
        colors: isDailyPnlColumn
          ? dailyPnlLabelColors
          : isPortfolioBreakdown
              ? ["#f8fafc"]
              : undefined,
      },
      dropShadow: undefined,
    },
    states: isLineChart || isVolumeProfile
      ? {
          hover: {
            filter: {
              type: isVolumeProfile ? "lighten" : "none",
              ...(isVolumeProfile ? { value: 0.08 } : {}),
            },
          },
          active: {
            filter: {
              type: isVolumeProfile ? "lighten" : "none",
              ...(isVolumeProfile ? { value: 0.04 } : {}),
            },
          },
        }
      : undefined,
    tooltip: {
      theme: "dark",
      fillSeriesColor: false,
      style: isPortfolioBreakdown
        ? {
            fontSize: "12px",
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
          }
        : undefined,
      x: {
        show: isBtcPriceTrend ? false : isLineChart || isDailyPnlColumn,
      },
      marker: {
        show: isBtcPriceTrend ? false : !isPortfolioBreakdown,
      },
      custom: isBtcPriceTrend
        ? ({ series, seriesIndex, dataPointIndex, w }) => {
            const label = w.globals.categoryLabels?.[dataPointIndex] ?? "";
            const value = Math.round(
              series[seriesIndex]?.[dataPointIndex] ?? 0,
            );
            return `<div style="padding:8px 10px;border:1px solid rgba(255,255,255,0.08);border-radius:12px;background:rgba(11,15,20,0.96);box-shadow:0 18px 42px rgba(0,0,0,0.42);color:#f8fafc;font-size:12px;line-height:1.35;"><div style="color:rgba(226,232,240,0.62);font-size:11px;margin-bottom:2px;">${label}</div><div style="font-weight:600;letter-spacing:0.01em;">$${value.toLocaleString()}</div></div>`;
          }
        : isVolumeProfile
          ? ({ series, seriesIndex, dataPointIndex, w }) => {
              const label = w.globals.categoryLabels?.[dataPointIndex] ?? "";
              const rawValue = Number(
                series[seriesIndex]?.[dataPointIndex] ?? 0,
              );
              const direction =
                volumeProfileDirections?.[dataPointIndex] === "bearish"
                  ? "Bearish"
                  : "Bullish";
              const accentColor =
                volumeProfileDirections?.[dataPointIndex] === "bearish"
                  ? "#fb7185"
                  : "#2ae6bd";

              return `<div style="padding:8px 10px;border:1px solid rgba(255,255,255,0.08);border-radius:12px;background:rgba(11,15,20,0.96);box-shadow:0 18px 42px rgba(0,0,0,0.42);color:#f8fafc;font-size:12px;line-height:1.4;"><div style="color:rgba(226,232,240,0.62);font-size:11px;margin-bottom:4px;">Time: ${label}</div><div style="font-weight:600;letter-spacing:0.01em;margin-bottom:3px;">Volume: ${rawValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div><div style="color:${accentColor};font-size:11px;font-weight:600;">Direction: ${direction}</div></div>`;
            }
        : isPortfolioBreakdown
          ? ({ series, seriesIndex, w }) => {
              const label = w.globals.labels?.[seriesIndex] ?? "";
              const value = Number(series[seriesIndex] ?? 0);
              const percentage = `${value.toFixed(0)}%`;
              const dominanceValue = `${value.toFixed(2)}% dominance`;
              return `<div style="padding:8px 10px;border:1px solid rgba(255,255,255,0.08);border-radius:12px;background:rgba(8,12,18,0.96);box-shadow:0 12px 28px rgba(0,0,0,0.28);color:#e2e8f0;font-size:12px;line-height:1.4;"><div style="font-weight:600;color:#f8fafc;">${label}</div><div style="margin-top:2px;color:rgba(226,232,240,0.82);">${percentage}</div><div style="margin-top:2px;color:rgba(148,163,184,0.9);font-size:11px;">${dominanceValue}</div></div>`;
            }
          : undefined,
      y: isDailyPnlColumn
        ? {
            formatter: (value: number) =>
              `${value > 0 ? "+" : ""}${value.toFixed(0)}`,
          }
        : isVolumeProfile
          ? {
              formatter: (value: number) => value.toLocaleString(),
            }
          : isPortfolioBreakdown
            ? {
                formatter: (value: number) => `${value}% allocation`,
              }
            : undefined,
    },
    grid: isCartesianChart
      ? {
          show: !isVolumeProfile,
          borderColor: isLineChart
            ? isBtcPriceTrend
              ? marketTrendGridColor
              : "rgba(122, 255, 223, 0.24)"
            : isDailyPnlColumn
              ? "rgba(148, 163, 184, 0.12)"
              : isVolumeProfile
                ? "rgba(120, 164, 151, 0.08)"
                : isColumnChart
                  ? "rgba(63, 216, 175, 0.12)"
                  : "rgba(148, 163, 184, 0.16)",
          strokeDashArray:
            isLineChart || isDailyPnlColumn || isVolumeProfile
              ? isBtcPriceTrend
                ? 4
                : isVolumeProfile
                  ? 2
                  : 3
              : 0,
          xaxis: {
            lines: {
              show: !isBtcPriceTrend,
            },
          },
          yaxis: {
            lines: {
              show: true,
            },
          },
          row: {
            colors: ["transparent"],
            opacity: 0,
          },
          column: {
            colors: ["transparent"],
            opacity: 0,
          },
          padding: isDailyPnlColumn
            ? {
                top: 16,
                right: 10,
                bottom: 22,
                left: 8,
              }
            : isVolumeProfile
              ? {
                top: 8,
                right: 10,
                bottom: 4,
                left: 10,
              }
              : isBtcPriceTrend
                ? {
                    top: 0,
                    right: 10,
                    bottom: 12,
                    left: 18,
                  }
                : undefined,
        }
      : undefined,
    annotations: isDailyPnlColumn
      ? {
          yaxis: [
            {
              y: 0,
              borderColor: "rgba(255, 255, 255, 0.1)",
              strokeDashArray: 0,
            },
          ],
        }
      : undefined,
    xaxis: isCartesianChart
      ? {
          categories,
          crosshairs: {
            show:
              (!isBtcPriceTrend && isLineChart) ||
              isDailyPnlColumn ||
              isVolumeProfile,
            stroke: {
              color: isDailyPnlColumn
                ? "rgba(148, 163, 184, 0.18)"
                : isVolumeProfile
                  ? "rgba(122, 255, 223, 0.14)"
                  : "rgba(125, 255, 225, 0.32)",
              width: isDailyPnlColumn ? 1 : 1.2,
              dashArray: 3,
            },
          },
          labels: {
            show: !isVolumeProfile,
            offsetY: isDailyPnlColumn ? -2 : undefined,
            style: {
              colors: isLineChart
                ? isBtcPriceTrend
                  ? "rgba(226,232,240,0.44)"
                  : "#7ea190"
                : isDailyPnlColumn
                  ? "rgba(226,232,240,0.44)"
                  : isVolumeProfile
                    ? "rgba(226,232,240,0.44)"
                    : isColumnChart
                      ? "#8ab8aa"
                      : "#94a3b8",
              fontSize:
                isLineChart || isDailyPnlColumn
                  ? isBtcPriceTrend
                    ? "11px"
                    : "12px"
                  : isVolumeProfile
                    ? "11px"
                    : isColumnChart
                      ? "11px"
                      : undefined,
              fontWeight: isVolumeProfile ? 500 : undefined,
            },
          },
          axisBorder: {
            show: isBtcPriceTrend ? false : isDailyPnlColumn || isVolumeProfile,
            color: isLineChart
              ? "rgba(72, 101, 92, 0.16)"
              : isDailyPnlColumn
                ? "rgba(255, 255, 255, 0.05)"
                : isVolumeProfile
                  ? "rgba(255, 255, 255, 0.04)"
                  : isColumnChart
                    ? "rgba(63, 216, 175, 0.14)"
                    : "rgba(148, 163, 184, 0.16)",
          },
          axisTicks: {
            show: false,
            color: isLineChart
              ? "rgba(72, 101, 92, 0.16)"
              : isColumnChart
                ? "rgba(63, 216, 175, 0.14)"
                : "rgba(148, 163, 184, 0.16)",
          },
        }
      : undefined,
    yaxis: isCartesianChart
      ? {
          show: isBtcPriceTrend || isDailyPnlColumn || isVolumeProfile,
          min: yAxisMin,
          max: yAxisMax,
          tickAmount: isBtcPriceTrend
            ? 4
            : isLineChart || isDailyPnlColumn
              ? 5
              : undefined,
          axisBorder: {
            show: false,
          },
          axisTicks: {
            show: false,
          },
          labels: {
            show: isBtcPriceTrend || isDailyPnlColumn,
            formatter: isLineChart
              ? isBtcPriceTrend
                ? (value: number) => `$${Math.round(value).toLocaleString()}`
                : (value: number) => value.toFixed(0)
              : isDailyPnlColumn
                ? (value: number) =>
                    `${value > 0 ? "+" : ""}${value.toFixed(0)}`
                : isVolumeProfile
                  ? (value: number) => value.toLocaleString()
                  : undefined,
            style: {
              colors: isLineChart
                ? isBtcPriceTrend
                  ? "rgba(255,255,255,0.25)"
                  : "#7ea190"
                : isDailyPnlColumn
                  ? "rgba(255,255,255,0.25)"
                  : isVolumeProfile
                    ? "rgba(255,255,255,0.25)"
                    : isColumnChart
                      ? "#8ab8aa"
                      : "#94a3b8",
              fontSize:
                isLineChart || isDailyPnlColumn
                  ? isBtcPriceTrend
                    ? "11px"
                    : "12px"
                  : isVolumeProfile
                    ? "11px"
                    : isColumnChart
                      ? "11px"
                      : undefined,
              fontWeight: isVolumeProfile ? 500 : undefined,
            },
            offsetX: isBtcPriceTrend ? -10 : isVolumeProfile ? -4 : undefined,
          },
        }
      : undefined,
    plotOptions: {
      pie: isPortfolioBreakdown
        ? {
            expandOnClick: false,
            offsetY: 2,
            donut: {
              size: "74%",
                background: "transparent",
                labels: {
                  show: true,
                  name: {
                  show: false,
                  },
                  value: {
                  show: false,
                  },
                  total: {
                  show: true,
                  showAlways: true,
                  label: dominantSliceLabel || "—",
                  color: "rgba(226,232,235,0.62)",
                  fontSize: "11px",
                  fontWeight: 500,
                  formatter: () => `${dominantSliceValue.toFixed(0)}%`,
                },
              },
            },
          }
        : undefined,
      bar: {
        horizontal: isBarChart,
        borderRadius: isVolumeProfile
          ? 5
          : isColumnChart
            ? isDailyPnlColumn
              ? 6
              : 3
            : 0,
        borderRadiusApplication: isColumnChart ? "end" : "around",
        borderRadiusWhenStacked: "last",
        dataLabels: isDailyPnlColumn
          ? {
              position: "top",
            }
          : isVolumeProfile
            ? {
                position: "center",
              }
            : undefined,
        columnWidth: isVolumeProfile
          ? "70%"
          : isColumnChart
            ? isDailyPnlColumn
              ? "80%"
              : "62%"
            : undefined,
        barHeight: isVolumeProfile ? "84%" : isBarChart ? "82%" : undefined,
        distributed: isDailyPnlColumn || isVolumeProfile,
        colors:
          (isColumnChart || isVolumeProfile) && !isDailyPnlColumn
            ? {
                ranges: isVolumeProfile
                  ? undefined
                  : [
                      {
                        from: 0,
                        to: Number.POSITIVE_INFINITY,
                        color: "#58ffd6",
                      },
                      {
                        from: Number.NEGATIVE_INFINITY,
                        to: -0.00001,
                        color: "#7f1d1d",
                      },
                    ],
                backgroundBarColors: isVolumeProfile
                  ? []
                  : undefined,
                backgroundBarOpacity: isVolumeProfile ? 1 : 0,
                backgroundBarRadius: isVolumeProfile ? 7 : 0,
              }
            : undefined,
      },
    },
    labels: chartType === "pie" ? labels : undefined,
    stroke: isLineChart
      ? {
          curve: "smooth",
          width: isBtcPriceTrend ? 3 : 4,
          lineCap: "round",
        }
      : isPortfolioBreakdown
        ? {
            width: 1.5,
            colors: ["rgba(10, 10, 10, 0.18)"],
          }
        : isColumnChart
          ? {
              width: isDailyPnlColumn ? 1.1 : 1,
              colors: [
                isDailyPnlColumn
                  ? "rgba(255, 255, 255, 0.1)"
                  : "rgba(120, 255, 221, 0.28)",
              ],
            }
        : isVolumeProfile
            ? {
                width: 1,
                colors: ["rgba(240,255,251,0.08)"],
              }
            : undefined,
    legend: {
      show: isPortfolioBreakdown,
      position: "bottom",
      horizontalAlign: "center",
      floating: false,
      offsetY: 6,
      itemMargin: {
        horizontal: 16,
        vertical: 8,
      },
      markers: {
        size: 7,
        offsetX: -2,
      },
      labels: {
        colors: "rgba(226,232,235,0.68)",
        useSeriesColors: false,
      },
      fontSize: "11px",
      fontWeight: 400,
      formatter: (seriesName: string, opts?: { seriesIndex: number }) => {
        const seriesIndex = opts?.seriesIndex ?? -1;
        const value =
          seriesIndex >= 0 && seriesIndex < portfolioValues.length
            ? portfolioValues[seriesIndex]
            : null;

        return value === null
          ? seriesName
          : `${seriesName} ${value.toFixed(0)}%`;
      },
    },
  });
}
