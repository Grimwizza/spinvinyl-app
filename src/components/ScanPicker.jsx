import React, { useEffect } from 'react';
import { X, Barcode, ScanText } from 'lucide-react';

export default function ScanPicker({ onClose, onSelect }) {
    useEffect(() => {
        const scrollY = window.scrollY;
        document.body.classList.add('modal-open');
        document.body.style.top = `-${scrollY}px`;
        return () => {
            document.body.classList.remove('modal-open');
            document.body.style.top = '';
            window.scrollTo(0, scrollY);
        };
    }, []);

    return (
        <div className="fixed inset-0 z-[200] flex flex-col bg-black">

            {/* Header */}
            <div
                className="flex items-center justify-between px-4 pb-3 bg-black/80 backdrop-blur border-b border-white/10 flex-shrink-0"
                style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}
            >
                <div>
                    <h2 className="text-white font-bold text-base">Scan a Record</h2>
                    <p className="text-gray-500 text-xs">Choose how to identify this record</p>
                </div>
                <button
                    onClick={onClose}
                    className="w-10 h-10 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-white/10 active:opacity-70 flex-shrink-0"
                >
                    <X size={20} className="text-white" />
                </button>
            </div>

            {/* Body */}
            <div className="flex flex-col items-center justify-center flex-1 px-6 gap-6">
                <p className="text-gray-400 text-sm text-center">
                    How would you like to find this record?
                </p>

                <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
                    {/* Scan Sleeve (barcode) */}
                    <button
                        onClick={() => onSelect('barcode')}
                        className="flex-1 flex flex-col items-center justify-center gap-3 p-6 rounded-2xl bg-gradient-to-br from-violet-900/60 to-pink-900/60 border border-violet-500/30 hover:border-violet-400/60 hover:from-violet-900/80 hover:to-pink-900/80 active:scale-[0.97] transition-all group min-h-[140px]"
                    >
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-600 to-pink-600 flex items-center justify-center shadow-lg shadow-violet-500/30 group-hover:scale-105 transition-transform">
                            <Barcode size={26} className="text-white" />
                        </div>
                        <div className="text-center">
                            <p className="text-white font-bold text-base">Scan Sleeve</p>
                            <p className="text-gray-400 text-xs mt-1 leading-snug">
                                Point at the barcode<br />on the back of the sleeve
                            </p>
                        </div>
                    </button>

                    {/* Scan Vinyl (matrix) */}
                    <button
                        onClick={() => onSelect('matrix')}
                        className="flex-1 flex flex-col items-center justify-center gap-3 p-6 rounded-2xl bg-gradient-to-br from-amber-900/60 to-orange-900/60 border border-amber-500/30 hover:border-amber-400/60 hover:from-amber-900/80 hover:to-orange-900/80 active:scale-[0.97] transition-all group min-h-[140px]"
                    >
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-600 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/30 group-hover:scale-105 transition-transform">
                            <ScanText size={26} className="text-white" />
                        </div>
                        <div className="text-center">
                            <p className="text-gray-400 text-xs font-medium">No Barcode?</p>
                            <p className="text-white font-bold text-base">Scan Vinyl</p>
                            <p className="text-gray-400 text-xs mt-1 leading-snug">
                                Read the etched text<br />in the runout groove
                            </p>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
}
