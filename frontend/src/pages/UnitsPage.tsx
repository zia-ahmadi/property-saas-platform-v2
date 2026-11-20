import { Link, useParams } from 'react-router'
import { buttonVariants } from '@/components/ui/button'

export function UnitsPage() {
  const { propertyId } = useParams()
  return <div className="space-y-5"><Link className={buttonVariants({ variant: 'outline' })} to={`/properties/${propertyId}`}>Back to Property Details</Link><h2 className="text-2xl font-bold">Units Management</h2><p>Unit management is not available yet.</p></div>
}
