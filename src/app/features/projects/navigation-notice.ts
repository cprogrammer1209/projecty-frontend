/**
 * A one-time message handed over by the page that just navigated here (e.g. "Project created"), through the
 * router's navigation state. Read once, then cleared, so a reload doesn't show it again.
 */
export function takeNavigationNotice(): string | null {
  const state = history.state as { notice?: string | null } | null;
  const notice = state?.notice ?? null;
  if (notice) {
    history.replaceState({ ...state, notice: null }, '');
  }
  return notice;
}
