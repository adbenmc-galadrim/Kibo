type DetectedBarcode = { rawValue: string };

type BarcodeDetectorInstance = { detect(source: CanvasImageSource): Promise<DetectedBarcode[]> };

declare var BarcodeDetector: (new (options: { formats: string[] }) => BarcodeDetectorInstance) | undefined;
