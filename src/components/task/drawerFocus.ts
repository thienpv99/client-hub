// One-shot hint for the task drawer: "Xem & duyệt" opens the drawer scrolled to the file to approve (SPEC §1.6 —
// approving takes two clicks). Set right before useTaskDrawer().open(id); the drawer consumes it once loaded.
export type DrawerFocusTarget = 'preview';

let pending: { taskId: string; target: DrawerFocusTarget } | null = null;

export function requestDrawerFocus(taskId: string, target: DrawerFocusTarget): void {
  pending = { taskId, target };
}

export function takeDrawerFocus(taskId: string): DrawerFocusTarget | null {
  if (!pending || pending.taskId !== taskId) return null;
  const target = pending.target;
  pending = null;
  return target;
}
