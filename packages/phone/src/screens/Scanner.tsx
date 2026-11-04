import { Camera } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { fr } from "../i18n/fr";

const SCAN_EVERY_MS = 300;
const CORNERS = [
  "top-6 left-6 border-t-4 border-l-4",
  "top-6 right-6 border-t-4 border-r-4",
  "bottom-14 left-6 border-b-4 border-l-4",
  "bottom-14 right-6 border-b-4 border-r-4",
];

const MAX_FRAME_WIDTH = 640;

type Detect = (video: HTMLVideoElement) => Promise<string[]>;

export const canScan = (): boolean => typeof navigator.mediaDevices?.getUserMedia === "function";

async function canvasDetector(): Promise<Detect> {
  const { readQrFrame } = await import("../qr-frame");
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("canvas 2d context unavailable");
  return async (video) => {
    if (video.videoWidth === 0) return [];
    const scale = Math.min(1, MAX_FRAME_WIDTH / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const text = readQrFrame(context.getImageData(0, 0, canvas.width, canvas.height));
    return text ? [text] : [];
  };
}

async function createDetector(): Promise<Detect> {
  if (typeof BarcodeDetector !== "function") return canvasDetector();
  const detector = new BarcodeDetector({ formats: ["qr_code"] });
  return async (video) => (await detector.detect(video)).map((code) => code.rawValue);
}

function startScan(video: HTMLVideoElement, onCode: (code: string) => void, onFail: () => void): () => void {
  let stream: MediaStream | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let stopped = false;
  let reading = false;
  const stop = () => {
    stopped = true;
    if (timer) clearInterval(timer);
    for (const track of stream?.getTracks() ?? []) track.stop();
  };
  const run = async () => {
    const detect = await createDetector();
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    if (stopped) return stop();
    video.srcObject = stream;
    await video.play();
    timer = setInterval(async () => {
      if (reading || stopped) return;
      reading = true;
      const found = await detect(video)
        .then((texts) => texts.find((text) => text.startsWith("kibo1.")))
        .finally(() => {
          reading = false;
        });
      if (found && !stopped) {
        stop();
        onCode(found);
      }
    }, SCAN_EVERY_MS);
  };
  run().catch((e: unknown) => {
    console.error("[kibo-phone] camera unavailable", e);
    stop();
    onFail();
  });
  return stop;
}

export function Scanner({ onCode }: { onCode(code: string): void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!video.current) return;
    return startScan(video.current, onCode, () => setFailed(true));
  }, [onCode]);
  return (
    <div className="relative h-[300px] overflow-hidden rounded-2xl bg-[#0e0e10]">
      <video ref={video} muted playsInline className="absolute inset-0 size-full object-cover" />
      {CORNERS.map((corner) => (
        <span key={corner} aria-hidden className={`absolute size-[34px] border-white ${corner}`} />
      ))}
      <span aria-hidden className="absolute inset-x-[83px] top-[134px] h-px bg-[#f97316]" />
      <p className="absolute inset-x-0 bottom-5 flex items-center justify-center gap-2 text-[13px] text-white/85">
        <Camera aria-hidden size={14} />
        {failed ? fr.pair.camera : fr.pair.aim}
      </p>
    </div>
  );
}
