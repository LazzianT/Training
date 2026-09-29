import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiBaseUrl, ApiRequestError } from '../api/auth.js';
import { FEEDBACK_ASPECTS } from '@training/contracts';

type Access = { eventId: number; purpose: string; title: string; date: string; room: string | null; expiresAt: string };
type Assessment = Access & { questions: { id: number; number: number; text: string; options: Record<string, string> }[] };

export const AssessmentAccess = () => {
  const { token } = useParams();
  const [access, setAccess] = useState<Access | null>(null);
  const [error, setError] = useState('');
  const [nip, setNip] = useState('');
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackScores, setFeedbackScores] = useState<Record<string, string>>(() => Object.fromEntries(FEEDBACK_ASPECTS.map((item) => [item.code, '5'])));

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

  useEffect(() => {
    document.body.classList.add('assessment-access-page');
    return () => document.body.classList.remove('assessment-access-page');
  }, []);

  if (!access) return <main className="grid min-h-dvh place-items-center bg-[#EFEAE0] p-6 text-center text-[#55697C]">{error || 'Memuat...'}</main>;

  const label = access.purpose === 'pre_test' ? 'Pre-test' : access.purpose === 'post_test' ? 'Post-test' : 'Feedback Training';
  const open = async () => {
    const response = await fetch(`${apiBaseUrl}/api/assessment/access/${encodeURIComponent(token ?? '')}/open`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nip }) });
    const body = await response.json();
    if (!response.ok) { setError(body.error?.message ?? 'Tidak dapat membuka form.'); return; }
    setAssessment(body);
  };
  const submit = async () => {
    const path = access.purpose === 'feedback' ? 'feedback' : 'submit';
    const body = access.purpose === 'feedback' ? { nip, entries: FEEDBACK_ASPECTS.map((item) => ({ aspect: item.code, score: Number(feedbackScores[item.code]), comment: feedbackComment })) } : { nip, answers: Object.entries(answers).map(([questionId, answer]) => ({ questionId: Number(questionId), answer })) };
    const response = await fetch(`${apiBaseUrl}/api/assessment/access/${encodeURIComponent(token ?? '')}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (response.ok) setSubmitted(true); else setError('Pengiriman gagal.');
  };
  const isFeedback = access.purpose === 'feedback';
  return <main className="min-h-dvh bg-[#0A2942] p-4 text-[#0A2942] sm:p-8"><div className="mx-auto max-w-3xl"><section className="overflow-hidden bg-[#FAF8F3] shadow-[0_12px_40px_rgba(0,0,0,0.2)]"><div className="bg-[#0A2942] px-6 py-7 text-white sm:px-10"><p className="text-xs font-semibold tracking-[0.18em] text-[#D9A441] uppercase">PT Braja Mukti Cakra · Evaluasi Training</p><h1 className="mt-3 text-3xl font-semibold">{label}</h1><p className="mt-2 max-w-xl text-sm leading-relaxed text-white/65">Bantu kami meningkatkan kualitas training berikutnya. Penilaian Anda dirangkum secara anonim untuk evaluasi kegiatan.</p></div><div className="px-6 py-6 sm:px-10 sm:py-8"><div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#0A2942]/10 pb-5"><div><p className="text-xs font-semibold tracking-[0.12em] text-[#8A5A17] uppercase">Acara</p><h2 className="mt-1 text-xl font-semibold text-[#0A2942]">{access.title}</h2><p className="mt-1 text-sm text-[#55697C]">{access.date}{access.room ? ` · ${access.room}` : ''}</p></div><div className="text-right"><p className="text-2xl font-semibold text-[#0A2942]">{isFeedback ? FEEDBACK_ASPECTS.length : assessment?.questions.length ?? 0}</p><p className="text-xs text-[#55697C]">{isFeedback ? 'aspek penilaian' : 'pertanyaan'}</p></div></div>{submitted ? <div className="mt-8 border-l-4 border-[#28704A] bg-[#28704A]/8 p-5"><p className="font-semibold text-[#28704A]">Respons berhasil disimpan.</p><p className="mt-1 text-sm text-[#55697C]">Terima kasih sudah membantu meningkatkan kualitas training.</p></div> : assessment ? <>{isFeedback ? <div className="mt-7"><div className="mb-5 flex items-center justify-between"><div><h3 className="text-lg font-semibold text-[#0A2942]">Nilai setiap aspek</h3><p className="mt-1 text-xs text-[#55697C]">1 = sangat kurang · 5 = sangat baik</p></div><span className="border border-[#D9A441] px-2 py-1 text-[10px] font-semibold text-[#8A5A17]">WAJIB DIISI</span></div><div className="grid gap-3">{FEEDBACK_ASPECTS.map((item, index) => <fieldset key={item.code} className="border border-[#0A2942]/10 bg-white p-4 transition-colors focus-within:border-[#D9A441] hover:border-[#0A2942]/25"><legend className="max-w-full text-sm font-semibold leading-relaxed text-[#0A2942]"><span className="mr-2 text-xs font-mono text-[#8A5A17]">{String(index + 1).padStart(2, '0')}</span>{item.label}</legend><div className="mt-4 grid grid-cols-5 gap-2">{[1, 2, 3, 4, 5].map((score) => <label key={score} className={`flex cursor-pointer flex-col items-center gap-1 border py-2 text-xs transition ${feedbackScores[item.code] === String(score) ? 'border-[#0A2942] bg-[#0A2942] font-semibold text-white' : 'border-[#0A2942]/15 text-[#55697C] hover:border-[#8A5A17]'}`}><input type="radio" name={`feedback-${item.code}`} value={score} checked={feedbackScores[item.code] === String(score)} onChange={() => setFeedbackScores({ ...feedbackScores, [item.code]: String(score) })} className="sr-only" />{score}</label>)}</div></fieldset>)}</div><label className="mt-6 block border border-[#0A2942]/10 bg-white p-4 text-sm font-semibold text-[#0A2942]">Komentar tambahan <span className="font-normal text-[#78716C]">(opsional)</span><textarea value={feedbackComment} onChange={(e) => setFeedbackComment(e.target.value)} placeholder="Ceritakan bagian yang paling membantu atau perlu diperbaiki..." className="mt-3 min-h-32 w-full resize-y border border-[#0A2942]/15 bg-[#FAF8F3] p-3 font-normal outline-none focus:border-[#8A5A17]" /></label></div> : <div className="mt-6 grid gap-5">{assessment.questions.map((question) => <fieldset key={question.id}><legend className="font-semibold">{question.number}. {question.text}</legend>{Object.entries(question.options).map(([key, value]) => <label key={key} className="mt-2 flex gap-2 text-sm"><input type="radio" name={`q-${question.id}`} onChange={() => setAnswers({ ...answers, [question.id]: key })} />{key}. {value}</label>)}</fieldset>)}</div>}<button type="button" onClick={submit} className="mt-7 w-full bg-[#8A5A17] px-4 py-3.5 font-semibold text-white transition hover:bg-[#6F4812]">Kirim {label}</button></> : <><label className="mt-8 block text-sm font-semibold">NIP<input value={nip} onChange={(e) => setNip(e.target.value)} className="mt-2 w-full border border-[#0A2942]/25 bg-white p-3 font-normal" /></label><button type="button" onClick={open} className="mt-4 w-full bg-[#0A2942] px-4 py-3 font-semibold text-white">Mulai {label}</button></>}</div></section></div>{error && <p className="mx-auto mt-4 max-w-3xl text-sm text-[#FFD4D0]">{error}</p>}</main>;
};
