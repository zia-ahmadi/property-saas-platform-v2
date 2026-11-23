import { leaseStatuses, type LeaseStatus as Status } from './api'

const tones: Record<Status, string> = {
  DRAFT: 'bg-violet-500/10 text-violet-800 dark:text-violet-200',
  ACTIVE: 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-200',
  ENDED: 'bg-slate-500/10 text-slate-700 dark:text-slate-200',
  CANCELLED: 'bg-muted text-muted-foreground',
}

export function LeaseStatus({ status }: { status: Status }) {
  return <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${tones[status]}`}>{leaseStatuses[status]}</span>
}
