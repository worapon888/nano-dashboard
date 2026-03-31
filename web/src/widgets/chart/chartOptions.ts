import type { ApexOptions } from "apexcharts";
import type { ChartType } from "../../types/widget";

type BuildChartOptionsParams = {
  chartId: string;
  chartType: ChartType;
  title: string;
  categories?: string[];
  labels?: string[];
  values?: number[];
};

const axisChartTypes: ChartType[] = ["line", "bar", "column"];

export function getApexChartType(chartType: ChartType): "line" | "bar" | "pie" {
  if (chartType === "bar" || chartType === "column") {
    return "bar";
  }

  return chartType;
}

export function buildChartOptions({
  chartId,
  chartType,
  categories,
  labels,
  values,
}: BuildChartOptionsParams): ApexOptions {
  const isBarChart = chartType === "bar";
  const isColumnChart = chartType === "column";
  const isLineChart = chartType === "line";
  const apexChartType = getApexChartType(chartType);
  const isCartesianChart = axisChartTypes.includes(chartType);
  const minValue =
    values && values.length > 0 ? Math.min(...values) : undefined;
  const maxValue =
    values && values.length > 0 ? Math.max(...values) : undefined;
  const valueRange =
    minValue !== undefined && maxValue !== undefined
      ? Math.max(maxValue - minValue, 1)
      : undefined;
  const verticalPadding =
    isLineChart && valueRange !== undefined ? valueRange * 0.45 : undefined;
  const yAxisMin =
    isLineChart && minValue !== undefined && verticalPadding !== undefined
      ? Math.floor(minValue - verticalPadding)
      : undefined;
  const yAxisMax =
    isLineChart && maxValue !== undefined && verticalPadding !== undefined
      ? Math.ceil(maxValue + verticalPadding)
      : undefined;

  return {
    chart: {
      id: chartId,
      type: apexChartType,
      background: "transparent",
      dropShadow: isLineChart
        ? {
            enabled: true,
            top: 0,
            left: 0,
            blur: 10,
            color: "#58ffd6",
            opacity: 0.9,
          }
        : undefined,
      toolbar: {
        show: !isLineChart,
      },
      sparkline: {
        enabled: false,
      },
    },
    theme: {
      mode: "dark",
    },
    colors: isLineChart
      ? ["#58ffd6"]
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
            gradientToColors: ["#0d6b53"],
            inverseColors: false,
            opacityFrom: 0.7,
            opacityTo: 0.4,
            stops: [0, 78, 100],
          },
        }
      : isColumnChart
        ? {
            type: "gradient",
            gradient: {
              shade: "dark",
              type: isBarChart ? "horizontal" : "vertical",
              shadeIntensity: 0,
              gradientToColors: ["#123d31"],
              inverseColors: false,
              opacityFrom: 0.96,
              opacityTo: 0.34,
              stops: [0, 18, 100],
            },
          }
      : undefined,
    markers: isLineChart
      ? {
          size: 0,
          colors: ["#58ffd6"],
          strokeColors: "#dffff7",
          strokeWidth: 3,
          discrete:
            values && values.length > 0
              ? [
                  {
                    seriesIndex: 0,
                    dataPointIndex: values.length - 1,
                    fillColor: "#081310",
                    strokeColor: "#58ffd6",
                    size: 6,
                  },
                ]
              : undefined,
          hover: {
            size: 6,
            sizeOffset: 1,
          },
        }
      : undefined,
    dataLabels: {
      enabled: false,
    },
    states: isLineChart
      ? {
          hover: {
            filter: {
              type: "none",
            },
          },
          active: {
            filter: {
              type: "none",
            },
          },
        }
      : undefined,
    tooltip: {
      theme: "dark",
      x: {
        show: isLineChart,
      },
      marker: {
        show: false,
      },
    },
    grid: isCartesianChart
      ? {
          borderColor: isLineChart
            ? "rgba(122, 255, 223, 0.24)"
            : isColumnChart
              ? "rgba(63, 216, 175, 0.12)"
              : "rgba(148, 163, 184, 0.16)",
          strokeDashArray: isLineChart ? 3 : 0,
          row: {
            colors: ["transparent"],
            opacity: 0,
          },
          column: {
            colors: ["transparent"],
            opacity: 0,
          },
        }
      : undefined,
    xaxis: isCartesianChart
      ? {
          categories,
          crosshairs: {
            show: isLineChart,
            stroke: {
              color: "rgba(125, 255, 225, 0.32)",
              width: 1.2,
              dashArray: 3,
            },
          },
          labels: {
            style: {
              colors: isLineChart
                ? "#7ea190"
                : isColumnChart
                  ? "#8ab8aa"
                  : "#94a3b8",
              fontSize: isLineChart ? "12px" : isColumnChart ? "11px" : undefined,
            },
          },
          axisBorder: {
            color: isLineChart
              ? "rgba(72, 101, 92, 0.16)"
              : isColumnChart
                ? "rgba(63, 216, 175, 0.14)"
                : "rgba(148, 163, 184, 0.16)",
          },
          axisTicks: {
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
          min: yAxisMin,
          max: yAxisMax,
          tickAmount: isLineChart ? 5 : undefined,
          labels: {
            formatter: isLineChart
              ? (value: number) => value.toFixed(0)
              : undefined,
            style: {
              colors: isLineChart
                ? "#7ea190"
                : isColumnChart
                  ? "#8ab8aa"
                  : "#94a3b8",
              fontSize: isLineChart ? "12px" : isColumnChart ? "11px" : undefined,
            },
          },
        }
      : undefined,
    plotOptions: {
      bar: {
        horizontal: isBarChart,
        borderRadius: isColumnChart ? 3 : 0,
        borderRadiusApplication: isColumnChart ? "end" : "around",
        borderRadiusWhenStacked: "last",
        columnWidth: isColumnChart ? "62%" : undefined,
        barHeight: isBarChart ? "82%" : undefined,
        distributed: false,
        colors: isColumnChart
          ? {
              ranges: [
                {
                  from: Number.NEGATIVE_INFINITY,
                  to: -0.00001,
                  color: "#ff4d5f",
                },
              ],
              backgroundBarOpacity: 0,
            }
          : undefined,
      },
    },
    labels: chartType === "pie" ? labels : undefined,
    stroke: isLineChart
      ? {
          curve: "smooth",
          width: 4,
          lineCap: "round",
        }
      : isColumnChart
        ? {
            width: 1,
            colors: ["rgba(120, 255, 221, 0.28)"],
          }
        : undefined,
  };
}
