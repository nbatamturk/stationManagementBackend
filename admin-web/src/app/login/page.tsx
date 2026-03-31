'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  return <div style={{maxWidth:380,margin:'80px auto'}} className='card'>
    <h2>Admin Login</h2>
    <form onSubmit={async (e) => { e.preventDefault(); try { await login(email, password); router.push('/dashboard'); } catch (err) { setError((err as Error).message); } }} style={{display:'grid',gap:12}}>
      <Input placeholder='Email' value={email} onChange={(e) => setEmail(e.target.value)} />
      <Input placeholder='Password' type='password' value={password} onChange={(e) => setPassword(e.target.value)} />
      {error ? <p style={{color:'red'}}>{error}</p> : null}
      <Button type='submit'>Sign in</Button>
    </form>
  </div>;
}
