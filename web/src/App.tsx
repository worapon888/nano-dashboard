import { ReactLenis } from 'lenis/react'
import DashboardPage from './features/dashboard/components/DashboardPage'

function App() {
  return (
    <ReactLenis
      root
      options={{
        autoRaf: true,
        duration: 1.3,
        smoothWheel: true,
        wheelMultiplier: 0.9,
        syncTouch: true,
        touchMultiplier: 1,
        gestureOrientation: 'vertical',
      }}
    >
      <DashboardPage />
    </ReactLenis>
  )
}

export default App
