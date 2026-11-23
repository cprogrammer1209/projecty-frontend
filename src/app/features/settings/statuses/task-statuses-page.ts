import { ChangeDetectionStrategy, Component, OnInit, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Observable } from 'rxjs';

import { ApiError } from '../../../core/api/api.types';
import { LayoutApi, LayoutStatus, LayoutSummary } from '../../../core/customfield/layout.api';
import { ActivePortalService } from '../../../core/portal/active-portal.service';
import { ToastService } from '../../../core/ui/toast.service';
import { Icon } from '../../../shared/ui/icon/icon';
import { Popover } from '../../../shared/ui/popover/popover';

const MAX_STATUSES = 20;
const MAX_NAME = 30;
const FALLBACK = '#8e9199';
const COLORS: [string, string][] = [
  ['Gray', '#8e9199'],
  ['Blue', '#4d7cf0'],
  ['Green', '#2f9e6f'],
  ['Amber', '#d9962b'],
  ['Red', '#cf4238'],
  ['Purple', '#8b5cf6'],
  ['Teal', '#14a3b8'],
  ['Pink', '#d9488b'],
];

interface Notice {
  text: string;
  kind: '' | 'err';
}

/**
 * Settings → Tasks → Statuses: every task layout owns its statuses (Open or Closed, one Open default). Pick a layout,
 * then add, rename, colour, retype, make default, reorder (drag or the arrows) and delete. The server's rules
 * (a status tasks use cannot be deleted, at least one Open and one Closed) arrive as the notice at the top.
 */
