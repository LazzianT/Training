import { useEffect, useState, type ClipboardEvent, type CSSProperties } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.js';
import {
  addTestQuestion,
  createTestSet,
  deleteQuestion,
  fetchMyEvents,
  fetchQuestions,
  fetchTestSets,
  publishTestSet,
  type SavedQuestion,
} from '../api/events.js';
import { ApiRequestError } from '../api/auth.js';
import { useConfirm } from '../components/ConfirmDialog.js';
import { useToast } from '../components/Toast.js';
import { OptionEditor } from '../components/OptionEditor.js';
import { Button, Field, Panel, Segmented, inputClass, textareaClass } from '../components/ui.js';

type Draft = {
  type: 'pg' | 'essay';
  text: string;
  a: string;
  b: string;
  c: string;
  d: string;
  correct: string;
  instructions: string;
  answerGuide: string;
  imageData: string;
  point: number;
};

const empty = (): Draft => ({
  type: 'pg',
  text: '',
  a: '',
  b: '',
  c: '',
  d: '',
  correct: 'A',
  instructions: '',
  answerGuide: '',
  imageData: '',
  point: 1,
});

const TYPE_LABEL = { pg: 'Pilihan Ganda', essay: 'Essay' } as const;

export const QuestionEditor = () => {
  const { eventId } = useParams();
  const { session, signOut } = useAuth();
  const confirm = useConfirm();
  const { push } = useToast();
  const storageKey = `training.question-drafts.${eventId}`;

  const [title, setTitle] = useState('');
  const [drafts, setDrafts] = useState<Draft[]>(() => {
    try {
      const value = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
      return Array.isArray(value) && value.length ? value : [empty()];
    } catch {
      return [empty()];
    }
  });
  const [savedQuestions, setSavedQuestions] = useState<SavedQuestion[]>([]);
  const [saving, setSaving] = useState<number | null>(null);
  const [testSetId, setTestSetId] = useState<number | null>(null);
  const [testStatus, setTestStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!session || !eventId) return;
    const id = Number(eventId);
    Promise.all([fetchMyEvents(session.accessToken), fetchTestSets(session.accessToken, id)])
      .then(async ([events, tests]) => {
        setTitle(events.find((event) => event.id === id)?.judul ?? 'Acara');
        const test = tests.find((item) => item.type === 'mixed');
        setTestSetId(test?.id ?? null);
        setTestStatus(test?.status ?? null);
        if (test) {
          setSavedQuestions(await fetchQuestions(session.accessToken, test.id));
        } else {
          setSavedQuestions([]);
        }
      })
      .catch((error: unknown) => {
        if (error instanceof ApiRequestError && error.status === 401) signOut();
      });
  }, [eventId, session, signOut]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(drafts));
  }, [drafts, storageKey]);

  const update = (index: number, key: keyof Draft, value: string | number) =>
    setDrafts((items) => items.map((item, i) => (i === index ? { ...item, [key]: value } : item)));

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

  const removeSection = async (index: number) => {
    if (drafts.length === 1) return;
    const ok = await confirm({
      title: 'Buang draft soal ini?',
      description: 'Draft yang belum disimpan akan hilang dari daftar ini. Soal yang sudah tersimpan tidak terpengaruh.',
      confirmLabel: 'Buang draft',
      tone: 'danger',
    });
    if (!ok) return;
    setDrafts((items) => items.filter((_, itemIndex) => itemIndex !== index));
  };

  const save = async (index: number) => {
    if (!session || !eventId || !drafts[index].text.trim()) return;
    setSaving(index);
    try {
      const test = await createTestSet(session.accessToken, Number(eventId), 'mixed');
      setTestSetId(test.id);
      await addTestQuestion(session.accessToken, test.id, {
        ...drafts[index],
        imageData: drafts[index].imageData || undefined,
      });
      const questions = await fetchQuestions(session.accessToken, test.id);
      setSavedQuestions(questions);
      setDrafts((items) => items.filter((_, itemIndex) => itemIndex !== index));
      push({
        tone: 'success',
        title: `Soal ke-${questions.at(-1)?.number ?? questions.length} tersimpan`,
        description: drafts.length > 1 ? `${drafts.length - 1} draft lain masih menunggu disimpan.` : undefined,
      });
    } catch (error) {
      push({
        tone: 'danger',
        title: 'Soal gagal disimpan',
        description: error instanceof ApiRequestError ? error.message : 'Terjadi kesalahan saat menyimpan soal.',
      });
    } finally {
      setSaving(null);
    }
  };

  const removeSaved = async (question: SavedQuestion) => {
    if (!session || !testSetId) return;
    const ok = await confirm({
      title: `Hapus soal ke-${question.number}?`,
      description: 'Soal yang sudah dihapus tidak dapat dikembalikan dan hasil peserta yang sudah menjawab tidak ikut berubah.',
      confirmLabel: 'Hapus soal',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await deleteQuestion(session.accessToken, testSetId, question);
      setSavedQuestions((items) => items.filter((item) => item.id !== question.id));
      push({ tone: 'success', title: `Soal ke-${question.number} dihapus` });
    } catch (error) {
      push({
        tone: 'danger',
        title: 'Soal gagal dihapus',
        description: error instanceof ApiRequestError ? error.message : 'Terjadi kesalahan saat menghapus soal.',
      });
    }
  };

  const publish = async () => {
    if (!session || !testSetId) return;
    const ok = await confirm({
      title: 'Publikasikan test?',
      description: `Peserta akan bisa mengerjakan ${savedQuestions.length} soal setelah QR dibuat. Soal yang belum disimpan tidak ikut terbit.`,
      confirmLabel: 'Publikasikan',
    });
    if (!ok) return;
    try {
      await publishTestSet(session.accessToken, testSetId);
      setTestStatus('published');
      push({
        tone: 'success',
        title: 'Test dipublikasikan',
        description: 'QR untuk peserta sudah bisa digunakan.',
      });
    } catch (error) {
      push({
        tone: 'danger',
        title: 'Test gagal dipublikasikan',
        description: error instanceof ApiRequestError ? error.message : undefined,
      });
    }
  };

  const published = testStatus === 'published';
  const savedCount = savedQuestions.length;

  return (
    <div data-surface="saas">
      <Link
        to="/my-events"
        className="text-sm font-semibold text-slate-900 underline underline-offset-4 outline-none transition duration-150 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
      >
        Kembali ke Acara Saya
      </Link>

      <header className="enter-section mt-4 flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-[-0.04em] text-slate-900 sm:text-3xl">Buat Soal</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            {title} · {savedCount} soal tersimpan · draft otomatis tersimpan di perangkat ini.
          </p>
        </div>
        {testSetId && (
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`border px-2 py-1 text-[10px] font-semibold tracking-[0.1em] uppercase ${
                published ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-700'
              }`}
            >
              {published ? 'Terbit' : 'Draft'}
            </span>
            <Button type="button" onClick={publish} disabled={savedCount === 0}>
              {published ? 'Terbitkan Ulang' : 'Publikasikan Test'}
            </Button>
          </div>
        )}
      </header>

      {testSetId && savedCount === 0 && (
        <p className="enter-section mt-6 border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700" style={{ '--enter-delay': '40ms' } as CSSProperties}>
          Test set sudah dibuat. Tambahkan minimal satu soal sebelum mempublikasikan.
        </p>
      )}

      {savedCount > 0 && (
        <div
          className="enter-section mt-6"
          style={{ '--enter-delay': '40ms' } as CSSProperties}
        >
          <Panel
            title="Soal Tersimpan"
            description={`${savedCount} soal dalam test set ini. Urutan mengikuti nomor soal.`}
          >
            <ul className="divide-y divide-slate-100">
              {savedQuestions.map((question, index) => (
                <li
                  key={`${question.type}-${question.id}`}
                  className="enter-row flex flex-wrap items-start justify-between gap-3 px-5 py-3 transition duration-150 hover:bg-slate-50"
                  style={{ '--enter-delay': `${Math.min(index, 8) * 24}ms` } as CSSProperties}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900 tabular-nums">
                        Soal ke-{question.number}
                      </span>
                      <span className="border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.08em] text-slate-600 uppercase">
                        {TYPE_LABEL[question.type]}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">{question.text}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeSaved(question)}
                    className="shrink-0 text-xs font-semibold text-slate-900 underline underline-offset-4 outline-none transition duration-150 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                  >
                    Hapus
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}

      <div className="mt-6 grid max-w-3xl gap-4">
        {drafts.map((draft, index) => (
          <section
            key={index}
            className="enter-section border border-slate-200 bg-white p-5 sm:p-6"
            style={{ '--enter-delay': `${120 + Math.min(index, 4) * 40}ms` } as CSSProperties}
          >
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <h2 className="text-base font-semibold tracking-[-0.01em] text-slate-900">
                Soal ke-{savedCount + index + 1}
              </h2>
              {drafts.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeSection(index)}
                  className="text-xs font-semibold text-slate-500 underline underline-offset-4 outline-none transition duration-150 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                >
                  Buang draft
                </button>
              )}
            </header>

            <div className="mt-5">
              <Segmented
                name={`type-${index}`}
                legend="Jenis soal"
                value={draft.type}
                onChange={(value) => update(index, 'type', value)}
                options={[
                  { value: 'pg', label: 'Pilihan Ganda' },
                  { value: 'essay', label: 'Essay' },
                ]}
              />
            </div>

            <div className="mt-5">
              <Field id={`text-${index}`} label="Pertanyaan">
                {(field) => (
                  <textarea
                    value={draft.text}
                    onChange={(event) => update(index, 'text', event.target.value)}
                    placeholder="Tulis pertanyaan atau instruksi peserta"
                    {...field}
                    className={textareaClass()}
                  />
                )}
              </Field>
            </div>

            <div
              onPaste={(event) => paste(index, event)}
              tabIndex={0}
              role="group"
              aria-label="Tempel gambar soal"
              className="mt-4 border border-dashed border-slate-300 bg-slate-50 p-4 outline-none transition duration-150 hover:border-slate-400 focus-visible:border-slate-900 focus-visible:ring-2 focus-visible:ring-black"
            >
              {draft.imageData ? (
                <div className="flex flex-wrap items-start gap-4">
                  <img src={draft.imageData} alt="Gambar soal" className="max-h-48 rounded-none border border-slate-200" />
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-9 px-3 text-xs"
                    onClick={() => update(index, 'imageData', '')}
                  >
                    Hapus gambar
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2.5 text-xs text-slate-500">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4 text-slate-400" aria-hidden="true">
                    <rect x="3.5" y="4.5" width="17" height="15" strokeLinecap="square" />
                    <circle cx="8.5" cy="9.5" r="1.5" />
                    <path d="M4 17l5-5 4 4 3-3 4 4" strokeLinecap="square" />
                  </svg>
                  Klik area ini lalu tekan Ctrl+V untuk menempel gambar soal.
                </div>
              )}
            </div>

            {draft.type === 'pg' ? (
              <div className="mt-5 grid gap-5">
                <div>
                  <p className="text-xs font-semibold text-slate-700">Pilihan jawaban</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Klik huruf untuk menjadikannya kunci jawaban.
                  </p>
                  <div className="mt-2">
                    <OptionEditor
                      values={{ A: draft.a, B: draft.b, C: draft.c, D: draft.d }}
                      correct={draft.correct}
                      onChange={(key, value) => update(index, key.toLowerCase() as 'a' | 'b' | 'c' | 'd', value)}
                      onCorrectChange={(key) => update(index, 'correct', key)}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-5 grid gap-5">
                <Field id={`instructions-${index}`} label="Instruksi" optional>
                  {(field) => (
                    <textarea
                      value={draft.instructions}
                      onChange={(event) => update(index, 'instructions', event.target.value)}
                      {...field}
                      className={textareaClass()}
                    />
                  )}
                </Field>
                <Field id={`guide-${index}`} label="Panduan jawaban" optional>
                  {(field) => (
                    <textarea
                      value={draft.answerGuide}
                      onChange={(event) => update(index, 'answerGuide', event.target.value)}
                      {...field}
                      className={textareaClass()}
                    />
                  )}
                </Field>
              </div>
            )}

            <div className="mt-5 grid max-w-32">
              <Field
                id={`point-${index}`}
                label="Poin"
                hint="Bobot soal saat dinilai."
              >
                {(field) => (
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={draft.point}
                    onChange={(event) => update(index, 'point', Math.max(1, Number(event.target.value) || 1))}
                    {...field}
                    className={inputClass()}
                  />
                )}
              </Field>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-5">
              <Button type="button" disabled={saving === index || !draft.text.trim()} onClick={() => save(index)}>
                {saving === index ? 'Menyimpan...' : 'Simpan Soal Ini'}
              </Button>
              {!draft.text.trim() && (
                <span className="text-xs text-slate-500">Pertanyaan masih kosong.</span>
              )}
            </div>
          </section>
        ))}

        <button
          type="button"
          onClick={addSection}
          className="enter-section flex min-h-16 items-center justify-center gap-2 border border-dashed border-slate-300 text-sm font-semibold text-slate-900 outline-none transition duration-150 hover:border-slate-900 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
        >
          <span aria-hidden="true" className="text-lg leading-none">+</span>
          Tambah Soal
        </button>
      </div>
    </div>
  );
};
