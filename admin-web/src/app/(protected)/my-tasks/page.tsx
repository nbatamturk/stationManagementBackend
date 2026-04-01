'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authClient } from '@/lib/api/auth-client';
import { issuesClient } from '@/lib/api/issues-client';
import { stationsClient } from '@/lib/api/stations-client';
import { testHistoryClient } from '@/lib/api/test-history-client';
import type { Issue, Station, TestHistory } from '@/types/api';

type TaskStatus = 'ASSIGNED' | 'IN_PROGRESS' | 'PASSED' | 'FAILED' | 'BLOCKED' | 'SKIPPED';
type TaskRow = {
  issue: Issue;
  station: Station;
  history: TestHistory[];
  status: TaskStatus;
};

const badgeStyle: Record<TaskStatus, { bg: string; color: string }> = {
  ASSIGNED: { bg: '#f3f4f6', color: '#374151' },
  IN_PROGRESS: { bg: '#dbeafe', color: '#1e40af' },
  PASSED: { bg: '#dcfce7', color: '#166534' },
  FAILED: { bg: '#fee2e2', color: '#991b1b' },
  BLOCKED: { bg: '#ffedd5', color: '#9a3412' },
  SKIPPED: { bg: '#f5f5f4', color: '#44403c' },
};

const asDate = (value: string) => new Date(value);
const isToday = (value: string) => {
  const d = asDate(value);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
};

function deriveTaskStatus(issue: Issue, latest?: TestHistory): TaskStatus {
  if (issue.status === 'in_progress') return 'IN_PROGRESS';
  if (issue.status === 'open') return 'ASSIGNED';
  if (!latest) return 'SKIPPED';
  if (latest.result === 'pass') return 'PASSED';
  if (latest.result === 'fail') return 'FAILED';
  return 'BLOCKED';
}

