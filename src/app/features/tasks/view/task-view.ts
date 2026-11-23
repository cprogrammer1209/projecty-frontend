import { ChangeDetectionStrategy, Component, ElementRef, OnInit, computed, effect, inject, input } from '@angular/core';

import { Dialog } from '../../../shared/ui/dialog/dialog';
import { Icon } from '../../../shared/ui/icon/icon';
import { TvBoard } from './tv-board';
import { TvBulkBar } from './tv-bulk-bar';
import { TvDisplayMenu } from './tv-display-menu';
import { TvList } from './tv-list';
import { TvNewTask } from './tv-new-task';
import { TvCommand, TvPalette } from './tv-palette';
import { TvPeek } from './tv-peek';
import { TvPicker } from './tv-picker';
import { TvSource } from './tv-model';
import { TvState } from './tv-state';
import { TvStatuses } from './tv-statuses';
import { TvStore } from './tv-store';
import { TvToolbar } from './tv-toolbar';

/**
 * The Linear-style task view, one component for the project Tasks tab and the portal My Tasks / All Tasks: toolbar with
 * Filter, search and Display, filter chips, a grouped list or a board, a bulk bar, peek panel, New task modal, Ctrl+K
 * palette and the keyboard shortcuts. A screen supplies the data (`source.load`) and the buttons of its own (`tvExtra`).
 */
@Component({
  selector: 'py-task-view',
  imports: [TvToolbar, TvList, TvBoard, TvBulkBar, TvDisplayMenu, TvPicker, TvNewTask, TvPalette, TvPeek, Dialog, Icon],
  providers: [TvStore],
  templateUrl: './task-view.html',
  host: {
    '(document:keydown)': 'onKey($event)',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskView implements OnInit {
  readonly source = input.required<TvSource>();
  readonly state = input.required<TvState>();
  /** A message to show on arrival (e.g. "WEB-T4 moved to the trash."). */
  readonly notice = input<string | null>(null);

  protected readonly store = inject(TvStore);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly statuses = inject(TvStatuses);

  protected readonly commands = computed<TvCommand[]>(() => {
    const st = this.state();
    const save = (): void => st.save();
    return [
      ...(this.store.canCreateAny() ? [{ label: 'Create new task', run: () => this.store.openNew() }] : []),
      { label: 'Switch to list view', run: () => { st.view.set('list'); save(); } },
      { label: 'Switch to board view', run: () => { st.view.set('board'); save(); } },
      ...this.store.groupChoices().map((g) => ({ label: `Group by ${g.label.toLowerCase()}`, run: () => { st.group.set(g.id); save(); } })),
    ];
  });

  constructor() {
    // keep the focused row in sight when J/K moves it
    effect(() => {
      const id = this.store.focus();
      if (!id) return;
      queueMicrotask(() => this.host.nativeElement.querySelector(`[data-open="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'nearest' }));
    });
  }

  ngOnInit(): void {
    this.statuses.clear();
    this.store.people.load();
    this.store.notice.set(this.notice());
    this.store.init(this.source(), this.state());
  }

  /** Reload (a screen calls this after it changed something, e.g. a task list). */
  refresh(): Promise<void> {
    return this.store.refresh();
  }

  setNotice(message: string | null): void {
    this.store.setNotice(message);
  }

  protected resolve(ok: boolean): void {
    const c = this.store.confirm();
    this.store.confirm.set(null);
    c?.done(ok);
  }

  private anchorFor(kind: string, id: string): HTMLElement {
    const root = this.host.nativeElement;
    return root.querySelector<HTMLElement>(`[data-open="${CSS.escape(id)}"] [data-pick="${kind}"]`) ?? root.querySelector<HTMLElement>('#display-btn') ?? root;
  }

  protected onKey(e: KeyboardEvent): void {
    const s = this.store;
    const el = e.target as HTMLElement;
    if (!this.host.nativeElement.isConnected) return;
    const typing = /INPUT|TEXTAREA|SELECT/.test(el.tagName) || el.isContentEditable;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      s.palette.set(true);
      return;
    }
    if (s.menu() || s.toolbarMenu() || s.newTask() || s.palette() || s.confirm() || document.querySelector('py-dialog .overlay')) return;
    if (e.key === 'Escape') {
      if (typing) {
        if (!el.closest('#tv-peek')) el.blur();
        return;
      }
      if (s.peek()) return s.closePeek();
      if (s.checked().size) s.clearChecked();
      return;
    }
    if (typing || e.ctrlKey || e.metaKey || e.altKey || !s.data()) return;
    const k = e.key.toLowerCase();
    if (k === 'c') {
      e.preventDefault();
      return s.openNew();
    }
    if (s.peek()) {
      if (k === 'j' || k === 'arrowdown') { e.preventDefault(); return s.stepPeek(1); }
      if (k === 'k' || k === 'arrowup') { e.preventDefault(); return s.stepPeek(-1); }
      if (k === ' ') { e.preventDefault(); return s.closePeek(); }
      if (k === 'enter') {
        const t = s.byId(s.peek() as string);
        s.closePeek(false);
        if (t) s.openPage(t);
      }
      return;
    }
    const order = s.order();
    if (k === 'j' || k === 'arrowdown' || k === 'k' || k === 'arrowup') {
      e.preventDefault();
      if (!order.length) return;
      const d = k === 'j' || k === 'arrowdown' ? 1 : -1;
      let i = order.indexOf(s.focus() ?? '');
      i = i < 0 ? (d > 0 ? 0 : order.length - 1) : Math.max(0, Math.min(order.length - 1, i + d));
      s.focus.set(order[i]);
      return;
    }
    const focus = s.focus();
    if (k === 'x' && focus) { e.preventDefault(); return s.toggleCheck(focus); }
    if (k === ' ' && focus) { e.preventDefault(); return s.openPeek(focus); }
    if (k === 'enter' && focus) {
      e.preventDefault();
      const t = s.byId(focus);
      if (t) s.openPage(t);
      return;
    }
    const kind = ({ s: 'status', p: 'priority', a: 'owner', d: 'due' } as Record<string, 'status' | 'priority' | 'owner' | 'due'>)[k];
    if (kind) {
      const ids = s.checked().size ? [...s.checked()] : focus ? [focus] : [];
      if (!ids.length) return;
      e.preventDefault();
      s.pick(kind, ids, this.anchorFor(kind, ids[0]));
    }
  }
}
