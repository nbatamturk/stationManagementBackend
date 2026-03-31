'use client';
import Link from 'next/link';
import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getCoreRowModel, useReactTable, flexRender, createColumnHelper } from '@tanstack/react-table';
import { stationsClient } from '@/lib/api/stations-client';
import { Station } from '@/types/api';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { TableShell } from '@/components/ui/table-shell';

const col = createColumnHelper<Station>();

export function StationsTable({ page, search }: { page: number; search: string }) {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ['stations', page, search], queryFn: () => stationsClient.list({ page, search, limit: 20 }) });
  const archive = useMutation({ mutationFn: (id: string) => stationsClient.archive(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['stations'] }) });
  const remove = useMutation({ mutationFn: (id: string) => stationsClient.remove(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['stations'] }) });
  const columns = useMemo(() => [
    col.accessor('name', { header: 'Name' }),
    col.accessor('status', { header: 'Status' }),
    col.accessor('location', { header: 'Location' }),
    col.display({ id: 'actions', header: 'Actions', cell: ({ row }) => <div style={{display:'flex',gap:8}}><Link href={`/stations/${row.original.id}`}>View</Link><Link href={`/stations/${row.original.id}/edit`}>Edit</Link><ConfirmButton label='Archive' confirmText='Archive this station?' onConfirm={() => archive.mutate(row.original.id)} /><ConfirmButton label='Delete' confirmText='Delete this station?' onConfirm={() => remove.mutate(row.original.id)} /></div> }),
  ], [archive, remove]);
  const table = useReactTable({ data: data?.data ?? [], columns, getCoreRowModel: getCoreRowModel() });
  if (isLoading) return <div>Loading stations...</div>;
  if (error) return <div>Failed to load stations.</div>;
  return <TableShell title='Stations' actions={<Link href='/stations/new'>Create Station</Link>}><table className='table'><thead>{table.getHeaderGroups().map(hg => <tr key={hg.id}>{hg.headers.map(h => <th key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</th>)}</tr>)}</thead><tbody>{table.getRowModel().rows.map(r => <tr key={r.id}>{r.getVisibleCells().map(c => <td key={c.id}>{flexRender(c.column.columnDef.cell, c.getContext())}</td>)}</tr>)}</tbody></table><p>Page {data?.meta.page} / {data?.meta.totalPages} (Total: {data?.meta.total})</p></TableShell>;
}
