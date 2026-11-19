import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from './table'

it('renders semantic headings, caption, and data inside a keyboard-focusable scroll region', async () => {
  const user = userEvent.setup()
  render(
    <TableContainer aria-label="Example records">
      <Table>
        <TableCaption>Example records</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>State</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableHead scope="row">Example</TableHead>
            <TableCell>Ready</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>,
  )
  const region = screen.getByRole('region', { name: 'Example records' })
  expect(region).toHaveAccessibleName('Example records')
  const table = within(region).getByRole('table', { name: 'Example records' })
  expect(within(table).getAllByRole('rowgroup')).toHaveLength(2)
  expect(within(table).getAllByRole('row')).toHaveLength(2)
  expect(within(table).getByRole('columnheader', { name: 'Name' })).toHaveAttribute('scope', 'col')
  expect(within(table).getByRole('rowheader', { name: 'Example' })).toHaveAttribute('scope', 'row')
  expect(within(table).getByRole('cell', { name: 'Ready' })).toBeInTheDocument()
  await user.tab()
  expect(region).toHaveFocus()
})

it('supports an externally labelled table without a caption', () => {
  render(
    <>
      <h2 id="records-title">Records</h2>
      <Table aria-labelledby="records-title">
        <TableBody>
          <TableRow>
            <TableCell>No records yet</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </>,
  )
  expect(screen.getByRole('table', { name: 'Records' })).toHaveTextContent('No records yet')
})

it('names the scroll region from aria-labelledby and preserves native div props', async () => {
  const user = userEvent.setup()
  const onFocus = vi.fn()
  const ref = { current: null as HTMLDivElement | null }
  render(
    <>
      <h2 id="table-title">Available records</h2>
      <TableContainer
        aria-labelledby="table-title"
        id="records-region"
        title="Scroll to explore"
        ref={ref}
        onFocus={onFocus}
      >
        <Table aria-labelledby="table-title">
          <TableBody>
            <TableRow>
              <TableCell>Example</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </>,
  )
  const region = screen.getByRole('region', { name: 'Available records' })
  expect(region).toHaveAccessibleName('Available records')
  expect(region).toHaveAttribute('id', 'records-region')
  expect(region).toHaveAttribute('title', 'Scroll to explore')
  expect(ref.current).toBe(region)
  await user.tab()
  expect(region).toHaveFocus()
  expect(onFocus).toHaveBeenCalledOnce()
})
