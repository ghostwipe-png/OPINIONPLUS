// app/job/page.js
'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Briefcase, Building2, MapPin, Clock, ExternalLink, Plus, DollarSign, X, CheckCircle2, Trash2, Flame, GraduationCap, Calendar, Zap, AlertCircle } from 'lucide-react';
import { useAuth } from '../../lib/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

let cachedCsrfToken = null;
async function fetchCsrfToken() {
  if (cachedCsrfToken) return cachedCsrfToken;
  try {
    const res = await fetch(`${API_BASE}/auth/csrf`, { credentials: 'include' });
    const data = await res.json();
    cachedCsrfToken = data.token;
    return cachedCsrfToken;
  } catch (e) { return ''; }
}

function JobBoardContent() {
  const { user, isAuthenticated, isAdmin } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: '',
    company: '',
    location: '',
    type: 'Full-time',
    apply_link: '',
    description: '',
    package_type: 'single', // 'single' (KES 500) or 'multiple' (KES 1,200)
    job_slots: 1, // 1 to 12
    deadline: '',
    is_urgent: false,
    education: 'No Experience Needed',
    additional_info: '',
  });

  const fetchJobs = async () => {
    try {
      const res = await fetch(`${API_BASE}/jobs`);
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
      }
    } catch (e) {
      console.error('Failed to fetch jobs:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();

    // Check if returning from Paystack with a reference
    const reference = searchParams.get('reference');
    if (reference) {
      verifyAndPublishJob(reference);
    }
  }, [searchParams]);

  const verifyAndPublishJob = async (reference) => {
    setVerifying(true);
    try {
      const token = await fetchCsrfToken();
      const res = await fetch(`${API_BASE}/jobs/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token || '' },
        credentials: 'include',
        body: JSON.stringify({ reference }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setSuccessMsg('Payment confirmed! Your job posting is live.');
        fetchJobs();
        window.history.replaceState({}, '', '/job');
      } else {
        alert(data.error || 'Payment verification failed.');
      }
    } catch (e) {
      alert('Error verifying transaction.');
    } finally {
      setVerifying(false);
    }
  };

  const handleDeleteJob = async (jobId) => {
    if (!confirm('Are you sure you want to delete this job posting?')) return;
    try {
      const token = await fetchCsrfToken();
      const res = await fetch(`${API_BASE}/jobs/${jobId}`, {
        method: 'DELETE',
        headers: { 'X-CSRF-Token': token || '' },
        credentials: 'include',
      });
      if (res.ok) {
        setJobs((prev) => prev.filter((j) => j.id !== jobId));
      } else {
        alert('Failed to delete job posting.');
      }
    } catch (e) {
      alert('Error deleting job post.');
    }
  };

  const formatApplyLink = (link) => {
    if (!link) return '#';
    if (link.startsWith('http://') || link.startsWith('https://') || link.startsWith('mailto:')) {
      return link;
    }
    return `https://${link}`;
  };

  const handleInitPaystackPayment = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    const priceKES = form.package_type === 'multiple' ? 1200 : 500;
    const payload = {
      ...form,
      amount_kes: priceKES,
      author_id: user?.id,
    };

    try {
      const token = await fetchCsrfToken();
      const res = await fetch(`${API_BASE}/jobs/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token || '' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      
      const data = await res.json();
      if (res.ok && data.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        alert(data.error || 'Failed to initialize Paystack session.');
        setSubmitting(false);
      }
    } catch (e) {
      alert('Network error while connecting to Paystack.');
      setSubmitting(false);
    }
  };

  // Automatically filter out jobs older than 60 days
  const activeJobs = jobs.filter((job) => {
    if (!job.created_at) return true;
    const createdDate = new Date(job.created_at).getTime();
    const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;
    return Date.now() - createdDate <= sixtyDaysMs;
  });

  return (
    <div className="min-h-screen bg-paper pb-24 relative">
      {verifying && (
        <div className="fixed inset-0 z-50 bg-ink/80 backdrop-blur-sm grid place-items-center text-white p-4">
          <div className="text-center space-y-3">
            <div className="w-12 h-12 border-4 border-signal border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-lg font-black uppercase tracking-widest">Verifying Payment...</p>
            <p className="text-xs text-white/60">Confirming your Paystack transaction securely.</p>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-600 text-white p-4 text-center text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 shadow-md">
          <CheckCircle2 size={16} /> {successMsg}
          <button onClick={() => setSuccessMsg('')} className="ml-4 underline opacity-80 hover:opacity-100">Dismiss</button>
        </div>
      )}

      {/* HERO BANNER */}
      <section className="bg-[#1C1917] text-white py-16 px-6 relative overflow-hidden">
        <div className="max-w-6xl mx-auto relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="bg-signal/20 text-signal font-bold uppercase text-[10px] px-3 py-1 inline-flex items-center gap-1.5 rounded-full mb-3">
              <Briefcase size={12} /> Direct Media & Corporate Careers
            </div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight uppercase leading-none mb-2">
              Opportunity <span className="text-signal">Hub</span>
            </h1>
            <p className="text-xs sm:text-sm font-medium text-white/70 max-w-xl">
              Post single roles or bulk listings. All job posts automatically remain active for 60 days.
            </p>
          </div>

          {isAuthenticated ? (
            <button 
              onClick={() => setShowModal(true)}
              className="bg-signal text-white font-bold uppercase text-xs tracking-wider px-7 py-3.5 rounded-full hover:bg-white hover:text-ink transition-all shadow-lg flex items-center gap-2 shrink-0"
            >
              <Plus size={16} /> Post Jobs (From KES 500)
            </button>
          ) : (
            <Link 
              href="/login"
              className="bg-white/10 text-white font-bold uppercase text-xs tracking-wider px-7 py-3.5 rounded-full hover:bg-white hover:text-ink transition-all shrink-0"
            >
              Sign in to Post
            </Link>
          )}
        </div>
      </section>

      {/* COMPACT DENSE JOB LISTINGS SECTION */}
      <div className="max-w-6xl mx-auto px-5 pt-8">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-500">
            Active Opportunity Stream ({activeJobs.length})
          </p>
          <span className="text-[10px] text-ink-400 font-semibold uppercase">Auto-expires after 60 Days</span>
        </div>

        {loading ? (
          <div className="space-y-3 py-8">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 bg-white rounded-xl animate-pulse shadow-xs" />
            ))}
          </div>
        ) : activeJobs.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-xs my-6">
            <Briefcase size={36} className="mx-auto text-ink-300 mb-3" />
            <p className="text-lg font-black uppercase tracking-tight text-ink mb-1">No active listings</p>
            <p className="text-xs font-medium text-ink-500 max-w-sm mx-auto">Be the first employer to list a role and reach our audience of writers, creators, and media pros.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {activeJobs.map((job) => {
              const isOwnerOrAdmin = user && (user.id === job.author_id || user.id === job.user_id || isAdmin);

              return (
                <div 
                  key={job.id} 
                  className="bg-white rounded-xl p-4 shadow-[0_2px_10px_rgba(0,0,0,0.03)] hover:shadow-md transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs group"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-ink-50 shrink-0 flex items-center justify-center overflow-hidden">
                      {job.employer_logo ? (
                        <img src={job.employer_logo} alt={job.company} className="w-full h-full object-cover" />
                      ) : (
                        <Building2 size={18} className="text-ink-400" />
                      )}
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-extrabold text-ink text-sm tracking-tight truncate">{job.title}</h3>
                        
                        {job.is_urgent && (
                          <span className="bg-red-50 text-signal font-black text-[9px] px-2 py-0.5 rounded-full flex items-center gap-1 uppercase tracking-wider">
                            <Flame size={10} /> Urgent
                          </span>
                        )}
                        
                        {job.education && (
                          <span className="bg-ink-50 text-ink-600 font-semibold text-[9px] px-2 py-0.5 rounded-full flex items-center gap-1 uppercase">
                            <GraduationCap size={10} /> {job.education}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-500 font-medium">
                        <span className="font-bold text-signal">{job.company}</span>
                        <span>• {job.location || 'Remote'}</span>
                        <span>• {job.type}</span>
                        {job.deadline && (
                          <span className="text-amber-600 font-bold flex items-center gap-1">
                            <Calendar size={10} /> Closes: {job.deadline}
                          </span>
                        )}
                      </div>

                      {(job.description || job.additional_info) && (
                        <p className="text-ink-600 line-clamp-1 text-[11px] font-normal">
                          {job.additional_info || job.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2 justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-wire/40">
                    {isOwnerOrAdmin && (
                      <button
                        onClick={() => handleDeleteJob(job.id)}
                        className="text-ink-400 hover:text-signal p-2 rounded-full hover:bg-red-50 transition-colors"
                        title="Delete Post"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}

                    <a 
                      href={formatApplyLink(job.apply_link)} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="bg-ink text-white font-bold uppercase text-[10px] tracking-wider px-5 py-2.5 rounded-full hover:bg-signal transition-colors flex items-center gap-1.5 shadow-xs"
                    >
                      Apply <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* COMPACT MODAL FOR JOB POSTING */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl relative p-6 sm:p-8">
            <button 
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 p-2 text-ink-400 hover:text-signal rounded-full transition-colors"
            >
              <X size={20} />
            </button>
            
            <div className="mb-6 border-b border-wire/60 pb-4">
              <h2 className="text-2xl font-black uppercase tracking-tight text-ink flex items-center gap-2">
                <Briefcase className="text-signal" /> Employer Suite
              </h2>
              <p className="text-xs font-medium text-ink-500 mt-1">Select your publishing package and job requirements.</p>
            </div>

            <form onSubmit={handleInitPaystackPayment} className="space-y-4">
              {/* PACKAGE SELECTION */}
              <div>
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-ink-500 block mb-2">Posting Package</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, package_type: 'single', job_slots: 1 })}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      form.package_type === 'single'
                        ? 'border-signal bg-signal/5 text-ink shadow-xs'
                        : 'border-wire/80 bg-paper text-ink-600 hover:border-ink'
                    }`}
                  >
                    <p className="text-xs font-black uppercase">Single Job Post</p>
                    <p className="text-lg font-black text-ink mt-0.5">KES 500</p>
                    <p className="text-[10px] text-ink-400 mt-1">1 Job Slot • Active 60 Days</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm({ ...form, package_type: 'multiple', job_slots: 12 })}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      form.package_type === 'multiple'
                        ? 'border-signal bg-signal/5 text-ink shadow-xs'
                        : 'border-wire/80 bg-paper text-ink-600 hover:border-ink'
                    }`}
                  >
                    <p className="text-xs font-black uppercase flex items-center gap-1">
                      <Zap size={12} className="text-signal" /> Multiple Package
                    </p>
                    <p className="text-lg font-black text-ink mt-0.5">KES 1,200</p>
                    <p className="text-[10px] text-ink-400 mt-1">Up to 12 Jobs • Active 60 Days</p>
                  </button>
                </div>
              </div>

              {/* JOB FIELDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-ink-500 block mb-1">Job Title</label>
                  <input 
                    required
                    value={form.title} 
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g. Senior Copywriter" 
                    className="w-full bg-[#F4F4F6] rounded-lg px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:bg-white focus:ring-1 focus:ring-ink"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-ink-500 block mb-1">Company Name</label>
                  <input 
                    required
                    value={form.company} 
                    onChange={(e) => setForm({ ...form, company: e.target.value })}
                    placeholder="e.g. Acme Media House" 
                    className="w-full bg-[#F4F4F6] rounded-lg px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:bg-white focus:ring-1 focus:ring-ink"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-ink-500 block mb-1">Location</label>
                  <input 
                    value={form.location} 
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    placeholder="e.g. Nairobi, Kenya or Remote" 
                    className="w-full bg-[#F4F4F6] rounded-lg px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:bg-white focus:ring-1 focus:ring-ink"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-ink-500 block mb-1">Employment Type</label>
                  <select 
                    value={form.type} 
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full bg-[#F4F4F6] rounded-lg px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:bg-white focus:ring-1 focus:ring-ink"
                  >
                    <option>Full-time</option>
                    <option>Part-time</option>
                    <option>Contract</option>
                    <option>Freelance</option>
                    <option>Internship</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-ink-500 block mb-1">Qualification Required</label>
                  <select 
                    value={form.education} 
                    onChange={(e) => setForm({ ...form, education: e.target.value })}
                    className="w-full bg-[#F4F4F6] rounded-lg px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:bg-white focus:ring-1 focus:ring-ink"
                  >
                    <option>No Experience Needed</option>
                    <option>Certificate Needed</option>
                    <option>Diploma Needed</option>
                    <option>Degree Needed</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-ink-500 block mb-1">Application Closing Deadline</label>
                  <input 
                    type="date"
                    value={form.deadline} 
                    onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                    className="w-full bg-[#F4F4F6] rounded-lg px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:bg-white focus:ring-1 focus:ring-ink"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-ink-500 block mb-1">Application URL or Email</label>
                <input 
                  required
                  value={form.apply_link} 
                  onChange={(e) => setForm({ ...form, apply_link: e.target.value })}
                  placeholder="https://company.com/apply or mailto:jobs@company.com" 
                  className="w-full bg-[#F4F4F6] rounded-lg px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:bg-white focus:ring-1 focus:ring-ink"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-ink-500 block mb-1">Optional Relevant Details</label>
                <textarea 
                  value={form.additional_info} 
                  onChange={(e) => setForm({ ...form, additional_info: e.target.value })}
                  placeholder="Mention salary range, key benefits, or special instructions..." 
                  rows={2}
                  className="w-full bg-[#F4F4F6] rounded-lg px-3.5 py-2.5 text-xs font-medium focus:outline-none focus:bg-white focus:ring-1 focus:ring-ink resize-none"
                />
              </div>

              {/* URGENT TOGGLE */}
              <div className="flex items-center gap-2 pt-1">
                <input 
                  type="checkbox" 
                  id="urgent_check"
                  checked={form.is_urgent} 
                  onChange={(e) => setForm({ ...form, is_urgent: e.target.checked })}
                  className="rounded text-signal focus:ring-signal w-4 h-4 cursor-pointer"
                />
                <label htmlFor="urgent_check" className="text-xs font-extrabold text-ink uppercase cursor-pointer flex items-center gap-1">
                  <Flame size={14} className="text-signal" /> Mark as Needed Urgently
                </label>
              </div>

              {/* PAYMENT CHECKOUT SUMMARY */}
              <div className="bg-[#1C1917] text-white rounded-xl p-4 flex items-center justify-between mt-4">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-signal">Paystack Checkout Total</p>
                  <p className="text-xs font-medium text-white/70">M-Pesa, Cards & Mobile Money</p>
                </div>
                <p className="text-2xl font-black text-white">
                  KES {form.package_type === 'multiple' ? '1,200' : '500'}
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-paper text-ink font-bold uppercase text-[10px] tracking-wider py-3.5 rounded-full hover:bg-wire/40 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={submitting}
                  className="flex-[2] bg-signal text-white font-bold uppercase text-[10px] tracking-wider py-3.5 rounded-full hover:bg-ink transition-colors shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <DollarSign size={14} /> {submitting ? 'Connecting...' : 'Proceed to Paystack'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function JobBoardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-paper grid place-items-center text-xs font-bold uppercase tracking-widest text-ink-400">Loading Job Board...</div>}>
      <JobBoardContent />
    </Suspense>
  );
}