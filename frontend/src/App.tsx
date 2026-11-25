import { NotificationProvider } from '@/app/providers/NotificationProvider'
import { WorkspaceAppearance } from '@/features/settings/WorkspaceAppearance'
import { AppRouter } from '@/app/router/AppRouter'

function App() {
  return (
    <NotificationProvider>
      <WorkspaceAppearance />
      <AppRouter />
    </NotificationProvider>
  )
}

export default App
