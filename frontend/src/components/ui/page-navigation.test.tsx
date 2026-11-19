import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import { useState } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { Breadcrumbs } from './breadcrumbs'
import { Button } from './button'
import { PageHeader } from './page-header'
import { Pagination } from './pagination'

describe('PageHeader', () => {
  it('renders a standalone page heading without optional content', () => {
    render(<PageHeader title="Quarterly property availability" />)
    expect(
      screen.getByRole('heading', { level: 1, name: 'Quarterly property availability' }),
    ).toBeVisible()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('supports an in-shell heading, description, breadcrumbs, and an operable action', async () => {
    const user = userEvent.setup()
    const onAction = vi.fn()
    render(
      <MemoryRouter>
        <PageHeader
          headingLevel={2}
          title="Record details"
          description="Review the record."
          breadcrumbs={
            <Breadcrumbs ancestors={[{ label: 'Records', to: '/' }]} current="Record details" />
          }
          actions={<Button onClick={onAction}>Edit record</Button>}
        />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { level: 2, name: 'Record details' })).toBeVisible()
    expect(screen.getByText('Review the record.')).toBeVisible()
    await user.tab()
    expect(screen.getByRole('link', { name: 'Records' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Edit record' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(onAction).toHaveBeenCalledOnce()
  })
})

describe('Breadcrumbs', () => {
  it('exposes ordered ancestors, a current item, and decorative separators', () => {
    render(
      <MemoryRouter>
        <Breadcrumbs
          ancestors={[
            { label: 'Properties', to: '/properties' },
            { label: 'Property 101', to: '/properties/101' },
          ]}
          current="Units"
        />
      </MemoryRouter>,
    )

    const trail = screen.getByRole('navigation', { name: 'Breadcrumb' })
    const list = within(trail).getByRole('list')
    expect(list.tagName).toBe('OL')
    const items = within(list).getAllByRole('listitem')
    expect(items.map((item) => item.textContent)).toEqual(['Properties', 'Property 101', 'Units'])
    expect(items[2]).toHaveAttribute('aria-current', 'page')
    expect(within(list).getAllByRole('link')).toHaveLength(2)
    expect(items[0].querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('navigates to a caller-provided destination by keyboard', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/properties/101']}>
        <Routes>
          <Route
            path="/properties/101"
            element={
              <Breadcrumbs
                ancestors={[{ label: 'Properties', to: '/properties' }]}
                current="Property 101"
              />
            }
          />
          <Route path="/properties" element={<h1>Property list</h1>} />
        </Routes>
      </MemoryRouter>,
    )
    await user.tab()
    expect(screen.getByRole('link', { name: 'Properties' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('heading', { name: 'Property list' })).toBeVisible()
  })
})

describe('Pagination', () => {
  it.each([
    [1, 0],
    [1, 1],
    [0, 5],
    [6, 5],
    [1.5, 5],
    [1, Infinity],
  ])('renders no controls for page %s with total %s', (page, totalPages) => {
    render(<Pagination page={page} totalPages={totalPages} onPageChange={vi.fn()} />)
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('uses one-based pages and prevents invalid or current-page callbacks', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    const { rerender } = render(<Pagination page={1} totalPages={3} onPageChange={onPageChange} />)
    await user.click(screen.getByRole('button', { name: 'Previous page' }))
    await user.click(screen.getByRole('button', { name: 'Page 1', current: 'page' }))
    expect(onPageChange).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(onPageChange).toHaveBeenLastCalledWith(2)

    rerender(<Pagination page={3} totalPages={3} onPageChange={onPageChange} />)
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(onPageChange).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Previous page' }))
    expect(onPageChange).toHaveBeenLastCalledWith(2)
  })

  it('supports keyboard selection and retains focus on the selected page', async () => {
    function ControlledPagination() {
      const [page, setPage] = useState(1)
      return <Pagination page={page} totalPages={4} onPageChange={setPage} />
    }

    const user = userEvent.setup()
    render(<ControlledPagination />)
    await user.tab()
    await user.tab()
    const second = screen.getByRole('button', { name: 'Page 2' })
    expect(second).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(second).toHaveFocus()
    expect(second).toHaveAttribute('aria-current', 'page')
  })

  it('renders a compact range and noninteractive, announced gaps', () => {
    render(
      <Pagination page={50} totalPages={100} onPageChange={vi.fn()} label="Records pagination" />,
    )
    const nav = screen.getByRole('navigation', { name: 'Records pagination' })
    expect(
      within(nav)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Previous', '1', '49', '50', '51', '100', 'Next'])
    expect(within(nav).getAllByText('Pages omitted')).toHaveLength(2)
    expect(within(nav).getAllByText('…')[0]).toHaveAttribute('aria-hidden', 'true')
  })

  it.each([
    [1, 100, '1 2 3 4 … 100'],
    [2, 100, '1 2 3 4 … 100'],
    [3, 100, '1 2 3 4 … 100'],
    [50, 100, '1 … 49 50 51 … 100'],
    [98, 100, '1 … 97 98 99 100'],
    [99, 100, '1 … 97 98 99 100'],
    [100, 100, '1 … 97 98 99 100'],
    [1, 8, '1 2 3 4 … 8'],
    [2, 8, '1 2 3 4 … 8'],
    [3, 8, '1 2 3 4 … 8'],
    [4, 8, '1 2 3 4 5 … 8'],
    [5, 8, '1 … 4 5 6 7 8'],
    [6, 8, '1 … 5 6 7 8'],
    [7, 8, '1 … 5 6 7 8'],
    [8, 8, '1 … 5 6 7 8'],
  ])('renders the exact ordered range for page %i of %i', (page, totalPages, range) => {
    render(<Pagination page={page} totalPages={totalPages} onPageChange={vi.fn()} />)
    const items = screen.getAllByRole('listitem').slice(1, -1)
    expect(
      items.map((item) => {
        const button = within(item).queryByRole('button')
        if (button) {
          expect(button).toHaveAccessibleName(`Page ${button.textContent}`)
          return button.textContent
        }
        expect(within(item).getByText('Pages omitted')).toBeInTheDocument()
        expect(within(item).getByText('…')).toHaveAttribute('aria-hidden', 'true')
        return '…'
      }),
    ).toEqual(range.split(' '))
    expect(screen.getByRole('button', { current: 'page' })).toHaveAccessibleName(`Page ${page}`)
  })

  it.each([2, 3, 4, 5, 6, 7])('renders all %i pages for every current page', (totalPages) => {
    const onPageChange = vi.fn()
    const { rerender } = render(
      <Pagination page={1} totalPages={totalPages} onPageChange={onPageChange} />,
    )

    for (let page = 1; page <= totalPages; page++) {
      rerender(<Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />)
      expect(
        screen.getAllByRole('button', { name: /^Page \d+$/ }).map((button) => button.textContent),
      ).toEqual(Array.from({ length: totalPages }, (_, index) => String(index + 1)))
      expect(screen.getByRole('button', { current: 'page' })).toHaveAccessibleName(`Page ${page}`)
      expect(screen.queryByText('Pages omitted')).not.toBeInTheDocument()
    }
  })

  it('keeps keyboard focus on a selected page when the compact range shifts', async () => {
    function ControlledPagination() {
      const [page, setPage] = useState(3)
      return <Pagination page={page} totalPages={8} onPageChange={setPage} />
    }

    const user = userEvent.setup()
    render(<ControlledPagination />)
    for (let index = 0; index < 5; index++) await user.tab()
    const fourthPage = screen.getByRole('button', { name: 'Page 4' })
    expect(fourthPage).toHaveFocus()
    expect(screen.queryByRole('button', { name: 'Page 5' })).not.toBeInTheDocument()
    await user.keyboard('{Enter}')
    expect(fourthPage).toHaveFocus()
    expect(fourthPage).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Page 5' })).toBeInTheDocument()
  })
})

it('passes an axe scan of the composed header and navigation', async () => {
  const { container } = render(
    <MemoryRouter>
      <main>
        <PageHeader
          title="Record details"
          breadcrumbs={
            <Breadcrumbs ancestors={[{ label: 'Records', to: '/' }]} current="Record details" />
          }
        />
        <Pagination page={5} totalPages={10} onPageChange={vi.fn()} />
      </main>
    </MemoryRouter>,
  )
  const { violations } = await axe.run(container, {
    // Rendered color contrast is checked in Chrome.
    rules: { 'color-contrast': { enabled: false } },
  })
  expect(
    violations.map(({ id, nodes }) => ({ id, targets: nodes.map(({ target }) => target) })),
  ).toEqual([])
})
