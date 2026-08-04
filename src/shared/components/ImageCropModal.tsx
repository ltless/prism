"use client";

import { useState, useCallback, useRef } from "react";
import Cropper, { Area } from "react-easy-crop";
import { m } from "motion/react";
import { X, Check, ArrowCounterClockwise } from "@phosphor-icons/react";
import { getCroppedImg } from "../utils/cropImage";
import { toast } from "sonner";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { useScrollLock } from "../hooks/useScrollLock";
import { useReducedMotion } from "../hooks/useReducedMotion";

interface ImageCropModalProps {
 image: string;
 aspect: number;
 isOpen: boolean;
 onClose: () => void;
 onCropComplete: (croppedBlob: Blob) => void;
 title?: string;
}

export function ImageCropModal({
 image,
 aspect,
 onClose,
 onCropComplete,
 title = "Crop Image"
}: ImageCropModalProps) {
 const [crop, setCrop] = useState({ x: 0, y: 0 });
 const [zoom, setZoom] = useState(1);
 const croppedAreaPixelsRef = useRef<Area | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, true);
  useScrollLock(true);
  const reduced = useReducedMotion();

  const onCropChange = useCallback((crop: { x: number; y: number }) => {
  setCrop(crop);
  }, []);

 const onZoomChange = useCallback((zoom: number) => {
 setZoom(zoom);
 }, []);

 const onCropCompleteInternal = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
 croppedAreaPixelsRef.current = croppedAreaPixels;
 }, []);

 const handleSave = async () => {
 if (croppedAreaPixelsRef.current) {
 try {
 const croppedBlob = await getCroppedImg(image, croppedAreaPixelsRef.current);
 if (croppedBlob) {
 onCropComplete(croppedBlob);
 onClose();
 }
 } catch {
 toast.error("Failed to crop image");
 }
 }
 };

 return (
  <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="image-crop-modal-title" className="fixed inset-0 z-modal flex items-center justify-center p-4">
  {/* Backdrop */}
  <m.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  exit={{ opacity: 0 }}
  transition={{ duration: reduced ? 0 : 0.2 }}
  onClick={onClose}
  className="absolute inset-0 bg-black/80"
  />

  {/* Modal */}
  <m.div
  initial={{ scale: reduced ? 1 : 0.9, opacity: 0 }}
  animate={{ scale: 1, opacity: 1 }}
  exit={{ scale: reduced ? 1 : 0.9, opacity: 0 }}
  transition={{ duration: reduced ? 0 : 0.2 }}
  className="relative w-full max-w-xl bg-panel-bg rounded-[40px] border border-main-border shadow-xl overflow-hidden flex flex-col"
 >
 {/* Header */}
 <div className="p-6 border-b border-main-border flex items-center justify-between">
 <h3 id="image-crop-modal-title" className="text-xs text-main-text">
 {title}
 </h3>
 <button
 	type="button"
 	onClick={onClose}
 	aria-label="Close"
 	className="p-2 hover:bg-surface-bg rounded-full text-muted-text hover:text-main-text transition-colors ease-out-expo cursor-pointer "
 >
 <X size={20} weight="light" />
 </button>
 </div>

 {/* Cropper Area */}
 <div className="relative h-[300px] md:h-[400px] w-full bg-black/40">
 <Cropper
 image={image}
 crop={crop}
 zoom={zoom}
 aspect={aspect}
 onCropChange={onCropChange}
 onZoomChange={onZoomChange}
 onCropComplete={onCropCompleteInternal}
 classes={{
 containerClassName: "rounded-none",
 mediaClassName: "max-w-none"
 }}
 />
 </div>

 {/* Footer / Controls */}
 <div className="p-8 space-y-8 bg-panel-bg">
 <div className="flex flex-col gap-3">
 <div className="flex justify-between text-[11px] text-muted-text">
 <span>Magnification</span>
 <span className="text-primary font-bold">{Math.round(zoom * 100)}%</span>
 </div>
 <input
 type="range"
 value={zoom}
 min={1}
 max={3}
 step={0.1}
        aria-label="Zoom"
 onChange={(e) => onZoomChange(Number(e.target.value))}
 className="w-full h-1.5 bg-surface-bg border border-main-border rounded-full appearance-none cursor-pointer accent-primary"
 />
 </div>

 <div className="flex gap-4">
 <button
 type="button"
 onClick={() => {
 setZoom(1);
 setCrop({ x: 0, y: 0 });
 }}
 className="flex-1 py-4 rounded-full bg-surface-bg border border-main-border text-main-text text-xs hover:bg-panel-bg hover:border-muted-text/30 transition-colors ease-out-expo flex items-center justify-center gap-2 cursor-pointer shadow-sm "
 >
 <ArrowCounterClockwise size={14} weight="light" />
 Reset
 </button>
 <button
 type="button"
 onClick={handleSave}
 className="flex-[2] py-4 rounded-full bg-primary text-primary-foreground text-xs hover:shadow-lg hover:shadow-primary/20 transition-shadow ease-out-expo flex items-center justify-center gap-2 cursor-pointer shadow-md "
 >
 <Check size={14} weight="bold" />
 Confirm Selection
 </button>
 </div>
 </div>
 </m.div>
 </div>
 );
}
