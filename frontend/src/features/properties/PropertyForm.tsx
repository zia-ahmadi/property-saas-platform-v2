import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { propertyTypes, type PropertyInput, type PropertyType } from './api'

export function PropertyForm({ initial, saving, error, onSave }: { initial: PropertyInput; saving: boolean; error?: string; onSave: (value: PropertyInput) => void }) {
  const [value, setValue] = useState(initial)
  const [validation, setValidation] = useState('')
  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!value.name.trim() || !value.addressLine1.trim() || !value.city.trim()) { setValidation('Name, address and city are required.'); return }
    if (!/^[A-Z]{2}$/.test(value.countryCode)) { setValidation('Country code must contain two uppercase letters.'); return }
    setValidation('')
    onSave({ ...value, name: value.name.trim(), addressLine1: value.addressLine1.trim(), addressLine2: value.addressLine2?.trim() || null, city: value.city.trim() })
  }
  return <form onSubmit={submit} className="max-w-xl space-y-4">
    <div className="space-y-2"><Label htmlFor="property-name">Property name</Label><Input id="property-name" required maxLength={150} value={value.name} onChange={e => setValue({ ...value, name: e.target.value })} /></div>
    <div className="space-y-2"><Label htmlFor="property-type">Property type</Label><select id="property-type" className="min-h-11 w-full rounded-md border bg-background px-3" value={value.propertyType} onChange={e => setValue({ ...value, propertyType: e.target.value as PropertyType })}>{propertyTypes.map(type => <option key={type} value={type}>{type.replace('_', ' ')}</option>)}</select></div>
    <div className="space-y-2"><Label htmlFor="property-address">Address line 1</Label><Input id="property-address" required maxLength={255} value={value.addressLine1} onChange={e => setValue({ ...value, addressLine1: e.target.value })} /></div>
    <div className="space-y-2"><Label htmlFor="property-address2">Address line 2 (optional)</Label><Input id="property-address2" maxLength={255} value={value.addressLine2 ?? ''} onChange={e => setValue({ ...value, addressLine2: e.target.value })} /></div>
    <div className="space-y-2"><Label htmlFor="property-city">City</Label><Input id="property-city" required maxLength={100} value={value.city} onChange={e => setValue({ ...value, city: e.target.value })} /></div>
    <div className="space-y-2"><Label htmlFor="property-country">Country code</Label><Input id="property-country" required maxLength={2} value={value.countryCode} onChange={e => setValue({ ...value, countryCode: e.target.value.toUpperCase() })} aria-describedby="country-help" /><p id="country-help" className="text-sm text-muted-foreground">Two-letter country code, such as US.</p></div>
    {(validation || error) && <p role="alert" className="text-sm text-destructive">{validation || error}</p>}
    <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save property'}</Button>
  </form>
}
