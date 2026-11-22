import { CustomFieldOption, FieldType } from '../../../core/customfield/custom-field.api';

/** What a value control needs to know about a field. Both a field definition and a layout field fit. */
export interface ValueField {
  apiName: string;
  label: string;
  description: string | null;
  fieldType: FieldType;
  mandatory: boolean;
  readOnly?: boolean;
  wide?: boolean | null;
  config: Record<string, unknown>;
  options: CustomFieldOption[];
}

export interface PersonOption {
  userId: string;
  fullName: string;
}

/** Types that take the whole row of a section's grid unless a layout says otherwise. */
const WIDE_TYPES: FieldType[] = ['LONG_TEXT', 'MULTI_PICKLIST'];

export const isEmptyValue = (value: unknown): boolean =>
  value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);

/** The layout's width choice wins; otherwise long text and pick several are wide. */
export const isWideField = (field: Pick<ValueField, 'fieldType' | 'wide'>): boolean =>
  field.wide ?? WIDE_TYPES.includes(field.fieldType);

/** Numbers go to the server as numbers when they parse, and as typed text otherwise (so its message shows). */
export function parseNumber(raw: string): number | string | null {
  if (raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : raw;
}

/** The text shown for a stored value (a choice shows its label, a person their name). */
export function displayValue(
  field: ValueField,
  value: unknown,
  people: PersonOption[] = [],
  formatDate: (iso: string) => string = (iso) => iso,
): string {
  if (isEmptyValue(value)) return '';
  switch (field.fieldType) {
    case 'CHECKBOX':
      return value ? 'Yes' : 'No';
    case 'DATE':
      return formatDate(String(value));
    case 'PICKLIST':
      return field.options.find((o) => o.id === value)?.label ?? 'Unknown choice';
    case 'MULTI_PICKLIST':
      return (value as string[]).map((id) => field.options.find((o) => o.id === id)?.label ?? 'Unknown choice').join(', ');
    case 'USER':
      return people.find((p) => p.userId === value)?.fullName ?? 'Unknown person';
    case 'DECIMAL': {
      const decimals = typeof field.config['decimals'] === 'number' ? (field.config['decimals'] as number) : 2;
      return Number(value).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    }
    case 'NUMBER':
      return Number(value).toLocaleString('en-US');
    default:
      return String(value);
  }
}
