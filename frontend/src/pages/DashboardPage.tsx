import { Building2, Users, DollarSign, Wrench, ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router'

export function DashboardPage() {
  const navigate = useNavigate()

  const stats = [
    { label: 'Total Properties', value: '12', icon: Building2, change: '+2 this month' },
    { label: 'Active Leases', value: '148', icon: Users, change: '94% occupancy' },
    { label: 'Monthly Revenue', value: '$284,500', icon: DollarSign, change: '+12.4% YoY' },
    { label: 'Open Maintenance', value: '7', icon: Wrench, change: '2 high priority' },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Enterprise Portfolio Dashboard</h2>
        <p className="text-sm text-muted-foreground">
          Overview of multi-tenant property operations and financials.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="rounded-xl border bg-card p-6 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-sm font-medium">{stat.label}</span>
                <Icon className="size-4" />
              </div>
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="text-xs text-emerald-600 font-medium">{stat.change}</div>
            </div>
          )
        })}
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Quick Navigation & Routing Test</h3>
          <Button size="sm" onClick={() => navigate('/properties')} className="gap-1.5">
            View Properties <ArrowUpRight className="size-4" />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          React Router is successfully mounted. Use the sidebar to navigate between properties,
          property details, units, and settings without full-page reloads.
        </p>
      </div>
    </div>
  )
}
