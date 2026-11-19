import { Button } from './button'

interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  label?: string
}

function getVisiblePages(page: number, totalPages: number) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1)

  const start = Math.max(2, Math.min(page - 1, totalPages - 3))
  const pages = [1, start, start + 1, start + 2, totalPages]

  return pages.flatMap((number, index) => {
    const gap = index === 0 ? 0 : number - pages[index - 1]
    if (gap === 2) return [number - 1, number]
    return gap > 2 ? [`gap-${number}` as const, number] : [number]
  })
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
  label = 'Pagination',
}: PaginationProps) {
  if (
    !Number.isSafeInteger(totalPages) ||
    totalPages <= 1 ||
    !Number.isSafeInteger(page) ||
    page < 1 ||
    page > totalPages
  ) {
    return null
  }

  const selectPage = (next: number) => {
    if (next >= 1 && next <= totalPages && next !== page) onPageChange(next)
  }

  return (
    <nav aria-label={label}>
      <ul className="flex min-w-0 flex-wrap items-center gap-1">
        <li>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            aria-label="Previous page"
            disabled={page === 1}
            onClick={() => selectPage(page - 1)}
          >
            Previous
          </Button>
        </li>
        {getVisiblePages(page, totalPages).map((item) => (
          <li key={item} className="min-w-0">
            {typeof item === 'number' ? (
              <Button
                type="button"
                variant={item === page ? 'default' : 'outline'}
                className="min-h-11 min-w-11"
                aria-label={`Page ${item}`}
                aria-current={item === page ? 'page' : undefined}
                onClick={() => selectPage(item)}
              >
                {item}
              </Button>
            ) : (
              <>
                <span aria-hidden="true" className="px-2 text-muted-foreground">
                  …
                </span>
                <span className="sr-only">Pages omitted</span>
              </>
            )}
          </li>
        ))}
        <li>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            aria-label="Next page"
            disabled={page === totalPages}
            onClick={() => selectPage(page + 1)}
          >
            Next
          </Button>
        </li>
      </ul>
    </nav>
  )
}
