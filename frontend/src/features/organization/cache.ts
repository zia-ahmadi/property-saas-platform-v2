import type { QueryClient } from '@tanstack/react-query'

/** Remove obsolete tenant data without asynchronously clearing newly mounted queries. */
export function discardOrganizationQueries(client: QueryClient, keep?: readonly unknown[]) {
  const predicate = (query: { queryKey: readonly unknown[] }) => query.queryKey[0] === 'organization' &&
    (!keep || keep.some((value, index) => query.queryKey[index + 1] !== value))
  // Cancellation starts synchronously. Never chain a global clear after it: the
  // verified scope may already have mounted its queries when that promise settles.
  void client.cancelQueries({ predicate })
  client.removeQueries({ predicate })
}
