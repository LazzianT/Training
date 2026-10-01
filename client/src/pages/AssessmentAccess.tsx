import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useParams } from 'react-router-dom';
import { FEEDBACK_ASPECTS } from '@training/contracts';
import { apiBaseUrl, ApiRequestError } from '../api/auth.js';
import { ChoiceGroup } from '../components/ChoiceGroup.js';
import { ProgressBar, RatingScale } from '../components/RatingScale.js';
import { SignaturePad } from '../components/SignaturePad.js';
import { useConfirm } from '../components/ConfirmDialog.js';
import { Button, Field, inputClass, textareaClass } from '../components/ui/index.js';

type Purpose = 'pre_test' | 'post_test' | 'feedback' | 'attendance';
type Access = {
  eventId: number;
  purpose: Purpose;
  title: string;
  date: string;
  room: string | null;
  expiresAt: string;
};
type Assessment = Access & { questions: { id: number; number: number; text: string; options: Record<string, string> }[] };

const labels: Record<Purpose, string> = {
  pre_test: 'Pre-test',
  post_test: 'Post-test',
  feedback: 'Feedback Training',
  attendance: 'Absensi Training',
};

const isTest = (purpose: Purpose) => purpose === 'pre_test' || purpose === 'post_test';


export const AssessmentAccess = () => {
  const { token } = useParams();
  const confirm = useConfirm();
  const [access, setAccess] = useState<Access | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [nip, setNip] = useState('');
  const [signatureData, setSignatureData] = useState('');
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackScores, setFeedbackScores] = useState<Record<string, number>>(() =>
    Object.fromEntries(FEEDBACK_ASPECTS.map((item) => [item.code, 5])),
  );
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    document.body.classList.add('assessment-access-page');
    return () => document.body.classList.remove('assessment-access-page');
  }, []);

  useEffect(() => {
    if (!token) return;
    fetch(`${apiBaseUrl}/api/assessment/access/${encodeURIComponent(token)}`)
      .then(async (response) => {
        if (!response.ok) throw new ApiRequestError('QR_EXPIRED', 'QR tidak berlaku.', response.status);
        return response.json() as Promise<Access>;
      })
      .then(setAccess)
      .catch((reason: unknown) => setError(reason instanceof ApiRequestError ? reason.message : 'QR tidak dapat dibuka.'));
  }, [token]);

  const questions = assessment?.questions ?? [];
  const answeredCount = questions.filter((question) => answers[question.id]).length;
  const feedbackAnswered = FEEDBACK_ASPECTS.length;

  // The test is locked the moment it is opened: leaving mid-way loses the answers.
  const started = isTest(access?.purpose ?? 'attendance') && assessment !== null && !submitted;
  useEffect(() => {
    if (!started) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [started]);

  const ready = useMemo(() => {
    if (submitted) return false;
    if (!access) return false;
    if (isTest(access.purpose)) return answeredCount === questions.length && questions.length > 0;
    if (access.purpose === 'attendance') return nip.trim().length > 0 && signatureData.length > 0;
    return feedbackAnswered > 0;
  }, [access, answers, answeredCount, feedbackAnswered, questions.length, signatureData, submitted, nip]);

  if (!access) {
    return (
      <main data-surface="saas" className="grid min-h-dvh place-items-center bg-slate-50 p-6 text-center">
        <p className={`text-sm ${error ? 'font-medium text-red-700' : 'text-slate-500'}`} role={error ? 'alert' : 'status'}>
          {error || 'Memuat...'}
        </p>
      </main>
    );
  }

  const open = async () => {
    setError('');
    setSending(true);
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/assessment/access/${encodeURIComponent(token ?? '')}/open`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nip }) },
      );
      const body = await response.json();
      if (!response.ok) return setError(body.error?.message ?? 'Tidak dapat membuka form.');
      setAssessment(body);
    } catch {
      setError('Tidak dapat menghubungi server. Coba lagi.');
    } finally {
      setSending(false);
    }
  };

const submit = async () => {
    if (!access) return;
    const isFeedback = access.purpose === 'feedback';
    const isAttendance = access.purpose === 'attendance';

    const ok = await confirm({
      title: 'Kirim jawaban?',
      description: isAttendance
        ? 'Absensi yang sudah dikirim tidak dapat diubah lagi.'
        : isFeedback
          ? 'Feedback yang sudah dikirim tidak dapat diubah lagi.'
          : `Jawaban yang sudah dikirim tidak dapat diubah lagi. ${answeredCount} dari ${questions.length} soal terisi.`,
      confirmLabel: 'Kirim',
    });
    if (!ok) return;

    setError('');
    setSending(true);
    const path = isFeedback ? 'feedback' : isAttendance ? 'attendance' : 'submit';
    const body = isFeedback
      ? { nip, entries: FEEDBACK_ASPECTS.map((item) => ({ aspect: item.code, score: feedbackScores[item.code], comment: feedbackComment })) }
      : isAttendance
        ? { nip, signatureData }
        : { nip, answers: Object.entries(answers).map(([questionId, answer]) => ({ questionId: Number(questionId), answer })) };

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/assessment/access/${encodeURIComponent(token ?? '')}/${path}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
      );
      if (response.ok) setSubmitted(true);
      else {
        setError(
          ((await response.json().catch(() => null)) as { error?: { message?: string } } | null)?.error?.message ??
            'Pengiriman gagal.',
        );
      }
    } catch {
      setError('Tidak dapat menghubungi server. Coba lagi.');
    } finally {
      setSending(false);
    }
  };

  const isFeedback = access.purpose === 'feedback';

  const isAttendance = access.purpose === 'attendance';
  const showTest = !isAttendance && !isFeedback && assessment !== null;

  return (
    <main data-surface="saas" className="min-h-dvh bg-slate-50 pb-28 text-slate-900">
      <div className="mx-auto max-w-2xl">
        <header className="enter-section border-b border-slate-200 bg-white px-4 py-6 sm:px-7">
          <p className="text-[10px] font-semibold tracking-[0.18em] text-slate-500 uppercase">
            PT Braja Mukti Cakra · Training
          </p>
          <h1 className="mt-2.5 text-2xl font-semibold tracking-[-0.04em] text-slate-900 sm:text-3xl">
            {labels[access.purpose]}
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            {access.title} · {access.date}
            {access.room ? ` · ${access.room}` : ''}
          </p>
        </header>

        <div className="px-4 py-6 sm:px-7">
          {error && (
            <div role="alert" className="mb-5 border border-red-500 bg-red-50 px-3 py-2.5 text-sm text-red-700">
              {error}
            </div>
          )}

          {submitted ? (
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
              <p className="mt-3 text-base font-semibold text-slate-900">Respons berhasil disimpan</p>
              <p className="mt-1.5 text-sm text-slate-500">
                Terima kasih. Anda dapat menutup halaman ini.
              </p>
            </div>
          ) : (
            <>
              {isAttendance && (
                <div className="grid gap-5">
                  <Field id="attendance-nip" label="NIP" hint="Sesuai data karyawan di HR.">
                    {(field) => (
                      <input
                        inputMode="numeric"
                        autoComplete="off"
                        value={nip}
                        onChange={(event) => setNip(event.target.value)}
                        placeholder="Masukkan NIP"
                        {...field}
                        className={inputClass()}
                      />
                    )}
                  </Field>
                  <div>
                    <p className="text-xs font-semibold text-slate-700">Tanda tangan</p>
                    <div className="mt-2">
                      <SignaturePad onChange={setSignatureData} />
                    </div>
                  </div>
                </div>
              )}

              {!isAttendance && !assessment && (
                <div className="grid gap-5">
                  <Field id="access-nip" label="NIP" hint="Sesuai data karyawan di HR.">
                    {(field) => (
                      <input
                        inputMode="numeric"
                        autoComplete="off"
                        value={nip}
                        onChange={(event) => setNip(event.target.value)}
                        placeholder="Masukkan NIP"
                        {...field}
                        className={inputClass()}
                      />
                    )}
                  </Field>
                  <Button type="button" onClick={open} disabled={!nip.trim() || sending}>
                    {sending ? 'Memuat...' : 'Lanjutkan'}
                  </Button>
                </div>
              )}

              {showTest && (
                <>
                  <div className="enter-section" style={{ '--enter-delay': '40ms' } as CSSProperties}>
                    <ProgressBar answered={answeredCount} total={questions.length} label="Kemajuan pengerjaan" />
                  </div>

                  <div className="mt-6 grid gap-4">
                    {questions.map((question, index) => (
                      /*
                        A plain div, not a fieldset. A visible <legend> is laid out
                        on top of a fieldset's border and cuts through it, which is
                        what pushed the question out of the card. ChoiceGroup owns
                        the fieldset and its accessible name instead.
                      */
                      <div
                        key={question.id}
                        className="enter-section border border-slate-200 bg-white p-4 sm:p-5"
                        style={{ '--enter-delay': `${80 + Math.min(index, 6) * 40}ms` } as CSSProperties}
                      >
                        <p className="text-sm font-semibold break-words text-slate-900">
                          <span className="mr-1.5 text-slate-400 tabular-nums">{question.number}.</span>
                          {question.text}
                        </p>
                        <div className="mt-3">
                          <ChoiceGroup
                            name={`question-${question.id}`}
                            legend={`Soal ${question.number}: ${question.text}`}
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

              {isFeedback && (
                <div className="grid gap-6">
                  <div className="enter-section" style={{ '--enter-delay': '40ms' } as CSSProperties}>
                    <ProgressBar answered={feedbackAnswered} total={FEEDBACK_ASPECTS.length} label="Aspek terisi" />
                  </div>
                  {FEEDBACK_ASPECTS.map((item, index) => (
                    <div
                      key={item.code}
                      className="enter-section border border-slate-200 bg-white p-4 sm:p-5"
                      style={{ '--enter-delay': `${80 + index * 40}ms` } as CSSProperties}
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
                  <Field id="feedback-comment" label="Komentar" optional>
                    {(field) => (
                      <textarea
                        value={feedbackComment}
                        onChange={(event) => setFeedbackComment(event.target.value)}
                        placeholder="Ceritakan hal yang perlu diperbaiki atau dipertahankan"
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

      {/* Sticky action bar: on a phone the primary action must never be below the fold. */}
      {!submitted && (isAttendance || assessment !== null) && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3 sm:px-7">
            {showTest && (
              <p className="text-xs text-slate-500 tabular-nums">
                {answeredCount} dari {questions.length} soal
              </p>
            )}
            <Button
              type="button"
              onClick={submit}
              disabled={!ready || sending}
              className={showTest ? 'ml-auto' : 'w-full'}
            >
              {sending
                ? 'Mengirim...'
                : isAttendance
                  ? 'Kirim Absensi'
                  : isFeedback
                    ? 'Kirim Feedback'
                    : 'Kirim Jawaban'}
            </Button>
          </div>
        </div>
      )}
    </main>
  );
};
