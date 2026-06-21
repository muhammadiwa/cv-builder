import { useEffect, useRef, useState } from 'react';
import {
  Check, X, Loader2, Save, Pencil, Trash2, ChevronDown, ChevronRight, Plus,
} from 'lucide-react';

export {
  SkillsSection, ExperienceSection, EducationSection, ProjectsSection,
};

// ── Section shapes (mirrored from lib/api.ts ProfileData) ──────────
type SkillEntry = { name: string; level?: string; keywords: string[] };
type WorkEntry = {
  name: string; position: string; location?: string; description?: string;
  startDate?: string; endDate?: string | null; highlights?: string[];
};
type EduEntry = {
  institution: string; area?: string; studyType?: string;
  startDate?: string; endDate?: string;
};
type ProjectEntry = { name: string; description?: string; highlights?: string[] };

// ── Edit / Save / Cancel button group (shared) ────────────────────
function EditSaveCancelGroup({
  editing, dirty, saving, justSaved, onEdit, onSave, onCancel,
}: {
  editing: boolean; dirty: boolean; saving: boolean; justSaved: boolean;
  onEdit: () => void; onSave: () => void; onCancel: () => void;
}) {
  if (justSaved) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[12px] font-semibold rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
        <Check size={12} /> Saved
      </span>
    );
  }
  if (editing && dirty) {
    return (
      <div className="flex items-center gap-1.5">
        <button
          type="button" onClick={onCancel} disabled={saving}
          className="inline-flex items-center gap-1 px-2 py-1 text-[12px] font-medium border border-slate-200 text-slate-700 bg-white rounded hover:border-slate-300 transition-colors disabled:opacity-50"
        >
          <X size={12} /> Cancel
        </button>
        <button
          type="button" onClick={onSave} disabled={saving}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-[12px] font-semibold bg-brand-600 text-white rounded hover:bg-brand-700 transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
          Save
        </button>
      </div>
    );
  }
  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <button
          type="button" onClick={onCancel} disabled={saving}
          className="inline-flex items-center gap-1 px-2 py-1 text-[12px] font-medium border border-slate-200 text-slate-700 bg-white rounded hover:border-slate-300 transition-colors disabled:opacity-50"
        >
          <X size={12} /> Cancel
        </button>
        <span className="text-[11px] text-slate-500 italic">no changes</span>
      </div>
    );
  }
  return (
    <button
      type="button" onClick={onEdit}
      className="inline-flex items-center gap-1 px-2.5 py-1 text-[12px] font-medium border border-slate-200 text-slate-700 bg-white rounded hover:border-slate-300 transition-colors"
    >
      <Pencil size={12} /> Edit
    </button>
  );
}

// ── Generic section wrapper ────────────────────────────────────────
function SectionShell({
  title, open, onToggle, headerAction, children,
}: {
  title: string; open: boolean; onToggle: () => void;
  headerAction: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section className="card card-pad">
      <div className="flex items-center justify-between gap-3 mb-4">
        <button
          onClick={onToggle}
          className="flex items-center gap-2 text-left flex-1 min-w-0"
        >
          <h3 className="section-title mb-0">{title}</h3>
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <div className="shrink-0">{headerAction}</div>
      </div>
      {open && <div className="space-y-4">{children}</div>}
    </section>
  );
}

