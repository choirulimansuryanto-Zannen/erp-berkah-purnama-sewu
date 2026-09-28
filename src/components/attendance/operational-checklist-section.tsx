"use client";

import { Fragment, useMemo, useRef, useState, useTransition } from "react";
import { Check, RotateCcw, Upload, Video } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WebcamModal } from "@/components/attendance/webcam-modal";

type ChecklistItem = { id: string; category: string; subLabel: string };
type Submission = { itemId: string; photoUrl: string };

export function OperationalChecklistSection({
  items,
  initialSubmissions,
  pramuniagaRosterId,
  pramuniagaName,
}: {
  items: ChecklistItem[];
  initialSubmissions: Submission[];
  pramuniagaRosterId: string;
  pramuniagaName: string;
}) {
  const [photos, setPhotos] = useState<Record<string, string>>(
    Object.fromEntries(initialSubmissions.map((s) => [s.itemId, s.photoUrl])),
  );
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set(initialSubmissions.map((s) => s.itemId)));
  const [webcamItemId, setWebcamItemId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, ChecklistItem[]>();
    for (const item of items) {
      const group = map.get(item.category) ?? [];
      group.push(item);
      map.set(item.category, group);
    }
    return Array.from(map.entries());
  }, [items]);

  const filledCount = Object.keys(photos).length;

  function setPhoto(itemId: string, dataUrl: string) {
    setPhotos((prev) => ({ ...prev, [itemId]: dataUrl }));
    setSavedIds((prev) => {
      const next = new Set(prev);
      next.delete(itemId); // unsaved change until "Simpan Perubahan" is clicked
      return next;
    });
  }

  function openUpload(itemId: string) {
    uploadTargetRef.current = itemId;
    fileInputRef.current?.click();
  }

  function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const itemId = uploadTargetRef.current;
    e.target.value = "";
    if (!file || !itemId) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(itemId, reader.result as string);
    reader.readAsDataURL(file);
  }

  function submit() {
    const itemsToSave = Object.entries(photos).map(([itemId, photoUrl]) => ({ itemId, photoUrl }));
    if (itemsToSave.length === 0) return;

    startTransition(async () => {
      const res = await fetch("/api/attendance/checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pramuniagaRosterId, items: itemsToSave }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`Tersimpan: ${data.saved} item.`);
        setSavedIds(new Set(Object.keys(photos)));
      } else {
        setMessage(typeof data.error === "string" ? data.error : "Gagal menyimpan checklist.");
      }
    });
  }

  const activeItem = items.find((i) => i.id === webcamItemId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Checklist Operasional — {pramuniagaName}</CardTitle>
        <span className="ml-auto text-xs font-medium text-slate-400">{filledCount} / {items.length} item terisi</span>
      </CardHeader>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/80 text-left">
            <tr>
              <th className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Aktivitas</th>
              <th className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Status &amp; Opsi Foto</th>
            </tr>
          </thead>
          <tbody>
            {grouped.map(([category, groupItems]) => (
              <Fragment key={category}>
                <tr className="border-t border-slate-100 bg-amber-50/60">
                  <td colSpan={2} className="px-5 py-1.5 text-xs font-bold uppercase tracking-wide text-amber-800">
                    {category}
                  </td>
                </tr>
                {groupItems.map((item) => {
                  const label = item.subLabel || item.category;
                  const photo = photos[item.id];
                  const isSaved = savedIds.has(item.id);
                  return (
                    <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                      <td className="px-5 py-2.5 pl-8 text-slate-700">{label}</td>
                      <td className="px-5 py-2.5">
                        {photo ? (
                          <div className="flex items-center gap-2.5">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={photo} alt={label} className="h-9 w-9 rounded-md object-cover" />
                            <span
                              className={
                                isSaved
                                  ? "flex items-center gap-1 text-xs font-medium text-emerald-600"
                                  : "flex items-center gap-1 text-xs font-medium text-amber-600"
                              }
                            >
                              <Check className="h-3.5 w-3.5" />
                              {isSaved ? "Tersimpan" : "Belum disimpan"}
                            </span>
                            <button
                              onClick={() => setWebcamItemId(item.id)}
                              className="ml-1 flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-50"
                            >
                              <RotateCcw className="h-3 w-3" />
                              Ganti
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              onClick={() => setWebcamItemId(item.id)}
                              className="flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                            >
                              <Video className="h-3.5 w-3.5" />
                              Livecam
                            </button>
                            <button
                              onClick={() => openUpload(item.id)}
                              className="flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                            >
                              <Upload className="h-3.5 w-3.5" />
                              Upload Foto
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileSelected} />

      <div className="flex items-center gap-3 border-t border-slate-100 p-4">
        <Button onClick={submit} disabled={pending || filledCount === 0}>
          {pending ? "Menyimpan..." : "SIMPAN PERUBAHAN"}
        </Button>
        {message && <p className="text-sm text-slate-600">{message}</p>}
      </div>

      {activeItem && (
        <WebcamModal
          title={activeItem.subLabel || activeItem.category}
          onClose={() => setWebcamItemId(null)}
          onCapture={(dataUrl) => {
            setPhoto(activeItem.id, dataUrl);
            setWebcamItemId(null);
          }}
        />
      )}
    </Card>
  );
}
