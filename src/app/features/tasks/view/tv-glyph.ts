import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

import { initials } from '../../auth/text';
import { TvIcon } from './tv-model';

const AVATAR_COLORS = ['#5e6ad2', '#2f9e6f', '#d6457a', '#c2651b', '#1f8d7c', '#7c5cd6', '#3b82d9', '#a44a06'];
const DEFAULT_COLOR = '#6b7280';

/** Line glyphs of the task view (16px grid), by name. */
export const UI_ICONS: Record<string, string> = {
  plus: '<path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  filter: '<path d="M2.5 4h11M4.5 8h7M6.5 12h3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
  disp: '<path d="M2.5 5h6M11.5 5h2M2.5 11h2M7.5 11h6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="10" cy="5" r="1.5" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="6" cy="11" r="1.5" fill="none" stroke="currentColor" stroke-width="1.3"/>',
  list: '<path d="M2.5 4h11M2.5 8h11M2.5 12h11" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
  board: '<rect x="2.5" y="2.5" width="3.2" height="11" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="6.4" y="2.5" width="3.2" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="10.3" y="2.5" width="3.2" height="9" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/>',
  car: '<path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  x: '<path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  expand: '<path d="M9.5 2.5h4v4M6.5 13.5h-4v-4M13.5 2.5L9 7M2.5 13.5L7 9" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
  up: '<path d="M4 10l4-4 4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  down: '<path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  cal: '<rect x="2.5" y="3.5" width="11" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M2.5 7h11M5.5 2v3M10.5 2v3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
  sub: '<path d="M4 2.5v6a2 2 0 0 0 2 2h6M9.5 8l2.5 2.5L9.5 13" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>',
  search: '<circle cx="7" cy="7" r="4.2" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M10.2 10.2L13.5 13.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
  stack: '<path d="M8 2l6 3-6 3-6-3zM2 8l6 3 6-3M2 11l6 3 6-3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>',
  trash: '<path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>',
};

/** A line glyph by name (inherits the text colour). */
@Component({
  selector: 'py-tv-icon',
  template: `<svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 16 16" aria-hidden="true" [innerHTML]="path()"></svg>`,
  styles: `:host { display: inline-flex; flex: none; }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TvUiIcon {
  readonly n = input.required<string>();
  readonly size = input(14);
  private readonly sanitizer = inject(DomSanitizer);
  /** The paths are constants of this file, so they are trusted. */
  protected readonly path = computed(() => this.sanitizer.bypassSecurityTrustHtml(UI_ICONS[this.n()] ?? ''));
}

/** A person's avatar (initials on a colour from the name), or a dashed ring when nobody. */
@Component({
  selector: 'py-tv-avatar',
  template: `
    @if (name(); as n) {
      <span class="tv-av" [style.width.px]="size()" [style.height.px]="size()" [style.font-size.px]="fontSize()" [style.background]="color()" [title]="n">{{ initial() }}</span>
    } @else {
      <span class="tv-av none" [style.width.px]="size()" [style.height.px]="size()" title="Unassigned"></span>
    }
  `,
  styles: `:host { display: inline-flex; flex: none; }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TvAvatar {
  readonly name = input<string | null>(null);
  readonly size = input(20);
  protected readonly initial = computed(() => initials(this.name() ?? ''));
  protected readonly fontSize = computed(() => Math.round(this.size() * 0.42));
  protected readonly color = computed(() => AVATAR_COLORS[[...(this.name() ?? '')].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length]);
}

/** Up to two overlapping avatars and a "+n". */
@Component({
  selector: 'py-tv-owners',
  imports: [TvAvatar],
  template: `
    @if (names().length) {
      <span class="avs">
        @for (n of names().slice(0, 2); track $index) { <py-tv-avatar [name]="n" [size]="size()" /> }
        @if (names().length > 2) { <span class="tv-av more" [style.width.px]="size()" [style.height.px]="size()" [style.font-size.px]="size() * 0.42">+{{ names().length - 2 }}</span> }
      </span>
    } @else { <py-tv-avatar [name]="null" [size]="size()" /> }
  `,
  styles: `:host { display: inline-flex; }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TvOwners {
  readonly names = input.required<string[]>();
  readonly size = input(20);
}

/**
 * The small picture of the task view. Status: closed = filled tick, the default open status = dashed ring, other open
 * statuses = ring with a half pie (in the status colour). Priority: bars (critical = a warning square). Person: initials.
 */
@Component({
  selector: 'py-tv-glyph',
  imports: [TvUiIcon, TvAvatar],
  templateUrl: './tv-glyph.html',
  styles: `:host { display: inline-flex; flex: none; align-items: center; }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TvGlyph {
  readonly icon = input.required<TvIcon>();
  readonly size = input(14);

  protected readonly color = computed(() => {
    const i = this.icon();
    return i.k === 'status' ? i.s.color || DEFAULT_COLOR : DEFAULT_COLOR;
  });
  protected readonly closed = computed(() => {
    const i = this.icon();
    return i.k === 'status' && i.s.statusType === 'CLOSED';
  });
  protected readonly dashed = computed(() => {
    const i = this.icon();
    return i.k === 'status' && i.s.statusType !== 'CLOSED' && i.s.defaultStatus;
  });
  protected readonly half = computed(() => {
    const i = this.icon();
    return i.k === 'status' && i.s.statusType !== 'CLOSED' && !i.s.defaultStatus;
  });
  protected readonly bars = computed(() => {
    const i = this.icon();
    const n = i.k === 'prio' ? ({ LOW: 1, MEDIUM: 2, HIGH: 3 } as Record<string, number>)[i.p] ?? 0 : 0;
    return [0, 1, 2].map((k) => ({ x: [3, 6.6, 10.2][k], y: [8, 5, 2][k], h: [4, 7, 10][k], on: k < n }));
  });
  protected readonly prio = computed(() => {
    const i = this.icon();
    return i.k === 'prio' ? i.p : 'NONE';
  });
  protected readonly ui = computed(() => {
    const i = this.icon();
    return i.k === 'ui' ? i.n : '';
  });
  protected readonly person = computed(() => {
    const i = this.icon();
    return i.k === 'person' ? i.name : null;
  });
}
