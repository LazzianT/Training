import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { OjtAssessmentSummary, OjtBatchStatus } from '@training/contracts';
import { ApiRequestError } from '../api/auth.js';
import { createOjtMateriQr, revokeOjtMateriQr } from '../api/ojt.js';
import { Button, EmptyState } from './ui/index.js';
import { Modal } from './Modal.js';
import { CopyButton, useToast } from './Toast.js';
import { useConfirm } from './ConfirmDialog.js';
import { shortDate } from '../lib/date.js';

const PURPOSES = [
  { value: 'pre_test', label: 'Pre-test', needsQuestions: true },
  { value: 'post_test', label: 'Post-test', needsQuestions: true },
  { value: 'feedback', label: 'Feedback', needsQuestions: false },
  { value: 'attendance', label: 'Absensi', needsQuestions: false },
] as const;

type Props = {
  token: string;
  batchId: number;
  /** Draft and closed batches refuse new codes, so the buttons are disabled. */
  batchStatus: OjtBatchStatus;
  /** Null when no material is open, which closes the dialog. */
  entry: OjtAssessmentSummary | null;
  onClose: () => void;
};

/**
 * Four QR codes for one material of one batch.
 *
 * The question status is shown before the codes, not after. A pre-test code can
 * be printed and handed out with no questions behind it, and the only symptom
 * was a participant scanning it and finding an empty form, so the test codes stay
 * disabled until the bank is published and non-empty, and the way to fix that is
 * a link away.
 */
