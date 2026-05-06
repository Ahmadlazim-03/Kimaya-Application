"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, X, RefreshCw, Check, AlertTriangle, Loader2, ScanFace } from "lucide-react";
import { cn } from "@/lib/utils";

// MediaPipe types
interface Detection {
  boundingBox: { originX: number; originY: number; width: number; height: number };
  categories: { score: number; index: number; categoryName: string; displayName: string }[];
  keypoints: { x: number; y: number }[];
}

interface FaceDetectorResult {
  detections: Detection[];
}

interface FaceDetectorProps {
  /** Called when a face photo is captured successfully */
  onCapture: (photoBase64: string) => void;
  /** Called when the modal is closed */
  onClose: () => void;
  /** Mode: 'register' for registration, 'attendance' for check-in */
  mode: "register" | "attendance";
  /** Registered face photo URL for auto-comparison in attendance mode */
  registeredFaceUrl?: string | null;
  /** Minimum confidence score required (0-1) */
  minConfidence?: number;
  /** Auto-capture in attendance mode after this many ms of stable detection */
  autoCaptureDelay?: number;
}

export default function FaceDetector({
  onCapture,
  onClose,
  mode,
  registeredFaceUrl,
  minConfidence = 0.75,
  autoCaptureDelay = 1500,
}: FaceDetectorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<unknown>(null);
  const animFrameRef = useRef<number>(0);
  const stableDetectionStartRef = useRef<number>(0);

  const [status, setStatus] = useState<"loading" | "ready" | "no-face" | "multi-face" | "detected" | "captured" | "comparing" | "matched" | "failed" | "error">("loading");
  const [statusMessage, setStatusMessage] = useState("Memuat model deteksi wajah...");
  const [confidence, setConfidence] = useState(0);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [autoProgress, setAutoProgress] = useState(0);
  const [matchScore, setMatchScore] = useState<number | null>(null);

  // Initialize MediaPipe FaceDetector and webcam
  const initialize = useCallback(async () => {
    try {
      setStatus("loading");
      setStatusMessage("Memuat model deteksi wajah...");

      // Dynamic import of MediaPipe
      const vision = await import("@mediapipe/tasks-vision");
      const { FaceDetector, FilesetResolver } = vision;

      // Initialize WASM runtime (pinned version for stability)
      const wasmFileset = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm"
      );

      const modelPath =
        "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite";

      // Try GPU first, fallback to CPU if GPU fails
      let detector;
      try {
        detector = await FaceDetector.createFromOptions(wasmFileset, {
          baseOptions: { modelAssetPath: modelPath, delegate: "GPU" },
          runningMode: "VIDEO",
          minDetectionConfidence: minConfidence,
        });
      } catch (gpuErr) {
        console.warn("GPU delegate failed, falling back to CPU:", gpuErr);
        setStatusMessage("GPU tidak tersedia, menggunakan CPU...");
        detector = await FaceDetector.createFromOptions(wasmFileset, {
          baseOptions: { modelAssetPath: modelPath, delegate: "CPU" },
          runningMode: "VIDEO",
          minDetectionConfidence: minConfidence,
        });
      }
      detectorRef.current = detector;

      // Start webcam — stop any existing stream first
      setStatusMessage("Mengakses kamera...");
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Play with timeout handling
        await Promise.race([
          videoRef.current.play(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("CAMERA_TIMEOUT")), 8000)
          ),
        ]);
      }

      setStatus("ready");
      setStatusMessage("Posisikan wajah Anda di dalam frame");

      // Start detection loop
      startDetectionLoop();
    } catch (err) {
      console.error("FaceDetector init error:", err);
      setStatus("error");
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setStatusMessage("Izin kamera ditolak. Aktifkan izin kamera di browser Anda.");
      } else if (err instanceof DOMException && err.name === "NotFoundError") {
        setStatusMessage("Kamera tidak ditemukan. Pastikan perangkat memiliki kamera.");
      } else if (
        (err instanceof DOMException && err.name === "AbortError") ||
        (err instanceof Error && err.message === "CAMERA_TIMEOUT")
      ) {
        setStatusMessage("Kamera timeout. Tutup aplikasi lain yang menggunakan kamera, lalu coba lagi.");
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        setStatusMessage(`Gagal memuat face detector: ${msg.slice(0, 100)}`);
      }
    }
  }, [minConfidence]);

  // Detection loop - runs every animation frame
  const startDetectionLoop = useCallback(() => {
    const detect = () => {
      const video = videoRef.current;
      const detector = detectorRef.current as {
        detectForVideo: (video: HTMLVideoElement, timestamp: number) => FaceDetectorResult;
      } | null;
      const overlayCanvas = overlayCanvasRef.current;

      if (!video || !detector || !overlayCanvas || video.readyState < 2) {
        animFrameRef.current = requestAnimationFrame(detect);
        return;
      }

      try {
        const result = detector.detectForVideo(video, performance.now());
        drawOverlay(result, overlayCanvas, video);

        if (result.detections.length === 0) {
          setStatus("no-face");
          setStatusMessage("Wajah tidak terdeteksi. Posisikan wajah Anda di frame.");
          setConfidence(0);
          setAutoProgress(0);
          stableDetectionStartRef.current = 0;
        } else if (result.detections.length > 1) {
          setStatus("multi-face");
          setStatusMessage("Terdeteksi lebih dari 1 wajah. Pastikan hanya 1 wajah.");
          setConfidence(0);
          setAutoProgress(0);
          stableDetectionStartRef.current = 0;
        } else {
          const score = result.detections[0].categories[0]?.score || 0;
          setConfidence(score);

          if (score >= minConfidence) {
            setStatus("detected");
            setStatusMessage(
              mode === "register"
                ? "Wajah terdeteksi! Klik tombol Capture."
                : "Wajah terdeteksi! Menunggu verifikasi..."
            );

            // Auto-capture logic for attendance mode
            if (mode === "attendance") {
              if (stableDetectionStartRef.current === 0) {
                stableDetectionStartRef.current = Date.now();
              }
              const elapsed = Date.now() - stableDetectionStartRef.current;
              const progress = Math.min((elapsed / autoCaptureDelay) * 100, 100);
              setAutoProgress(progress);

              if (elapsed >= autoCaptureDelay) {
                capturePhoto();
                return; // Stop loop after capture
              }
            }
          } else {
            setStatus("no-face");
            setStatusMessage(`Skor deteksi rendah (${(score * 100).toFixed(0)}%). Perbaiki pencahayaan.`);
            setAutoProgress(0);
            stableDetectionStartRef.current = 0;
          }
        }
      } catch {
        // Detection error - skip frame
      }

      animFrameRef.current = requestAnimationFrame(detect);
    };

    animFrameRef.current = requestAnimationFrame(detect);
  }, [mode, minConfidence, autoCaptureDelay]);

  // Draw face detection overlay
  const drawOverlay = (result: FaceDetectorResult, canvas: HTMLCanvasElement, video: HTMLVideoElement) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const detection of result.detections) {
      const { originX, originY, width, height } = detection.boundingBox;
      const score = detection.categories[0]?.score || 0;
      const isGood = score >= minConfidence;

      // Draw bounding box
      ctx.strokeStyle = isGood ? "#4CAF50" : "#FF9800";
      ctx.lineWidth = 3;
      ctx.setLineDash([]);

      // Rounded corners
      const x = originX;
      const y = originY;
      const r = 12;
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + width - r, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + r);
      ctx.lineTo(x + width, y + height - r);
      ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
      ctx.lineTo(x + r, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.stroke();

      // Draw semi-transparent fill
      ctx.fillStyle = isGood ? "rgba(76, 175, 80, 0.08)" : "rgba(255, 152, 0, 0.08)";
      ctx.fill();

      // Draw keypoints (eyes, nose, mouth)
      if (detection.keypoints) {
        for (const kp of detection.keypoints) {
          ctx.beginPath();
          ctx.arc(kp.x * canvas.width, kp.y * canvas.height, 3, 0, 2 * Math.PI);
          ctx.fillStyle = isGood ? "#4CAF50" : "#FF9800";
          ctx.fill();
        }
      }

      // Score label
      ctx.fillStyle = isGood ? "#4CAF50" : "#FF9800";
      ctx.font = "bold 14px Inter, sans-serif";
      ctx.fillText(`${(score * 100).toFixed(0)}%`, x + 6, y - 8);
    }
  };

  // Cleanup
  const cleanup = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (detectorRef.current && typeof (detectorRef.current as { close: () => void }).close === "function") {
      (detectorRef.current as { close: () => void }).close();
      detectorRef.current = null;
    }
  }, []);

  // Capture photo from video
  const capturePhoto = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Mirror the image (selfie mode)
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const base64 = canvas.toDataURL("image/jpeg", 0.85);
    setCapturedImage(base64);

    // Stop detection loop
    cancelAnimationFrame(animFrameRef.current);

    // In attendance mode with registered face: auto-compare
    if (mode === "attendance" && registeredFaceUrl) {
      setStatus("comparing");
      setStatusMessage("🔍 Membandingkan wajah...");
      try {
        const { compareFaces } = await import("@/lib/faceMatch");
        const result = await compareFaces(registeredFaceUrl, base64);
        setMatchScore(result.score);
        if (result.match) {
          setStatus("matched");
          setStatusMessage(`✅ Wajah cocok! (${result.score}%) — Melanjutkan...`);
          // Auto-submit after short delay so user sees the result
          setTimeout(() => {
            onCapture(base64);
            cleanup();
          }, 1000);
        } else {
          setStatus("failed");
          setStatusMessage(`❌ Wajah tidak cocok (${result.score}%). Mencoba ulang...`);
          // Auto-retake after 2s
          setTimeout(() => {
            setCapturedImage(null);
            setAutoProgress(0);
            setMatchScore(null);
            stableDetectionStartRef.current = 0;
            setStatus("ready");
            setStatusMessage("Posisikan wajah Anda di dalam frame");
            startDetectionLoop();
          }, 2000);
        }
      } catch {
        setStatus("failed");
        setStatusMessage("❌ Gagal membandingkan wajah. Mencoba ulang...");
        setTimeout(() => {
          setCapturedImage(null);
          setAutoProgress(0);
          stableDetectionStartRef.current = 0;
          setStatus("ready");
          setStatusMessage("Posisikan wajah Anda di dalam frame");
          startDetectionLoop();
        }, 2000);
      }
    } else {
      // Register mode or no registered face: manual confirm
      setStatus("captured");
      setStatusMessage("Foto berhasil diambil!");
    }
  }, [mode, registeredFaceUrl, onCapture, cleanup, startDetectionLoop]);

  // Retake photo
  const handleRetake = () => {
    setCapturedImage(null);
    setAutoProgress(0);
    setMatchScore(null);
    stableDetectionStartRef.current = 0;
    setStatus("ready");
    setStatusMessage("Posisikan wajah Anda di dalam frame");
    startDetectionLoop();
  };

  // Confirm photo
  const handleConfirm = () => {
    if (capturedImage) {
      onCapture(capturedImage);
      cleanup();
    }
  };

  // Close modal
  const handleClose = () => {
    cleanup();
    onClose();
  };

  useEffect(() => {
    initialize();
    return cleanup;
  }, [initialize, cleanup]);

  const statusColors: Record<string, string> = {
    loading: "text-blue-500",
    ready: "text-kimaya-brown-light/60",
    "no-face": "text-amber-500",
    "multi-face": "text-red-500",
    detected: "text-green-600",
    captured: "text-kimaya-olive",
    comparing: "text-blue-500",
    matched: "text-green-600",
    failed: "text-red-500",
    error: "text-red-500",
  };

  const statusIcons: Record<string, React.ReactNode> = {
    loading: <Loader2 size={16} className="animate-spin" />,
    ready: <ScanFace size={16} />,
    "no-face": <AlertTriangle size={16} />,
    "multi-face": <AlertTriangle size={16} />,
    detected: <Check size={16} />,
    captured: <Check size={16} />,
    comparing: <Loader2 size={16} className="animate-spin" />,
    matched: <Check size={16} />,
    failed: <AlertTriangle size={16} />,
    error: <AlertTriangle size={16} />,
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={handleClose}
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", damping: 25 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden"
      >
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
                MediaPipe Face Detection • Gratis
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-lg hover:bg-kimaya-cream flex items-center justify-center text-kimaya-brown-light/40 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Camera View */}
        <div className="relative bg-black aspect-video">
          {/* Video */}
          <video
            ref={videoRef}
            playsInline
            muted
            className={cn(
              "w-full h-full object-cover",
              capturedImage ? "hidden" : "block",
              // Mirror effect for selfie
              "scale-x-[-1]"
            )}
          />

          {/* Detection overlay */}
          <canvas
            ref={overlayCanvasRef}
            className={cn(
              "absolute inset-0 w-full h-full object-cover",
              capturedImage ? "hidden" : "block",
              "scale-x-[-1]"
            )}
          />

          {/* Captured image preview */}
          {capturedImage && (
            <img
              src={capturedImage}
              alt="Captured face"
              className="w-full h-full object-cover"
            />
          )}

          {/* Hidden canvas for capture */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Face guide overlay */}
          {!capturedImage && status !== "loading" && status !== "error" && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div
                className={cn(
                  "w-48 h-60 rounded-[50%] border-2 border-dashed transition-colors duration-300",
                  status === "detected" ? "border-green-400/60" : "border-white/30"
                )}
              />
            </div>
          )}

          {/* Loading overlay */}
          {status === "loading" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80">
              <div className="text-center text-white">
                <Loader2 size={40} className="animate-spin mx-auto mb-3 text-kimaya-olive" />
                <p className="text-sm">{statusMessage}</p>
              </div>
            </div>
          )}

          {/* Error overlay */}
          {status === "error" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80">
              <div className="text-center text-white px-6">
                <AlertTriangle size={40} className="mx-auto mb-3 text-red-400" />
                <p className="text-sm mb-4">{statusMessage}</p>
                <button
                  onClick={initialize}
                  className="px-4 py-2 rounded-xl bg-kimaya-olive text-white text-sm font-medium flex items-center gap-2 mx-auto"
                >
                  <RefreshCw size={14} /> Coba Lagi
                </button>
              </div>
            </div>
          )}

          {/* Auto-capture progress bar (attendance mode) */}
          {mode === "attendance" && autoProgress > 0 && status === "detected" && !capturedImage && (
            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/30">
              <motion.div
                className="h-full bg-green-400"
                initial={{ width: "0%" }}
                animate={{ width: `${autoProgress}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
          )}

          {/* Confidence badge */}
          {confidence > 0 && !capturedImage && (
            <div className="absolute top-4 right-4">
              <div
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md",
                  confidence >= minConfidence
                    ? "bg-green-500/20 text-green-300 border border-green-400/30"
                    : "bg-amber-500/20 text-amber-300 border border-amber-400/30"
                )}
              >
                Skor: {(confidence * 100).toFixed(0)}%
              </div>
            </div>
          )}
        </div>

        {/* Status Bar */}
        <div className="px-6 py-3 bg-kimaya-cream/30 border-t border-kimaya-cream-dark/20">
          <div className={cn("flex items-center gap-2 text-sm", statusColors[status])}>
            {statusIcons[status]}
            <span>{statusMessage}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 flex items-center gap-3">
          {!capturedImage ? (
            <>
              <button
                onClick={handleClose}
                className="flex-1 py-3 rounded-xl border border-kimaya-cream-dark/30 text-sm font-medium text-kimaya-brown hover:bg-kimaya-cream/30 transition-colors"
              >
                Batal
              </button>
              {mode === "register" && (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={capturePhoto}
                  disabled={status !== "detected"}
                  className={cn(
                    "flex-1 py-3 rounded-xl text-white text-sm font-medium flex items-center justify-center gap-2 transition-all shadow-lg",
                    status === "detected"
                      ? "bg-kimaya-olive hover:bg-kimaya-olive-dark shadow-kimaya-olive/20"
                      : "bg-gray-300 cursor-not-allowed shadow-none"
                  )}
                >
                  <Camera size={16} /> Capture
                </motion.button>
              )}
              {mode === "attendance" && status === "detected" && (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={capturePhoto}
                  className="flex-1 py-3 rounded-xl bg-kimaya-olive text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-kimaya-olive-dark transition-all shadow-lg shadow-kimaya-olive/20"
                >
                  <Camera size={16} /> Capture Sekarang
                </motion.button>
              )}
            </>
          ) : (
            <>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleRetake}
                className="flex-1 py-3 rounded-xl border border-kimaya-cream-dark/30 text-sm font-medium text-kimaya-brown hover:bg-kimaya-cream/30 transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw size={14} /> Ambil Ulang
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleConfirm}
                className="flex-1 py-3 rounded-xl bg-kimaya-olive text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-kimaya-olive-dark transition-all shadow-lg shadow-kimaya-olive/20"
              >
                <Check size={16} /> Gunakan Foto Ini
              </motion.button>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
