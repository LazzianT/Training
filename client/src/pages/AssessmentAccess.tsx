import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { FEEDBACK_ASPECTS } from '@training/contracts';
import { apiBaseUrl, ApiRequestError } from '../api/auth.js';

type Purpose = 'pre_test' | 'post_test' | 'feedback' | 'attendance';
type Access = { eventId: number; purpose: Purpose; title: string; date: string; room: string | null; expiresAt: string };
type Assessment = Access & { questions: { id: number; number: number; text: string; options: Record<string, string> }[] };

const labels: Record<Purpose, string> = {
  pre_test: 'Pre-test',
  post_test: 'Post-test',
  feedback: 'Feedback Training',
  attendance: 'Absensi Training',
};

export const AssessmentAccess = () => {
  const { token } = useParams();
  const [access, setAccess] = useState<Access | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [nip, setNip] = useState('');
  const [signatureData, setSignatureData] = useState('');
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackScores, setFeedbackScores] = useState<Record<string, string>>(() => Object.fromEntries(FEEDBACK_ASPECTS.map((item) => [item.code, '5'])));
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const signatureCanvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

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

  if (!access) return <main className="grid min-h-dvh place-items-center bg-[#EFEAE0] p-6 text-center text-[#55697C]">{error || 'Memuat...'}</main>;

  const isFeedback = access.purpose === 'feedback';
  const isAttendance = access.purpose === 'attendance';
  const open = async () => {
    const response = await fetch(`${apiBaseUrl}/api/assessment/access/${encodeURIComponent(token ?? '')}/open`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nip }) });
    const body = await response.json();
    if (!response.ok) return setError(body.error?.message ?? 'Tidak dapat membuka form.');
    setAssessment(body);
  };

  const submit = async () => {
    const path = isFeedback ? 'feedback' : isAttendance ? 'attendance' : 'submit';
    const body = isFeedback
      ? { nip, entries: FEEDBACK_ASPECTS.map((item) => ({ aspect: item.code, score: Number(feedbackScores[item.code]), comment: feedbackComment })) }
      : isAttendance
        ? { nip, signatureData }
        : { nip, answers: Object.entries(answers).map(([questionId, answer]) => ({ questionId: Number(questionId), answer })) };
    const response = await fetch(`${apiBaseUrl}/api/assessment/access/${encodeURIComponent(token ?? '')}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (response.ok) setSubmitted(true);
    else setError(((await response.json().catch(() => null)) as { error?: { message?: string } } | null)?.error?.message ?? 'Pengiriman gagal.');
  };

  const signaturePoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvas.current;
    if (!canvas) return null;
    const bounds = canvas.getBoundingClientRect();
    return { x: ((event.clientX - bounds.left) / bounds.width) * canvas.width, y: ((event.clientY - bounds.top) / bounds.height) * canvas.height };
  };

  const startSignature = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvas.current;
    const point = signaturePoint(event);
    if (!canvas || !point) return;
    drawing.current = true;
    canvas.setPointerCapture(event.pointerId);
    const context = canvas.getContext('2d');
    if (!context) return;
    context.beginPath();
    context.moveTo(point.x, point.y);
  };

  const drawSignature = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const point = signaturePoint(event);
    const context = signatureCanvas.current?.getContext('2d');
    if (!point || !context) return;
    context.lineTo(point.x, point.y);
    context.stroke();
  };

  const endSignature = () => {
    if (!drawing.current || !signatureCanvas.current) return;
    drawing.current = false;
    setSignatureData(signatureCanvas.current.toDataURL('image/png'));
  };

  const clearSignature = () => {
    const canvas = signatureCanvas.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureData('');
  };

  return <main className="min-h-dvh bg-[#0A2942] p-4 text-[#0A2942] sm:p-8"><div className="mx-auto max-w-3xl"><section className="overflow-hidden bg-[#FAF8F3] shadow-[0_12px_40px_rgba(0,0,0,0.2)]"><div className="bg-[#0A2942] px-6 py-7 text-white sm:px-10"><p className="text-xs font-semibold tracking-[0.18em] text-[#D9A441] uppercase">PT Braja Mukti Cakra · Training</p><h1 className="mt-3 text-3xl font-semibold">{labels[access.purpose]}</h1><p className="mt-2 text-sm text-white/65">{access.title} · {access.date}{access.room ? ` · ${access.room}` : ''}</p></div><div className="px-6 py-6 sm:px-10 sm:py-8">{error && <p className="mb-5 border-l-4 border-[#B42318] bg-[#B42318]/10 p-3 text-sm text-[#B42318]">{error}</p>}{submitted ? <div className="border-l-4 border-[#28704A] bg-[#28704A]/8 p-5"><p className="font-semibold text-[#28704A]">Respons berhasil disimpan.</p><p className="mt-1 text-sm text-[#55697C]">Terima kasih.</p></div> : isAttendance ? <div className="grid gap-4"><label className="grid gap-2 text-sm font-semibold">NIP<input value={nip} onChange={(event) => setNip(event.target.value)} className="border p-3 font-normal" /></label><div className="grid gap-2 text-sm font-semibold"><span>Tanda tangan</span><canvas ref={signatureCanvas} width="600" height="240" onPointerDown={startSignature} onPointerMove={drawSignature} onPointerUp={endSignature} onPointerCancel={endSignature} className="h-48 w-full touch-none border border-[#0A2942]/20 bg-white" /><button type="button" onClick={clearSignature} className="justify-self-start border border-[#0A2942]/20 px-3 py-2 text-xs">Hapus tanda tangan</button></div><button type="button" disabled={!nip || !signatureData} onClick={submit} className="bg-[#0A2942] p-3 font-semibold text-white disabled:opacity-40">Kirim Absensi</button></div> : !assessment ? <div className="grid gap-4"><label className="grid gap-2 text-sm font-semibold">NIP<input value={nip} onChange={(event) => setNip(event.target.value)} className="border p-3 font-normal" /></label><button type="button" disabled={!nip} onClick={open} className="bg-[#0A2942] p-3 font-semibold text-white disabled:opacity-40">Lanjutkan</button></div> : isFeedback ? <div className="grid gap-4">{FEEDBACK_ASPECTS.map((item) => <label key={item.code} className="grid gap-2 text-sm font-semibold">{item.label}<select value={feedbackScores[item.code]} onChange={(event) => setFeedbackScores((current) => ({ ...current, [item.code]: event.target.value }))} className="border p-3 font-normal">{[1, 2, 3, 4, 5].map((score) => <option key={score}>{score}</option>)}</select></label>)}<textarea value={feedbackComment} onChange={(event) => setFeedbackComment(event.target.value)} placeholder="Komentar (opsional)" className="min-h-24 border p-3" /><button type="button" onClick={submit} className="bg-[#0A2942] p-3 font-semibold text-white">Kirim Feedback</button></div> : <div className="grid gap-5">{assessment.questions.map((question) => <fieldset key={question.id} className="grid gap-2"><legend className="font-semibold">{question.number}. {question.text}</legend>{Object.entries(question.options).map(([option, text]) => <label key={option} className="flex gap-2 text-sm"><input type="radio" name={`question-${question.id}`} checked={answers[question.id] === option} onChange={() => setAnswers((current) => ({ ...current, [question.id]: option }))} />{option}. {text}</label>)}</fieldset>)}<button type="button" onClick={submit} className="bg-[#0A2942] p-3 font-semibold text-white">Kirim Jawaban</button></div>}</div></section></div></main>;
};
