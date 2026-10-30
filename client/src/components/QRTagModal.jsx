import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Printer, ShieldCheck } from 'lucide-react';

export default function QRTagModal({ isOpen, onClose, title, subtitle, code, metadata = [], mode = 'storage' }) {
  if (!isOpen) return null;

  const qrPayload = JSON.stringify({
    system: 'VaultTrace',
    mode,
    code,
    title,
    verifiedAt: new Date().toISOString(),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#F7F6F2] rounded-[28px] shadow-2xl border border-[#DFDDD4] max-w-md w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#2C372F] text-[#F7F6F2] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5" />
            <div>
              <h3 className="font-semibold text-xs uppercase tracking-wider">
                {mode === 'handover' ? 'Official Handover Pass' : 'Vault Storage Tag'}
              </h3>
              <p className="text-[11px] text-[#C8D3C9] font-mono">{code}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#C8D3C9] hover:text-white p-1 rounded-lg transition"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 flex flex-col items-center text-center">
          <div className="p-4 bg-white border border-[#DFDDD4] rounded-2xl mb-4">
            <QRCodeSVG
              value={qrPayload}
              size={168}
              bgColor="#ffffff"
              fgColor="#1F2621"
              level="M"
              includeMargin={false}
            />
          </div>

          <span className="font-mono text-xs font-semibold px-3 py-1 rounded-full bg-[#ECEAE3] text-[#1F2621] border border-[#DFDDD4] mb-2">
            {code}
          </span>
          <h4 className="text-base font-bold text-[#1F2621]">{title}</h4>
          {subtitle && <p className="text-xs text-[#606861] mt-0.5">{subtitle}</p>}

          <div className="w-full mt-5 bg-[#ECEAE3] rounded-2xl p-4 border border-[#DFDDD4] text-left space-y-2">
            {metadata.map((item, idx) => (
              <div key={idx} className="flex items-start justify-between text-xs gap-2">
                <span className="text-[#606861] font-medium">{item.label}</span>
                <span className="text-[#1F2621] font-semibold text-right">{item.value}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-center gap-3 w-full">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-[#2C372F] hover:bg-[#1F2621] text-[#F7F6F2] font-semibold text-xs transition"
            >
              <Printer className="w-4 h-4" />
              <span>Print Pass</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-full border border-[#D5D3C8] bg-[#FBFBF9] text-[#1F2621] hover:bg-[#E2E0D6] font-semibold text-xs transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
