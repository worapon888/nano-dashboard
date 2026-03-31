import { useDeferredValue } from 'react'
import ReactApexChart from 'react-apexcharts'
import type { ApexOptions } from 'apexcharts'
import useResizeObserver from '../../../shared/hooks/useResizeObserver'
import type { CartesianChartSeries } from '../../../shared/types/widget'

type ChartRendererProps = {
  chartType: 'area' | 'line' | 'bar' | 'pie'
  chartOptions: ApexOptions
  chartSeries: number[] | CartesianChartSeries[]
}

function ChartRenderer({
  chartType,
  chartOptions,
  chartSeries,
}: ChartRendererProps) {
  const { ref, width, height } = useResizeObserver<HTMLDivElement>()
  const deferredWidth = useDeferredValue(width)
  const deferredHeight = useDeferredValue(height)
  const chartWidth = Math.max(deferredWidth, 0)
  const chartHeight = Math.max(deferredHeight, 0)
  const isReady = chartWidth > 0 && chartHeight > 0

  return (
    <div
      ref={ref}
      className="relative z-[1] flex-1 min-h-0 min-w-0 w-full overflow-hidden"
    >
      {isReady ? (
        <ReactApexChart
          type={chartType}
          series={chartSeries}
          options={chartOptions}
          height={chartHeight}
          width={chartWidth}
        />
      ) : null}
    </div>
  )
}

export default ChartRenderer
