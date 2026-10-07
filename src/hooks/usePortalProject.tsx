// Portal project selection (owner G1). PortalProjectProvider is mounted by the portal route (around ClientLayout).
// The selected project lives in the URL search param `project` (null = all projects).
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { AccountRef } from '@/services/contract';
import { api } from '@/services/api';
import { useQuery } from './useQuery';
import { useViewer } from './useViewer';

export const PROJECT_PARAM = 'project';

export interface PortalProjectState {
  projectId: string | null;
  setProjectId(id: string | null): void;
  projects: { id: string; name: string }[];
}

/** Extra data the client shell needs (company logo, task badge). */
export interface PortalShellInfo {
  account: (AccountRef & { exec_summary: string; email_domain: string }) | null;
  /** tasks waiting on the viewer (all projects) */
  myTaskCount: number;
  loading: boolean;
}

interface PortalShellData {
  account: PortalShellInfo['account'];
  projects: { id: string; name: string }[];
  myTaskCount: number;
}

const ProjectContext = createContext<PortalProjectState | null>(null);
const ShellContext = createContext<PortalShellInfo>({ account: null, myTaskCount: 0, loading: false });

function useProjectParam(): [string | null, (id: string | null) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get(PROJECT_PARAM);
  const setRaw = useCallback(
    (id: string | null) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (id) next.set(PROJECT_PARAM, id);
          else next.delete(PROJECT_PARAM);
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );
  return [raw, setRaw];
}

export function PortalProjectProvider({ children }: { children: ReactNode }) {
  const viewer = useViewer();
  const enabled = !!viewer && viewer.org_type === 'client';
  const query = useQuery<PortalShellData>(
    async () => {
      const home = await api.getPortalHome();
      return {
        account: home.account,
        projects: home.projects.map((p) => ({ id: p.id, name: p.name })),
        myTaskCount: home.my_tasks.length,
      };
    },
    [viewer?.user.id, viewer?.account_id],
    { enabled },
  );

  const [raw, setRaw] = useProjectParam();
  const projects = useMemo(() => query.data?.projects ?? [], [query.data]);
  // keep the URL value while the list loads; drop it once we know it is not one of the account's projects
  const projectId = raw && (query.data === undefined || projects.some((p) => p.id === raw)) ? raw : null;

  const projectState = useMemo<PortalProjectState>(
    () => ({ projectId, setProjectId: setRaw, projects }),
    [projectId, setRaw, projects],
  );
  const shell = useMemo<PortalShellInfo>(
    () => ({ account: query.data?.account ?? null, myTaskCount: query.data?.myTaskCount ?? 0, loading: query.loading }),
    [query.data, query.loading],
  );

  return (
    <ProjectContext.Provider value={projectState}>
      <ShellContext.Provider value={shell}>{children}</ShellContext.Provider>
    </ProjectContext.Provider>
  );
}

export function usePortalProject(): PortalProjectState {
  const ctx = useContext(ProjectContext);
  // Outside the provider (should not happen in the portal): fall back to the bare URL param.
  const [raw, setRaw] = useProjectParam();
  const fallback = useMemo<PortalProjectState>(() => ({ projectId: raw, setProjectId: setRaw, projects: [] }), [raw, setRaw]);
  return ctx ?? fallback;
}

export function usePortalShell(): PortalShellInfo {
  return useContext(ShellContext);
}
