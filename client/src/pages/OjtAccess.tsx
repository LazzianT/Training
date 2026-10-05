import { useEffect, useState, type CSSProperties } from 'react';
import { useParams } from 'react-router-dom';
import { FEEDBACK_ASPECTS, type OjtAccess, type OjtQuestion } from '@training/contracts';
import { ApiRequestError } from '../api/auth.js';
import { openOjtAccess, fetchOjtAccess, submitOjtAnswers, submitOjtFeedback } from '../api/ojt.js';
import { ChoiceGroup } from '../components/ChoiceGroup.js';
import { ProgressBar, RatingScale } from '../components/RatingScale.js';
import { SignaturePad } from '../components/SignaturePad.js';
import { OjtPesertaPicker } from '../components/OjtPesertaPicker.js';
import { useConfirm } from '../components/ConfirmDialog.js';
import { Button, Field, textareaClass } from '../components/ui/index.js';
import { shortDate } from '../lib/date.js';

type OpenResult = {
  nama: string;
  sessionId?: number;
  questions?: OjtQuestion[];
  attendance?: boolean;
};

/**
  The page a participant lands on after scanning an OJT QR. They have no account
  and no NIP, so identity comes from the code HR gave them, and every request is
  scoped to the batch the token belongs to.
*/
export const OjtAccessPage = () => {
  const { token } = useParams();
  const confirm = useConfirm();
  const [access, setAccess] = useState<OjtAccess | null>(null);
  const [opened, setOpened] = useState<OpenResult | null>(null);
  const [kode, setKode] = useState('');
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [feedbackScores, setFeedbackScores] = useState<Record<string, number>>(() =>
    Object.fromEntries(FEEDBACK_ASPECTS.map((item) => [item.code, 5])),
  );
  const [feedbackComment, setFeedbackComment] = useState('');
  const [signature, setSignature] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    document.body.classList.add('assessment-access-page');
    return () => document.body.classList.remove('assessment-access-page');
  }, []);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    fetchOjtAccess(token, controller.signal)
      .then(setAccess)
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        setError(reason instanceof ApiRequestError ? reason.message : 'QR tidak dapat dibuka.');
      });
    return () => controller.abort();
  }, [token]);

  const open = async () => {
    setBusy(true);
    setError('');
    try {
      setOpened(await openOjtAccess(token ?? '', kode));
    } catch (reason) {
      setError(reason instanceof ApiRequestError ? reason.message : 'Form tidak dapat dibuka.');
    } finally {
      setBusy(false);
    }
  };

  const questions = opened?.questions ?? [];
  const answeredCount = questions.filter((question) => answers[question.id]).length;

  const send = async (body: unknown, successTitle: string) => {
    setBusy(true);
    setError('');
    try {
      if (access?.purpose === 'feedback') {
        await submitOjtFeedback(token ?? '', {
          kodePeserta: kode,
          comment: feedbackComment || null,
          entries: FEEDBACK_ASPECTS.map((item) => ({
            aspect: item.code,
            score: feedbackScores[item.code],
            comment: null,
          })),
        });
      } else if (access?.purpose === 'attendance') {
        await openOjtAccess(token ?? '', kode, signature);
      } else {
        await submitOjtAnswers(token ?? '', {
          kodePeserta: kode,
          sessionId: opened?.sessionId,
          answers: Object.entries(answers).map(([questionId, answer]) => ({
            questionId: Number(questionId),
            answer,
          })),
        });
      }
      setDone(true);
      setSuccess(successTitle);
    } catch (reason) {
      setError(reason instanceof ApiRequestError ? reason.message : 'Pengiriman gagal.');
    } finally {
      setBusy(false);
    }
  };

  const [success, setSuccess] = useState('');

  const confirmSend = async () => {
    const ok = await confirm({
      title: 'Kirim jawaban?',
      description:
        access?.purpose === 'attendance'
          ? 'Absensi hari ini akan tercatat dan tidak dapat diubah lagi.'
          : 'Jawaban yang sudah dikirim tidak dapat diubah lagi.',
      confirmLabel: 'Kirim',
    });
    if (!ok) return;
    await send(null, access?.purpose === 'attendance' ? 'Absensi tercatat' : 'Jawaban terkirim');
  };

  if (!access) {
    return (
      <main data-surface="saas" className="grid min-h-dvh place-items-center bg-slate-50 p-6 text-center">
        <p className={`text-sm ${error ? 'font-medium text-red-700' : 'text-slate-500'}`} role={error ? 'alert' : 'status'}>
          {error || 'Memuat...'}
        </p>
      </main>
    );
  }

  const canSend =
    access.purpose === 'attendance'
      ? Boolean(signature)
      : access.purpose === 'feedback'
        ? true
        : questions.length > 0 && answeredCount === questions.length;

  return (
    <main data-surface="saas" className="min-h-dvh bg-slate-50 pb-28 text-slate-900">
      <div className="mx-auto max-w-2xl">
        <header className="enter-section border-b border-slate-200 bg-white px-4 py-6 sm:px-7">
          <p className="text-[10px] font-semibold tracking-[0.18em] text-slate-500 uppercase">
            PT Braja Mukti Cakra · OJT
          </p>
          <h1 className="mt-2.5 text-2xl font-semibold tracking-[-0.04em] text-slate-900 sm:text-3xl">
            {access.title}
          </h1>
          {/*
            The material leads. A participant holding a QR needs to know what they
            are being assessed on before they type their code, otherwise the first
            thing they learn is from the questions.
          */}
          <p className="mt-2 text-sm font-semibold text-slate-900">
            {access.materiNama}
            <span className="ml-2 text-xs font-normal text-slate-500 tabular-nums">
              {access.materiKode}
              {access.materiTanggal ? ` · ${shortDate(access.materiTanggal)}` : ''}
            </span>
          </p>
          <p className="mt-1.5 text-sm text-slate-500">
            {shortDate(access.tanggalMulai)} – {shortDate(access.tanggalSelesai)}
            {access.lokasi ? ` · ${access.lokasi}` : ''}
          </p>
        </header>

        <div className="px-4 py-6 sm:px-7">
          {error && (
            <div role="alert" className="mb-5 border border-red-500 bg-red-50 px-3 py-2.5 text-sm text-red-700">
              {error}
            </div>
          )}

          {done ? (
            <div className="enter-section border border-emerald-200 bg-white p-6 text-center sm:p-8">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="mx-auto h-8 w-8 text-emerald-600"
                aria-hidden="true"
              >
                <path d="M5 12.5l4.5 4.5L19 7" strokeLinecap="square" />
              </svg>
              <p className="mt-3 text-base font-semibold text-slate-900">{success}</p>
              <p className="mt-1.5 text-sm text-slate-500">Terima kasih. Anda dapat menutup halaman ini.</p>
            </div>
          ) : !opened ? (
            <div className="enter-section grid gap-5">
              <Field
                id="ojt-peserta"
                label="Nama Anda"
                hint="Ketik nama Anda lalu pilih dari daftar peserta batch ini."
              >
                {(field) => (
                  <OjtPesertaPicker
                    id="ojt-peserta"
                    peserta={access.peserta}
                    value={kode}
                    onSelect={(kodePeserta) => setKode(kodePeserta)}
                    onClear={() => setKode('')}
                    disabled={busy}
                    className={field.className}
                    aria-describedby={field['aria-describedby']}
                  />
                )}
              </Field>
              {access.peserta.length === 0 && (
                <p className="border-l-2 border-amber-500 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Belum ada peserta terdaftar di batch ini. Hubungi HR.
                </p>
              )}
              <Button type="button" onClick={open} disabled={!kode.trim() || busy}>
                {busy ? 'Memuat...' : 'Lanjutkan'}
              </Button>
            </div>
          ) : (
            <>
              <div className="enter-section surface-card px-4 py-3">
                <p className="text-xs text-slate-500">Mengisi sebagai</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-900">{opened.nama}</p>
              </div>

              {access.purpose === 'attendance' && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold text-slate-700">Tanda tangan</p>
                  <SignaturePad onChange={setSignature} />
                </div>
              )}

              {questions.length > 0 && (
                <>
                  <div
                    className="enter-section mt-6"
                    style={{ '--enter-delay': '40ms' } as CSSProperties}
                  >
                    <ProgressBar answered={answeredCount} total={questions.length} label="Kemajuan pengerjaan" />
                  </div>
                  <div className="mt-6 grid gap-4">
                    {questions.map((question, index) => (
                      <div
                        key={question.id}
                        className="enter-section surface-card p-4 sm:p-5"
                        style={{ '--enter-delay': `${80 + Math.min(index, 6) * 40}ms` } as CSSProperties}
                      >
                        <p className="text-sm font-semibold break-words text-slate-900">
                          <span className="mr-1.5 text-slate-400 tabular-nums">{question.number}.</span>
                          {question.text}
                        </p>
                        {question.image && (
                          <img src={question.image} alt="" className="mt-3 max-h-56 border border-slate-200" />
                        )}
                        <div className="mt-3">
                          <ChoiceGroup
                            name={`ojt-question-${question.id}`}
                            legend={`Soal ${question.number}`}
                            choices={Object.entries(question.options).map(([value, label]) => ({ value, label }))}
                            value={answers[question.id]}
                            onChange={(value) => setAnswers((current) => ({ ...current, [question.id]: value }))}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {access.purpose === 'feedback' && (
                <div className="mt-4 grid gap-6">
                  {FEEDBACK_ASPECTS.map((item, index) => (
                    <div
                      key={item.code}
                      className="enter-section surface-card p-4 sm:p-5"
                      style={{ '--enter-delay': `${80 + index * 30}ms` } as CSSProperties}
                    >
                      <RatingScale
                        legend={item.label}
                        value={feedbackScores[item.code] ?? 5}
                        onChange={(value) => setFeedbackScores((current) => ({ ...current, [item.code]: value }))}
                        lowLabel="Sangat buruk"
                        highLabel="Sangat baik"
                      />
                    </div>
                  ))}
                  <Field id="ojt-comment" label="Komentar" optional>
                    {(field) => (
                      <textarea
                        value={feedbackComment}
                        onChange={(change) => setFeedbackComment(change.target.value)}
                        {...field}
                        className={textareaClass()}
                      />
                    )}
                  </Field>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {!done && opened && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3 sm:px-7">
            {questions.length > 0 ? (
              <p className="text-xs text-slate-500 tabular-nums">
                {answeredCount} dari {questions.length} soal
              </p>
            ) : (
              <span />
            )}
            <Button type="button" onClick={confirmSend} disabled={!canSend || busy} className="ml-auto">
              {busy
                ? 'Mengirim...'
                : access.purpose === 'attendance'
                  ? 'Kirim Absensi'
                  : access.purpose === 'feedback'
                    ? 'Kirim Feedback'
                    : 'Kirim Jawaban'}
            </Button>
          </div>
        </div>
      )}
    </main>
  );
};
