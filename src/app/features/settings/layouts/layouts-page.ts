import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, ViewEncapsulation, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';

import { ApiError } from '../../../core/api/api.types';
import { LayoutApi, LayoutSummary } from '../../../core/customfield/layout.api';
import { ActivePortalService } from '../../../core/portal/active-portal.service';
import { ToastService } from '../../../core/ui/toast.service';
import { Dialog } from '../../../shared/ui/dialog/dialog';
import { Icon } from '../../../shared/ui/icon/icon';
import { Popover } from '../../../shared/ui/popover/popover';
import { settingsEntity } from '../settings-entity';
import { plural } from './layout-draft';

const MAX_LAYOUTS = 3;

interface Notice {
  text: string;
  kind: '' | 'err';
}

/**
 * Settings → Projects → Layouts (CUS-US-21): the list of layouts, with new, clone, make default and
 * deactivate. Layouts are never deleted. Managers open the builder from a row; others only read.
 */
@Component({
  selector: 'py-layouts-page',
  imports: [NgTemplateOutlet, ReactiveFormsModule, RouterLink, Dialog, Popover, Icon],
  templateUrl: './layouts-page.html',
  styleUrl: './layouts-page.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LayoutsPage implements OnInit {
  private readonly api = inject(LayoutApi);
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly entity = settingsEntity(this.route);
  private readonly toast = inject(ToastService);
  protected readonly active = inject(ActivePortalService);

  protected readonly canManage = this.active.can('CUSTOM_FIELDS_MANAGE');
  protected readonly max = MAX_LAYOUTS;
  protected readonly plural = plural;
  protected readonly items = signal<LayoutSummary[] | null>(null);
  protected readonly notice = signal<Notice | null>(null);

  protected readonly menu = signal<{ layout: LayoutSummary; anchor: HTMLElement } | null>(null);

  protected readonly dialogOpen = signal(false);
  protected readonly cloning = signal<LayoutSummary | null>(null);
  protected readonly busy = signal(false);
  protected readonly dialogError = signal<string | null>(null);
  protected readonly form = this.fb.group({ name: '', start: 'blank', from: '' });

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.api.list(this.entity.type).subscribe({
      next: (items) => this.items.set(items),
      error: (err: ApiError) => {
        this.items.update((cur) => cur ?? []);
        this.notice.set({ text: err.message, kind: 'err' });
      },
    });
  }

  protected dismiss(): void {
    this.notice.set(null);
  }

  /* ---- row menu ---- */
  protected openMenu(layout: LayoutSummary, event: Event): void {
    this.menu.set({ layout, anchor: event.currentTarget as HTMLElement });
    setTimeout(() => document.querySelector<HTMLElement>('.lay-menu .mi')?.focus());
  }

  protected closeMenu(): void {
    const m = this.menu();
    this.menu.set(null);
    m?.anchor.focus();
  }

  protected menuKeys(event: KeyboardEvent): void {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const items = Array.from((event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('.mi'));
    const i = items.indexOf(document.activeElement as HTMLElement);
    const next = event.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
    items[next]?.focus();
  }

  protected edit(layout: LayoutSummary): void {
    this.menu.set(null);
    void this.router.navigate([layout.id], { relativeTo: this.route });
  }

  protected makeDefault(layout: LayoutSummary): void {
    this.menu.set(null);
    if (layout.defaultLayout) {
      this.notice.set({ text: `${layout.name} is already the default layout.`, kind: '' });
      return;
    }
    this.run(this.api.makeDefault(layout.id), 'Default layout changed');
  }

  protected toggle(layout: LayoutSummary): void {
    this.menu.set(null);
    this.run(
      layout.active ? this.api.deactivate(layout.id) : this.api.activate(layout.id),
      layout.active ? 'Layout deactivated' : 'Layout activated',
    );
  }

  private run(call: Observable<unknown>, ok: string): void {
    this.notice.set(null);
    call.subscribe({
      next: () => {
        this.toast.show(ok);
        this.load();
      },
      error: (err: ApiError) => {
        this.notice.set({ text: err.message, kind: 'err' });
        this.load();
      },
    });
  }

  /* ---- new / clone dialog ---- */
  protected openDialog(source: LayoutSummary | null = null): void {
    this.menu.set(null);
    const list = this.items() ?? [];
    this.cloning.set(source);
    this.dialogError.set(null);
    this.form.reset({
      name: source ? `Copy of ${source.name}` : '',
      start: source ? 'copy' : 'blank',
      from: (source ?? list[0])?.id ?? '',
    });
    this.dialogOpen.set(true);
  }

  protected closeDialog(): void {
    if (!this.busy()) this.dialogOpen.set(false);
  }

  protected submit(): void {
    const { name, start, from } = this.form.getRawValue();
    this.busy.set(true);
    this.dialogError.set(null);
    this.api
      .create({ entityType: this.entity.type, name: name.trim(), cloneFromId: start === 'copy' && from ? from : null })
      .subscribe({
        next: (created) => {
          this.busy.set(false);
          this.dialogOpen.set(false);
          this.toast.show('Layout created');
          void this.router.navigate([created.id], { relativeTo: this.route });
        },
        error: (err: ApiError) => {
          this.busy.set(false);
          if (err.code === 'LAYOUT_LIMIT') {
            this.dialogOpen.set(false);
            this.notice.set({ text: err.message, kind: 'err' });
            return;
          }
          const detail = err.details?.['name'];
          this.dialogError.set(typeof detail === 'string' ? detail : err.message);
        },
      });
  }
}
