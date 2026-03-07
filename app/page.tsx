'use client';
import { useState } from 'react';

export default function Home() {
  const [accountId, setAccountId] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [message, setMessage] = useState('');

  const sendOtp = async () => {
    const res = await fetch('/api/send-otp', {
      method: 'POST',
      body: JSON.stringify({ accountId, phoneNumber: phone }),
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    setMessage(data.message || data.error);
  };

  const verifyOtp = async () => {
    const res = await fetch('/api/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ accountId, otp }),
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    setMessage(data.message || data.error);
  };

  return (
    <main style={{ padding: 20 }}>
      <h1>2FA OTP Demo</h1>
      <div>
        <input placeholder="Account ID" value={accountId} onChange={(e) => setAccountId(e.target.value)} />
        <input placeholder="Phone Number" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <button onClick={sendOtp}>Send OTP</button>
      </div>
      <div style={{ marginTop: 20 }}>
        <input placeholder="Enter OTP" value={otp} onChange={(e) => setOtp(e.target.value)} />
        <button onClick={verifyOtp}>Verify OTP</button>
      </div>
      {message && <p>{message}</p>}
    </main>
  );
}