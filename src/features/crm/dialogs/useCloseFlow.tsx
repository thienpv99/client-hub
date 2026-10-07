// Win / lose flow shared by the pipeline (drop on Thắng / Thua, card menu) and the opportunity page.
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { OpportunityView } from '@/services/crmContract';
import { api } from '@/services/api';
import { useAction } from '@/hooks/useAction';
import { t } from '@/i18n';
import { ReasonDialog } from '@/components/common/reason-dialog';
import { WinDialog } from './WinDialog';
import type { WinTarget } from './WinDialog';

type LoseTarget = Pick<OpportunityView, 'id' | 'name'>;

export interface CloseFlow {
  askWin(o: WinTarget): void;
  askLose(o: LoseTarget): void;
  dialogs: ReactNode;
}

export function useCloseFlow(): CloseFlow {
  const { run } = useAction();
  const [win, setWin] = useState<WinTarget | null>(null);
  const [winOpen, setWinOpen] = useState(false);
  const [lose, setLose] = useState<LoseTarget | null>(null);
  const [loseOpen, setLoseOpen] = useState(false);

  const dialogs = (
    <>
      <WinDialog opportunity={win} open={winOpen} onOpenChange={setWinOpen} />
      <ReasonDialog
        open={loseOpen}
        onOpenChange={setLoseOpen}
        title={t('crm.lose.title', { name: lose?.name ?? '' })}
        description={t('crm.lose.description')}
        label={t('crm.lose.label')}
        placeholder={t('crm.lose.placeholder')}
        confirmLabel={t('crm.lose.submit')}
        onConfirm={async (reason) => {
          if (!lose) return false;
          const result = await run(() => api.loseOpportunity(lose.id, reason), {
            success: 'crm.lose.toast',
            successParams: { name: lose.name },
          });
          return result !== undefined;
        }}
      />
    </>
  );

  return {
    askWin: (o) => {
      setWin(o);
      setWinOpen(true);
    },
    askLose: (o) => {
      setLose(o);
      setLoseOpen(true);
    },
    dialogs,
  };
}
