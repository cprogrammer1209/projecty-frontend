import { CustomField, FieldType } from '../../../core/customfield/custom-field.api';
import { LayoutEditor, LayoutPlacement, LayoutUpdate } from '../../../core/customfield/layout.api';

/** The layout as the builder edits it: the stored layout, with sections keyed by a local id. */
export interface Draft {
  id: string;
  name: string;
  description: string | null;
  defaultLayout: boolean;
  active: boolean;
  usage: number;
  sections: DraftSection[];
}

export interface DraftSection {
  id: string;
  name: string;
  collapsible: boolean;
  fields: LayoutPlacement[];
}

export interface Found {
  section: DraftSection;
  index: number;
  placement: LayoutPlacement;
}

export const FIELD_TYPES: { id: FieldType; label: string }[] = [
  { id: 'TEXT', label: 'Text' },
  { id: 'LONG_TEXT', label: 'Long text' },
  { id: 'NUMBER', label: 'Whole number' },
  { id: 'DECIMAL', label: 'Decimal' },
  { id: 'DATE', label: 'Date' },
  { id: 'CHECKBOX', label: 'Checkbox' },
  { id: 'PICKLIST', label: 'Pick one' },
  { id: 'MULTI_PICKLIST', label: 'Pick several', },
  { id: 'USER', label: 'Person' },
];

export const TYPE_LABEL: Record<string, string> = Object.fromEntries(FIELD_TYPES.map((t) => [t.id, t.label]));

export const PICK_TYPES: FieldType[] = ['PICKLIST', 'MULTI_PICKLIST'];

export const UNPLACED = 'unplaced';

export const plural = (n: number, word: string): string => `${n} ${n === 1 ? word : word + 's'}`;

export const newPlacement = (apiName: string): LayoutPlacement => ({
  apiName,
  mandatory: null,
  readOnly: false,
  defaultValue: null,
  wide: null,
});

export function fromEditor(e: LayoutEditor): Draft {
  return {
    id: e.id,
    name: e.name,
    description: e.description,
    defaultLayout: e.defaultLayout,
    active: e.active,
    usage: e.usage,
    sections: e.sections.map((s) => ({
      id: s.id,
      name: s.name,
      collapsible: s.collapsible,
      fields: s.fields.map((p) => ({ ...p })),
    })),
  };
}

/** What Save sends: the section ids are the server's to assign. */
export function toUpdate(d: Draft): LayoutUpdate {
  return {
    name: d.name.trim(),
    description: d.description,
    sections: d.sections.map((s) => ({
      name: s.name.trim(),
      collapsible: s.collapsible,
      fields: s.fields.map((p) => ({
        apiName: p.apiName,
        mandatory: p.mandatory,
        readOnly: p.readOnly,
        defaultValue: p.defaultValue ?? null,
        wide: p.wide,
      })),
    })),
  };
}

export function find(d: Draft, apiName: string): Found | null {
  for (const section of d.sections) {
    const index = section.fields.findIndex((p) => p.apiName === apiName);
    if (index >= 0) return { section, index, placement: section.fields[index] };
  }
  return null;
}

export const unplaced = (d: Draft, fields: CustomField[]): CustomField[] =>
  fields.filter((f) => !find(d, f.apiName));

/** Moves a field (placed or not) to a section, before another field or at the end; `UNPLACED` removes it. Mutates `d`. */
export function move(d: Draft, apiName: string, to: string, before: string | null = null): void {
  const at = find(d, apiName);
  const placement = at ? at.section.fields.splice(at.index, 1)[0] : newPlacement(apiName);
  if (to === UNPLACED) return;
  const section = d.sections.find((s) => s.id === to);
  if (!section) return;
  const i = before ? section.fields.findIndex((p) => p.apiName === before) : -1;
  if (i >= 0) section.fields.splice(i, 0, placement);
  else section.fields.push(placement);
}

/** Swaps a field with its neighbour in the same section. Mutates `d`. */
export function shift(d: Draft, apiName: string, delta: number): void {
  const at = find(d, apiName);
  if (!at) return;
  const j = at.index + delta;
  const list = at.section.fields;
  if (j >= 0 && j < list.length) [list[at.index], list[j]] = [list[j], list[at.index]];
}

const WIDE_TYPES: FieldType[] = ['LONG_TEXT', 'MULTI_PICKLIST'];

export const isWide = (d: Draft, field: CustomField): boolean =>
  find(d, field.apiName)?.placement.wide ?? WIDE_TYPES.includes(field.fieldType);

export interface Effective {
  mandatory: boolean;
  readOnly: boolean;
  defaultValue: unknown;
}

/** The field as this layout shows it: the layout's choices win over the field's own. */
export function effective(d: Draft, field: CustomField): Effective {
  const p = find(d, field.apiName)?.placement;
  return {
    mandatory: p?.mandatory ?? field.mandatory,
    readOnly: !!p?.readOnly,
    defaultValue: p?.defaultValue ?? field.defaultValue,
  };
}

/** Why the draft cannot be saved, or null. */
export function problem(d: Draft): string | null {
  if (!d.name.trim()) return 'Name the layout.';
  const names = new Set<string>();
  for (const s of d.sections) {
    const n = s.name.trim().toLowerCase();
    if (!n) return 'Every section needs a name.';
    if (names.has(n)) return `Two sections are called "${s.name.trim()}".`;
    names.add(n);
  }
  return null;
}

export function defaultLabel(field: CustomField, value: unknown): string {
  if (field.fieldType === 'PICKLIST') return field.options.find((o) => o.id === value)?.label ?? String(value);
  if (field.fieldType === 'CHECKBOX') return 'Checked';
  return String(value);
}

/** Types whose layout default makes no sense. */
export const takesNoDefault = (f: CustomField): boolean =>
  f.unique || f.fieldType === 'USER' || f.fieldType === 'MULTI_PICKLIST';
