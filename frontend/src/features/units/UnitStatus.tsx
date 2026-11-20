export function UnitStatus({ status }: { status: string }) {
  const styles: Record<string, string> = {
    AVAILABLE: 'bg-green-100 text-green-900',
    UNAVAILABLE: 'bg-amber-100 text-amber-900',
    OCCUPIED: 'bg-blue-100 text-blue-900',
  }
  return (
    <span
      className={`inline-block rounded px-2 py-1 text-sm ${styles[status] ?? 'bg-muted text-foreground'}`}
    >
      Availability: {styles[status] ? status : 'Unknown (unsupported status)'}
    </span>
  )
}
