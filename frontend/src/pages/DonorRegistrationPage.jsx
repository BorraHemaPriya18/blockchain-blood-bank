import React, { useState, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Droplet,
  Upload,
  Camera,
  AlertCircle,
  CheckCircle2,
  SmilePlus,
  ToggleLeft,
  ToggleRight,
  Video,
  ShieldAlert,
  Info,
} from 'lucide-react';

export default function DonorRegistrationPage() {
  const { registerDonor } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    fullName: '',
    dateOfBirth: '1998-06-15',
    gender: 'Male',
    bloodGroup: 'O+',
    phoneNumber: '+1-555-0199',
    street: '742 Evergreen Terrace',
    city: 'Springfield',
    state: 'OR',
    postalCode: '97477',
    emergencyName: 'Jane Doe',
    emergencyRelationship: 'Spouse',
    emergencyPhone: '+1-555-0198',
  });

  const [photoFile, setPhotoFile] = useState(null);
  const [docFile, setDocFile] = useState(null);

  // Affective state / anti-duress demo
  const [affectiveEnabled, setAffectiveEnabled] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [emotionResult, setEmotionResult] = useState(null); // { emotion, confidence, duress }
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Simulated emotion detection — no real ML; demonstrates the paper concept only
  const DEMO_EMOTIONS = [
    { emotion: 'Calm', confidence: 0.97, duress: false },
    { emotion: 'Happy', confidence: 0.94, duress: false },
    { emotion: 'Neutral', confidence: 0.91, duress: false },
  ];

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraActive(true);
      setEmotionResult(null);
    } catch {
      setError('Camera access denied. You can still register manually.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraActive(false);
  }, []);

  const captureAndAnalyse = useCallback(() => {
    // Simulate a 1-second "analysis" then pick a deterministic demo result
    const result = DEMO_EMOTIONS[Math.floor(Math.random() * DEMO_EMOTIONS.length)];
    setTimeout(() => {
      setEmotionResult(result);
      stopCamera();
    }, 1000);
  }, [stopCamera]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const payload = new FormData();
      payload.append('username', formData.username);
      payload.append('email', formData.email);
      payload.append('password', formData.password);
      payload.append('fullName', formData.fullName);
      payload.append('dateOfBirth', formData.dateOfBirth);
      payload.append('gender', formData.gender);
      payload.append('bloodGroup', formData.bloodGroup);
      payload.append('phoneNumber', formData.phoneNumber);

      payload.append(
        'address',
        JSON.stringify({
          street: formData.street,
          city: formData.city,
          state: formData.state,
          postalCode: formData.postalCode,
        })
      );

      payload.append(
        'emergencyContact',
        JSON.stringify({
          name: formData.emergencyName,
          relationship: formData.emergencyRelationship,
          phone: formData.emergencyPhone,
        })
      );

      if (photoFile) payload.append('photo', photoFile);
      if (docFile) payload.append('document', docFile);

      if (affectiveEnabled && emotionResult) {
        payload.append('emotionDetected', emotionResult.emotion);
        payload.append('affectiveConsentStatus', emotionResult.duress ? 'false' : 'true');
      }

      await registerDonor(payload);
      navigate('/donor-dashboard');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex w-12 h-12 rounded-2xl bg-rose-600 items-center justify-center text-white shadow-lg shadow-rose-200 mb-3">
            <Droplet className="w-7 h-7 fill-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Voluntary Blood Donor Registration</h1>
          <p className="mt-2 text-sm text-slate-600 max-w-xl mx-auto">
            Your personal identifiable information (PII) is securely stored off-chain and separated from your
            cryptographic donor reference ID to guarantee privacy and anonymity during blood tracking.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 p-6 sm:p-10">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start space-x-3 text-rose-800 text-sm">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* 1. Account Credentials */}
            <div>
              <h3 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-2 mb-4">
                1. Authentication Credentials
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Username</label>
                  <input
                    type="text"
                    name="username"
                    required
                    value={formData.username}
                    onChange={handleChange}
                    placeholder="johndoe_donor"
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-rose-500 focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Email Address</label>
                  <input
                    type="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="john@example.com"
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-rose-500 focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Password</label>
                  <input
                    type="password"
                    name="password"
                    required
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••••••"
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-rose-500 focus:border-rose-500"
                  />
                </div>
              </div>
            </div>

            {/* 2. Personal Information (PII) */}
            <div>
              <h3 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-2 mb-4">
                2. Donor Profile & Clinical Details (Stored Off-Chain)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700">Full Legal Name</label>
                  <input
                    type="text"
                    name="fullName"
                    required
                    value={formData.fullName}
                    onChange={handleChange}
                    placeholder="John Michael Doe"
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-rose-500 focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Blood Group</label>
                  <select
                    name="bloodGroup"
                    value={formData.bloodGroup}
                    onChange={handleChange}
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-rose-500 focus:border-rose-500 font-semibold text-rose-700"
                  >
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                      <option key={bg} value={bg}>
                        {bg}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Gender</label>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-rose-500 focus:border-rose-500"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700">Date of Birth</label>
                  <input
                    type="date"
                    name="dateOfBirth"
                    required
                    value={formData.dateOfBirth}
                    onChange={handleChange}
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-rose-500 focus:border-rose-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700">Phone Number</label>
                  <input
                    type="tel"
                    name="phoneNumber"
                    required
                    value={formData.phoneNumber}
                    onChange={handleChange}
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-rose-500 focus:border-rose-500"
                  />
                </div>
              </div>

              {/* Address */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700">Street Address</label>
                  <input
                    type="text"
                    name="street"
                    value={formData.street}
                    onChange={handleChange}
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-rose-500 focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">City</label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-rose-500 focus:border-rose-500"
                  />
                </div>
              </div>
            </div>

            {/* 3. Document and Photograph Upload */}
            <div>
              <h3 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-2 mb-4">
                3. Verification Documents & Photo
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 border-2 border-dashed border-slate-300 rounded-xl hover:border-rose-400 transition-colors text-center">
                  <Camera className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Donor Photograph</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setPhotoFile(e.target.files[0])}
                    className="block w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-rose-50 file:text-rose-700 hover:file:bg-rose-100"
                  />
                </div>
                <div className="p-4 border-2 border-dashed border-slate-300 rounded-xl hover:border-rose-400 transition-colors text-center">
                  <Upload className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Supporting ID (PDF/Image)</label>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setDocFile(e.target.files[0])}
                    className="block w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                  />
                </div>
              </div>
            </div>


            {/* 4. Base Paper Demo: Affective State & Anti-Duress Check */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  if (affectiveEnabled) { stopCamera(); setEmotionResult(null); }
                  setAffectiveEnabled((v) => !v);
                }}
                className="w-full flex items-center justify-between px-5 py-4 bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <SmilePlus className="w-5 h-5 text-indigo-500" />
                  <div className="text-left">
                    <p className="text-sm font-bold text-slate-800">
                      Base Paper Demonstration: Affective State &amp; Anti-Duress Check
                    </p>
                    <p className="text-xs text-slate-500">SSRN paper section 5 — optional demo feature</p>
                  </div>
                </div>
                {affectiveEnabled
                  ? <ToggleRight className="w-7 h-7 text-indigo-500" />
                  : <ToggleLeft className="w-7 h-7 text-slate-400" />}
              </button>

              {affectiveEnabled && (
                <div className="px-5 py-4 space-y-4 bg-white">
                  {/* Clinical safety disclaimer */}
                  <div className="flex items-start space-x-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                    <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                    <span>
                      <strong>Clinical Safety Notice:</strong> Facial expressions are <em>never</em> treated as proof
                      of medical consent and will never block a genuine donor. This demo illustrates the coercion-detection
                      concept from the SSRN paper only. Manual verification always takes precedence.
                    </span>
                  </div>

                  {/* Camera / result area */}
                  {!emotionResult ? (
                    <div className="space-y-3">
                      <div className="relative w-full aspect-video bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center">
                        {cameraActive
                          ? <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                          : <div className="text-slate-500 text-xs flex flex-col items-center space-y-2">
                              <Video className="w-8 h-8" />
                              <span>Camera inactive</span>
                            </div>
                        }
                      </div>
                      <div className="flex space-x-3">
                        {!cameraActive
                          ? <button type="button" onClick={startCamera}
                              className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors flex items-center justify-center space-x-1">
                              <Camera className="w-4 h-4" /><span>Start Camera</span>
                            </button>
                          : <>
                              <button type="button" onClick={captureAndAnalyse}
                                className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors">
                                Capture &amp; Analyse
                              </button>
                              <button type="button" onClick={stopCamera}
                                className="px-4 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold transition-colors">
                                Cancel
                              </button>
                            </>
                        }
                      </div>
                    </div>
                  ) : (
                    <div className={`p-4 rounded-xl border ${
                      emotionResult.duress
                        ? 'bg-rose-50 border-rose-300'
                        : 'bg-emerald-50 border-emerald-300'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-slate-800">
                            Detected: <span className={emotionResult.duress ? 'text-rose-600' : 'text-emerald-600'}>
                              {emotionResult.emotion}
                            </span>
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Confidence: {(emotionResult.confidence * 100).toFixed(0)}%
                            {emotionResult.duress
                              ? ' — Possible coercion signal detected. Manual review recommended.'
                              : ' — No duress indicators detected.'}
                          </p>
                        </div>
                        <CheckCircle2 className={`w-6 h-6 ${emotionResult.duress ? 'text-rose-500' : 'text-emerald-500'}`} />
                      </div>
                      <button type="button" onClick={() => { setEmotionResult(null); }}
                        className="mt-3 text-xs text-slate-500 underline hover:text-slate-700">
                        Re-capture
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl shadow-md shadow-rose-200 transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating Secure Donor Account...' : 'Complete Voluntary Donor Registration'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
