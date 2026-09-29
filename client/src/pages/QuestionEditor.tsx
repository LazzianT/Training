import { useEffect, useState, type ClipboardEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.js';
import { addTestQuestion, createTestSet, deleteQuestion, fetchMyEvents, fetchQuestions, fetchTestSets, publishTestSet, type SavedQuestion } from '../api/events.js';
import { ApiRequestError } from '../api/auth.js';

type Draft = { type: 'pg' | 'essay'; text: string; a: string; b: string; c: string; d: string; correct: string; instructions: string; answerGuide: string; imageData: string; point: number };
const empty = (): Draft => ({ type: 'pg', text: '', a: '', b: '', c: '', d: '', correct: 'A', instructions: '', answerGuide: '', imageData: '', point: 1 });

export const QuestionEditor = () => {
  const { eventId } = useParams();
  const { session, signOut } = useAuth();
  const storageKey = `training.question-drafts.${eventId}`;
  const [title, setTitle] = useState('');
  const [drafts, setDrafts] = useState<Draft[]>(() => { try { const value = JSON.parse(localStorage.getItem(storageKey) ?? '[]'); return Array.isArray(value) && value.length ? value : [empty()]; } catch { return [empty()]; } });
  const [savedCount, setSavedCount] = useState(0);
  const [saving, setSaving] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [testSetId, setTestSetId] = useState<number | null>(null);
  const [savedQuestions, setSavedQuestions] = useState<SavedQuestion[]>([]);

  useEffect(() => {
    if (!session || !eventId) return;
    const id = Number(eventId);
    Promise.all([fetchMyEvents(session.accessToken), fetchTestSets(session.accessToken, id)]).then(async ([events, tests]) => {
      setTitle(events.find((event) => event.id === id)?.judul ?? 'Event');
      const test = tests.find((item) => item.type === 'mixed');
      setTestSetId(test?.id ?? null);
      if (test) {
        const questions = await fetchQuestions(session.accessToken, test.id);
        setSavedQuestions(questions);
        setSavedCount(questions.length);
      } else {
        setSavedCount(0);
      }
    }).catch((error: unknown) => { if (error instanceof ApiRequestError && error.status === 401) signOut(); });
  }, [eventId, session, signOut]);

  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(drafts)); }, [drafts, storageKey]);

  const update = (index: number, key: keyof Draft, value: string | number) => setDrafts((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));
  const paste = (index: number, event: ClipboardEvent<HTMLDivElement>) => {
    const image = [...event.clipboardData.items].find((item) => item.type.startsWith('image/'));
    if (!image) return;
    event.preventDefault();
    const file = image.getAsFile();
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => update(index, 'imageData', String(reader.result));
    reader.readAsDataURL(file);
  };
  const addSection = () => setDrafts((items) => [...items, empty()]);
  const removeSection = (index: number) => setDrafts((items) => items.length === 1 ? items : items.filter((_, itemIndex) => itemIndex !== index));
  const save = async (index: number) => {
    if (!session || !eventId || !drafts[index].text.trim()) return;
    setSaving(index); setMessage('');
    try {
      const test = await createTestSet(session.accessToken, Number(eventId), 'mixed');
      setTestSetId(test.id);
      await addTestQuestion(session.accessToken, test.id, { ...drafts[index], imageData: drafts[index].imageData || undefined });
      const questions = await fetchQuestions(session.accessToken, test.id);
      setSavedQuestions(questions);
      setDrafts((items) => items.filter((_, itemIndex) => itemIndex !== index));
      setSavedCount(questions.length);
      setMessage(`Soal ke-${questions.at(-1)?.number ?? questions.length} tersimpan.`);
    } catch (error) { setMessage(error instanceof ApiRequestError ? error.message : 'Soal gagal disimpan.'); }
    finally { setSaving(null); }
  };

  const removeSaved = async (question: SavedQuestion) => {
    if (!session || !testSetId || !window.confirm(`Hapus Soal ke-${question.number}?`)) return;
    try {
      await deleteQuestion(session.accessToken, testSetId, question);
      setSavedQuestions((items) => items.filter((item) => item.id !== question.id));
      setSavedCount((count) => Math.max(0, count - 1));
      setMessage(`Soal ke-${question.number} dihapus.`);
    } catch (error) { setMessage(error instanceof ApiRequestError ? error.message : 'Soal gagal dihapus.'); }
  };

  const publish = async () => {
    if (!session || !testSetId) return;
    try { await publishTestSet(session.accessToken, testSetId); setMessage('Test dipublikasikan. QR dapat digunakan peserta.'); }
    catch (error) { setMessage(error instanceof ApiRequestError ? error.message : 'Test gagal dipublikasikan.'); }
  };

  return <>
    <Link to="/my-events" className="text-sm text-[#8A5A17] underline underline-offset-4">Kembali ke My Event</Link>
    <header className="mt-5 flex flex-wrap items-end justify-between gap-4 border-b border-[#0A2942]/15 pb-5"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5A17]">Bank Soal</p><h1 className="mt-1 text-3xl font-semibold text-[#0A2942]">Buat Soal</h1><p className="mt-2 text-sm text-[#55697C]">{title} · {savedCount} soal tersimpan · draft otomatis tersimpan.</p></div>{testSetId && <button type="button" onClick={publish} className="bg-[#0A2942] px-4 py-2.5 text-sm font-semibold text-white">Publish Test</button>}</header>
    {message && <p className="mt-4 text-sm text-[#8A5A17]">{message}</p>}
    {savedQuestions.length > 0 && <section className="mt-6 max-w-2xl border border-[#0A2942]/15 bg-[#F1EEE7] p-5"><h2 className="text-lg font-semibold text-[#0A2942]">Soal tersimpan</h2><div className="mt-3 grid gap-2">{savedQuestions.map((question) => <div key={`${question.type}-${question.id}`} className="flex items-center justify-between gap-3 border-b border-[#0A2942]/10 py-2 text-sm"><span><strong>Soal ke-{question.number}</strong> · {question.type === 'pg' ? 'Pilihan Ganda' : 'Essay'}<span className="ml-2 text-[#55697C]">{question.text}</span></span><button type="button" onClick={() => removeSaved(question)} className="shrink-0 text-xs text-[#B42318] underline">Hapus soal</button></div>)}</div></section>}
    <div className="mt-6 grid max-w-2xl gap-6">
      {drafts.map((draft, index) => <section key={index} className="border border-[#0A2942]/20 bg-[#FAF8F3] p-5 shadow-[0_2px_0_rgba(10,41,66,0.06)]">
        <div className="flex items-center justify-between border-b-2 border-[#0A2942] pb-3"><h2 className="text-xl font-semibold text-[#0A2942]">Soal ke-{savedCount + index + 1}</h2>{drafts.length > 1 && <button type="button" onClick={() => removeSection(index)} className="text-xs text-[#B42318] underline">Hapus section</button>}</div>
        <label className="mt-5 block text-sm font-semibold text-[#55697C]">Jenis soal<select value={draft.type} onChange={(e) => update(index, 'type', e.target.value)} className="mt-2 w-full border border-[#0A2942]/25 bg-white p-3 font-normal text-[#0A2942]"><option value="pg">Pilihan Ganda</option><option value="essay">Essay</option></select></label>
        <label className="mt-5 block text-sm font-semibold text-[#55697C]">Pertanyaan<textarea value={draft.text} onChange={(e) => update(index, 'text', e.target.value)} className="mt-2 min-h-28 w-full border border-[#0A2942]/25 bg-white p-3 font-normal text-[#0A2942]" /></label>
        <div onPaste={(event) => paste(index, event)} tabIndex={0} className="mt-4 border border-dashed border-[#8A5A17]/60 bg-white p-4 text-sm text-[#55697C] outline-none focus:ring-2 focus:ring-[#D9A441]/30">Klik area ini lalu tekan Ctrl+V untuk menempel gambar.{draft.imageData && <img src={draft.imageData} alt="Gambar soal" className="mt-3 max-h-56 max-w-full" />}</div>
        {draft.type === 'pg' ? <div className="mt-5 grid gap-3">{(['a', 'b', 'c', 'd'] as const).map((key) => <label key={key} className="text-sm font-semibold text-[#55697C]">Pilihan {key.toUpperCase()}<input value={draft[key]} onChange={(e) => update(index, key, e.target.value)} className="mt-1 w-full border border-[#0A2942]/25 bg-white p-3 font-normal text-[#0A2942]" /></label>)}<label className="text-sm font-semibold text-[#55697C]">Kunci jawaban<select value={draft.correct} onChange={(e) => update(index, 'correct', e.target.value)} className="mt-1 w-full border border-[#0A2942]/25 bg-white p-3 font-normal text-[#0A2942]"><option>A</option><option>B</option><option>C</option><option>D</option></select></label></div> : <><label className="mt-5 block text-sm font-semibold text-[#55697C]">Instruksi<textarea value={draft.instructions} onChange={(e) => update(index, 'instructions', e.target.value)} className="mt-1 min-h-20 w-full border border-[#0A2942]/25 bg-white p-3 font-normal text-[#0A2942]" /></label><label className="mt-4 block text-sm font-semibold text-[#55697C]">Panduan jawaban<textarea value={draft.answerGuide} onChange={(e) => update(index, 'answerGuide', e.target.value)} className="mt-1 min-h-24 w-full border border-[#0A2942]/25 bg-white p-3 font-normal text-[#0A2942]" /></label></>}
        <button type="button" disabled={saving === index || !draft.text.trim()} onClick={() => save(index)} className="mt-6 bg-[#0A2942] px-5 py-3 font-semibold text-white disabled:opacity-40">{saving === index ? 'Menyimpan...' : 'Simpan Soal Ini'}</button>
      </section>)}
      <button type="button" onClick={addSection} className="border-2 border-dashed border-[#8A5A17]/60 px-5 py-4 text-sm font-semibold text-[#8A5A17] hover:bg-[#8A5A17]/5">+ Tambah Soal</button>
    </div>
  </>;
};
