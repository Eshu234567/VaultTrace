import React, { useState, useRef, useEffect } from 'react';
import { analyzeItemImage } from '../services/visionRecognitionService';

export default function CameraObjectScanner({ onDetected, mode = 'lost' }) {
  const [cameraActive, setCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState('environment');
  const [analyzing, setAnalyzing] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [detectionResult, setDetectionResult] = useState(null);
  const [cameraError, setCameraError] = useState('');

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const startLiveCamera = async (preferredFacing = facingMode) => {
    setCameraError('');
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: preferredFacing, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch (_) {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      streamRef.current = stream;
      setCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 60);
    } catch (err) {
      setCameraError(
        'Could not access live camera stream. Please grant browser camera permission or use the 📷 Upload / Take Photo button.'
      );
      setCameraActive(false);
    }
  };

  const flipCamera = () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    if (cameraActive) {
      startLiveCamera(next);
    }
  };

  const runVisionOnImageElement = async (imgEl, filename = '') => {
    setAnalyzing(true);
    setStatusText('Initializing AI Computer Vision model...');
    try {
      const result = await analyzeItemImage(imgEl, filename, (msg) => setStatusText(msg));
      setDetectionResult(result);
      setPreviewUrl(result.imageDataUrl);
      if (onDetected) {
        onDetected(result);
      }
    } catch (err) {
      console.error('[CameraObjectScanner] Vision error:', err);
      setCameraError('Could not analyze image. Please try another photo.');
    } finally {
      setAnalyzing(false);
      setStatusText('');
    }
  };

  const captureFromLiveCamera = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    stopCamera();

    const img = new Image();
    img.onload = () => {
      runVisionOnImageElement(img, 'camera_capture.jpg');
    };
    img.src = dataUrl;
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCameraError('');
    stopCamera();

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result;
      if (!dataUrl) return;
      const img = new Image();
      img.onload = () => {
        runVisionOnImageElement(img, file.name);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="bg-[#F7F6F2] rounded-[24px] border-2 border-dashed border-[#B8CBBF] p-5 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#DDE6DF] text-[#233829] text-[11px] font-bold uppercase tracking-wider">
            <span>📷 AI Image-Based Object Recognition</span>
          </div>
          <h3 className="text-base font-bold text-[#1F2621]">
            Snap or Upload Item Photo to Auto-Fill Form
          </h3>
          <p className="text-xs text-[#58605A]">
            Pretrained Computer Vision (COCO-SSD + MobileNetV2) identifies object category, colour, and visible characteristics automatically.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={analyzing}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#2C372F] hover:bg-[#1F2621] text-[#F7F6F2] text-xs font-semibold shadow-sm transition disabled:opacity-50"
          >
            <span className="text-base leading-none" role="img" aria-label="camera">
              📷
            </span>
            <span>Upload / Take Photo</span>
          </button>

          {!cameraActive ? (
            <button
              type="button"
              onClick={() => startLiveCamera()}
              disabled={analyzing}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#ECEAE3] hover:bg-[#E2E0D6] text-[#1F2621] border border-[#D5D3C8] text-xs font-semibold transition disabled:opacity-50"
            >
              <span className="text-base leading-none" role="img" aria-label="webcam">
                📷
              </span>
              <span>Open Live Camera</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={stopCamera}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-[#F5E4E2] text-[#7D2B23] border border-[#E5C5C1] text-xs font-semibold transition"
            >
              <span>Close Camera</span>
            </button>
          )}
        </div>
      </div>

      {cameraError && (
        <div className="rounded-2xl bg-[#F5E4E2] border border-[#E5C5C1] px-4 py-2.5 text-xs text-[#7D2B23] font-medium">
          {cameraError}
        </div>
      )}

      {/* Live Camera Viewfinder */}
      {cameraActive && (
        <div className="relative rounded-2xl overflow-hidden bg-[#1F2621] border border-[#2C372F] max-w-lg mx-auto">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-64 sm:h-72 object-cover"
          />
          <div className="pointer-events-none absolute inset-6 border-2 border-dashed border-[#DDE6DF]/70 rounded-2xl flex items-end justify-center pb-3">
            <span className="px-3 py-1 rounded-full bg-black/60 text-[#F7F6F2] text-[11px] font-medium">
              Center the {mode === 'lost' ? 'lost' : 'found'} object inside the frame
            </span>
          </div>

          <div className="p-3 bg-[#1F2621] flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={flipCamera}
              className="px-3.5 py-2 rounded-full bg-[#3E4C42] text-[#F7F6F2] text-xs font-semibold hover:bg-[#4A5A4E] transition"
            >
              🔄 Flip Camera
            </button>
            <button
              type="button"
              onClick={captureFromLiveCamera}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[#DDE6DF] hover:bg-white text-[#1F2621] text-xs font-bold transition"
            >
              <span className="text-base leading-none">📷</span>
              <span>Capture & Recognize Object</span>
            </button>
          </div>
        </div>
      )}

      {/* Analyzing Spinner */}
      {analyzing && (
        <div className="rounded-2xl bg-[#ECEAE3] border border-[#DFDDD4] p-5 flex items-center gap-3.5">
          <div className="w-5 h-5 rounded-full border-2 border-[#2C372F] border-t-transparent animate-spin shrink-0" />
          <div className="space-y-0.5">
            <div className="text-xs font-bold text-[#1F2621]">
              Running Pretrained Computer Vision Analysis...
            </div>
            <div className="text-[11px] text-[#58605A]">{statusText}</div>
          </div>
        </div>
      )}

      {/* AI Vision Recognition Results Card */}
      {detectionResult && !analyzing && (
        <div className="rounded-2xl bg-[#ECEAE3] border border-[#D5D3C8] p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex items-center gap-4">
            {previewUrl && (
              <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-[#C8C6BC] shrink-0 bg-white">
                <img
                  src={previewUrl}
                  alt="Captured item"
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-[#2C372F]/90 text-[#F7F6F2] text-[9px] font-bold">
                  {detectionResult.confidencePct}%
                </span>
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-[#2C372F] text-[#F7F6F2] text-[11px] font-semibold">
                  ✓ Form Auto-Populated
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-[#DDE6DF] text-[#233829] border border-[#B8CBBF] text-[11px] font-semibold">
                  {detectionResult.confidencePct}% Vision Confidence
                </span>
                <span className="text-[11px] text-[#606861] font-mono">
                  {detectionResult.modelSource}
                </span>
              </div>

              <div className="text-sm font-bold text-[#1F2621]">
                Detected: {detectionResult.itemName}{' '}
                <span className="text-xs font-normal text-[#58605A]">
                  (Class: {detectionResult.rawDetectedClass})
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#353D37]">
                <span className="px-2.5 py-0.5 rounded-full bg-[#FBFBF9] border border-[#D5D3C8] font-medium">
                  Category: <strong>{detectionResult.category}</strong>
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FBFBF9] border border-[#D5D3C8] font-medium">
                  <span
                    className="w-2.5 h-2.5 rounded-full border border-black/20 inline-block"
                    style={{ backgroundColor: detectionResult.colourHex }}
                  />
                  <span>
                    Colour: <strong>{detectionResult.colour}</strong> ({detectionResult.colourHex})
                  </span>
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-[#FBFBF9] border border-[#D5D3C8] font-medium">
                  Material: <strong>{detectionResult.material}</strong>
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-[#FBFBF9] border border-[#D5D3C8] font-medium">
                  Size: <strong>{detectionResult.size}</strong>
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-1.5 rounded-full bg-[#FBFBF9] hover:bg-[#E2E0D6] text-[#1F2621] border border-[#D5D3C8] text-xs font-semibold shrink-0 transition"
          >
            📷 Retake Photo
          </button>
        </div>
      )}
    </div>
  );
}
