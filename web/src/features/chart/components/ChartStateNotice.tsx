import WidgetShell from '../../../shared/components/WidgetShell'

type ChartStateNoticeProps = {
  title: string
  tone: 'empty' | 'error'
  heading: string
  description: string
}

function ChartStateNotice({
  title,
  tone,
  heading,
  description,
}: ChartStateNoticeProps) {
  return (
    <WidgetShell title={title} subtitle="Chart">
      <div className="flex h-full min-h-0 items-center justify-center p-5">
        <div
          className={`w-full max-w-sm rounded-[1.2rem] border px-5 py-6 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] ${
            tone === 'error'
              ? 'border-rose-400/14 bg-rose-400/[0.04]'
              : 'border-white/8 bg-white/[0.02]'
          }`}
        >
          <div
            className={`mx-auto flex h-11 w-11 items-center justify-center rounded-full border ${
              tone === 'error'
                ? 'border-rose-400/18 bg-rose-400/[0.08] text-rose-300'
                : 'border-white/10 bg-white/[0.04] text-slate-300'
            }`}
          >
            {tone === 'error' ? '!' : '?'}
          </div>
          <h3 className="mt-4 text-sm font-semibold tracking-[0.01em] text-slate-100">
            {heading}
          </h3>
          <p className="mt-2 text-[0.82rem] leading-6 text-slate-400">{description}</p>
        </div>
      </div>
    </WidgetShell>
  )
}

export default ChartStateNotice
