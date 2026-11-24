import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { expect, it, vi } from 'vitest'
import type { InvoiceDetails } from '@/features/billing/api'
import { BillingPage } from './BillingPage'
import { InvoiceDetailsPage } from './InvoiceDetailsPage'
import { IssueInvoicePage } from './IssueInvoicePage'

const request = vi.hoisted(() => vi.fn())

vi.mock('@/features/organization/context', () => ({
  useOrganization: () => ({
    current: { organizationId: 'org-1' },
    queryKey: (keys: unknown[]) => ['organization', 'org-1', ...keys],
    request,
  }),
}))

it('opens an invoice from the register and records a partial payment', async () => {
  const user = userEvent.setup()
  let record: InvoiceDetails = {
    asOf: '2026-11-24',
    invoice: {
      id: 'invoice-1', invoiceNumber: 42, leaseId: 'lease-1', renterName: 'Sam Renter',
      propertyName: 'North House', unitNumber: '1A', billingMonth: '2026-11-01',
      dueOn: '2026-11-30', issuedAt: '2026-11-01T00:00:00Z', currency: 'USD',
      amount: 900, paidAmount: 0, balance: 900, status: 'OPEN', version: 0,
      voidedAt: null, voidReason: null,
    },
    payments: [],
  }

  request.mockImplementation(async (method: string, path: string) => {
    if (method === 'get' && path === 'billing/invoices/summary') {
      return { open: 1, overdue: 0, paid: 0, totals: [], asOf: record.asOf }
    }
    if (method === 'get' && path === 'billing/invoices') {
      return { content: [record.invoice], totalElements: 1, totalPages: 1 }
    }
    if (method === 'get' && path === 'billing/invoices/invoice-1') return record
    if (method === 'post' && path === 'billing/invoices/invoice-1/payments') {
      record = {
        ...record,
        invoice: { ...record.invoice, paidAmount: 300, balance: 600, status: 'PARTIALLY_PAID', version: 1 },
        payments: [{
          id: 'payment-1', amount: 300, method: 'BANK_TRANSFER', reference: 'Receipt 90',
          receivedOn: record.asOf, recordedAt: '2026-11-24T12:00:00Z',
        }],
      }
      return record
    }
    throw new Error(`Unexpected request ${method} ${path}`)
  })

  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/billing']}>
        <Routes>
          <Route path="/billing" element={<BillingPage />} />
          <Route path="/billing/:invoiceId" element={<InvoiceDetailsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )

  await user.click(await screen.findByRole('link', { name: /INV-42/ }))
  await user.click(await screen.findByRole('button', { name: 'Record payment' }))
  await user.type(screen.getByRole('spinbutton', { name: 'Amount (USD)' }), '300')
  await user.selectOptions(screen.getByRole('combobox', { name: 'Payment method' }), 'BANK_TRANSFER')
  await user.type(screen.getByRole('textbox', { name: 'Reference (optional)' }), 'Receipt 90')
  await user.click(screen.getByRole('button', { name: 'Save payment' }))

  expect(request).toHaveBeenCalledWith('post', 'billing/invoices/invoice-1/payments', {
    amount: 300, receivedOn: '2026-11-24', method: 'BANK_TRANSFER', reference: 'Receipt 90', version: 0,
  })
  expect(await screen.findByText('Partially paid')).toBeInTheDocument()
  expect(within(screen.getByRole('region', { name: 'Payment history' })).getByText('Receipt 90')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Void invoice' })).not.toBeInTheDocument()
})


it('issues an invoice using the lease selected from the lease page', async () => {
  const user = userEvent.setup()
  request.mockImplementation(async (method: string, path: string) => {
    if (method === 'get' && path === 'leases/lease-1') {
      return {
        id: 'lease-1', renterName: 'Sam Renter', propertyName: 'North House', unitNumber: '1A',
        startsOn: '2026-11-01', endsOn: null, monthlyRent: 900, currency: 'USD', status: 'ACTIVE',
      }
    }
    if (method === 'post' && path === 'billing/invoices') return { invoice: { id: 'invoice-1' } }
    throw new Error(`Unexpected request ${method} ${path}`)
  })

  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/billing/new?lease=lease-1']}>
        <Routes>
          <Route path="/billing/new" element={<IssueInvoicePage />} />
          <Route path="/billing/invoice-1" element={<h2>Invoice created</h2>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )

  expect(await screen.findByText('Sam Renter · North House · Unit 1A')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Billing month'), { target: { value: '2026-11' } })
  fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '2026-11-30' } })
  await user.click(screen.getByRole('button', { name: 'Issue invoice' }))

  expect(await screen.findByRole('heading', { name: 'Invoice created' })).toBeInTheDocument()
  expect(request).toHaveBeenCalledWith('post', 'billing/invoices', {
    leaseId: 'lease-1', billingMonth: '2026-11-01', dueOn: '2026-11-30',
  })
})
