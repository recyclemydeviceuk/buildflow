import type { LeadFieldConfig, LeadFieldKey } from '../api/settings'

export const DEFAULT_LEAD_FIELDS: LeadFieldConfig[] = [
  {
    key: 'name',
    label: 'Contact Name',
    placeholder: 'Enter contact name',
    type: 'text',
    section: 'core',
    required: true,
    active: true,
    order: 0,
  },
  {
    key: 'phone',
    label: 'Phone Number',
    placeholder: 'Enter phone number',
    type: 'text',
    section: 'core',
    required: true,
    active: true,
    order: 1,
  },
  {
    key: 'city',
    label: 'Location',
    placeholder: 'Select city',
    type: 'select',
    section: 'qualification',
    required: true,
    active: true,
    order: 2,
  },
  {
    key: 'budget',
    label: 'Budget',
    placeholder: 'e.g. 50L - 1Cr',
    type: 'text',
    section: 'qualification',
    required: false,
    active: true,
    order: 3,
  },
  {
    key: 'buildType',
    label: 'Build Type',
    placeholder: 'Select build type',
    type: 'select',
    section: 'qualification',
    options: ['Residential', 'Commercial', 'Villas', 'Apartment', 'Plot'],
    required: false,
    active: true,
    order: 4,
  },
  {
    key: 'plotOwned',
    label: 'Plot Owned',
    placeholder: 'Select ownership',
    type: 'boolean',
    section: 'qualification',
    required: false,
    active: true,
    order: 5,
  },
  {
    key: 'campaign',
    label: 'Campaign',
    placeholder: 'Campaign',
    type: 'text',
    section: 'qualification',
    required: false,
    active: true,
    order: 6,
  },
  {
    key: 'email',
    label: 'Email',
    placeholder: 'Enter email address',
    type: 'email',
    section: 'qualification',
    required: false,
    active: true,
    order: 7,
  },
  {
    key: 'plotSize',
    label: 'Plot Size',
    placeholder: 'Size...',
    type: 'number',
    section: 'qualification',
    required: false,
    active: true,
    order: 8,
  },
  {
    key: 'plotSizeUnit',
    label: 'Plot Size Unit',
    placeholder: 'Select unit',
    type: 'select',
    section: 'qualification',
    options: ['sq ft', 'sq yards', 'acres', 'guntha'],
    required: false,
    active: true,
    order: 9,
  },
]

const FIELD_MAP = new Map(DEFAULT_LEAD_FIELDS.map((field) => [field.key, field]))
export const LEAD_FIELDS_STORAGE_KEY = 'buildflow:lead-fields-updated-at'
export const LEAD_FIELDS_UPDATED_EVENT = 'buildflow:lead-fields-updated'

export const sortLeadFields = (fields: LeadFieldConfig[]) =>
  [...fields].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

export const normalizeLeadFieldConfigs = (fields?: LeadFieldConfig[]) =>
  sortLeadFields(
    DEFAULT_LEAD_FIELDS.map((defaultField) => {
      const configuredField = fields?.find((field) => field.key === defaultField.key)
      const required = ['name', 'phone', 'city'].includes(defaultField.key)

      return {
        ...defaultField,
        ...configuredField,
        order:
          typeof configuredField?.order === 'number' ? configuredField.order : defaultField.order,
        required: required ? true : configuredField?.required ?? defaultField.required,
        active: required ? true : configuredField?.active ?? defaultField.active,
      }
    })
  )
    .map((field, index) => ({ ...field, order: index }))

export const getLeadFieldTemplate = (key: LeadFieldKey) => FIELD_MAP.get(key)

export const broadcastLeadFieldsUpdated = () => {
  if (typeof window === 'undefined') return
  const timestamp = String(Date.now())
  localStorage.setItem(LEAD_FIELDS_STORAGE_KEY, timestamp)
  window.dispatchEvent(new CustomEvent(LEAD_FIELDS_UPDATED_EVENT, { detail: timestamp }))
}
