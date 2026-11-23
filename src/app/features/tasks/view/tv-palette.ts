import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ActivePortalService } from '../../../core/portal/active-portal.service';
import { ProjectApi } from '../../../core/project/project.api';
import { TvGlyph } from './tv-glyph';
import { TvIcon, TvTask } from './tv-model';

export interface TvCommand {
  label: string;
  run: () => void;
}

interface Row {
  label: string;
  task?: TvTask;
  run: () => void;
}

const MAX_TASK_RESULTS = 6;

/** The Ctrl+K command menu: the screen's own commands, go-to links (My tasks, All tasks, Projects, each project) and a task search. */
@Component({
  selector: 'py-tv-palette',
  imports: [TvGlyph],
  template: `
    <div class="tv-scrim" id="tv-pal" (mousedown)="$event.target === $event.currentTarget && closed.emit()">
      <div class="tv-pal" role="dialog" aria-label="Command menu">
        <input #q id="tv-palq" placeholder="Type a command or search tasks…" aria-label="Command" autocomplete="off" [value]="query()" (input)="onInput($any($event.target).value)" />
        <div class="res">
          @for (r of rows(); track $index; let i = $index) {
            @if (i === 0) { <div class="gl">Commands</div> }
            @if (i === commandCount() && r.task) { <div class="gl">Tasks</div> }
            <button type="button" [class.hi]="i === hi()" [attr.data-i]="i" (click)="run(r)">
              @if (r.task; as t) { <py-tv-glyph [icon]="icon(t)" /> }{{ r.label }}
            </button>
          } @empty {
            <div class="pop-e">No results</div>
          }
        </div>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TvPalette {
  readonly commands = input<TvCommand[]>([]);
  readonly tasks = input<TvTask[]>([]);
  readonly openTask = output<TvTask>();
  readonly closed = output<void>();

  private readonly router = inject(Router);
  private readonly active = inject(ActivePortalService);
  private readonly projectApi = inject(ProjectApi);
  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('q');
  protected readonly query = signal('');
  protected readonly hi = signal(0);
  private readonly projects = signal<{ id: string; name: string }[]>([]);

  private readonly base = computed<Row[]>(() => {
    const slug = this.active.portal()?.slug ?? '';
    const go = (link: unknown[], query: Record<string, string> = {}) => () => void this.router.navigate(link, { queryParams: query });
    return [
      ...this.commands(),
      { label: 'Go to My tasks', run: go(['/p', slug, 'tasks']) },
      { label: 'Go to All tasks', run: go(['/p', slug, 'tasks'], { tab: 'all' }) },
      { label: 'Go to Projects', run: go(['/p', slug, 'projects']) },
      ...this.projects().map((p) => ({ label: `Go to ${p.name}`, run: go(['/p', slug, 'projects', p.id, 'tasks']) })),
    ];
  });
  private readonly cmds = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.base().filter((c) => !q || c.label.toLowerCase().includes(q));
  });
  protected readonly rows = computed<Row[]>(() => {
    const q = this.query().trim().toLowerCase();
    const found = q
      ? this.tasks().filter((t) => `${t.key} ${t.title}`.toLowerCase().includes(q)).slice(0, MAX_TASK_RESULTS).map((t) => ({ label: `${t.key}  ${t.title}`, task: t, run: () => this.openTask.emit(t) }))
      : [];
    return [...this.cmds(), ...found];
  });
  protected readonly commandCount = computed(() => this.cmds().length);

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => this.field().nativeElement.focus());
    firstValueFrom(this.projectApi.list()).then((l) => this.projects.set(l.map((p) => ({ id: p.id, name: p.name })))).catch(() => undefined);
    const key = (e: KeyboardEvent): void => {
      const swallow = (): void => {
        e.preventDefault();
        e.stopPropagation();
      };
      if (e.key === 'Escape') { swallow(); this.closed.emit(); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { swallow(); this.hi.set(Math.max(0, Math.min(this.rows().length - 1, this.hi() + (e.key === 'ArrowDown' ? 1 : -1)))); }
      else if (e.key === 'Enter') { swallow(); const r = this.rows()[this.hi()]; if (r) this.run(r); }
    };
    document.addEventListener('keydown', key, true);
    destroyRef.onDestroy(() => document.removeEventListener('keydown', key, true));
  }

  protected icon(t: TvTask): TvIcon {
    return { k: 'status', s: { color: t.statusColor, statusType: t.statusType, defaultStatus: false } };
  }

  protected onInput(value: string): void {
    this.query.set(value);
    this.hi.set(0);
  }

  protected run(r: Row): void {
    this.closed.emit();
    r.run();
  }
}
