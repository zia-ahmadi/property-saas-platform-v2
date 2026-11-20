import { useState, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { unitTypes, type UnitInput, type UnitType } from './api'
export function UnitForm({
  initial,
  saving,
  error,
  onSave,
}: {
  initial: UnitInput
  saving: boolean
  error?: string
  onSave: (input: UnitInput) => Promise<unknown>
}) {
  const [number, setNumber] = useState(initial.unitNumber)
  const [type, setType] = useState(initial.unitType)
  const [floor, setFloor] = useState(initial.floorNumber?.toString() ?? '')
  const [area, setArea] = useState(initial.areaSqm?.toString() ?? '')
  const [validation, setValidation] = useState('')
  const lock = useRef(false)
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (lock.current || saving) return
    if (!number.trim() || number.trim().length > 50) {
      setValidation('Unit number must contain 1–50 characters.')
      return
    }
    if (
      floor &&
      (!/^-?\d+$/.test(floor) || Number(floor) < -2147483648 || Number(floor) > 2147483647)
    ) {
      setValidation('Floor must be a 32-bit integer.')
      return
    }
    if (area && (!/^\d{1,10}(\.\d{1,2})?$/.test(area) || Number(area) <= 0)) {
      setValidation(
        'Area must be greater than zero, with at most 10 integer digits and 2 decimal places.',
      )
      return
    }
    setValidation('')
    lock.current = true
    try {
      await onSave({
        unitNumber: number.trim(),
        unitType: type,
        floorNumber: floor ? Number(floor) : null,
        areaSqm: area ? Number(area) : null,
      })
    } finally {
      lock.current = false
    }
  }
  return (
    <form onSubmit={submit} className="max-w-xl space-y-4" aria-describedby="unit-error">
      <fieldset disabled={saving} className="space-y-4">
        <div>
          <Label htmlFor="unit-number">Unit number *</Label>
          <Input
            id="unit-number"
            required
            maxLength={50}
            value={number}
            onChange={(e) => setNumber(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="unit-type">Unit type *</Label>
          <select
            id="unit-type"
            required
            className="min-h-11 w-full rounded border bg-background p-2"
            value={type}
            onChange={(e) => setType(e.target.value as UnitType)}
          >
            {unitTypes.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="unit-floor">Floor (optional)</Label>
          <Input
            id="unit-floor"
            inputMode="numeric"
            value={floor}
            onChange={(e) => setFloor(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="unit-area">Area in m² (optional)</Label>
          <Input
            id="unit-area"
            inputMode="decimal"
            value={area}
            onChange={(e) => setArea(e.target.value)}
          />
        </div>
        <p id="unit-error" role={validation || error ? 'alert' : undefined}>
          {validation || error}
        </p>
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save unit'}
        </Button>
      </fieldset>
    </form>
  )
}
