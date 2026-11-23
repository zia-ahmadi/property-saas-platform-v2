import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { propertyTypes, type PropertyInput, type PropertyType } from './api'
import { MapPin } from 'lucide-react'

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
  return (
    <form onSubmit={submit} className="w-full space-y-7">
      <fieldset disabled={saving} className="space-y-7">
        <section aria-labelledby="property-basics-heading" className="space-y-4">
          <div className="flex items-center gap-3 border-b pb-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/5 text-primary">
              <MapPin aria-hidden="true" className="size-4" />
            </span>
            <div>
              <h3 id="property-basics-heading" className="font-semibold">
                Property details
              </h3>
              <p className="text-sm text-muted-foreground">
                Give this location a name and a clear type.
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="property-name">Property name</Label>
              <Input
                id="property-name"
                required
                maxLength={150}
                placeholder="e.g. Northstar Residences"
                value={value.name}
                onChange={(event) => setValue({ ...value, name: event.target.value })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="property-type">Property type</Label>
              <select
                id="property-type"
                className="min-h-11 w-full rounded-md border bg-background px-3 text-base"
                value={value.propertyType}
                onChange={(event) =>
                  setValue({ ...value, propertyType: event.target.value as PropertyType })
                }
              >
                {propertyTypes.map((type) => (
                  <option key={type} value={type}>
                    {type.replaceAll('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>
        <section aria-labelledby="property-location-heading" className="space-y-4">
          <div className="border-b pb-3">
            <h3 id="property-location-heading" className="font-semibold">
              Location
            </h3>
            <p className="text-sm text-muted-foreground">
              Use the mailing address for this property.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="property-address">Address line 1</Label>
              <Input
                id="property-address"
                required
                maxLength={255}
                placeholder="Street address"
                value={value.addressLine1}
                onChange={(event) => setValue({ ...value, addressLine1: event.target.value })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="property-address2">Address line 2 (optional)</Label>
              <Input
                id="property-address2"
                maxLength={255}
                placeholder="Apartment, suite, etc."
                value={value.addressLine2 ?? ''}
                onChange={(event) => setValue({ ...value, addressLine2: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="property-city">City</Label>
              <Input
                id="property-city"
                required
                maxLength={100}
                placeholder="City"
                value={value.city}
                onChange={(event) => setValue({ ...value, city: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="property-country">Country code</Label>
              <Input
                id="property-country"
                required
                maxLength={2}
                placeholder="US"
                value={value.countryCode}
                onChange={(event) =>
                  setValue({ ...value, countryCode: event.target.value.toUpperCase() })
                }
                aria-describedby="country-help"
              />
              <p id="country-help" className="text-xs text-muted-foreground">
                Two-letter country code.
              </p>
            </div>
          </div>
        </section>
        {(validation || error) && (
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {validation || error}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
          <p className="text-xs text-muted-foreground">Fields marked required must be completed.</p>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save property'}
          </Button>
        </div>
      </fieldset>
    </form>
  )
}
