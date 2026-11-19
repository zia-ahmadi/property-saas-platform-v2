import { NotificationProvider } from '@/app/providers/NotificationProvider'
import { AppRouter } from '@/app/router/AppRouter'

function App() {
  return (
    <NotificationProvider>
      <AppRouter />
    </NotificationProvider>
  )
}

export default App
