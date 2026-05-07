"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, RefreshCw, Check, AlertTriangle, Loader2, ScanFace, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type ChallengeConfig,
  getRegistrationChallenges,
  getAttendanceChallenges,
  checkChallenge,
} from "@/lib/livenessDetection";

interface FaceLandmark { x: number; y: number; z: number }
interface BlendshapeCategory { categoryName: string; score: number }
interface LandmarkerResult {
  faceLandmarks: FaceLandmark[][];
  faceBlendshapes?: { categories: BlendshapeCategory[] }[];
}

interface FaceDetectorProps {
  onCapture: (photoBase64: string, matchScore?: number) => void;
  onClose: () => void;
  mode: "register" | "attendance";
  registeredFaceUrl?: string | null;
  minConfidence?: number;
}

type Status =
  | "loading" | "ready" | "no-face" | "detected"
  | "liveness" | "liveness-done"
  | "captured" | "comparing" | "matched" | "failed" | "error";

export default function FaceDetector({
  onCapture, onClose, mode, registeredFaceUrl, minConfidence = 0.5,
}: FaceDetectorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<unknown>(null);
  const animFrameRef = useRef<number>(0);
  const capturedRef = useRef(false);

  // ── Use REFS for detection loop state (avoids stale closure bug) ──
  const challengesRef = useRef<ChallengeConfig[]>([]);
  const currentIdxRef = useRef(0);
  const completedRef = useRef<boolean[]>([]);
  const actionStartRef = useRef(0);
  const livenessStartedRef = useRef(false);
  const faceStableStartRef = useRef(0);

  // ── UI state (triggers re-renders) ──
  const [status, setStatus] = useState<Status>("loading");
  const [statusMessage, setStatusMessage] = useState("Memuat model...");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [matchScore, setMatchScore] = useState<number | null>(null);
  const [challengeProgress, setChallengeProgress] = useState(0);
  const [debugInfo, setDebugInfo] = useState("");
  const [, forceRender] = useState(0); // force re-render for challenge UI

  // ── Initialize ──
  const initialize = useCallback(async () => {
    try {
      capturedRef.current = false;
      setStatus("loading");
      setStatusMessage("Memuat model deteksi wajah...");

      const vision = await import("@mediapipe/tasks-vision");
      const { FaceLandmarker, FilesetResolver } = vision;
      const wasmFileset = await FilesetResolver.forVisionTasks("/wasm");

      let landmarker;
      const opts = {
        baseOptions: { modelAssetPath: "/models/mediapipe/face_landmarker.task", delegate: "GPU" as const },
        runningMode: "VIDEO" as const,
        numFaces: 1,
        minFaceDetectionConfidence: minConfidence,
        minTrackingConfidence: minConfidence,
        outputFaceBlendshapes: true,
      };

      try {
        landmarker = await FaceLandmarker.createFromOptions(wasmFileset, opts);
      } catch {
        setStatusMessage("GPU tidak tersedia, menggunakan CPU...");
        landmarker = await FaceLandmarker.createFromOptions(wasmFileset, {
          ...opts, baseOptions: { ...opts.baseOptions, delegate: "CPU" as const },
        });
      }
      landmarkerRef.current = landmarker;

      setStatusMessage("Mengakses kamera...");
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        const video = videoRef.current;
        video.srcObject = stream; video.muted = true; video.playsInline = true; video.autoplay = true;
        await new Promise<void>((resolve) => {
          const check = () => { if (video.readyState >= 2) resolve(); };
          check();
          video.addEventListener("loadedmetadata", check);
          video.addEventListener("canplay", check);
          setTimeout(resolve, 5000);
        });
        try { await video.play(); } catch { /* ok */ }
      }

      // Prepare challenges
      const challs = mode === "register" ? getRegistrationChallenges() : getAttendanceChallenges();
      challengesRef.current = challs;
      currentIdxRef.current = 0;
      completedRef.current = new Array(challs.length).fill(false);
      actionStartRef.current = 0;
      livenessStartedRef.current = false;
      faceStableStartRef.current = 0;
      forceRender(n => n + 1);

      setStatus("ready");
      setStatusMessage("Posisikan wajah Anda di dalam frame");
      startLoop();
    } catch (err) {
      console.error("Init error:", err);
      setStatus("error");
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setStatusMessage("Izin kamera ditolak.");
      } else if (err instanceof DOMException && err.name === "NotFoundError") {
        setStatusMessage("Kamera tidak ditemukan.");
      } else {
        setStatusMessage(`Gagal memuat: ${err instanceof Error ? err.message.slice(0, 80) : "unknown"}`);
      }
    }
  }, [minConfidence, mode]);

  // ── Capture Photo ──
  const doCapture = useCallback(async () => {
    if (capturedRef.current) return;
    capturedRef.current = true;
    cancelAnimationFrame(animFrameRef.current);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.translate(canvas.width, 0); ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const base64 = canvas.toDataURL("image/jpeg", 0.85);
    setCapturedImage(base64);

    if (mode === "attendance" && registeredFaceUrl) {
      setStatus("comparing");
      setStatusMessage("🔍 Membandingkan wajah...");
      try {
        const { compareFaces } = await import("@/lib/faceMatch");
        const result = await compareFaces(registeredFaceUrl, base64);
        setMatchScore(result.score);
        if (result.match) {
          setStatus("matched");
          setStatusMessage(`✅ Wajah cocok! (${result.score}%)`);
          cleanup();
          setTimeout(() => onCapture(base64, result.score), 1000);
        } else {
          setStatus("failed");
          setStatusMessage(`❌ Wajah tidak cocok (${result.score}%). Coba lagi...`);
          setTimeout(() => resetAll(), 2500);
        }
      } catch (err) {
        console.error("Auto-compare error:", err);
        setStatus("failed");
        setStatusMessage("❌ Gagal membandingkan. Coba lagi...");
        setTimeout(() => resetAll(), 2500);
      }
    } else if (mode === "attendance" && !registeredFaceUrl) {
      setStatus("error");
      setStatusMessage("❌ Belum ada foto wajah terdaftar.");
    } else {
      setStatus("captured");
      setStatusMessage("✅ Foto berhasil diambil!");
    }
  }, [mode, registeredFaceUrl, onCapture]);

  // ── Detection Loop (reads from REFS, not state) ──
  const startLoop = useCallback(() => {
    const detect = () => {
      const video = videoRef.current;
      const landmarker = landmarkerRef.current as {
        detectForVideo: (v: HTMLVideoElement, t: number) => LandmarkerResult;
      } | null;

      if (!video || !landmarker || video.readyState < 2 || capturedRef.current) {
        animFrameRef.current = requestAnimationFrame(detect);
        return;
      }

      try {
        const result = landmarker.detectForVideo(video, performance.now());
        const landmarks = result.faceLandmarks?.[0];
        const blendshapes = result.faceBlendshapes?.[0]?.categories;

        // Draw overlay
        const overlay = overlayRef.current;
        if (overlay) drawOverlay(overlay, video, landmarks || null, livenessStartedRef.current);

        if (!landmarks || landmarks.length === 0) {
          setStatus("no-face");
          setStatusMessage("Wajah tidak terdeteksi. Posisikan wajah di frame.");
          faceStableStartRef.current = 0;
          actionStartRef.current = 0;
          setChallengeProgress(0);
        } else if (mode === "attendance") {
          // ── ATTENDANCE MODE: iPhone-style instant face scan ──
          // No liveness challenges — just detect face stably, then auto-capture & compare
          if (faceStableStartRef.current === 0) faceStableStartRef.current = Date.now();
          const stableMs = Date.now() - faceStableStartRef.current;
          const scanDuration = 1200; // 1.2 seconds of stable face detection
          const progress = Math.min((stableMs / scanDuration) * 100, 100);
          setChallengeProgress(progress);
          setStatus("detected");
          setStatusMessage("🔍 Memindai wajah...");

          if (stableMs >= scanDuration) {
            // Face stable long enough → capture & compare immediately
            setStatus("liveness-done");
            setStatusMessage("✅ Wajah terdeteksi!");
            setChallengeProgress(100);
            setTimeout(() => doCapture(), 300);
            return; // stop loop
          }
        } else if (!livenessStartedRef.current) {
          // ── REGISTER MODE: Wait for stable face before starting liveness ──
          if (faceStableStartRef.current === 0) faceStableStartRef.current = Date.now();
          const stableMs = Date.now() - faceStableStartRef.current;
          if (stableMs < 800) {
            setStatus("detected");
            setStatusMessage("Wajah terdeteksi! Tetap diam...");
          } else {
            livenessStartedRef.current = true;
            actionStartRef.current = 0;
            setChallengeProgress(0);
            setStatus("liveness");
          }
        } else {
          // ── REGISTER MODE: Liveness challenges (all state from refs!) ──
          const idx = currentIdxRef.current;
          const challenges = challengesRef.current;

          if (idx < challenges.length) {
            const challenge = challenges[idx];
            setStatus("liveness");
            setStatusMessage(`${challenge.emoji} ${challenge.instruction}`);

            const checkResult = checkChallenge(challenge.type, landmarks, blendshapes);
            setDebugInfo(checkResult.debug);

            if (checkResult.detected) {
              if (actionStartRef.current === 0) actionStartRef.current = Date.now();
              const elapsed = Date.now() - actionStartRef.current;
              const progress = Math.min((elapsed / challenge.holdDurationMs) * 100, 100);
              setChallengeProgress(progress);

              if (elapsed >= challenge.holdDurationMs) {
                // Challenge completed!
                completedRef.current[idx] = true;
                const nextIdx = idx + 1;

                if (nextIdx >= challenges.length) {
                  // All done!
                  currentIdxRef.current = nextIdx;
                  setStatus("liveness-done");
                  setStatusMessage("✅ Verifikasi wajah selesai!");
                  setChallengeProgress(100);
                  forceRender(n => n + 1);
                  setTimeout(() => doCapture(), 600);
                  return; // stop loop
                } else {
                  currentIdxRef.current = nextIdx;
                  actionStartRef.current = 0;
                  setChallengeProgress(0);
                  forceRender(n => n + 1);
                }
              }
            } else {
              actionStartRef.current = 0;
              setChallengeProgress(0);
            }
          }
        }
      } catch (err) {
        console.warn("Detection frame error:", err);
      }

      animFrameRef.current = requestAnimationFrame(detect);
    };

    animFrameRef.current = requestAnimationFrame(detect);
  }, [doCapture]);

  // ── Draw Overlay ──
  function drawOverlay(canvas: HTMLCanvasElement, video: HTMLVideoElement, landmarks: FaceLandmark[] | null, isLiveness: boolean) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!landmarks) return;

    const contour = [10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109,10];
    ctx.strokeStyle = isLiveness ? "#22c55e" : "#4CAF50";
    ctx.lineWidth = 2;
    ctx.beginPath();
    contour.forEach((idx, i) => {
      const lm = landmarks[idx];
      if (i === 0) ctx.moveTo(lm.x * canvas.width, lm.y * canvas.height);
      else ctx.lineTo(lm.x * canvas.width, lm.y * canvas.height);
    });
    ctx.closePath(); ctx.stroke();
    ctx.fillStyle = isLiveness ? "rgba(34,197,94,0.05)" : "rgba(76,175,80,0.05)";
    ctx.fill();

    if (isLiveness) {
      for (const idx of [33,133,362,263,159,145,386,374,1,4,13,14,61,291]) {
        const lm = landmarks[idx];
        ctx.beginPath();
        ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = "#22c55e"; ctx.fill();
      }
    }
  }

  // ── Reset ──
  const resetAll = useCallback(() => {
    capturedRef.current = false;
    setCapturedImage(null); setMatchScore(null); setChallengeProgress(0); setDebugInfo("");
    actionStartRef.current = 0; faceStableStartRef.current = 0; livenessStartedRef.current = false;

    const challs = mode === "register" ? getRegistrationChallenges() : getAttendanceChallenges();
    challengesRef.current = challs;
    currentIdxRef.current = 0;
    completedRef.current = new Array(challs.length).fill(false);
    forceRender(n => n + 1);

    setStatus("ready"); setStatusMessage("Posisikan wajah Anda di dalam frame");
    startLoop();
  }, [mode, startLoop]);

  // ── Cleanup ──
  const cleanup = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    const lm = landmarkerRef.current as { close?: () => void } | null;
    if (lm?.close) { lm.close(); landmarkerRef.current = null; }
  }, []);

  const handleConfirm = () => { if (capturedImage) { onCapture(capturedImage); cleanup(); } };
  const handleClose = () => { cleanup(); onClose(); };

  useEffect(() => { initialize(); return cleanup; }, [initialize, cleanup]);

  // Read from refs for UI
  const challenges = challengesRef.current;
  const currentIdx = currentIdxRef.current;
  const completed = completedRef.current;
  const currentChallenge = challenges[currentIdx];

  const statusColors: Record<string, string> = {
    loading: "text-blue-500", ready: "text-kimaya-brown-light/60", "no-face": "text-amber-500",
    detected: "text-green-600", liveness: "text-blue-500", "liveness-done": "text-green-600",
    captured: "text-kimaya-olive", comparing: "text-blue-500", matched: "text-green-600",
    failed: "text-red-500", error: "text-red-500",
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={handleClose} className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", damping: 25 }} onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-kimaya-cream-dark/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-kimaya-olive/10 flex items-center justify-center">
              <ScanFace size={20} className="text-kimaya-olive" />
            </div>
            <div>
              <h2 className="text-lg font-serif text-kimaya-brown">
                {mode === "register" ? "Registrasi Wajah" : "Verifikasi Wajah"}
              </h2>
              <p className="text-xs text-kimaya-brown-light/50">
                {mode === "register" ? "Liveness Detection • Anti-Spoofing" : "Face ID • Pencocokan Instan"}
              </p>
            </div>
          </div>
          <button onClick={handleClose} className="w-8 h-8 rounded-lg hover:bg-kimaya-cream flex items-center justify-center text-kimaya-brown-light/40">
            <X size={18} />
          </button>
        </div>

        {/* Camera */}
        <div className="relative bg-black aspect-[3/4] sm:aspect-[4/3]">
          <video ref={videoRef} autoPlay playsInline muted className={cn("w-full h-full object-cover", capturedImage ? "hidden" : "block", "scale-x-[-1]")} />
          <canvas ref={overlayRef} className={cn("absolute inset-0 w-full h-full object-cover", capturedImage ? "hidden" : "block", "scale-x-[-1]")} />
          {capturedImage && <img src={capturedImage} alt="Captured" className="w-full h-full object-cover" />}
          <canvas ref={canvasRef} className="hidden" />

          {/* Oval guide */}
          {!capturedImage && status !== "loading" && status !== "error" && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className={cn("w-56 h-72 sm:w-64 sm:h-80 rounded-[50%] border-2 border-dashed transition-colors",
                (status === "liveness" || status === "liveness-done") ? "border-green-400/60" :
                status === "detected" ? "border-green-400/40" : "border-white/30")} />
            </div>
          )}

          {/* Loading */}
          {status === "loading" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80">
              <div className="text-center text-white">
                <Loader2 size={40} className="animate-spin mx-auto mb-3 text-kimaya-olive" />
                <p className="text-sm">{statusMessage}</p>
              </div>
            </div>
          )}

          {/* Error */}
          {status === "error" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80">
              <div className="text-center text-white px-6">
                <AlertTriangle size={40} className="mx-auto mb-3 text-red-400" />
                <p className="text-sm mb-4">{statusMessage}</p>
                <button onClick={initialize} className="px-4 py-2 rounded-xl bg-kimaya-olive text-white text-sm flex items-center gap-2 mx-auto">
                  <RefreshCw size={14} /> Coba Lagi
                </button>
              </div>
            </div>
          )}

          {/* ── ATTENDANCE MODE: Scanning overlay ── */}
          {mode === "attendance" && status === "detected" && challengeProgress > 0 && !capturedImage && (
            <>
              <div className="absolute top-4 left-0 right-0 text-center pointer-events-none">
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                  className="inline-block px-4 py-2 rounded-full bg-black/60 backdrop-blur-md border border-blue-400/30">
                  <p className="text-white text-sm font-medium flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin text-blue-400" />
                    Memindai wajah...
                  </p>
                </motion.div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/30">
                <div className="h-full bg-blue-400 rounded-r transition-all duration-100" style={{ width: `${challengeProgress}%` }} />
              </div>
            </>
          )}

          {/* ── REGISTER MODE: Liveness Challenge UI ── */}
          {mode === "register" && (status === "liveness" || status === "liveness-done") && !capturedImage && (
            <div className="absolute top-0 left-0 right-0">
              <AnimatePresence mode="wait">
                {currentChallenge && status === "liveness" && (
                  <motion.div key={currentIdx} initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                    className="mx-4 mt-6 p-5 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 text-center shadow-2xl">
                    <p className="text-white text-lg font-medium tracking-wide">{currentChallenge.instruction}</p>
                    <div className="mt-3 flex items-center justify-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                      <p className="text-green-300/90 text-sm font-medium uppercase tracking-widest">Tahan Posisi</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Progress dots */}
              <div className="flex items-center justify-center gap-3 mt-6 px-4">
                {challenges.map((ch, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className={cn("w-3 h-3 rounded-full transition-all duration-300",
                      completed[i] ? "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.6)]" :
                      i === currentIdx ? "bg-white scale-125 shadow-[0_0_10px_rgba(255,255,255,0.6)]" :
                      "bg-white/20")}>
                    </div>
                    {i < challenges.length - 1 && <div className={cn("w-8 h-px", completed[i] ? "bg-green-500/50" : "bg-white/20")} />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Done overlay (both modes) */}
          {status === "liveness-done" && !capturedImage && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 flex items-center justify-center bg-green-900/30 pointer-events-none">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}
                className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center shadow-xl">
                <Check size={40} className="text-white" />
              </motion.div>
            </motion.div>
          )}

          {/* Progress bar (register liveness only) */}
          {mode === "register" && status === "liveness" && challengeProgress > 0 && !capturedImage && (
            <div className="absolute bottom-0 left-0 right-0 h-2 bg-black/30">
              <div className="h-full bg-green-400 rounded-r transition-all duration-75" style={{ width: `${challengeProgress}%` }} />
            </div>
          )}

          {/* Match score badge */}
          {matchScore !== null && capturedImage && (
            <div className="absolute top-4 right-4">
              <div className={cn("px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md",
                matchScore >= 70 ? "bg-green-500/20 text-green-300 border border-green-400/30" :
                "bg-red-500/20 text-red-300 border border-red-400/30")}>
                Skor: {matchScore}%
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-3 bg-kimaya-cream/30 border-t border-kimaya-cream-dark/20">
          <div className={cn("flex items-center gap-2 text-sm", statusColors[status])}>
            {status === "loading" || status === "comparing" ? <Loader2 size={16} className="animate-spin" /> :
             status === "liveness" ? <ShieldCheck size={16} /> :
             status === "matched" || status === "liveness-done" || status === "captured" || status === "detected" ? <Check size={16} /> :
             status === "error" || status === "failed" || status === "no-face" ? <AlertTriangle size={16} /> :
             <ScanFace size={16} />}
            <span>{statusMessage}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 flex items-center gap-3">
          {!capturedImage ? (
            <>
              <button onClick={handleClose} className="flex-1 py-3 rounded-xl border border-kimaya-cream-dark/30 text-sm font-medium text-kimaya-brown hover:bg-kimaya-cream/30 transition-colors">Batal</button>
              {(status === "liveness" || status === "no-face") && (
                <motion.button whileTap={{ scale: 0.97 }} onClick={resetAll}
                  className="flex-1 py-3 rounded-xl border border-amber-300/50 text-sm font-medium text-amber-600 hover:bg-amber-50 transition-colors flex items-center justify-center gap-2">
                  <RefreshCw size={14} /> Ulang
                </motion.button>
              )}
            </>
          ) : status === "captured" ? (
            <>
              <motion.button whileTap={{ scale: 0.97 }} onClick={resetAll}
                className="flex-1 py-3 rounded-xl border border-kimaya-cream-dark/30 text-sm font-medium text-kimaya-brown flex items-center justify-center gap-2">
                <RefreshCw size={14} /> Ambil Ulang
              </motion.button>
              <motion.button whileTap={{ scale: 0.97 }} onClick={handleConfirm}
                className="flex-1 py-3 rounded-xl bg-kimaya-olive text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-kimaya-olive-dark shadow-lg shadow-kimaya-olive/20">
                <Check size={16} /> Gunakan Foto Ini
              </motion.button>
            </>
          ) : (
            <div className="flex-1 text-center text-sm text-kimaya-brown-light/60">
              {status === "comparing" && "Memproses..."}
              {status === "matched" && "✅ Berhasil!"}
              {status === "failed" && "Mencoba ulang..."}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