// ── useSectionEditor hook ──────────────────────────────────────────
function useSectionEditor<T>(initial: T[]) {
  const [editing, setEditing] = useState(false);
  const [items, setItems] = useState<T[]>(initial);
  const [snapshot, setSnapshot] = useState<T[]>(initial);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Re-sync when BE state arrives (e.g. re-upload). Don't touch
  // items while user is actively editing.
  useEffect(() => {
    if (!editing) {
      setItems(initial);
      setSnapshot(initial);
    }
  }, [initial, editing]);

  useEffect(
    () => () => { if (timerRef.current) clearTimeout(timerRef.current); },
    [],
  );

  const dirty = JSON.stringify(items) !== JSON.stringify(snapshot);

  const startEdit = () => {
    setSnapshot(items);
    setEditing(true);
  };

  const cancel = () => {
    setItems(snapshot);
    setEditing(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    setJustSaved(false);
  };

  const save = async (onSave: (items: T[]) => Promise<void> | void) => {
    setSaving(true);
    try {
      await onSave(items);
      setSnapshot(items);
      setEditing(false);
      setJustSaved(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setJustSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  return {
    editing, setEditing, items, setItems, snapshot, dirty, saving, justSaved,
    startEdit, cancel, save,
  };
}

// ── Skills section editor ───────────────────────────────────────────
function SkillsSection({
  title, open, onToggle, initial, onSave, saving: parentSaving,
}: {
  title: string; open: boolean; onToggle: () => void;
  initial: SkillEntry[];
  onSave: (items: SkillEntry[]) => Promise<void> | void;
  saving?: boolean;
}) {
  const ed = useSectionEditor<SkillEntry>(initial);
  const [newKw, setNewKw] = useState<Record<number, string>>({});

  const addCategory = () => ed.setItems((prev) => [
    ...prev, { name: 'New category', level: undefined, keywords: [] },
  ]);
  const removeCategory = (i: number) => ed.setItems((prev) => prev.filter((_, idx) => idx !== i));
  const updateCategory = (i: number, patch: Partial<SkillEntry>) =>
    ed.setItems((prev) => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s));

  const addKeyword = (i: number) => {
    const kw = (newKw[i] ?? '').trim();
    if (!kw) return;
    ed.setItems((prev) => prev.map((s, idx) => {
      if (idx !== i) return s;
      if (s.keywords.includes(kw)) return s;
      return { ...s, keywords: [...s.keywords, kw] };
    }));
    setNewKw((prev) => ({ ...prev, [i]: '' }));
  };
  const removeKeyword = (i: number, k: string) =>
    ed.setItems((prev) => prev.map((s, idx) =>
      idx === i ? { ...s, keywords: s.keywords.filter((kw) => kw !== k) } : s,
    ));

  return (
    <SectionShell
      title={title} open={open} onToggle={onToggle}
      headerAction={
        <EditSaveCancelGroup
          editing={ed.editing} dirty={ed.dirty}
          saving={ed.saving || !!parentSaving} justSaved={ed.justSaved}
          onEdit={ed.startEdit} onSave={() => ed.save(onSave)} onCancel={ed.cancel}
        />
      }
    >
      {!ed.editing ? (
        ed.items.length === 0 ? (
          <div className="text-xs text-slate-500 italic">No skills extracted yet.</div>
        ) : (
          <div className="space-y-3">
            {ed.items.map((s, i) => (
              <div key={i}>
                <div className="flex items-baseline justify-between mb-1.5">
                  <div className="text-xs font-medium text-slate-700">{s.name}</div>
                  {s.level && <div className="text-xs text-slate-500">{s.level}</div>}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {s.keywords.map((k) => (
                    <span key={k} className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs">{k}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="space-y-3">
          {ed.items.map((s, i) => (
            <div key={i} className="border border-slate-200 rounded-lg p-3 bg-slate-50/30">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-2 gap-2">
                  <input className="input" value={s.name} onChange={(e) => updateCategory(i, { name: e.target.value })} placeholder="Category name" />
                  <select className="input" value={s.level ?? ''} onChange={(e) => updateCategory(i, { level: e.target.value || undefined })}>
                    <option value="">No level</option>
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                    <option value="Mastered">Mastered</option>
                  </select>
                </div>
                <button type="button" onClick={() => removeCategory(i)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded shrink-0" title="Remove category">
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {s.keywords.map((k) => (
                  <span key={k} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 text-xs">
                    {k}
                    <button type="button" onClick={() => removeKeyword(i, k)} className="text-slate-400 hover:text-red-600" title="Remove keyword">×</button>
                  </span>
                ))}
                <input
                  type="text"
                  value={newKw[i] ?? ''}
                  onChange={(e) => setNewKw((prev) => ({ ...prev, [i]: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addKeyword(i); } }}
                  placeholder="Add keyword + Enter"
                  className="px-2 py-0.5 text-[12px] border border-dashed border-slate-300 rounded bg-white w-40 focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>
          ))}
          <button
            type="button" onClick={addCategory}
            className="w-full py-2 text-[12px] font-medium border border-dashed border-slate-300 text-slate-600 rounded-md hover:border-brand-400 hover:text-brand-700 hover:bg-brand-50/30 transition-colors flex items-center justify-center gap-1"
          >
            <Plus size={12} /> Add category
          </button>
        </div>
      )}
    </SectionShell>
  );
}

// ── Experience section editor ──────────────────────────────────────
function ExperienceSection({
  title, open, onToggle, initial, onSave, saving: parentSaving,
}: {
  title: string; open: boolean; onToggle: () => void;
  initial: WorkEntry[];
  onSave: (items: WorkEntry[]) => Promise<void> | void;
  saving?: boolean;
}) {
  const ed = useSectionEditor<WorkEntry>(initial);
  const [newHi, setNewHi] = useState<Record<number, string>>({});

  const addWork = () => ed.setItems((prev) => [
    ...prev, {
      name: 'Company', position: 'Role', location: undefined,
      description: undefined, startDate: undefined, endDate: undefined, highlights: [],
    },
  ]);
  const updateWork = (i: number, patch: Partial<WorkEntry>) =>
    ed.setItems((prev) => prev.map((w, idx) => idx === i ? { ...w, ...patch } : w));
  const removeWork = (i: number) => ed.setItems((prev) => prev.filter((_, idx) => idx !== i));
  const addHighlight = (i: number) => {
    const h = (newHi[i] ?? '').trim();
    if (!h) return;
    ed.setItems((prev) => prev.map((w, idx) => {
      if (idx !== i) return w;
      const highlights = w.highlights ?? [];
      if (highlights.includes(h)) return w;
      return { ...w, highlights: [...highlights, h] };
    }));
    setNewHi((prev) => ({ ...prev, [i]: '' }));
  };
  const removeHighlight = (i: number, h: string) =>
    ed.setItems((prev) => prev.map((w, idx) =>
      idx === i ? { ...w, highlights: (w.highlights ?? []).filter((x) => x !== h) } : w,
    ));

  return (
    <SectionShell
      title={title} open={open} onToggle={onToggle}
      headerAction={
        <EditSaveCancelGroup
          editing={ed.editing} dirty={ed.dirty}
          saving={ed.saving || !!parentSaving} justSaved={ed.justSaved}
          onEdit={ed.startEdit} onSave={() => ed.save(onSave)} onCancel={ed.cancel}
        />
      }
    >
      {!ed.editing ? (
        ed.items.length === 0 ? (
          <div className="text-xs text-slate-500 italic">No experience extracted yet.</div>
        ) : (
          <div className="space-y-4">
            {ed.items.map((w, i) => (
              <div key={i} className="border-l-2 border-brand-200 pl-3">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="font-medium text-sm text-slate-900">
                    {w.position} · {w.name}
                  </div>
                  <div className="text-xs text-slate-500 tabular-nums shrink-0">
                    {w.startDate ?? '?'} — {w.endDate ?? 'Present'}
                  </div>
                </div>
                {w.location && <div className="text-xs text-slate-500 mt-0.5">{w.location}</div>}
                {w.highlights && w.highlights.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs text-slate-700">
                    {w.highlights.map((h, j) => (
                      <li key={j} className="leading-relaxed">· {h}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="space-y-3">
          {ed.items.map((w, i) => (
            <div key={i} className="border border-slate-200 rounded-lg p-3 bg-slate-50/30">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-2 gap-2">
                  <input className="input" value={w.name} onChange={(e) => updateWork(i, { name: e.target.value })} placeholder="Company" />
                  <input className="input" value={w.position} onChange={(e) => updateWork(i, { position: e.target.value })} placeholder="Role" />
                  <input className="input" value={w.location ?? ''} onChange={(e) => updateWork(i, { location: e.target.value || undefined })} placeholder="Location" />
                  <input className="input" value={w.startDate ?? ''} onChange={(e) => updateWork(i, { startDate: e.target.value || undefined })} placeholder="Start (e.g. 2024-01)" />
                  <input className="input" value={w.endDate ?? ''} onChange={(e) => updateWork(i, { endDate: e.target.value || undefined })} placeholder="End (empty = Present)" />
                </div>
                <button type="button" onClick={() => removeWork(i)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded shrink-0" title="Remove experience">
                  <Trash2 size={14} />
                </button>
              </div>
              <textarea
                className="input min-h-[60px] mt-2 resize-y"
                value={w.description ?? ''}
                onChange={(e) => updateWork(i, { description: e.target.value || undefined })}
                placeholder="Description (1-2 sentences)"
              />
              <div className="mt-2">
                <div className="text-[11px] text-slate-500 mb-1.5 font-medium">Highlights</div>
                <ul className="space-y-1">
                  {(w.highlights ?? []).map((h, j) => (
                    <li key={j} className="flex items-start gap-2">
                      <span className="text-slate-400 mt-1.5 text-xs shrink-0">·</span>
                      <span className="flex-1 text-xs text-slate-700 leading-relaxed">{h}</span>
                      <button type="button" onClick={() => removeHighlight(i, h)} className="p-0.5 text-slate-400 hover:text-red-600 shrink-0" title="Remove highlight">
                        <X size={12} />
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center gap-1.5 mt-2">
                  <input
                    type="text"
                    value={newHi[i] ?? ''}
                    onChange={(e) => setNewHi((prev) => ({ ...prev, [i]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addHighlight(i); } }}
                    placeholder="Add highlight + Enter"
                    className="input flex-1 text-xs"
                  />
                  <button type="button" onClick={() => addHighlight(i)} className="btn btn-secondary text-xs">
                    <Plus size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          <button
            type="button" onClick={addWork}
            className="w-full py-2 text-[12px] font-medium border border-dashed border-slate-300 text-slate-600 rounded-md hover:border-brand-400 hover:text-brand-700 hover:bg-brand-50/30 transition-colors flex items-center justify-center gap-1"
          >
            <Plus size={12} /> Add experience
          </button>
        </div>
      )}
    </SectionShell>
  );
}

// ── Education section editor ───────────────────────────────────────
function EducationSection({
  title, open, onToggle, initial, onSave, saving: parentSaving,
}: {
  title: string; open: boolean; onToggle: () => void;
  initial: EduEntry[];
  onSave: (items: EduEntry[]) => Promise<void> | void;
  saving?: boolean;
}) {
  const ed = useSectionEditor<EduEntry>(initial);

  const addEdu = () => ed.setItems((prev) => [
    ...prev, { institution: 'Institution', area: undefined, studyType: undefined, endDate: undefined },
  ]);
  const updateEdu = (i: number, patch: Partial<EduEntry>) =>
    ed.setItems((prev) => prev.map((e, idx) => idx === i ? { ...e, ...patch } : e));
  const removeEdu = (i: number) => ed.setItems((prev) => prev.filter((_, idx) => idx !== i));

  return (
    <SectionShell
      title={title} open={open} onToggle={onToggle}
      headerAction={
        <EditSaveCancelGroup
          editing={ed.editing} dirty={ed.dirty}
          saving={ed.saving || !!parentSaving} justSaved={ed.justSaved}
          onEdit={ed.startEdit} onSave={() => ed.save(onSave)} onCancel={ed.cancel}
        />
      }
    >
      {!ed.editing ? (
        <div className="space-y-2">
          {ed.items.map((e, i) => (
            <div key={i} className="flex items-baseline justify-between">
              <div className="text-sm text-slate-900">
                {e.studyType && `${e.studyType}, `}
                {e.institution}
                {e.area && ` · ${e.area}`}
              </div>
              {e.endDate && <div className="text-xs text-slate-500">{e.endDate}</div>}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {ed.items.map((e, i) => (
            <div key={i} className="border border-slate-200 rounded-lg p-3 bg-slate-50/30 flex items-start gap-2">
              <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-2 gap-2">
                <input className="input" value={e.institution} onChange={(ev) => updateEdu(i, { institution: ev.target.value })} placeholder="Institution" />
                <input className="input" value={e.area ?? ''} onChange={(ev) => updateEdu(i, { area: ev.target.value || undefined })} placeholder="Area (e.g. Computer Science)" />
                <input className="input" value={e.studyType ?? ''} onChange={(ev) => updateEdu(i, { studyType: ev.target.value || undefined })} placeholder="Degree (e.g. Bachelor)" />
                <input className="input" value={e.endDate ?? ''} onChange={(ev) => updateEdu(i, { endDate: ev.target.value || undefined })} placeholder="End year (e.g. 2024)" />
              </div>
              <button type="button" onClick={() => removeEdu(i)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded shrink-0" title="Remove education">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button
            type="button" onClick={addEdu}
            className="w-full py-2 text-[12px] font-medium border border-dashed border-slate-300 text-slate-600 rounded-md hover:border-brand-400 hover:text-brand-700 hover:bg-brand-50/30 transition-colors flex items-center justify-center gap-1"
          >
            <Plus size={12} /> Add education
          </button>
        </div>
      )}
    </SectionShell>
  );
}

// ── Projects section editor ────────────────────────────────────────
function ProjectsSection({
  title, open, onToggle, initial, onSave, saving: parentSaving,
}: {
  title: string; open: boolean; onToggle: () => void;
  initial: ProjectEntry[];
  onSave: (items: ProjectEntry[]) => Promise<void> | void;
  saving?: boolean;
}) {
  const ed = useSectionEditor<ProjectEntry>(initial);
  const [newHi, setNewHi] = useState<Record<number, string>>({});

  const addProj = () => ed.setItems((prev) => [
    ...prev, { name: 'Project name', description: undefined, highlights: [] },
  ]);
  const updateProj = (i: number, patch: Partial<ProjectEntry>) =>
    ed.setItems((prev) => prev.map((p, idx) => idx === i ? { ...p, ...patch } : p));
  const removeProj = (i: number) => ed.setItems((prev) => prev.filter((_, idx) => idx !== i));
  const addHighlight = (i: number) => {
    const h = (newHi[i] ?? '').trim();
    if (!h) return;
    ed.setItems((prev) => prev.map((p, idx) => {
      if (idx !== i) return p;
      const highlights = p.highlights ?? [];
      if (highlights.includes(h)) return p;
      return { ...p, highlights: [...highlights, h] };
    }));
    setNewHi((prev) => ({ ...prev, [i]: '' }));
  };
  const removeHighlight = (i: number, h: string) =>
    ed.setItems((prev) => prev.map((p, idx) =>
      idx === i ? { ...p, highlights: (p.highlights ?? []).filter((x) => x !== h) } : p,
    ));

  return (
    <SectionShell
      title={title} open={open} onToggle={onToggle}
      headerAction={
        <EditSaveCancelGroup
          editing={ed.editing} dirty={ed.dirty}
          saving={ed.saving || !!parentSaving} justSaved={ed.justSaved}
          onEdit={ed.startEdit} onSave={() => ed.save(onSave)} onCancel={ed.cancel}
        />
      }
    >
      {!ed.editing ? (
        <div className="space-y-3">
          {ed.items.map((p, i) => (
            <div key={i}>
              <div className="text-sm font-medium text-slate-900">{p.name}</div>
              {p.description && <div className="text-xs text-slate-600 mt-1">{p.description}</div>}
              {p.highlights && p.highlights.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-xs text-slate-700">
                  {p.highlights.map((h, j) => (<li key={j}>· {h}</li>))}
                </ul>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {ed.items.map((p, i) => (
            <div key={i} className="border border-slate-200 rounded-lg p-3 bg-slate-50/30">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0 space-y-2">
                  <input className="input" value={p.name} onChange={(e) => updateProj(i, { name: e.target.value })} placeholder="Project name" />
                  <textarea className="input min-h-[60px] resize-y" value={p.description ?? ''} onChange={(e) => updateProj(i, { description: e.target.value || undefined })} placeholder="Description" />
                </div>
                <button type="button" onClick={() => removeProj(i)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded shrink-0" title="Remove project">
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="mt-2">
                <div className="text-[11px] text-slate-500 mb-1.5 font-medium">Highlights</div>
                <ul className="space-y-1">
                  {(p.highlights ?? []).map((h, j) => (
                    <li key={j} className="flex items-start gap-2">
                      <span className="text-slate-400 mt-1.5 text-xs shrink-0">·</span>
                      <span className="flex-1 text-xs text-slate-700 leading-relaxed">{h}</span>
                      <button type="button" onClick={() => removeHighlight(i, h)} className="p-0.5 text-slate-400 hover:text-red-600 shrink-0" title="Remove highlight">
                        <X size={12} />
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center gap-1.5 mt-2">
                  <input
                    type="text"
                    value={newHi[i] ?? ''}
                    onChange={(e) => setNewHi((prev) => ({ ...prev, [i]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addHighlight(i); } }}
                    placeholder="Add highlight + Enter"
                    className="input flex-1 text-xs"
                  />
                  <button type="button" onClick={() => addHighlight(i)} className="btn btn-secondary text-xs">
                    <Plus size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          <button
            type="button" onClick={addProj}
            className="w-full py-2 text-[12px] font-medium border border-dashed border-slate-300 text-slate-600 rounded-md hover:border-brand-400 hover:text-brand-700 hover:bg-brand-50/30 transition-colors flex items-center justify-center gap-1"
          >
            <Plus size={12} /> Add project
          </button>
        </div>
      )}
    </SectionShell>
  );
}
