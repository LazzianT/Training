import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiRequestError } from '../api/auth.js';
import { useAuth } from '../auth/AuthContext.js';
import { LoginForm } from '../components/LoginForm.js';

export const Login = () => {
  const { signIn, session } = useAuth();
  const navigate = useNavigate();
  const nipRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (session) navigate('/dashboard', { replace: true });
  }, [session, navigate]);

  useEffect(() => {
    nipRef.current?.focus();
  }, []);

  const handleSubmit = async (nip: string, credential: string) => {
    try {
      await signIn(nip.trim(), credential);
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      throw reason instanceof ApiRequestError
        ? reason
        : new Error('Tidak dapat memproses login. Coba lagi atau hubungi admin.');
    }
  };

  return (
    <main data-surface="saas" className="min-h-dvh bg-slate-50 px-4 py-4 text-slate-900 sm:px-8 sm:py-8">
      <div className="mx-auto flex min-h-[calc(100dvh-2rem)] max-w-6xl flex-col border border-slate-200 bg-white sm:min-h-[calc(100dvh-4rem)]">
        <header className="flex min-h-16 items-center justify-between border-b border-slate-200 px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="h-2.5 w-2.5 bg-slate-900" aria-hidden="true" />
            <p className="text-sm font-semibold tracking-tight">BMC Training</p>
          </div>
          <p className="hidden text-[10px] font-semibold tracking-[0.16em] text-slate-500 uppercase sm:block">
            PT BRAJA MUKTI CAKRA
          </p>
        </header>

        <div className="grid flex-1 lg:grid-cols-[1fr_28rem]">
          <figure className="relative hidden min-h-[34rem] overflow-hidden border-r border-slate-200 bg-slate-100 lg:block">
            <img
              src="/login-bg.jpeg"
              alt="Karyawan PT Braja Mukti Cakra bersama di depan gedung perusahaan"
              width={1600}
              height={1200}
              className="login-photo-settle absolute inset-0 h-full w-full object-cover object-[center_38%] brightness-[0.92] contrast-[1.06] grayscale-[16%] saturate-[0.82]"
            />
            <figcaption className="login-caption-settle absolute inset-x-0 bottom-0 border-t border-slate-200 bg-white px-8 py-5 xl:px-12">
              <h1 className="max-w-[16ch] text-3xl font-semibold leading-[1.05] tracking-[-0.05em] text-slate-900 xl:text-4xl">
                Kelola dari satu tempat.
              </h1>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                Event, assessment, dan insight karyawan dalam satu ruang kerja internal.
              </p>
            </figcaption>
          </figure>

          <section className="flex items-center px-5 py-10 sm:px-10 lg:px-12">
            <LoginForm onSubmit={handleSubmit} nipRef={nipRef} />
          </section>
        </div>

        <footer className="flex flex-col gap-1 border-t border-slate-200 px-5 py-4 text-[10px] tracking-[0.08em] text-slate-500 uppercase sm:flex-row sm:justify-between sm:px-8">
          <span>Secure internal access</span>
          <span>© 2026 PT Braja Mukti Cakra</span>
        </footer>
      </div>
    </main>
  );
};
