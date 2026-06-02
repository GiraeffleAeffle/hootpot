"use client";

import { ArrowRight, Camera, Link as LinkIcon, ScanLine } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

type BarcodeDetectorInstance = {
  detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>>;
};

type BarcodeDetectorConstructor = new (options?: {
  formats?: string[];
}) => BarcodeDetectorInstance;

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor;
  }
}

function isHootpotUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.hostname === "hootpot.vercel.app" &&
      (url.pathname.startsWith("/pay/") || url.pathname === "/pot")
    );
  } catch {
    return false;
  }
}

function cameraBlockedByPolicy(): boolean {
  type PolicyDocument = Document & {
    permissionsPolicy?: { allowsFeature(feature: string): boolean };
    featurePolicy?: { allowsFeature(feature: string): boolean };
  };
  const policyDocument = document as PolicyDocument;
  try {
    if (policyDocument.permissionsPolicy) {
      return !policyDocument.permissionsPolicy.allowsFeature("camera");
    }
    if (policyDocument.featurePolicy) {
      return !policyDocument.featurePolicy.allowsFeature("camera");
    }
  } catch {
    return false;
  }
  return false;
}

export function ScanMerchantQr() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const [manualUrl, setManualUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const standaloneScanUrl = "https://hootpot.vercel.app/scan";

  useEffect(() => {
    return () => {
      if (scanTimerRef.current !== null) {
        window.clearInterval(scanTimerRef.current);
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function startScanner() {
    setMessage(null);
    if (cameraBlockedByPolicy()) {
      setMessage(
        "Camera scanning is blocked by the host iframe permissions. Open the scanner outside the playground, or paste the checkout link.",
      );
      return;
    }
    if (!window.BarcodeDetector) {
      setMessage("This browser does not expose QR scanning. Paste the QR link instead.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage("Camera access is not available in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      setIsScanning(true);
      scanTimerRef.current = window.setInterval(() => {
        void (async () => {
          const video = videoRef.current;
          if (!video || video.readyState < 2) return;
          const codes = await detector.detect(video).catch(() => []);
          const value = codes[0]?.rawValue?.trim();
          if (!value) return;
          if (!isHootpotUrl(value)) {
            setMessage("QR found, but it is not a Hootpot checkout link.");
            return;
          }
          window.location.assign(value);
        })();
      }, 700);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not start the camera.",
      );
    }
  }

  function openManualUrl() {
    const value = manualUrl.trim();
    if (!isHootpotUrl(value)) {
      setMessage("Paste a Hootpot checkout link from a merchant QR.");
      return;
    }
    window.location.assign(value);
  }

  return (
    <main className="min-h-screen bg-[#fbf8f2] text-[#171428]">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-5">
        <section className="rounded-[8px] border border-[#251d3f] bg-[#fffdf8] p-4 shadow-[0_8px_0_#251d3f]">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#746b80]">
            Shopper checkout
          </p>
          <h1 className="mt-1 text-4xl font-black leading-none">
            Scan merchant QR
          </h1>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-5 text-[#746b80]">
            Scan a Hootpot merchant QR to open the CRC checkout. If the embedded
            browser blocks camera access, paste the checkout link below.
          </p>
        </section>

        <section className="grid gap-4 rounded-[8px] border border-[#251d3f] bg-[#fffdf8] p-4">
          <div className="overflow-hidden rounded-[8px] border border-[#251d3f] bg-[#171428]">
            <video
              ref={videoRef}
              muted
              playsInline
              className="aspect-[4/3] w-full object-cover"
            />
          </div>
          <Button
            type="button"
            onClick={startScanner}
            disabled={isScanning}
            className="h-11 rounded-[8px] bg-[#251d3f] text-[#fffdf8] hover:bg-[#382b66]"
          >
            {isScanning ? (
              <ScanLine className="size-4" />
            ) : (
              <Camera className="size-4" />
            )}
            {isScanning ? "Scanning..." : "Start Camera"}
          </Button>
          <a
            href={standaloneScanUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] border border-[#251d3f] bg-white px-4 text-sm font-black text-[#251d3f]"
          >
            Open standalone scanner
          </a>
        </section>

        <section className="rounded-[8px] border border-[#251d3f] bg-[#fffdf8] p-4">
          <h2 className="flex items-center gap-2 text-xl font-black">
            <LinkIcon className="size-5 text-[#0d7f5f]" />
            Paste QR link
          </h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
            <input
              value={manualUrl}
              onChange={(event) => setManualUrl(event.target.value)}
              placeholder="https://hootpot.vercel.app/pay/..."
              className="h-11 min-w-0 rounded-[8px] border border-[#d8cfbe] bg-white px-3 font-mono text-xs outline-none focus:border-[#251d3f]"
            />
            <Button
              type="button"
              onClick={openManualUrl}
              className="h-11 rounded-[8px] bg-[#d8f36a] text-[#1f2a0a] hover:bg-[#e2f77d]"
            >
              Open
              <ArrowRight className="size-4" />
            </Button>
          </div>
          {message ? (
            <p className="mt-3 rounded-[8px] border border-[#e9dfce] bg-[#f7f1e8] p-3 text-sm font-semibold text-[#746b80]">
              {message}
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