export default function MyTasksPage() {
  const queryClient = useQueryClient();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [quickNote, setQuickNote] = useState('');
  const [defectSearch, setDefectSearch] = useState('');

  const me = useQuery({ queryKey: ['me'], queryFn: () => authClient.me() });
  const stations = useQuery({ queryKey: ['stations', 'all-for-tasks'], queryFn: () => stationsClient.list({ page: 1, limit: 200 }) });

  const issueQueries = useQueries({
    queries: (stations.data?.data ?? []).map((station) => ({
      queryKey: ['issues', station.id],
      queryFn: () => issuesClient.listByStation(station.id),
      enabled: !!stations.data,
    })),
  });

  const historyQueries = useQueries({
    queries: (stations.data?.data ?? []).map((station) => ({
      queryKey: ['test-history', station.id],
      queryFn: () => testHistoryClient.listByStation(station.id),
      enabled: !!stations.data,
    })),
  });

  const isLoading = me.isLoading || stations.isLoading || issueQueries.some((q) => q.isLoading) || historyQueries.some((q) => q.isLoading);
  const isError = me.isError || stations.isError || issueQueries.some((q) => q.isError) || historyQueries.some((q) => q.isError);

  const tasks = useMemo<TaskRow[]>(() => {
    const userId = me.data?.user.id;
    if (!userId || !stations.data) return [];

    return (stations.data.data ?? []).flatMap((station, index) => {
      const issues = issueQueries[index]?.data?.data ?? [];
      const history = historyQueries[index]?.data?.data ?? [];
      const byStation = history.slice(0, 5);

      return issues
        .filter((issue) => issue.assignedTo === userId)
        .map((issue) => ({
          issue,
          station,
          history: byStation,
          status: deriveTaskStatus(issue, byStation[0]),
        }));
    });
  }, [historyQueries, issueQueries, me.data, stations.data]);

  const selectedTask = tasks.find((task) => task.issue.id === selectedTaskId) ?? tasks[0] ?? null;

  const summary = useMemo(() => {
    const now = new Date();
    const overdueCount = tasks.filter((task) => asDate(task.issue.createdAt).getTime() < now.getTime() - 2 * 24 * 60 * 60 * 1000 && task.status !== 'PASSED' && task.status !== 'FAILED').length;
    return {
      todayAssigned: tasks.filter((task) => isToday(task.issue.createdAt)).length,
      overdue: overdueCount,
      inProgress: tasks.filter((task) => task.status === 'IN_PROGRESS').length,
      completedToday: tasks.filter((task) => (task.status === 'PASSED' || task.status === 'FAILED') && task.history[0] && isToday(task.history[0].createdAt)).length,
    };
  }, [tasks]);

  const refreshTasks = async () => {
    await queryClient.invalidateQueries({ queryKey: ['issues'] });
    await queryClient.invalidateQueries({ queryKey: ['test-history'] });
  };

  const startMutation = useMutation({
    mutationFn: (issueId: string) => issuesClient.updateStatus(issueId, 'in_progress'),
    onSuccess: refreshTasks,
  });

  const resultMutation = useMutation({
    mutationFn: async ({ task, result }: { task: TaskRow; result: 'pass' | 'fail' }) => {
      if (task.issue.status !== 'in_progress') {
        await issuesClient.updateStatus(task.issue.id, 'in_progress');
      }
      await testHistoryClient.create(task.station.id, { result, notes: quickNote || undefined });
      return issuesClient.updateStatus(task.issue.id, 'resolved');
    },
    onSuccess: async () => {
      setQuickNote('');
      await refreshTasks();
    },
  });

  if (isLoading) return <div className='card'>Loading My Tasks...</div>;
  if (isError) return <div className='card'>My Tasks yüklenemedi. Lütfen sayfayı yenileyin.</div>;
  if (tasks.length === 0) return <div className='card'>No tasks assigned.</div>;

  const recentDefects = selectedTask ? tasks.filter((task) => task.station.id === selectedTask.station.id).slice(0, 5) : [];
  const defectMatches = selectedTask
    ? tasks.filter((task) => task.station.id === selectedTask.station.id && `${task.issue.id} ${task.issue.title}`.toLowerCase().includes(defectSearch.toLowerCase())).slice(0, 5)
    : [];

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <h2>My Tasks</h2>

      <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
        <div className='card'><strong>{summary.todayAssigned}</strong><div>Today assigned</div></div>
        <div className='card'><strong>{summary.overdue}</strong><div>Overdue</div></div>
        <div className='card'><strong>{summary.inProgress}</strong><div>In progress</div></div>
        <div className='card'><strong>{summary.completedToday}</strong><div>Completed today</div></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 12 }}>
        <div className='card' style={{ padding: 0 }}>
          <table className='table'>
            <thead>
              <tr>
                <th>Task</th><th>Station</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.issue.id} onClick={() => setSelectedTaskId(task.issue.id)} style={{ background: task.issue.id === selectedTask?.issue.id ? '#eef2ff' : undefined, cursor: 'pointer' }}>
                  <td>{task.issue.title}</td>
                  <td>{task.station.code}</td>
                  <td><span style={{ background: badgeStyle[task.status].bg, color: badgeStyle[task.status].color, padding: '4px 8px', borderRadius: 999 }}>{task.status}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Button onClick={(e) => { e.stopPropagation(); startMutation.mutate(task.issue.id); }} disabled={task.issue.status === 'in_progress' || startMutation.isPending}>▶ Start</Button>
                      <Button onClick={(e) => { e.stopPropagation(); resultMutation.mutate({ task, result: 'pass' }); }} disabled={resultMutation.isPending}>✔ Pass</Button>
                      <Button onClick={(e) => { e.stopPropagation(); resultMutation.mutate({ task, result: 'fail' }); }} disabled={resultMutation.isPending}>❌ Fail</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selectedTask && (
          <div className='card' style={{ display: 'grid', gap: 12 }}>
            <h3 style={{ margin: 0 }}>{selectedTask.issue.title}</h3>
            <div><strong>Station:</strong> {selectedTask.station.name}</div>
            <div>
              <strong>Quick note</strong>
              <Input value={quickNote} onChange={(e) => setQuickNote(e.target.value)} placeholder='Optional note for Pass/Fail' />
            </div>

            <div>
              <strong>Execution history</strong>
              <div style={{ display: 'grid', gap: 8, marginTop: 6 }}>
                {selectedTask.history.slice(0, 5).map((item) => (
                  <div key={item.id} style={{ borderLeft: '2px solid #e5e7eb', paddingLeft: 8 }}>
                    <div>{item.result.toUpperCase()} · {new Date(item.createdAt).toLocaleString()}</div>
                    <small>{item.notes || 'No note'}</small>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <strong>Defect search</strong>
              <Input value={defectSearch} onChange={(e) => setDefectSearch(e.target.value)} placeholder='Search by defect ID or title' />
              <div style={{ marginTop: 6, display: 'grid', gap: 6 }}>
                {(defectSearch ? defectMatches : recentDefects).map((task) => (
                  <button key={task.issue.id} style={{ textAlign: 'left', border: '1px solid #e5e7eb', background: '#fff', borderRadius: 6, padding: 8 }}>
                    #{task.issue.id.slice(0, 8)} · {task.issue.title}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
