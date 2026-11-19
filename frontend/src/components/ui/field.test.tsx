import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { expect, it } from 'vitest'
import { Field } from './field'
import { Input } from './input'
import { Label } from './label'
import { Textarea } from './textarea'

it('associates a standalone label with an uncontrolled input', async () => {
  const user = userEvent.setup()
  render(
    <>
      <Label htmlFor="name">Name</Label>
      <Input id="name" defaultValue="Initial" />
    </>,
  )
  const input = screen.getByRole('textbox', { name: 'Name' })
  await user.click(screen.getByText('Name'))
  expect(input).toHaveFocus()
  await user.clear(input)
  await user.type(input, 'Updated')
  expect(input).toHaveValue('Updated')
})

it('generates distinct labelled controls and exposes required and disabled states', async () => {
  const user = userEvent.setup()
  render(
    <>
      <Field label="Name" required>
        {(props) => <Input {...props} />}
      </Field>
      <Field label="Reference" disabled>
        {(props) => <Input {...props} defaultValue="Locked" />}
      </Field>
    </>,
  )
  const required = screen.getByRole('textbox', { name: 'Name (required)' })
  const disabled = screen.getByRole('textbox', { name: 'Reference' })
  expect(required).toBeRequired()
  expect(disabled).toBeDisabled()
  expect(required.id).not.toBe(disabled.id)
  await user.type(disabled, 'Ignored')
  expect(disabled).toHaveValue('Locked')
  await user.click(screen.getByText('Name (required)'))
  expect(required).toHaveFocus()
})

it('associates descriptions and validation errors and removes stale error references', () => {
  const view = (error?: string) => (
    <Field id="email" label="Email" description="Use your work email." error={error}>
      {(props) => <Input {...props} type="email" />}
    </Field>
  )
  const { rerender } = render(view('Enter a valid email.'))
  const input = screen.getByRole('textbox', { name: 'Email' })
  expect(input).toHaveAttribute('aria-invalid', 'true')
  expect(input).toHaveAccessibleDescription('Use your work email. Enter a valid email.')
  expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email.')
  rerender(view())
  expect(input).toHaveAttribute('aria-invalid', 'false')
  expect(input).toHaveAccessibleDescription('Use your work email.')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

function ControlledFields() {
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  return (
    <>
      <Field label="Name">
        {(props) => (
          <Input {...props} value={name} onChange={(event) => setName(event.target.value)} />
        )}
      </Field>
      <Field label="Notes" description="Optional details.">
        {(props) => (
          <Textarea {...props} value={notes} onChange={(event) => setNotes(event.target.value)} />
        )}
      </Field>
      <output aria-label="Entered values">
        {name}: {notes}
      </output>
    </>
  )
}

it('supports controlled input and textarea values with native multiline keyboard behavior', async () => {
  const user = userEvent.setup()
  render(<ControlledFields />)
  await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Ada')
  await user.type(screen.getByRole('textbox', { name: 'Notes' }), 'First{Enter}Second')
  expect(screen.getByRole('textbox', { name: 'Notes' })).toHaveValue('First\nSecond')
  expect(screen.getByLabelText('Entered values')).toHaveTextContent('Ada: First Second')
})

it('preserves caller-provided accessibility attributes and refs', () => {
  const ref = { current: null as HTMLTextAreaElement | null }
  render(
    <>
      <p id="help">Explain the issue.</p>
      <Textarea
        ref={ref}
        aria-label="Issue"
        aria-invalid="true"
        aria-describedby="help"
        defaultValue="Draft"
        required
        disabled
      />
    </>,
  )
  const textarea = screen.getByRole('textbox', { name: 'Issue' })
  expect(textarea).toHaveAccessibleDescription('Explain the issue.')
  expect(textarea).toHaveAttribute('aria-invalid', 'true')
  expect(textarea).toBeDisabled()
  expect(textarea).toBeRequired()
  expect(ref.current).toBe(textarea)
})
