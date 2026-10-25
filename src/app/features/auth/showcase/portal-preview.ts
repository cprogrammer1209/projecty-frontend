import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { Icon } from '../../../shared/ui/icon/icon';
import { SignupDraftStore } from '../signup-draft.store';
import { initials } from '../text';

/** Sign-up pane: the user's portal, filling in as they type. */
@Component({
  selector: 'py-portal-preview',
  imports: [Icon],
  templateUrl: './portal-preview.html',
  styleUrl: './portal-preview.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortalPreview {
  private readonly draft = inject(SignupDraftStore);

  protected readonly nav = [
    { icon: 'home', label: 'Home' },
    { icon: 'user', label: 'My work' },
    { icon: 'inbox', label: 'Inbox' },
    { icon: 'folder', label: 'Projects' },
    { icon: 'chart', label: 'Reports' },
    { icon: 'settings', label: 'Settings' },
  ];
  protected readonly skeletonWidths = [62, 48, 70, 40];

  protected readonly portalName = computed(() => this.draft.portalName().trim() || 'Your portal');
  protected readonly tile = computed(() => initials(this.draft.portalName()) || 'P');
  protected readonly avatar = computed(() => initials(this.draft.fullName()) || '?');
  protected readonly greeting = computed(() => {
    const first = this.draft.fullName().trim().split(/\s+/)[0];
    return first ? `Welcome, ${first}` : 'Welcome to ProjectY';
  });
  protected readonly url = computed(() => `${this.draft.slug() || 'your-portal'}.projecty.app`);
}
