'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { useDocumentTitle } from '@/lib/use-document-title';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function LoginPage() {
  useDocumentTitle('Sign In');
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  return <div className='login-shell'>
    <div className='card login-card'>
      <div>
        <p className='eyebrow'>Station Operations</p>
        <h2>Admin login</h2>
        <p className='muted'>Sign in to manage stations, issues, tests, and audit activity.</p>
      </div>
      <form onSubmit={async (e) => { e.preventDefault(); try { await login(email, password); router.push('/dashboard'); } catch (err) { setError((err as Error).message); } }} className='page-stack'>
        <Input placeholder='Email' value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input placeholder='Password' type='password' value={password} onChange={(e) => setPassword(e.target.value)} />
        {error ? <p className='form-error'>{error}</p> : null}
        <Button type='submit'>Sign in</Button>
      </form>
    </div>
  </div>;
}
