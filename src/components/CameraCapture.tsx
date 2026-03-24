import React, { useRef, useState, useEffect } from 'react';
import { X, Camera, RefreshCw, Loader2, Check } from 'lucide-react';

interface CameraCaptureProps {
  onCapture: (url: string) => void;
  onClose: () => void;
}

export default function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  useEffect(() => {
    async function startCamera() {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' }, 
          audio: false 
        });
        streamRef.current = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
        setIsReady(true);
      } catch (err) {
        alert("Could not access camera. Please check permissions.");
        onClose();
      }
    }
    startCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [onClose]);

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setCapturedImage(dataUrl);
      }
    }
  };

  const handleConfirm = () => {
    if (capturedImage) {
      onCapture(capturedImage);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[150] bg-black flex flex-col">
      <div className="p-6 flex justify-between items-center text-white">
        <h3 className="text-sm font-black uppercase tracking-widest">Camera</h3>
        <button onClick={onClose} className="p-2 bg-white/10 rounded-full"><X size={20} /></button>
      </div>

      <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-slate-900">
        {!capturedImage ? (
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            className="w-full h-full object-cover"
          />
        ) : (
          <img src={capturedImage} className="w-full h-full object-cover" alt="Captured" />
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      <div className="p-10 flex items-center justify-center gap-8 bg-black/80 backdrop-blur-xl">
        {!capturedImage ? (
          <button 
            onClick={handleCapture} 
            disabled={!isReady}
            className="w-20 h-20 bg-white rounded-full flex items-center justify-center active:scale-90 transition-all shadow-2xl shadow-white/20"
          >
            <div className="w-16 h-16 border-4 border-black/5 rounded-full" />
          </button>
        ) : (
          <>
            <button 
              onClick={() => setCapturedImage(null)} 
              className="w-16 h-16 bg-white/10 text-white rounded-full flex items-center justify-center active:scale-90 transition-all"
            >
              <RefreshCw size={24} />
            </button>
            <button 
              onClick={handleConfirm} 
              className="w-20 h-20 bg-emerald-500 text-white rounded-full flex items-center justify-center active:scale-90 transition-all shadow-2xl shadow-emerald-500/40"
            >
              <Check size={32} strokeWidth={3} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
