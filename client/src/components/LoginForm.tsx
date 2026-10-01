import { useState, type ChangeEvent, type FormEvent, type RefObject } from 'react';

type LoginFormProps = {
  onSubmit: (nip: string, credential: string) => Promise<void>;
  nipRef: RefObject<HTMLInputElement | null>;
};

const formatDdmmyy = (raw: string) => {
  const digits = raw.replace(/\D/g, '').slice(0, 6);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 6)].filter(Boolean).join(' ');
};

export const LoginForm = ({ onSubmit, nipRef }: LoginFormProps) => {
  const [nip, setNip] = useState('');
  const [credential, setCredential] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (!nip.trim() || !credential) {
      setError('Nomor Induk Karyawan dan tanggal lahir wajib diisi');
      return;
    }

    setLoading(true);
    try {
      await onSubmit(nip, credential);
      setCredential('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Tidak dapat memproses login. Coba lagi atau hubungi admin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      {/* The company logo already sits in the page header, so repeating it here
          would print the same identity twice within one viewport. */}
      <p className="border-b border-slate-200 pb-5 text-[10px] font-semibold tracking-[0.18em] text-slate-500 uppercase">
        Secure access
      </p>

      <h2 className="mt-9 text-4xl font-semibold tracking-[-0.06em] text-slate-900">Selamat datang.</h2>
      <p className="mt-3 text-sm leading-6 text-slate-500">Masuk dengan data karyawan Anda untuk melanjutkan.</p>

      {error && (
        <div role="alert" className="mt-6 border border-red-500 bg-red-50 px-3 py-2.5 text-xs leading-5 text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-8 grid gap-5" noValidate>
        <label htmlFor="nip" className="grid gap-2 text-xs font-semibold text-slate-700">
          Nomor Induk Karyawan
          <input
            id="nip"
            ref={nipRef}
            type="text"
            value={nip}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setNip(event.target.value)}
            placeholder="Masukkan NIP"
            autoComplete="username"
            className="h-12 border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900 outline-none transition duration-150 placeholder:text-slate-500 hover:border-slate-400 focus-visible:border-slate-900 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
          />
        </label>

        <label htmlFor="birthDate" className="grid gap-2 text-xs font-semibold text-slate-700">
          Tanggal lahir
          <span className="flex h-12 border border-slate-300 transition duration-150 focus-within:border-slate-900 focus-within:ring-2 focus-within:ring-black focus-within:ring-offset-2">
            <input
              id="birthDate"
              type={revealed ? 'text' : 'password'}
              inputMode="numeric"
              maxLength={8}
              value={credential}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setCredential(formatDdmmyy(event.target.value))}
              placeholder="Contoh: 17 08 90"
              autoComplete="current-password"
              className="min-w-0 flex-1 border-0 bg-white px-3 text-sm font-normal text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-500"
            />
            <button
              type="button"
              onClick={() => setRevealed((value) => !value)}
              className="px-3 text-xs font-semibold text-slate-500 outline-none transition duration-150 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-inset"
              aria-label={revealed ? 'Sembunyikan tanggal lahir' : 'Lihat tanggal lahir'}
            >
              {revealed ? 'Sembunyikan' : 'Lihat'}
            </button>
          </span>
          <small className="font-normal text-slate-500">Format 6 digit: DD MM YY</small>
        </label>

        <button
          type="submit"
          disabled={loading}
          className="mt-1 h-12 bg-slate-900 text-sm font-semibold text-white outline-none transition duration-150 hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:cursor-wait disabled:bg-slate-400 disabled:animate-pulse"
        >
          {loading ? 'Memeriksa...' : 'Masuk ke workspace'}
        </button>
      </form>

      <p className="mt-8 border-t border-slate-200 pt-4 text-xs text-slate-500">
        Butuh bantuan?{' '}
        <a href="mailto:hc@ptbmc.co.id" className="font-semibold text-slate-900 underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2">
          Hubungi Human Capital
        </a>
      </p>
    </div>
  );
};
