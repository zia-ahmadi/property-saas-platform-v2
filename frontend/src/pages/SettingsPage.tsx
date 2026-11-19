import { ShieldCheck, User, Bell, Database } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function SettingsPage() {
  const sections = [
    {
      title: 'Profile Settings',
      icon: User,
      desc: 'Manage your user profile and security credentials.',
    },
    {
      title: 'Notification Preferences',
      icon: Bell,
      desc: 'Configure email and alert settings for your organization.',
    },
    {
      title: 'Tenant Configuration',
      icon: ShieldCheck,
      desc: 'Manage your organization’s isolation settings and security keys.',
    },
    {
      title: 'Data & API',
      icon: Database,
      desc: 'API keys, database backups, and environment configuration.',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Manage your enterprise tenant and account settings.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sections.map((section) => {
          const Icon = section.icon
          return (
            <div
              key={section.title}
              className="rounded-xl border bg-card p-6 shadow-xs flex flex-col gap-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-foreground">
                  <Icon className="size-5" />
                </div>
                <h3 className="font-semibold">{section.title}</h3>
              </div>
              <p className="text-sm text-muted-foreground flex-1">{section.desc}</p>
              <Button variant="outline" size="sm" className="w-full">
                Configure
              </Button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
