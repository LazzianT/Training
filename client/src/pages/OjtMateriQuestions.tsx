import { useEffect, useState, type ClipboardEvent, type CSSProperties } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { OjtSavedQuestion } from '@training/contracts';
import { useAuth } from '../auth/AuthContext.js';
import {
  addOjtQuestion,
  deleteOjtQuestion,
  ensureOjtMateriTestSet,
  fetchOjtMateriTestSet,
  fetchOjtQuestions,
  publishOjtTestSet,
  unpublishOjtTestSet,
} from '../api/ojt.js';
import { fetchOjtMateriMaster } from '../api/ojt.js';
import { ApiRequestError } from '../api/auth.js';
import { useConfirm } from '../components/ConfirmDialog.js';
import { useToast } from '../components/Toast.js';
import { OptionEditor } from '../components/OptionEditor.js';
import { Button, Field, Panel, Segmented, inputClass, textareaClass } from '../components/ui/index.js';

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

/**
 * Authoring for one material's question bank.
 *
 * Deliberately mirrors the event QuestionEditor rather than sharing it. The two
 * write to different tables behind different routes, and the shared surface
 * would be a component with two API shapes threaded through it. Duplicating the
 * layout is the smaller cost; the real duplication debt is noted rather than
 * hidden.
 *
 * One bank per material, reused by every batch that teaches it. That is why
 * publishing matters more here than on an event: the questions are not going away
 * after one cohort.
 */
