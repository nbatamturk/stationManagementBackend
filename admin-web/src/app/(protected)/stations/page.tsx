'use client';
import { useState } from 'react';
import { StationsTable } from '@/features/stations/stations-table';
import { Input } from '@/components/ui/input';

export default function StationsPage() {
  const [search, setSearch] = useState('');
  return <div style={{display:'grid',gap:12}}><Input placeholder='Search stations...' value={search} onChange={(e) => setSearch(e.target.value)} /><StationsTable page={1} search={search} /></div>;
}
