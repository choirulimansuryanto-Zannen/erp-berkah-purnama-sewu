"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Camera, LogOut, MapPin, RotateCcw, Upload, Video } from "lucide-react";
import { cn } from "@/lib/cn";
import { Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const SHIFTS = ["SHIFT_1", "SHIFT_2", "FULLSHIFT"] as const;
const SHIFT_LABELS: Record<(typeof SHIFTS)[number], string> = {
  SHIFT_1: "Shift 1",
  SHIFT_2: "Shift 2",
  FULLSHIFT: "Fullshift",
};

type RosterOption = { id: string; name: string };
type OpenParticipant = { id: string; name: string; shift: (typeof SHIFTS)[number]; timeIn: string };

type Props = {
  outletLabel: string;
  defaultShift: (typeof SHIFTS)[number];
  /** Roster members with no open check-in today — available to check in now. */
  roster: RosterOption[];
  /** Roster members currently checked in (their own independent session each). */
  openParticipants: OpenParticipant[];
  /** How many pramuniaga this outlet allows checked in at once (default 4). */
  maxParticipants?: number;
};

function liveClock(): string {
  return new Date().toLocaleTimeString("id-ID", { hour12: false }) + " WIB";
}

export function CheckInPanel({ outletLabel, defaultShift, roster, openParticipants, maxParticipants = 4 }: Props) {
  const [pending, startTransition] = useTransition();
  const [checkingOutId, setCheckingOutId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [rosterId, setRosterId] = useState("");
  const [shift, setShift] = useState<(typeof SHIFTS)[number]>(defaultShift);
  // Empty on first (server-rendered) paint — computing a live clock value
  // during SSR would mismatch the client's hydration render by however many
  // seconds elapsed in between. Set for real once mounted, client-side only.
  const [clock, setClock] = useState("");
  const [gps, setGps] = useState<string | undefined>(undefined);
  const [gpsStatus, setGpsStatus] = useState<"loading" | "done" | "unavailable">("loading");
  const [photo, setPhoto] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    queueMicrotask(() => setClock(liveClock()));
    const interval = setInterval(() => setClock(liveClock()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      queueMicrotask(() => setGpsStatus("unavailable"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps(`${pos.coords.latitude.toFixed(6)},${pos.coords.longitude.toFixed(6)}`);
        setGpsStatus("done");
      },
      () => setGpsStatus("unavailable"),
      { timeout: 5000 },
    );
  }, []);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function startWebcam() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStreaming(true);
      setPhoto(null);
    } catch {
      setMessage("Tidak bisa mengakses kamera — coba unggah foto secara manual.");
    }
  }

  function stopWebcam() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStreaming(false);
  }

  function captureOrUpload() {
    if (streaming && videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")?.drawImage(video, 0, 0);
      setPhoto(canvas.toDataURL("image/jpeg", 0.85));
      stopWebcam();
    } else {
      fileInputRef.current?.click();
    }
  }

  function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result as string);
    reader.readAsDataURL(file);
  }

  function handleCheckIn() {
    startTransition(async () => {
      const res = await fetch("/api/attendance/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gps, photoUrl: photo ?? undefined, pramuniagaRosterId: rosterId, shift }),
      });
      const data = await res.json();
      setMessage(res.ok ? "Check-in berhasil." : (data.error ?? "Gagal check-in."));
      if (res.ok) window.location.reload();
    });
  }

  function handleCheckOut(participantId: string) {
    setCheckingOutId(participantId);
    startTransition(async () => {
      const res = await fetch("/api/attendance/check-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gps, pramuniagaRosterId: participantId }),
      });
      const data = await res.json();
      setMessage(res.ok ? "Check-out berhasil." : (data.error ?? "Gagal check-out."));
      if (res.ok) window.location.reload();
      else setCheckingOutId(null);
    });
  }

  const atCap = openParticipants.length >= maxParticipants;
  const canCheckIn = roster.length > 0 && !atCap;
  const canSubmit = Boolean(rosterId) && Boolean(shift) && Boolean(photo) && !pending;

  return (
    <div className="space-y-4">
      {openParticipants.length > 0 && (
        <div className="rounded-xl border border-slate-200/70 bg-white p-5 shadow-[var(--shadow-card)]">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Pramuniaga Bertugas Hari Ini ({openParticipants.length}/{maxParticipants})
          </p>
          <div className="space-y-2">
            {openParticipants.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-emerald-50/70 px-3.5 py-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="font-medium text-slate-800">{p.name}</span>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                    {SHIFT_LABELS[p.shift]}
                  </span>
                  <span className="text-xs text-slate-400">sejak {p.timeIn}</span>
                </div>
                <button
                  onClick={() => handleCheckOut(p.id)}
                  disabled={pending}
                  className="flex items-center gap-1.5 rounded-lg bg-brand-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-800 disabled:opacity-50"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  {pending && checkingOutId === p.id ? "Memproses..." : "Check-out"}
                </button>
              </div>
            ))}
          </div>
          {message && <p className="mt-3 text-center text-sm text-slate-600">{message}</p>}
        </div>
      )}

      {atCap ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Sudah {maxParticipants} pramuniaga check-in pada outlet ini (batas outlet). Hubungi Master Admin jika perlu menaikkan batas.
        </div>
      ) : canCheckIn ? (
        <div className="overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-[var(--shadow-card)]">
          <div className="p-6">
            <p className="mb-4 text-sm font-semibold text-slate-800">
              {openParticipants.length > 0 ? "Tambah Pramuniaga" : "Check-In"}
            </p>
            <div className="relative flex aspect-video max-h-72 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50">
              <span className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-slate-900/80 px-2.5 py-1 text-[11px] font-medium text-white">
                <span className={cn("h-1.5 w-1.5 rounded-full", streaming || photo ? "bg-emerald-400" : "bg-slate-400")} />
                {photo ? "FOTO SIAP" : streaming ? "WEBCAM AKTIF" : "WEBCAM READY"}
              </span>

              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt="Selfie absen masuk" className="h-full w-full rounded-xl object-cover" />
              ) : (
                <>
                  <video ref={videoRef} muted playsInline className={cn("h-full w-full rounded-xl object-cover", !streaming && "hidden")} />
                  {!streaming && (
                    <>
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-200 text-slate-400">
                        <Camera className="h-6 w-6" />
                      </div>
                      <p className="text-sm font-semibold text-slate-800">Selfie Absen Masuk</p>
                      <p className="max-w-xs text-center text-xs text-slate-400">
                        Ambil foto selfie melalui webcam atau unggah foto untuk absen masuk dengan stempel data otomatis.
                      </p>
                    </>
                  )}
                </>
              )}
            </div>
            <canvas ref={canvasRef} className="hidden" />
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileSelected} />

            <div className="mt-4 flex flex-wrap gap-3">
              {photo ? (
                <Button variant="outline" onClick={() => setPhoto(null)}>
                  <RotateCcw className="h-4 w-4" />
                  Ambil Ulang
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={streaming ? stopWebcam : startWebcam}>
                    <Video className="h-4 w-4" />
                    {streaming ? "Matikan Webcam" : "Live Webcam"}
                  </Button>
                  <Button variant="outline" onClick={captureOrUpload}>
                    <Upload className="h-4 w-4" />
                    {streaming ? "Ambil Foto" : "Ambil / Unggah Foto"}
                  </Button>
                </>
              )}
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>Nama Pramuniaga</Label>
                <Select className="mt-1" value={rosterId} onChange={(e) => setRosterId(e.target.value)}>
                  <option value="">Pilih nama pramuniaga</option>
                  {roster.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Shift</Label>
                <Select className="mt-1" value={shift} onChange={(e) => setShift(e.target.value as (typeof SHIFTS)[number])}>
                  {SHIFTS.map((s) => (
                    <option key={s} value={s}>
                      {SHIFT_LABELS[s]}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 rounded-xl bg-amber-50/70 p-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700/70">Outlet Pramuniaga</p>
                <p className="font-medium text-slate-800">{outletLabel}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700/70">Waktu Live</p>
                <p className="font-medium text-slate-800">{clock}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700/70">
                  <MapPin className="h-3 w-3" /> Titik Lokasi (GPS)
                </p>
                <p className="font-medium text-slate-800">
                  {gpsStatus === "loading" && "Mencari lokasi..."}
                  {gpsStatus === "unavailable" && "Lokasi tidak tersedia"}
                  {gpsStatus === "done" && gps}
                </p>
              </div>
            </div>

            <button
              onClick={handleCheckIn}
              disabled={!canSubmit}
              className="mt-5 w-full rounded-xl bg-emerald-600 px-4 py-5 text-lg font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending && !checkingOutId ? "Memproses..." : "CHECK-IN"}
            </button>
            {(!rosterId || !photo) && (
              <p className="mt-2 text-center text-xs text-slate-400">
                {!rosterId ? "Pilih nama pramuniaga" : "Ambil selfie"} untuk mengaktifkan check-in.
              </p>
            )}
            {message && <p className="mt-3 text-center text-sm text-slate-600">{message}</p>}
          </div>
        </div>
      ) : null}
    </div>
  );
}
