import DashboardGrid from './DashboardGrid'

function DashboardPage() {
  return (
    <main className="min-h-screen bg-black text-slate-100">
      <div className="flex min-h-screen flex-col px-6 py-8 sm:px-8 lg:px-10">
        <header className="border-b border-white/8 pb-6">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500">
            NanoDashboard
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Trading Dashboard
          </h1>
        </header>

        <section className="mt-6 flex-1 rounded-3xl border border-white/8 bg-[#050505] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          <DashboardGrid />
        </section>
      </div>
    </main>
  )
}

export default DashboardPage
