import { FieldType } from '../../../core/customfield/custom-field.api';

export const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'TEXT', label: 'Text' },
  { value: 'LONG_TEXT', label: 'Long text' },
  { value: 'NUMBER', label: 'Whole number' },
  { value: 'DECIMAL', label: 'Decimal' },
  { value: 'DATE', label: 'Date' },
  { value: 'CHECKBOX', label: 'Checkbox' },
  { value: 'PICKLIST', label: 'Pick one' },
  { value: 'MULTI_PICKLIST', label: 'Pick several' },
  { value: 'USER', label: 'Person' },
];

export const typeLabel = (type: FieldType): string => FIELD_TYPES.find((t) => t.value === type)?.label ?? type;

/** A module can have at most this many fields (active and inactive). */
export const MAX_FIELDS = 25;
export const UNIQUE_TYPES: FieldType[] = ['TEXT', 'NUMBER', 'DECIMAL', 'DATE'];
export const PICK_TYPES: FieldType[] = ['PICKLIST', 'MULTI_PICKLIST'];
export const NUMERIC_TYPES: FieldType[] = ['NUMBER', 'DECIMAL'];
