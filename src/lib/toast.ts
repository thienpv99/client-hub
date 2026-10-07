// Toast helpers on top of sonner (owner G1). The <Toaster /> is mounted once in App.
import { toast } from 'sonner';
import { t } from '@/i18n';

export type ToastId = string | number;

/** Success toast. With `onUndo`, shows a "Hoàn tác" action for 5 seconds. */
export function toastSuccess(message: string, opts?: { onUndo?: () => void | Promise<void> }): ToastId {
  const onUndo = opts?.onUndo;
  if (!onUndo) return toast.success(message);
  return toast.success(message, {
    duration: 5000,
    action: {
      label: t('common.undo'),
      onClick: () => {
        Promise.resolve()
          .then(onUndo)
          .catch((err: unknown) => {
            console.error('[toast] undo failed', err);
            toastError(t('common.toast.failed'));
          });
      },
    },
  });
}

export function toastError(message: string): ToastId {
  return toast.error(message);
}

export function toastInfo(message: string): ToastId {
  return toast.info(message);
}
