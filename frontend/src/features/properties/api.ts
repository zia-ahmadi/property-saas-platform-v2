export type PropertyType = 'APARTMENT' | 'HOUSE' | 'COMMERCIAL' | 'MIXED_USE' | 'LAND' | 'OTHER'
export interface PropertyInput { name: string; propertyType: PropertyType; addressLine1: string; addressLine2: string | null; city: string; countryCode: string }
export interface Property extends PropertyInput { id: string; organizationId: string; status: 'ACTIVE' | 'ARCHIVED'; createdAt: string; updatedAt: string }
export interface PropertyPage { content: Property[]; page: number; size: number; totalElements: number; totalPages: number; first: boolean; last: boolean }
export const propertyTypes: PropertyType[] = ['APARTMENT', 'HOUSE', 'COMMERCIAL', 'MIXED_USE', 'LAND', 'OTHER']

export const emptyProperty: PropertyInput = { name: '', propertyType: 'APARTMENT', addressLine1: '', addressLine2: '', city: '', countryCode: '' }
