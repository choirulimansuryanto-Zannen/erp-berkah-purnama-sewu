"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  title: string;
  onClose: () => void;
  onCapture: (dataUrl: string) => void;
};

export function WebcamModal({ title, onClose, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      })
      .catch(() => onClose());
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function capture() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    onCapture(canvas.toDataURL("image/jpeg", 0.8));
  }

  // Portal to document.body — a fixed-position modal nested inside
  // AppShell's animated <main> wrapper (animate-fade-in-up, which applies a
  // CSS transform) would otherwise compute "fixed" relative to that
  // transformed ancestor instead of the viewport, landing off-screen on any
  // page tall enough for the offset to matter.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-brand-900">{title}</p>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="aspect-video overflow-hidden rounded-lg bg-slate-900">
          <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
        </div>
        <canvas ref={canvasRef} className="hidden" />
        <Button onClick={capture} className="mt-3 w-full">
          <Camera className="h-4 w-4" />
          Ambil Foto
        </Button>
      </div>
    </div>,
    document.body,
  );
}