export const OjtMateriAssessment = ({ token, batchId, batchStatus, entry, onClose }: Props) => {
  const { push } = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState<string | null>(null);
  const [qr, setQr] = useState<{ purpose: string; url: string } | null>(null);

  const batchOpen = batchStatus === 'published';

  const issue = async (purpose: (typeof PURPOSES)[number]['value']) => {
    if (!entry) return;
    setBusy(purpose);
    try {
      const created = await createOjtMateriQr(token, batchId, entry.materiId, purpose);
      setQr({ purpose, url: created.url });
    } catch (error) {
      push({
        tone: 'danger',
        title: 'QR gagal dibuat',
        description: error instanceof ApiRequestError ? error.message : undefined,
      });
    } finally {
      setBusy(null);
    }
  };

  /*
    Retiring every code for this material, all four purposes at once.

    Deliberately blunt and deliberately explicit: it is the act that can strand a
    printed sheet, so it asks first and says exactly what it will do. Making it
    per-purpose would mean four controls for a job that is almost always "the old
    ones are done".
  */
  const revokeAll = async () => {
    if (!entry) return;
    const ok = await confirm({
      title: 'Cabut semua kode materi ini?',
      description:
        'Seluruh kode pre-test, post-test, feedback, dan absensi untuk materi ini berhenti berlaku, termasuk yang sudah dicetak dan ditempel. Peserta yang memindainya akan ditolak.',
      confirmLabel: 'Cabut semua',
      tone: 'danger',
    });
    if (!ok) return;

    setBusy('revoke');
    try {
      for (const purpose of PURPOSES) {
        await revokeOjtMateriQr(token, batchId, entry.materiId, purpose.value);
      }
      setQr(null);
      push({ tone: 'success', title: 'Kode lama dicabut' });
    } catch (error) {
      push({
        tone: 'danger',
        title: 'Gagal mencabut kode',
        description: error instanceof ApiRequestError ? error.message : undefined,
      });
    } finally {
      setBusy(null);
    }
  };

  if (!entry) return null;

  const label = PURPOSES.find((item) => item.value === qr?.purpose)?.label ?? '';

  return (
    <Modal
      open
      onClose={() => {
        setQr(null);
        onClose();
      }}
      title={entry.materiNama}
      description={`${entry.materiKode} · ${shortDate(entry.tanggal)}${
        entry.jamMulai && entry.jamSelesai ? ` · ${entry.jamMulai}-${entry.jamSelesai}` : ''
      }`}
      size="lg"
      footer={
        <Button type="button" variant="secondary" onClick={onClose}>
          Tutup
        </Button>
      }
    >
      <div className="space-y-5 p-5">
        {/*
          A batch that is not open refuses every code, so the reason is given once
          at the top rather than as an error on the first button pressed.
        */}
        {!batchOpen && (
          <p className="border-l-2 border-amber-500 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {batchStatus === 'draft'
              ? 'Batch masih draf, jadi QR belum bisa dibuat. Terbitkan batch lebih dulu.'
              : 'Batch sudah ditutup, jadi QR baru tidak bisa dibuat. Buka lagi batch bila perlu.'}
          </p>
        )}

        {/*
          Readiness first. Everything below depends on it: publishing locks the
          question count, and a code opened against an empty bank tells the
          participant nothing and records nothing.
        */}
        <div className="border border-slate-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Bank soal</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {entry.testSetId === null
                  ? 'Belum ada soal untuk materi ini.'
                  : entry.questionCount === 0
                    ? 'Belum ada pertanyaan.'
                    : `${entry.questionCount} soal, ${
                        entry.testSetStatus === 'published' ? 'dipublikasikan' : 'masih draf'
                      }.`}
              </p>
            </div>
            <Link
              to={`/ojt/materi/${entry.materiId}/soal`}
              className="shrink-0 border border-slate-900 px-3 py-2 text-xs font-semibold text-slate-900 outline-none transition duration-150 hover:bg-slate-900 hover:text-white focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
            >
              {entry.testSetId === null ? 'Buat soal' : 'Kelola soal'}
            </Link>
          </div>

          {!entry.siapUntukUji && (
            <p className="mt-3 border-l-2 border-amber-500 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Pre-test dan post-test belum bisa dibuat. Soal harus dipublikasikan dan berisi minimal satu
              pertanyaan.
              {entry.sesiTerkunci > 0 &&
                ` ${entry.sesiTerkunci} jawaban sudah terkunci, jadi perubahannya tidak akan memengaruhi jawaban yang sudah masuk.`}
            </p>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold tracking-[0.1em] text-slate-500 uppercase">Kode QR</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {PURPOSES.map((purpose) => {
              /*
                Disabling rather than warning: a pre-test code with no questions
                behind it is worse than no code, because it looks like it works.
              */
              const blocked = purpose.needsQuestions && !entry.siapUntukUji;
              return (
                <button
                  key={purpose.value}
                  type="button"
                  disabled={blocked || !batchOpen || busy !== null}
                  onClick={() => issue(purpose.value)}
                  title={
                    !batchOpen
                      ? 'Batch belum dibuka'
                      : blocked
                        ? 'Soal belum dipublikasikan'
                        : undefined
                  }
                  className="flex items-center justify-between gap-2 border border-slate-300 px-3 py-2.5 text-left text-sm font-semibold text-slate-900 outline-none transition duration-150 hover:border-slate-900 hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 disabled:hover:border-slate-200 disabled:hover:bg-transparent focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                >
                  <span>QR {purpose.label}</span>
                  <span className="text-xs font-normal text-slate-500">
                    {!batchOpen ? 'belum dibuka' : blocked ? 'belum siap' : busy === purpose.value ? '...' : 'buat'}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Kode yang sudah dibuat tetap berlaku sampai dicabut, jadi mencetak ulang tidak mematikan
            kode yang sudah di dinding. Cabut kode lama hanya bila memang ingin dihentikan.
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={busy !== null}
              onClick={revokeAll}
              className="text-xs font-semibold text-red-700 underline underline-offset-4 outline-none transition duration-150 hover:text-red-800 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
            >
              Cabut semua kode materi ini
            </button>
            <span className="text-xs text-slate-500">Empat tujuan sekaligus.</span>
          </div>
        </div>

        {qr && (
          <div className="enter-qr flex flex-wrap items-center gap-4 border border-slate-200 p-4">
            <img
              src={`https://quickchart.io/qr?text=${encodeURIComponent(qr.url)}&size=220`}
              alt={`QR ${qr.purpose}`}
              width={112}
              height={112}
              className="h-28 w-28"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">QR {label}</p>
              <p className="mt-1 text-xs break-all text-slate-500">{qr.url}</p>
            </div>
            <CopyButton value={qr.url} />
          </div>
        )}

        {!qr && entry.pesertaCount === 0 && (
          <EmptyState
            title="Belum ada peserta"
            description="Kode ini tidak bisa dipakai sampai ada peserta di batch."
          />
        )}
      </div>
    </Modal>
  );
};