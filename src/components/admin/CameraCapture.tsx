"use client";

/**
 * Full-screen live camera for the Onsite Estimator.
 *
 * Opens the device camera with getUserMedia (rear camera by default), shows a
 * live preview, and lets you snap several job-site photos in a row without
 * leaving the page. Each shot is drawn from the video frame to a downscaled
 * JPEG data URL — no EXIF-orientation headaches, small payloads.
 *
 * Falls back gracefully: if the browser blocks or lacks getUserMedia, the
 * caller can wire `onUseSystemCamera` to the native <input capture> picker.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Check, RefreshCw, X, ImageOff } from "lucide-react";

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;

interface CameraCaptureProps {
  /** How many more photos can still be added (composer cap minus current). */
  remaining: number;
  onCapture: (dataUrls: string[]) => void;
  onClose: () => void;
  /** Optional fallback to the OS camera/file picker when live camera fails. */
  onUseSystemCamera?: () => void;
}

export default function CameraCapture({
  remaining,
  onCapture,
  onClose,
  onUseSystemCamera,
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [shots, setShots] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [flash, setFlash] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // (Re)start the stream whenever the facing mode changes.
  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setError(null);

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("This browser can't open the live camera.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setReady(true);
      } catch (err) {
        const name = (err as Error)?.name;
        setError(
          name === "NotAllowedError"
            ? "Camera permission denied. Allow camera access in your browser settings."
            : name === "NotFoundError"
              ? "No camera found on this device."
              : "Couldn't start the camera."
        );
      }
    }

    void start();
    return () => {
      cancelled = true;
      stop();
    };
  }, [facing, stop]);

  // Lock body scroll while the camera is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const atCap = shots.length >= remaining;

  const snap = useCallback(() => {
    const video = videoRef.current;
    if (!video || !ready || atCap) return;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return;
    const scale = Math.min(1, MAX_DIMENSION / Math.max(vw, vh));
    const w = Math.round(vw * scale);
    const h = Math.round(vh * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    setShots((prev) => [...prev, dataUrl]);
    setFlash(true);
    window.setTimeout(() => setFlash(false), 120);
  }, [ready, atCap]);

  const confirm = () => {
    if (shots.length === 0) {
      onClose();
      return;
    }
    onCapture(shots);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col">
      {/* Live preview */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Shutter flash */}
        {flash ? <div className="absolute inset-0 bg-white/70 animate-fade-in" /> : null}

        {/* Top bar */}
        <div className="absolute top-0 inset-x-0 flex items-center justify-between p-4 bg-gradient-to-b from-black/70 to-transparent">
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 rounded-full bg-black/50 backdrop-blur grid place-items-center text-white"
            aria-label="Close camera"
          >
            <X className="w-5 h-5" />
          </button>
          <span className="text-xs font-mono uppercase tracking-widest text-white/90 bg-black/40 rounded-full px-3 py-1.5">
            {remaining > 0 ? `${shots.length}/${remaining} photos` : "Limit reached"}
          </span>
          <button
            type="button"
            onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
            className="w-11 h-11 rounded-full bg-black/50 backdrop-blur grid place-items-center text-white"
            aria-label="Switch camera"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        {/* Error / fallback overlay */}
        {error ? (
          <div className="absolute inset-0 grid place-items-center bg-black/85 p-6 text-center">
            <div className="max-w-xs space-y-4">
              <ImageOff className="w-10 h-10 text-brand-gold mx-auto" />
              <p className="text-sm text-white/90">{error}</p>
              <div className="flex flex-col gap-2">
                {onUseSystemCamera ? (
                  <button
                    type="button"
                    onClick={() => {
                      onUseSystemCamera();
                      onClose();
                    }}
                    className="px-4 py-2.5 rounded-xl bg-brand-gold text-brand-black text-sm font-semibold"
                  >
                    Use phone camera instead
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-white/20 text-white text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Captured strip */}
      {shots.length > 0 ? (
        <div className="bg-black px-3 py-2 flex gap-2 overflow-x-auto shrink-0">
          {shots.map((src, i) => (
            <div key={i} className="relative shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`Shot ${i + 1}`}
                className="h-16 w-16 object-cover rounded-lg border border-white/15"
              />
              <button
                type="button"
                onClick={() => setShots((prev) => prev.filter((_, j) => j !== i))}
                className="absolute -top-1.5 -right-1.5 bg-black border border-white/20 rounded-full p-0.5 text-white/80"
                aria-label={`Remove shot ${i + 1}`}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {/* Controls */}
      <div className="bg-black shrink-0 px-6 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] flex items-center justify-between gap-4">
        <div className="w-16 text-left">
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-white/70 hover:text-white"
          >
            Cancel
          </button>
        </div>

        <button
          type="button"
          onClick={snap}
          disabled={!ready || atCap || !!error}
          className="w-[72px] h-[72px] rounded-full bg-white disabled:opacity-40 grid place-items-center ring-4 ring-white/30 active:scale-95 transition-transform"
          aria-label="Take photo"
        >
          <Camera className="w-7 h-7 text-black" />
        </button>

        <div className="w-16 flex justify-end">
          <button
            type="button"
            onClick={confirm}
            disabled={shots.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-gold text-brand-black text-sm font-semibold disabled:opacity-40"
          >
            <Check className="w-4 h-4" />
            {shots.length > 0 ? shots.length : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
