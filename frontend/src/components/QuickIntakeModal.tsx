import { useEffect, useRef, useState } from 'react';
import { api } from '../api/endpoints';
import type { Runner } from '../api/types';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const CURRENCIES = ['EUR', 'GBP', 'NGN', 'KES'];
const GRADES = ['A', 'B', 'C', 'Ungraded'];

export function QuickIntakeModal({ open, onClose, onCreated }: Props) {
  const [runners, setRunners] = useState<Runner[]>([]);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [grade, setGrade] = useState('A');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [runnerId, setRunnerId] = useState('');
  const [newRunner, setNewRunner] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      api.runners.list().then((r) => setRunners(r.data)).catch(() => setRunners([]));
    }
  }, [open]);

  function reset() {
    setPhoto(null);
    setPreview(null);
    setBrand('');
    setModel('');
    setGrade('A');
    setPrice('');
    setCurrency('EUR');
    setRunnerId('');
    setNewRunner('');
    setNotes('');
    setError(null);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setPhoto(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function submit() {
    setError(null);
    if (!brand.trim() || !model.trim()) return setError('Brand and model are required');
    if (!price || Number(price) < 0) return setError('Enter a valid purchase price');
    setSubmitting(true);
    try {
      const form = new FormData();
      form.set('brand', brand.trim());
      form.set('model', model.trim());
      form.set('grade', grade);
      form.set('purchasePrice', price);
      form.set('purchaseCurrency', currency);
      if (notes.trim()) form.set('notes', notes.trim());
      if (runnerId) form.set('runnerId', runnerId);
      else if (newRunner.trim()) form.set('runnerName', newRunner.trim());
      if (photo) form.set('photo', photo);
      await api.items.create(form);
      reset();
      onCreated();
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Failed to save item');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-edge bg-card p-5 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-100">Quick Intake</h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-200">
            ✕
          </button>
        </div>

        {/* Photo */}
        <div className="mb-4">
          <div className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-edge bg-black/30 text-neutral-500">
            {preview ? (
              <img src={preview} alt="preview" className="h-full w-full object-cover" />
            ) : (
              <span className="text-sm">📷 Add a photo</span>
            )}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className="rounded-lg border border-edge bg-black/20 py-2 text-sm text-neutral-300 transition hover:border-neutral-600"
            >
              📷 {preview ? 'Retake photo' : 'Take photo'}
            </button>
            <button
              type="button"
              onClick={() => galleryRef.current?.click()}
              className="rounded-lg border border-edge bg-black/20 py-2 text-sm text-neutral-300 transition hover:border-neutral-600"
            >
              🖼️ {preview ? 'Change' : 'Choose from gallery'}
            </button>
          </div>
        </div>
        {/* Camera capture (opens camera directly on mobile) */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onFile}
          className="hidden"
        />
        {/* Gallery / file picker (no capture → opens photo library or files) */}
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          onChange={onFile}
          className="hidden"
        />

        {/* Brand / Model */}
        <div className="grid grid-cols-2 gap-2">
          <Field label="Brand">
            <input
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              list="brand-list"
              className="input"
              placeholder="Louis Vuitton"
            />
          </Field>
          <Field label="Model">
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="input"
              placeholder="Neverfull MM"
            />
          </Field>
        </div>

        {/* Grade chips */}
        <Field label="Grade">
          <div className="flex gap-2">
            {GRADES.map((g) => (
              <Chip key={g} active={grade === g} onClick={() => setGrade(g)}>
                {g}
              </Chip>
            ))}
          </div>
        </Field>

        {/* Price + currency */}
        <Field label="Purchase price">
          <div className="flex gap-2">
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              inputMode="decimal"
              className="input flex-1"
              placeholder="0.00"
            />
            <div className="flex gap-1">
              {CURRENCIES.map((c) => (
                <Chip key={c} active={currency === c} onClick={() => setCurrency(c)}>
                  {c}
                </Chip>
              ))}
            </div>
          </div>
        </Field>

        {/* Runner */}
        <Field label="Runner">
          <select
            value={runnerId}
            onChange={(e) => setRunnerId(e.target.value)}
            className="input mb-2"
          >
            <option value="">— select existing —</option>
            {runners.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.location})
              </option>
            ))}
          </select>
          {!runnerId && (
            <input
              value={newRunner}
              onChange={(e) => setNewRunner(e.target.value)}
              className="input"
              placeholder="…or type a new runner name"
            />
          )}
        </Field>

        {/* Notes */}
        <Field label="Notes (optional)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="input resize-none"
            placeholder="Anything to remember…"
          />
        </Field>

        {error && <p className="mb-2 text-sm text-red-400">{error}</p>}

        <button
          onClick={submit}
          disabled={submitting}
          className="mt-1 w-full rounded-xl bg-gold py-3 font-semibold text-black transition hover:brightness-110 disabled:opacity-50"
        >
          {submitting ? 'Saving…' : 'Add to Future Stock'}
        </button>

        <datalist id="brand-list">
          {[...new Set(runners.map(() => ''))].map((b, i) => (
            <option key={i} value={b} />
          ))}
        </datalist>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-xs font-medium text-neutral-400">{label}</span>
      {children}
    </label>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-sm transition ${
        active
          ? 'border-gold bg-gold/20 text-gold'
          : 'border-edge bg-black/20 text-neutral-400 hover:border-neutral-600'
      }`}
    >
      {children}
    </button>
  );
}
