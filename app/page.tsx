'use client';

import { useState } from 'react';

type Step = 'send' | 'verify' | 'done';
interface Msg { text: string; type: 'success' | 'error' | ''; }

export default function Home() {
  const [step, setStep] = useState<Step>('send');
  const [apiKey, setApiKey] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [sendMsg, setSendMsg] = useState<Msg>({ text: '', type: '' });
  const [verifyMsg, setVerifyMsg] = useState<Msg>({ text: '', type: '' });
  const [sendLoading, setSendLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);

  const sendOtp = async () => {
    setSendMsg({ text: '', type: '' });
    if (!apiKey.trim() || !phone.trim()) {
      setSendMsg({ text: 'API key and phone number are required.', type: 'error' });
      return;
    }
    setSendLoading(true);
    try {
      const res = await fetch('/api/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ phoneNumber: phone }),
      });
      const data = await res.json();
      if (res.ok) {
        setSendMsg({ text: 'Call initiated! You should receive it shortly.', type: 'success' });
        setStep('verify');
      } else {
        setSendMsg({ text: data.error || 'Something went wrong.', type: 'error' });
      }
    } catch {
      setSendMsg({ text: 'Network error. Please try again.', type: 'error' });
    }
    setSendLoading(false);
  };

  const verifyOtp = async () => {
    setVerifyMsg({ text: '', type: '' });
    if (otp.length !== 6 || !/^\d+$/.test(otp)) {
      setVerifyMsg({ text: 'OTP must be exactly 6 digits.', type: 'error' });
      return;
    }
    setVerifyLoading(true);
    try {
      const res = await fetch('/api/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ otp }),
      });
      const data = await res.json();
      if (res.ok) {
        setStep('done');
      } else {
        setVerifyMsg({ text: data.error || 'Verification failed.', type: 'error' });
      }
    } catch {
      setVerifyMsg({ text: 'Network error. Please try again.', type: 'error' });
    }
    setVerifyLoading(false);
  };

  const reset = () => {
    setStep('send');
    setApiKey('');
    setPhone('');
    setOtp('');
    setSendMsg({ text: '', type: '' });
    setVerifyMsg({ text: '', type: '' });
  };

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            <span className="text-xs font-mono text-gray-400 tracking-widest">voicepass / 2fa</span>
          </div>
          <h1 className="text-2xl font-medium text-gray-900 mb-1">Verify your number</h1>
          <p className="text-sm text-gray-500 leading-relaxed">
            Enter your API key and phone number to receive a voice call with your one-time code.
          </p>
        </div>

        {/* Done state */}
        {step === 'done' && (
          <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p className="text-base font-medium text-gray-900 mb-1">Verified</p>
            <p className="text-sm text-gray-500 mb-6">Phone number successfully authenticated.</p>
            <button onClick={reset}
              className="text-sm text-gray-500 border border-gray-200 rounded-lg px-4 py-2 hover:bg-gray-50 transition-colors">
              Start over
            </button>
          </div>
        )}

        {/* Step 1 — always visible unless done */}
        {step !== 'done' && (
          <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-3">
            <p className="text-[11px] font-mono text-gray-300 tracking-widest mb-4">
              STEP 1 — SEND CODE
            </p>

            {/* API Key */}
            <div className="mb-3">
              <label className="block text-xs text-gray-400 mb-1.5">API key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="vp_xxxxxxxxxxxxxxxx"
                disabled={step === 'verify'}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg
                  bg-gray-50 text-gray-900 placeholder-gray-300 outline-none font-mono
                  focus:border-gray-400 focus:bg-white transition-colors
                  disabled:opacity-40 disabled:cursor-not-allowed"
              />
            </div>

            {/* Phone */}
            <div className="mb-4">
              <label className="block text-xs text-gray-400 mb-1.5">Phone number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+234 800 000 0000"
                disabled={step === 'verify'}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg
                  bg-gray-50 text-gray-900 placeholder-gray-300 outline-none
                  focus:border-gray-400 focus:bg-white transition-colors
                  disabled:opacity-40 disabled:cursor-not-allowed"
              />
            </div>

            {step === 'send' ? (
              <button
                onClick={sendOtp}
                disabled={sendLoading}
                className="w-full py-2.5 px-4 text-sm font-medium rounded-lg bg-gray-900 text-white
                  hover:bg-gray-700 active:scale-[0.98] transition-all disabled:opacity-50
                  disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {sendLoading ? (
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="white" strokeOpacity="0.3" strokeWidth="2.5" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                ) : 'Call me with OTP'}
              </button>
            ) : (
              <button
                onClick={() => { setStep('send'); setSendMsg({ text: '', type: '' }); }}
                className="w-full py-2.5 px-4 text-sm text-gray-400 border border-gray-100
                  rounded-lg hover:bg-gray-50 transition-colors"
              >
                Change number
              </button>
            )}

            {sendMsg.text && (
              <p className={`mt-3 text-xs px-3 py-2.5 rounded-lg ${
                sendMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
              }`}>
                {sendMsg.text}
              </p>
            )}
          </div>
        )}

        {/* Step 2 — only after send */}
        {step === 'verify' && (
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <p className="text-[11px] font-mono text-gray-300 tracking-widest mb-4">
              STEP 2 — ENTER CODE
            </p>

            <div className="mb-4">
              <label className="block text-xs text-gray-400 mb-1.5">6-digit OTP</label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="· · · · · ·"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                className="w-full px-3 py-3 text-xl font-mono tracking-[0.3em] text-center
                  border border-gray-200 rounded-lg bg-gray-50 text-gray-900
                  placeholder-gray-300 outline-none focus:border-gray-400 focus:bg-white transition-colors"
              />
            </div>

            <button
              onClick={verifyOtp}
              disabled={verifyLoading || otp.length !== 6}
              className="w-full py-2.5 px-4 text-sm font-medium rounded-lg bg-gray-900 text-white
                hover:bg-gray-700 active:scale-[0.98] transition-all disabled:opacity-40
                disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {verifyLoading ? (
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="white" strokeOpacity="0.3" strokeWidth="2.5" />
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              ) : 'Verify OTP'}
            </button>

            {verifyMsg.text && (
              <p className={`mt-3 text-xs px-3 py-2.5 rounded-lg ${
                verifyMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
              }`}>
                {verifyMsg.text}
              </p>
            )}
          </div>
        )}

      </div>
    </main>
  );
}