export const OjtMateriQuestionsPage = () => {
  const { materiId } = useParams();
  const id = Number(materiId);
  const { session, signOut } = useAuth();
  const confirm = useConfirm();
  const { push } = useToast();
  const storageKey = `ojt.question-drafts.${materiId}`;

  const [materiName, setMateriName] = useState('');
  const [drafts, setDrafts] = useState<Draft[]>(() => {
    try {
      const value = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
      return Array.isArray(value) && value.length ? value : [empty()];
    } catch {
      return [empty()];
    }
  });
  const [savedQuestions, setSavedQuestions] = useState<OjtSavedQuestion[]>([]);
  const [saving, setSaving] = useState<number | null>(null);
  const [testSetId, setTestSetId] = useState<number | null>(null);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session || !Number.isInteger(id)) return;
    let cancelled = false;

    /*
      The bank is fetched, not created, on load. Opening the editor should not
      write to the database just because somebody looked at it; the row is created
      the first time a question is actually saved.
    */
    Promise.all([
      fetchOjtMateriMaster(session.accessToken),
      fetchOjtMateriTestSet(session.accessToken, id).catch((error: unknown) => {
        if (error instanceof ApiRequestError && error.status === 404) return null;
        throw error;
      }),
    ])
      .then(async ([catalog, testSet]) => {
        if (cancelled) return;
        const found = catalog.find((item) => item.id === id);
        setMateriName(found?.nama ?? `Materi ${id}`);
        if (testSet) {
          setTestSetId(testSet.id);
          setTestStatus(testSet.status);
          setSavedQuestions(await fetchOjtQuestions(session.accessToken, testSet.id));
        } else {
          setTestSetId(null);
          setTestStatus(null);
          setSavedQuestions([]);
        }
      })
      .catch((error: unknown) => {
        if (error instanceof ApiRequestError && error.status === 401) {
          signOut();
          return;
        }
        push({
          tone: 'danger',
          title: 'Soal gagal dimuat',
          description: error instanceof ApiRequestError ? error.message : undefined,
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, session, signOut, push]);

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
    if (!session || !drafts[index].text.trim()) return;
    setSaving(index);
    try {
      // Ensure rather than create: two people adding to the same material at once
      // have to land on one bank, not race for the unique constraint.
      const set = await ensureOjtMateriTestSet(session.accessToken, id);
      setTestSetId(set.id);
      setTestStatus(set.status);
      await addOjtQuestion(session.accessToken, set.id, {
        ...drafts[index],
        // OptionEditor hands back a plain string; the contract is a union, and
        // letting it widen here would push the mismatch to the API boundary.
        correct: drafts[index].correct as 'A' | 'B' | 'C' | 'D',
        imageData: drafts[index].imageData || undefined,
      });
      const questions = await fetchOjtQuestions(session.accessToken, set.id);
      setSavedQuestions(questions);
      setDrafts((items) => items.filter((_, itemIndex) => itemIndex !== index));
      push({
        tone: 'success',
        title: `Soal ke-${questions.at(-1)?.number ?? questions.length} tersimpan`,
        description:
          drafts.length > 1 ? `${drafts.length - 1} draft lain masih menunggu disimpan.` : undefined,
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

  const removeSaved = async (question: OjtSavedQuestion) => {
    if (!session || !testSetId) return;
    const ok = await confirm({
      title: `Hapus soal ke-${question.number}?`,
      description:
        'Soal yang sudah dihapus tidak dapat dikembalikan. Jawaban peserta yang sudah masuk tidak ikut berubah, tapi bank soal yang terbit tidak lagi sama dengan yang mereka kerjakan.',
      confirmLabel: 'Hapus soal',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await deleteOjtQuestion(session.accessToken, testSetId, question.id);
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
      title: 'Publikasikan bank soal?',
      description: `Bank ini dipakai semua batch yangMengajar materi ini, bukan hanya satu batch. Setelah terbit, QR pre-test dan post-test bisa dibuat. Draft yang belum disimpan tidak ikut terbit.`,
      confirmLabel: 'Publikasikan',
    });
    if (!ok) return;
    try {
      await publishOjtTestSet(session.accessToken, testSetId);
      setTestStatus('published');
      push({
        tone: 'success',
        title: 'Bank soal dipublikasikan',
        description: 'QR pre-test dan post-test untuk materi ini sekarang bisa dibuat.',
      });
    } catch (error) {
      push({
        tone: 'danger',
        title: 'Bank soal gagal dipublikasikan',
        description: error instanceof ApiRequestError ? error.message : undefined,
      });
    }
  };

  const unpublish = async () => {
    if (!session || !testSetId) return;
    const ok = await confirm({
      title: 'Kembalikan ke draf?',
      description:
        'Bank soal bisa diubah lagi setelah ini. Jawaban yang sudah terkunci tetap utuh, tapi peserta yang belum menjawab akan mengerjakan versi berbeda dari yang sudah dijawab orang lain.',
      confirmLabel: 'Kembalikan ke draf',
    });
    if (!ok) return;
    try {
      await unpublishOjtTestSet(session.accessToken, testSetId);
      setTestStatus('draft');
      push({ tone: 'success', title: 'Bank soal dikembalikan ke draf' });
    } catch (error) {
      push({
        tone: 'danger',
        title: 'Status gagal diubah',
        description: error instanceof ApiRequestError ? error.message : undefined,
      });
    }
  };

  const published = testStatus === 'published';
  const savedCount = savedQuestions.length;

  return (
    <div data-surface="saas">
      <Link
        to="/ojt/materi"
        className="text-sm font-semibold text-slate-900 underline underline-offset-4 outline-none transition duration-150 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
      >
        Kembali ke Master Materi
      </Link>

      <header className="enter-section mt-4 flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-[-0.04em] text-slate-900 sm:text-3xl">
            Bank Soal
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            {materiName} · {savedCount} soal tersimpan · dipakai semua batch yang mengajar materi ini.
          </p>
        </div>
        {testSetId && (
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`border px-2 py-1 text-[10px] font-semibold tracking-[0.1em] uppercase ${
                published
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200 bg-slate-50 text-slate-700'
              }`}
            >
              {published ? 'Terbit' : 'Draft'}
            </span>
            {published ? (
              <Button type="button" variant="secondary" onClick={unpublish}>
                Kembalikan ke Draf
              </Button>
            ) : (
              <Button type="button" onClick={publish} disabled={savedCount === 0}>
                Publikasikan
              </Button>
            )}
          </div>
        )}
      </header>

      {testSetId && savedCount === 0 && (
        <p
          className="enter-section mt-6 border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
          style={{ '--enter-delay': '40ms' } as CSSProperties}
        >
          Bank soal sudah dibuat. Tambahkan minimal satu soal sebelum mempublasikan, karena QR pre-test
          tidak bisa dibuat untuk bank yang kosong.
        </p>
      )}

      {savedCount > 0 && (
        <div className="enter-section mt-6" style={{ '--enter-delay': '40ms' } as CSSProperties}>
          <Panel
            title="Soal Tersimpan"
            description={`${savedCount} soal dalam bank ini. Urutan mengikuti nomor soal.`}
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

      {!loading && testSetId === null && (
        <p
          className="enter-section mt-6 border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
          style={{ '--enter-delay': '40ms' } as CSSProperties}
        >
          Bank soal untuk materi ini belum ada. Bank dibuat otomatis saat soal pertama disimpan.
        </p>
      )}

      <div className="mt-6 grid max-w-3xl gap-4">
        {drafts.map((draft, index) => (
          <section
            key={index}
            className="enter-section surface-card p-5 sm:p-6"
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
                  <img
                    src={draft.imageData}
                    alt="Gambar soal"
                    className="max-h-48 rounded-none border border-slate-200"
                  />
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
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="h-4 w-4 text-slate-400"
                    aria-hidden="true"
                  >
                    <rect x="3.5" y="4.5" width="17" height="15" strokeLinecap="square" />
                    <circle cx="8.5" cy="9.5" r="1.5" />
                    <path d="M4 17l5-5 4 4 3-3 4 4" strokeLinecap="square" />
                  </svg>
                  Klik area ini lalu tekan Ctrl+V untuk menempel gambar soal.
                </div>
              )}
            </div>

            {draft.type === 'pg' ? (
              <div className="mt-5">
                <p className="text-xs font-semibold text-slate-700">Pilihan jawaban</p>
                <p className="mt-0.5 text-xs text-slate-500">Klik huruf untuk menjadikannya kunci jawaban.</p>
                <div className="mt-2">
                  <OptionEditor
                    values={{ A: draft.a, B: draft.b, C: draft.c, D: draft.d }}
                    correct={draft.correct}
                    onChange={(key, value) =>
                      update(index, key.toLowerCase() as 'a' | 'b' | 'c' | 'd', value)
                    }
                    onCorrectChange={(key) => update(index, 'correct', key)}
                  />
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
              <Field id={`point-${index}`} label="Poin" hint="Bobot soal saat dinilai.">
                {(field) => (
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={draft.point}
                    onChange={(event) =>
                      update(index, 'point', Math.max(1, Number(event.target.value) || 1))
                    }
                    {...field}
                    className={inputClass()}
                  />
                )}
              </Field>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-5">
              <Button
                type="button"
                disabled={saving === index || !draft.text.trim()}
                onClick={() => save(index)}
              >
                {saving === index ? 'Menyimpan...' : 'Simpan Soal Ini'}
              </Button>
              {!draft.text.trim() && <span className="text-xs text-slate-500">Pertanyaan masih kosong.</span>}
            </div>
          </section>
        ))}

        <button
          type="button"
          onClick={addSection}
          className="enter-section flex min-h-16 items-center justify-center gap-2 border border-dashed border-slate-300 text-sm font-semibold text-slate-900 outline-none transition duration-150 hover:border-slate-900 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
        >
          <span aria-hidden="true" className="text-lg leading-none">
            +
          </span>
          Tambah Soal
        </button>
      </div>
    </div>
  );
};
