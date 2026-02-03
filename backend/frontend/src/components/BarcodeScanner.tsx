import React, { useEffect } from 'react';
import { XIcon } from './icons';
import { Html5Qrcode } from 'html5-qrcode';

interface BarcodeScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onCancel: () => void;
}

const scannerId = "barcode-scanner-view";

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScanSuccess, onCancel }) => {
  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;

    const startScanner = async () => {
      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length) {
          html5QrCode = new Html5Qrcode(scannerId);
          const config = { fps: 10, qrbox: { width: 280, height: 150 } };
          
          const successCallback = (decodedText: string) => {
            onScanSuccess(decodedText);
            stopScanner();
          };

          const errorCallback = (_error: any) => {
             // Errors are ignored to prevent console spam
          };

          await html5QrCode.start(
            { facingMode: "environment" },
            config,
            successCallback,
            errorCallback
          );
        }
      } catch (err) {
        console.error("Failed to start barcode scanner:", err);
      }
    };
    
    const stopScanner = () => {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch((err: any) => {
          console.error("Failed to stop scanner:", err);
        });
      }
    };

    startScanner();

    return () => {
      stopScanner();
    };
  }, [onScanSuccess]);

  return (
    <div className="fixed inset-0 bg-black/80 flex flex-col items-center justify-center z-50 animate-fade-in">
        <div id={scannerId} className="w-full max-w-md h-auto rounded-xl overflow-hidden border-4 border-white/20 shadow-2xl"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[170px] pointer-events-none">
            <div className="absolute inset-0 border-4 border-emerald-400 rounded-xl shadow-[0_0_20px_theme(colors.emerald.400)]"></div>
            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-red-500 animate-[scan_2s_ease-in-out_infinite]"></div>
        </div>

        <p className="text-white/80 mt-6 text-lg font-semibold">Position a barcode inside the frame</p>

        <button
            onClick={onCancel}
            className="absolute top-4 right-4 p-2 bg-white/20 text-white rounded-full hover:bg-white/30 transition-colors"
            aria-label="Close scanner"
        >
            <XIcon />
        </button>
        <style>
        {`
          @keyframes scan {
            0% { transform: translateY(-85px); }
            50% { transform: translateY(85px); }
            100% { transform: translateY(-85px); }
          }
        `}
        </style>
    </div>
  );
};
