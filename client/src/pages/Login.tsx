import { FormEvent, useState, ChangeEvent, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiRequestError } from '../api/auth.js';
import { useAuth } from '../auth/AuthContext.js';

/** Groups the 6 digits as the user types so separators are never mistyped. */
const formatDdmmyy = (raw: string) => {
  const digits = raw.replace(/\D/g, '').slice(0, 6);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 6)].filter(Boolean).join(' ');
};

export const Login = () => {
  const { signIn, session } = useAuth();
  const navigate = useNavigate();
  const [nip, setNip] = useState('');
  const [credential, setCredential] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const birthDateRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (session) navigate('/dashboard', { replace: true });
  }, [session, navigate]);

  useEffect(() => {
    birthDateRef.current?.focus();
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    if (!nip.trim() || !credential) {
      setError('Nomor Induk Karyawan dan tanggal lahir wajib diisi');
      return;
    }

    setLoading(true);
    try {
      await signIn(nip.trim(), credential);
      setCredential('');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(
        err instanceof ApiRequestError
          ? err.message
          : 'Tidak dapat memproses login. Coba lagi atau hubungi admin.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid h-dvh w-full grid-cols-1 overflow-hidden bg-[#0A2942] lg:grid-cols-[58fr_42fr]">
      {/* Kiri: brand, tanpa logo dan tanpa foto. Gelap dipakai sebagai pembatas huny, bukan gaya "tech". */}
      <section className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-center lg:px-14 lg:py-12">
        <div className="max-w-[30rem]">
          <p className="rise text-[13px] text-white/55" style={{ animationDelay: '160ms' }}>
            Portal Internal · Sistem Training
          </p>
          <div className="rise mt-5 h-px w-16 bg-white/35" style={{ animationDelay: '200ms' }} />
          <h1
            className="rise mt-7 text-[2.6rem] leading-[1.08] font-semibold text-white"
            style={{ animationDelay: '240ms' }}
          >
            Portal Training
            <br />
            Karyawan
          </h1>
          <p
            className="rise mt-5 text-[15px] leading-relaxed text-white/70"
            style={{ animationDelay: '300ms' }}
          >
            Satu tempat untuk sesi, absensi foto, dan sertifikat kompetensi.
          </p>
        </div>

        <p className="rise mt-16 text-[12px] text-white/45" style={{ animationDelay: '360ms' }}>
          © 2026 PT Braja Mukti Cakra
        </p>
      </section>

      {/* Kanan: kertas form. Foto di bleed ke tepi kanan viewport, jadi panel tidak terbaca sebagai kartu. */}
      <main
        className="paper relative min-h-0 overflow-hidden"
        style={{ borderLeft: '1px solid rgba(10,41,66,0.18)' }}
      >
        <div className="flex h-full flex-col px-8 pt-8 pb-8 sm:px-12 sm:pb-10 xl:px-20">
          <header
            className="rise flex shrink-0 items-center justify-between gap-4"
            style={{ animationDelay: '80ms' }}
          >
            <span className="text-[11.5px] font-semibold tracking-[0.14em] uppercase text-[#8A5A17]">
              01 / Masuk
            </span>
            <img src="/logo.png" alt="PT Braja Mukti Cakra" className="h-10 w-auto" />
          </header>

          <div className="flex min-h-0 flex-1 flex-col justify-center overflow-y-auto">
            <div className="mx-auto w-full max-w-[25rem]">
              <h2
                className="rise text-[1.9rem] leading-tight font-semibold text-[#0A2942]"
                style={{ animationDelay: '200ms' }}
              >
                Masuk dengan NIP
              </h2>
              <p
                className="rise mt-2.5 text-[14.5px] leading-relaxed text-[#55697C]"
                style={{ animationDelay: '240ms' }}
              >
                Password awal berupa tanggal lahir dari data HR, 6 digit DDMMYY.
              </p>

              {error && (
                <div
                  role="alert"
                  className="rise mt-6 border-l-2 border-[#B42318] bg-[#B42318]/8 py-2.5 pl-3.5 pr-3 text-[13.5px] leading-relaxed text-[#8A1C14]"
                >
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-8" noValidate>
                <div className="grid gap-5">
                  <div>
                    <label
                      htmlFor="nip"
                      className="block text-[11.5px] font-semibold tracking-[0.14em] uppercase text-[#55697C]"
                    >
                      Nomor Induk Karyawan
                    </label>
                    <input
                      id="nip"
                      type="text"
                      value={nip}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setNip(e.target.value)}
                      placeholder="4 digit Nomor Induk Terakhir"
                      autoComplete="username"
                      className="mt-2 block w-full border-0 border-b border-[#0A2942]/30 bg-transparent px-0 pb-2.5 text-[17px] text-[#0A2942] placeholder:text-[#55697C]/55 focus:border-[#8A5A17] focus:ring-0 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="birthDate"
                      className="block text-[11.5px] font-semibold tracking-[0.14em] uppercase text-[#55697C]"
                    >
                      Tanggal Lahir
                    </label>
                    <div className="mt-2 flex items-end gap-3 border-b border-[#0A2942]/30 focus-within:border-[#8A5A17]">
                      <input
                        id="birthDate"
                        ref={birthDateRef}
                        type={revealed ? 'text' : 'password'}
                        inputMode="numeric"
                        maxLength={8}
                        value={credential}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          setCredential(formatDdmmyy(e.target.value))
                        }
                        placeholder="DD MM YY"
                        className="block w-full border-0 bg-transparent px-0 pb-2.5 text-[17px] tracking-[0.1em] text-[#0A2942] placeholder:tracking-normal placeholder:text-[#55697C]/55 focus:ring-0 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setRevealed((v) => !v)}
                        className="shrink-0 pb-2.5 text-[12px] text-[#55697C] underline decoration-dotted underline-offset-4 transition-colors hover:text-[#0A2942] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8A5A17]"
                      >
                        {revealed ? 'Sembunyikan' : 'Lihat'}
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="group relative mt-9 flex w-full items-center justify-between bg-[#0A2942] px-5 py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-[#16405F] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8A5A17] active:translate-y-px disabled:translate-y-0 disabled:cursor-wait"
                >
                  <span>{loading ? 'Memeriksa' : 'Masuk'}</span>
                  {loading ? (
                    <span className="fill absolute inset-x-0 bottom-0 h-0.5 bg-[#D9A441]" />
                  ) : (
                    <span className="text-[18px] leading-none text-white/55 transition-colors group-hover:text-[#D9A441]">
                      &#8594;
                    </span>
                  )}
                </button>

                <p className="mt-6 text-[13px] text-[#55697C]">
                  <a
                    href="mailto:hc@ptbmc.co.id"
                    className="underline decoration-dotted underline-offset-4 transition-colors hover:text-[#0A2942]"
                  >
                    Hubungi Human Capital
                  </a>
                </p>
              </form>
            </div>
          </div>
        </div>

        {/* Foto bleeds ke tepi kanan, keluar dari flow, jadi tidak membentuk kartu. */}
        <img
          src="/login-bg.jpeg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-0 hidden h-[calc(100%+5rem)] w-[34%] max-w-[23rem] -translate-y-1/2 translate-x-2 object-cover opacity-25 mix-blend-luminosity xl:block"
        />
      </main>
    </div>
  );
};
