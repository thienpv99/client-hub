// /app/digest: preview of the Monday bulletin (SPEC §6). Default recipient = the viewer; the director may pick any
// C-level recipient (directors, AMs, client decision makers), an AM their own accounts' decision makers (the api
// decides what each viewer may open). The recipient lives in the URL (`?user=`). Reading width (DESIGN §2).
import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { UserRef, Viewer } from '@/services/contract';
import { api } from '@/services/api';
import { ErrorState } from '@/components/common/error-state';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/native-select';
import { useQuery } from '@/hooks/useQuery';
import { useViewer } from '@/hooks/useViewer';
import { t } from '@/i18n';
import { DigestSkeleton, DigestView } from './DigestView';
import { digestTime, weekdayName } from './schedule';
import { useDirectory } from './useDirectory';
import type { Directory } from './useDirectory';

const USER_PARAM = 'user';

interface Option {
  id: string;
  label: string;
}

function recipientGroups(viewer: Viewer, directory: Directory | undefined): { internal: Option[]; clients: Option[] } {
  const self = viewer.user.id;
  const internalPeople: UserRef[] = directory
    ? directory.internal.filter((u) => u.role === 'director' || u.role === 'am')
    : [];
  // an AM previews only themselves among New Era staff (the api refuses other staff)
  const allowedInternal = viewer.role === 'director' ? internalPeople : internalPeople.filter((u) => u.id === self);
  if (!allowedInternal.some((u) => u.id === self)) allowedInternal.unshift(viewer.user);

  const internal = allowedInternal.map((u) => ({
    id: u.id,
    label:
      u.id === self
        ? t('notify.preview.me', { name: u.full_name })
        : t('notify.preview.optionInternal', { name: u.full_name, role: t(`enums.role.${u.role}`) }),
  }));
  const clients: Option[] = [];
  for (const group of directory?.clients ?? []) {
    for (const u of group.users) {
      if (u.role !== 'client_owner') continue;
      clients.push({ id: u.id, label: t('notify.preview.optionClient', { name: u.full_name, account: group.account.name }) });
    }
  }
  return { internal, clients };
}

export function DigestPreviewPage() {
  const viewer = useViewer();
  const [params, setParams] = useSearchParams();
  const canPick = !!viewer && viewer.org_type === 'internal' && !viewer.read_only && (viewer.role === 'director' || viewer.role === 'am');
  const directory = useDirectory(canPick);
  const settings = useQuery(() => api.getSettings(), [viewer?.user.id], { enabled: !!viewer });

  const selfId = viewer?.user.id ?? '';
  const groups = viewer && canPick ? recipientGroups(viewer, directory.data) : null;
  const requested = groups ? params.get(USER_PARAM) : null;
  // the director may open anyone the api allows (deep link); an AM only the people listed, so an AM's `?user=`
  // waits for the list instead of flashing a "no access" error
  const isDirector = viewer?.role === 'director';
  const listed = !!requested && !!groups && [...groups.internal, ...groups.clients].some((o) => o.id === requested);
  const waitForList = !!requested && !isDirector && !directory.data;
  const userId = requested && (isDirector || listed) ? requested : selfId;
  const digest = useQuery(() => api.getWeeklyDigest(userId === selfId ? undefined : userId), [userId, selfId], {
    enabled: !!viewer && !waitForList,
  });

  const setUser = useCallback(
    (id: string) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (!id || id === selfId) next.delete(USER_PARAM);
          else next.set(USER_PARAM, id);
          return next;
        },
        { replace: true },
      );
    },
    [setParams, selfId],
  );

  if (!viewer) return null;

  const known = !groups || [...groups.internal, ...groups.clients].some((o) => o.id === userId);
  const description = t('notify.preview.description', {
    time: digestTime(settings.data ? settings.data.weekly_digest_hour : 8),
    weekday: weekdayName(settings.data ? settings.data.weekly_digest_weekday : 1),
  });

  return (
    <div className="mx-auto w-full max-w-reading space-y-6 md:space-y-8">
      <PageHeader
        title={t('notify.preview.title')}
        description={description}
        actions={
          groups ? (
            <NativeSelect
              aria-label={t('notify.preview.recipient')}
              value={userId}
              onChange={(e) => setUser(e.target.value)}
              disabled={directory.loading}
              wrapperClassName="w-full sm:w-72"
            >
              {!known ? (
                <option value={userId}>{digest.data ? digest.data.recipient.full_name : t('notify.preview.otherRecipient')}</option>
              ) : null}
              <optgroup label={t('notify.preview.groups.internal')}>
                {groups.internal.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
              {groups.clients.length > 0 ? (
                <optgroup label={t('notify.preview.groups.clients')}>
                  {groups.clients.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </NativeSelect>
          ) : null
        }
      />

      {digest.data ? (
        <DigestView digest={digest.data} />
      ) : digest.error && !digest.loading ? (
        <Card>
          <ErrorState error={digest.error} onRetry={digest.refetch} />
          {userId !== selfId ? (
            <div className="flex justify-center px-6 pb-8">
              <Button type="button" variant="secondary" onClick={() => setUser(selfId)}>
                {t('notify.preview.backToMine')}
              </Button>
            </div>
          ) : null}
        </Card>
      ) : (
        <DigestSkeleton />
      )}
    </div>
  );
}