@Component({
  selector: 'py-task-statuses-page',
  imports: [Icon, Popover],
  templateUrl: './task-statuses-page.html',
  styleUrl: './task-statuses-page.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskStatusesPage implements OnInit {
  private readonly api = inject(LayoutApi);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  protected readonly portal = inject(ActivePortalService);

  protected readonly canManage = this.portal.can('CUSTOM_FIELDS_MANAGE');
  protected readonly max = MAX_STATUSES;
  protected readonly maxName = MAX_NAME;
  protected readonly colors = COLORS;
  protected readonly layouts = signal<LayoutSummary[] | null>(null);
  protected readonly layoutId = signal<string | null>(null);
  protected readonly items = signal<LayoutStatus[] | null>(null);
  protected readonly notice = signal<Notice | null>(null);
  protected readonly editing = signal<string | null>(null);
  protected readonly newName = signal('');
  protected readonly newType = signal<'OPEN' | 'CLOSED'>('OPEN');
  protected readonly colorMenu = signal<{ status: LayoutStatus; anchor: HTMLElement } | null>(null);
  protected readonly dragId = signal<string | null>(null);
  protected readonly overId = signal<string | null>(null);

  protected readonly layout = computed(() => this.layouts()?.find((l) => l.id === this.layoutId()) ?? null);

  ngOnInit(): void {
    this.api.list('TASK').subscribe({
      next: (list) => {
        this.layouts.set(list);
        const wanted = this.route.snapshot.queryParamMap.get('layout');
        const pick = list.find((l) => l.id === wanted) ?? list.find((l) => l.defaultLayout) ?? list[0];
        this.layoutId.set(pick?.id ?? null);
        if (pick) this.load();
        else this.items.set([]);
      },
      error: (err: ApiError) => {
        this.layouts.set([]);
        this.items.set([]);
        this.notice.set({ text: err.message, kind: 'err' });
      },
    });
  }

  protected hex(s: LayoutStatus): string {
    return s.color || FALLBACK;
  }

  protected pickLayout(id: string): void {
    this.layoutId.set(id);
    this.items.set(null);
    this.notice.set(null);
    this.editing.set(null);
    this.load();
  }

  private load(): void {
    const id = this.layoutId();
    if (!id) return;
    this.api.statuses(id).subscribe({
      next: (list) => this.items.set(list),
      error: (err: ApiError) => {
        this.items.update((x) => x ?? []);
        this.notice.set({ text: err.message, kind: 'err' });
      },
    });
  }

  /** Runs a change; the server answers with the full ordered list. On an error the list is reloaded. */
  private run(call: Observable<LayoutStatus[]>, ok?: string, onDone?: () => void): void {
    this.notice.set(null);
    call.subscribe({
      next: (list) => {
        this.items.set(list);
        if (ok) this.toast.show(ok);
        onDone?.();
      },
      error: (err: ApiError) => {
        const d = err.details && Object.values(err.details)[0];
        this.notice.set({ text: typeof d === 'string' && err.code === 'VALIDATION_FAILED' ? d : err.message, kind: 'err' });
        this.load();
      },
    });
  }

  protected dismiss(): void {
    this.notice.set(null);
  }

  /* ---- add ---- */
  protected add(event: Event): void {
    event.preventDefault();
    const id = this.layoutId();
    const name = this.newName().trim();
    if (!id) return;
    if (!name) {
      this.notice.set({ text: 'Give the new status a name.', kind: 'err' });
      return;
    }
    this.run(this.api.addStatus(id, { name, statusType: this.newType() }), 'Status added', () => {
      this.newName.set('');
      this.newType.set('OPEN');
    });
  }

  /* ---- rename ---- */
  protected startRename(s: LayoutStatus): void {
    this.editing.set(s.id);
    setTimeout(() => {
      const i = document.querySelector<HTMLInputElement>('[data-rename-input]');
      i?.focus();
      i?.select();
    });
  }

  protected finishRename(s: LayoutStatus, input: HTMLInputElement, save: boolean): void {
    if (this.editing() !== s.id) return;
    this.editing.set(null);
    const name = input.value.trim();
    const id = this.layoutId();
    if (save && id && name !== s.name) this.run(this.api.updateStatus(id, s.id, { name }), 'Status renamed');
  }

  /* ---- type, default, colour, delete ---- */
  protected setType(s: LayoutStatus, value: string): void {
    const id = this.layoutId();
    if (id) this.run(this.api.updateStatus(id, s.id, { statusType: value as 'OPEN' | 'CLOSED' }), 'Status type changed');
  }

  protected makeDefault(s: LayoutStatus): void {
    const id = this.layoutId();
    if (id) this.run(this.api.updateStatus(id, s.id, { defaultStatus: true }), 'Default status changed');
  }

  protected remove(s: LayoutStatus): void {
    const id = this.layoutId();
    if (id) this.run(this.api.deleteStatus(id, s.id), 'Status deleted');
  }

  protected openColors(s: LayoutStatus, event: Event): void {
    this.colorMenu.set({ status: s, anchor: event.currentTarget as HTMLElement });
  }

  protected pickColor(hex: string): void {
    const m = this.colorMenu();
    const id = this.layoutId();
    this.colorMenu.set(null);
    if (m && id) this.run(this.api.updateStatus(id, m.status.id, { color: hex }), 'Colour changed');
  }

  /* ---- order ---- */
  protected move(s: LayoutStatus, delta: number): void {
    const ids = (this.items() ?? []).map((x) => x.id);
    const i = ids.indexOf(s.id);
    const j = i + delta;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    this.order(ids);
  }

  protected dragStart(s: LayoutStatus, event: DragEvent): void {
    this.dragId.set(s.id);
    event.dataTransfer?.setData('text/plain', s.id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  protected dragOver(s: LayoutStatus, event: DragEvent): void {
    if (!this.dragId()) return;
    event.preventDefault();
    this.overId.set(s.id);
  }

  protected dragEnd(): void {
    this.dragId.set(null);
    this.overId.set(null);
  }

  protected drop(target: LayoutStatus, event: DragEvent): void {
    event.preventDefault();
    const from = this.dragId();
    this.dragEnd();
    if (!from || from === target.id) return;
    const ids = (this.items() ?? []).map((x) => x.id);
    ids.splice(ids.indexOf(from), 1);
    ids.splice(ids.indexOf(target.id), 0, from);
    this.order(ids);
  }

  private order(ids: string[]): void {
    const id = this.layoutId();
    if (!id) return;
    const byId = new Map((this.items() ?? []).map((x) => [x.id, x]));
    this.items.set(ids.map((x) => byId.get(x)!)); // optimistic; the answer or a reload corrects it
    this.run(this.api.orderStatuses(id, ids));
  }
}
