'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

type Step = 'send' | 'verify' | 'done';
interface Msg { text: string; type: 'success' | 'error' | ''; }
interface User { id: number; email: string; name: string; api_key: string; balance: number; }

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [step, setStep] = useState<Step>('send');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [sendMsg, setSendMsg] = useState<Msg>({ text: '', type: '' });
  const [verifyMsg, setVerifyMsg] = useState<Msg>({ text: '', type: '' });
  const [sendLoading, setSendLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => { if (data.id) setUser(data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const copyKey = () => {
    if (!user) return;
    navigator.clipboard.writeText(user.api_key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sendOtp = async () => {
    setSendMsg({ text: '', type: '' });
    if (!phone.trim()) {
      setSendMsg({ text: 'Phone number is required.', type: 'error' });
      return;
    }
    setSendLoading(true);
    try {
      const res = await fetch('/api/send-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.api_key}`,
        },
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
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.api_key}`,
        },
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
    setStep('send'); setPhone(''); setOtp('');
    setSendMsg({ text: '', type: '' }); setVerifyMsg({ text: '', type: '' });
  };

  const initials = user?.name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) ?? '??';

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
          <span className="text-xs font-mono text-gray-400 tracking-widest">2FA Layer</span>
        </div>

        {/* User dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="w-8 h-8 rounded-full bg-gray-900 text-white text-xs font-medium
              flex items-center justify-center hover:bg-gray-700 transition-colors"
          >
            {initials}
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-100
              rounded-2xl shadow-sm overflow-hidden z-50">
              {/* User info */}
              <div className="px-4 py-3 border-b border-gray-50">
                <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                <p className="text-xs text-gray-400">{user?.email}</p>
              </div>

              {/* Balance */}
              <div className="px-4 py-3 border-b border-gray-50">
                <p className="text-[11px] text-gray-400 font-mono tracking-widest mb-1">BALANCE</p>
                <p className="text-lg font-medium text-gray-900">
                  ₦{user?.balance?.toFixed(2) ?? '0.00'}
                </p>
              </div>

              {/* API Key */}
              <div className="px-4 py-3 border-b border-gray-50">
                <p className="text-[11px] text-gray-400 font-mono tracking-widest mb-1.5">API KEY</p>
                <div className="flex items-center gap-2">
                  <code className="text-xs text-gray-600 font-mono bg-gray-50 px-2 py-1.5
                    rounded-lg flex-1 truncate border border-gray-100">
                    {user?.api_key}
                  </code>
                  <button
                    onClick={copyKey}
                    className="text-xs text-gray-400 hover:text-gray-700 transition-colors
                      px-2 py-1.5 border border-gray-100 rounded-lg hover:bg-gray-50 shrink-0"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Logout */}
              <button
                onClick={logout}
                className="w-full text-left px-4 py-3 text-sm text-red-500
                  hover:bg-red-50 transition-colors"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* 2FA Demo */}
      <div className="flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-medium text-gray-900 mb-1">Verify your number</h1>
            <p className="text-sm text-gray-500 leading-relaxed">
              Enter a phone number to receive a voice call with a one-time code.
            </p>
          </div>

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
                Try again
              </button>
            </div>
          )}

          {step !== 'done' && (
            <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-3">
              <p className="text-[11px] font-mono text-gray-300 tracking-widest mb-4">STEP 1 — SEND CODE</p>
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
                <button onClick={sendOtp} disabled={sendLoading || !user}
                  className="w-full py-2.5 px-4 text-sm font-medium rounded-lg bg-gray-900 text-white
                    hover:bg-gray-700 active:scale-[0.98] transition-all disabled:opacity-50
                    disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {sendLoading ? (
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="white" strokeOpacity="0.3" strokeWidth="2.5" />
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                  ) : 'Call me with OTP'}
                </button>
              ) : (
                <button onClick={() => { setStep('send'); setSendMsg({ text: '', type: '' }); }}
                  className="w-full py-2.5 px-4 text-sm text-gray-400 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors">
                  Change number
                </button>
              )}

              {sendMsg.text && (
                <p className={`mt-3 text-xs px-3 py-2.5 rounded-lg ${sendMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                  {sendMsg.text}
                </p>
              )}
            </div>
          )}

          {step === 'verify' && (
            <div className="bg-white border border-gray-100 rounded-2xl p-5">
              <p className="text-[11px] font-mono text-gray-300 tracking-widest mb-4">STEP 2 — ENTER CODE</p>
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
              <button onClick={verifyOtp} disabled={verifyLoading || otp.length !== 6}
                className="w-full py-2.5 px-4 text-sm font-medium rounded-lg bg-gray-900 text-white
                  hover:bg-gray-700 active:scale-[0.98] transition-all disabled:opacity-40
                  disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {verifyLoading ? (
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="white" strokeOpacity="0.3" strokeWidth="2.5" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                ) : 'Verify OTP'}
              </button>
              {verifyMsg.text && (
                <p className={`mt-3 text-xs px-3 py-2.5 rounded-lg ${verifyMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                  {verifyMsg.text}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}