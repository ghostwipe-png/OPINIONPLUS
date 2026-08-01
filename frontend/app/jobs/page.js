// app/job/page.js
'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Briefcase, Building2, MapPin, Clock, ExternalLink, Plus, DollarSign, X, CheckCircle2,
  Trash2, Flame, GraduationCap, Calendar, Zap, AlertCircle, Search, SlidersHorizontal,
  Star, Bookmark, Share2, Copy, Mail, ChevronDown, LayoutDashboard, Edit3, RefreshCw,
  Users, Sparkles, MessageCircle, Rss,
} from 'lucide-react';
import { useAuth } from '../../lib/auth';
import JobAlertsForm from '../../components/JobAlertsForm';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract', 'Freelance', 'Internship'];
const SALARY_CURRENCIES = ['KES', 'USD', 'EUR', 'GBP', 'ZAR', 'NGN', 'TZS', 'UGX'];
const CATEGORIES = [
  'Media & Journalism', 'Tech & Development', 'Marketing & PR', 'Finance & Accounting',
  'Healthcare', 'Education', 'NGO & Nonprofit', 'Government', 'Sales',
  'Design & Creative', 'Engineering', 'Hospitality',
];
const CATEGORY_COLORS = {
  'Media & Journalism': 'bg-rose-50 text-rose-600',
  'Tech & Development': 'bg-blue-50 text-blue-600',
  'Marketing & PR': 'bg-purple-50 text-purple-600',
  'Finance & Accounting': 'bg-emerald-50 text-emerald-600',
  'Healthcare': 'bg-teal-50 text-teal-600',
  'Education': 'bg-amber-50 text-amber-600',
  'NGO & Nonprofit': 'bg-lime-50 text-lime-700',
  'Government': 'bg-slate-100 text-slate-600',
  'Sales': 'bg-orange-50 text-orange-600',
  'Design & Creative': 'bg-pink-50 text-pink-600',
  'Engineering': 'bg-indigo-50 text-indigo-600',
  'Hospitality': 'bg-cyan-50 text-cyan-600',
};

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

function formatApplyLink(link) {
  if (!link) return '#';
  if (link.startsWith('http://') || link.startsWith('https://') || link.startsWith('mailto:')) {
    return link;
  }
  return `https://${link}`;
}

function formatSalary(min, max, currency = 'KES') {
  const fmt = (n) => (n >= 1000 ? `${Math.round(n / 1000)}K` : n);
  if (min && max) return `${currency} ${fmt(min)} - ${fmt(max)}`;
  if (min) return `From ${currency} ${fmt(min)}`;
  if (max) return `Up to ${currency} ${fmt(max)}`;
  return null;
}

function isFeaturedActive(job) {
  if (!job?.is_featured) return false;
  if (!job.featured_until) return true;
  return new Date(job.featured_until).getTime() > Date.now();
}

function deriveCountryFromLocation(location) {
  if (!location) return 'KE';
  const loc = location.toLowerCase();
  if (loc.includes('kenya') || loc.includes('nairobi') || loc.includes('mombasa') || loc.includes('kisumu')) return 'KE';
  if (loc.includes('uganda') || loc.includes('kampala')) return 'UG';
  if (loc.includes('tanzania') || loc.includes('dar es salaam') || loc.includes('dodoma')) return 'TZ';
  if (loc.includes('rwanda') || loc.includes('kigali')) return 'RW';
  if (loc.includes('nigeria') || loc.includes('lagos') || loc.includes('abuja')) return 'NG';
  if (loc.includes('south africa') || loc.includes('johannesburg') || loc.includes('cape town')) return 'ZA';
  if (loc.includes('ghana') || loc.includes('accra')) return 'GH';
  if (loc.includes('ethiopia') || loc.includes('addis ababa')) return 'ET';
  if (loc.includes('remote')) return null; // Remote jobs have no fixed country
  return 'KE'; // Default to Kenya for unspecified locations
}

function JobBoardContent() {
  const { user, isAuthenticated, isAdmin } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [jobs, setJobs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Filters
  const [filters, setFilters] = useState({
    q: searchParams.get('q') || '',
    type: searchParams.get('type') || '',
    category: searchParams.get('category') || '',
    remote: searchParams.get('remote') === 'true',
    urgent: searchParams.get('urgent') === 'true',
    sort: searchParams.get('sort') || 'newest',
  });
  const [searchInput, setSearchInput] = useState(filters.q);
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10) || 1);
  const [showFilters, setShowFilters] = useState(false);

  // Saved jobs
  const [savedIds, setSavedIds] = useState(new Set());

  // Employer dashboard
  const [dashboardJobs, setDashboardJobs] = useState([]);
  const [showDashboard, setShowDashboard] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  // Share dropdown
  const [shareOpenId, setShareOpenId] = useState(null);

  // Feature-job modal
  const [featureModalJob, setFeatureModalJob] = useState(null);
  const [featurePlan, setFeaturePlan] = useState('7');
  const [featureSubmitting, setFeatureSubmitting] = useState(false);

  // Edit-job modal
  const [editingJob, setEditingJob] = useState(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Post-job modal
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: '',
    company: '',
    location: '',
    type: 'Full-time',
    apply_link: '',
    description: '',
    package_type: 'single',
    job_slots: 1,
    deadline: '',
    is_urgent: false,
    education: 'No Experience Needed',
    additional_info: '',
    category: 'Media & Journalism',
    is_remote: false,
    salary_min: '',
    salary_max: '',
    salary_currency: 'KES',
  });

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const params = new URLSearchParams();
      if (filters.q) params.set('q', filters.q);
      if (filters.type) params.set('type', filters.type);
      if (filters.category) params.set('category', filters.category);
      if (filters.remote) params.set('remote', '1');
      if (filters.urgent) params.set('urgent', '1');
      if (filters.sort) params.set('sort', filters.sort);
      params.set('page', String(page));
      params.set('limit', '20');

      const res = await fetch(`${API_BASE}/jobs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
        setPagination(data.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 });
      } else {
        setLoadError('Failed to load job listings.');
      }
    } catch (e) {
      setLoadError('Network error while loading job listings.');
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  // Debounced search input -> filters.q
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput !== filters.q) updateFilter({ q: searchInput });
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  // Handle Paystack return references
  useEffect(() => {
    const reference = searchParams.get('reference');
    const featureReference = searchParams.get('feature_reference');
    const renewReference = searchParams.get('renew_reference');
    if (reference) verifyAndPublishJob(reference);
    if (renewReference) verifyAndPublishJob(renewReference, true);
    if (featureReference) verifyFeaturePayment(featureReference);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Saved jobs (auth only)
  useEffect(() => {
    if (!isAuthenticated) { setSavedIds(new Set()); return; }
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/jobs/saved`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setSavedIds(new Set((data.jobs || []).map((j) => j.id)));
        }
      } catch (e) { /* silent */ }
    })();
  }, [isAuthenticated]);

  // Employer dashboard (auth only)
  const fetchDashboard = useCallback(async () => {
    if (!isAuthenticated) { setDashboardJobs([]); return; }
    setDashboardLoading(true);
    try {
      const res = await fetch(`${API_BASE}/jobs/dashboard`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setDashboardJobs(data.jobs || []);
      }
    } catch (e) { /* silent */ }
    setDashboardLoading(false);
  }, [isAuthenticated]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard, jobs]);

  const updateFilter = (patch) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    setPage(1);
    const params = new URLSearchParams();
    if (next.q) params.set('q', next.q);
    if (next.type) params.set('type', next.type);
    if (next.category) params.set('category', next.category);
    if (next.remote) params.set('remote', 'true');
    if (next.urgent) params.set('urgent', 'true');
    if (next.sort && next.sort !== 'newest') params.set('sort', next.sort);
    router.replace(`/job${params.toString() ? `?${params.toString()}` : ''}`, { scroll: false });
  };

  const clearFilters = () => {
    setSearchInput('');
    updateFilter({ q: '', type: '', category: '', remote: false, urgent: false, sort: 'newest' });
  };

  const activeFilterCount = [
    filters.q, filters.type, filters.category, filters.remote, filters.urgent,
  ].filter(Boolean).length;

  const verifyAndPublishJob = async (reference, isRenewal = false) => {
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
        setSuccessMsg(data.message || (isRenewal ? 'Job renewed successfully!' : 'Payment confirmed! Your job posting is live.'));
        fetchJobs();
        fetchDashboard();
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

  const verifyFeaturePayment = async (reference) => {
    setVerifying(true);
    try {
      const token = await fetchCsrfToken();
      // Use standalone feature-verify endpoint (no :id param needed — job_id comes from Paystack metadata)
      const res = await fetch(`${API_BASE}/jobs/feature-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token || '' },
        credentials: 'include',
        body: JSON.stringify({ reference }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setSuccessMsg(data.message || 'Your job is now featured!');
        fetchJobs();
        fetchDashboard();
        window.history.replaceState({}, '', '/job');
      } else {
        alert(data.error || 'Featured job payment verification failed.');
      }
    } catch (e) {
      alert('Error verifying featured job payment.');
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
        setDashboardJobs((prev) => prev.filter((j) => j.id !== jobId));
      } else {
        alert('Failed to delete job posting.');
      }
    } catch (e) {
      alert('Error deleting job post.');
    }
  };

  const handleApplyClick = (jobId) => {
    fetch(`${API_BASE}/jobs/${jobId}/apply`, { method: 'POST' }).catch(() => {});
  };

  const toggleSaveJob = async (jobId) => {
    if (!isAuthenticated) { router.push('/login'); return; }
    const isSaved = savedIds.has(jobId);
    setSavedIds((prev) => {
      const next = new Set(prev);
      isSaved ? next.delete(jobId) : next.add(jobId);
      return next;
    });
    try {
      const token = await fetchCsrfToken();
      const res = await fetch(`${API_BASE}/jobs/${jobId}/save`, {
        method: isSaved ? 'DELETE' : 'POST',
        headers: { 'X-CSRF-Token': token || '' },
        credentials: 'include',
      });
      if (!res.ok) throw new Error('failed');
    } catch (e) {
      // revert on failure
      setSavedIds((prev) => {
        const next = new Set(prev);
        isSaved ? next.add(jobId) : next.delete(jobId);
        return next;
      });
    }
  };

  const copyShareLink = async (job) => {
    const link = `https://opinionplus.online/job?id=${job.id}`;
    try {
      await navigator.clipboard.writeText(link);
      setSuccessMsg('Link copied to clipboard!');
      setTimeout(() => setSuccessMsg(''), 2500);
    } catch (e) { /* silent */ }
    setShareOpenId(null);
  };

  const shareLinks = (job) => {
    const link = `https://opinionplus.online/job?id=${job.id}`;
    const text = `Check out this job at ${job.company}: ${job.title} — ${link}`;
    return {
      whatsapp: `https://wa.me/?text=${encodeURIComponent(text)}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(link)}`,
    };
  };

  const openFeatureModal = (job) => {
    setFeaturePlan('7');
    setFeatureModalJob(job);
  };

  const handleFeaturePayment = async () => {
    if (!featureModalJob) return;
    setFeatureSubmitting(true);
    try {
      const token = await fetchCsrfToken();
      const res = await fetch(`${API_BASE}/jobs/${featureModalJob.id}/feature-initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token || '' },
        credentials: 'include',
        body: JSON.stringify({ plan: featurePlan }),
      });
      const data = await res.json();
      if (res.ok && data.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        alert(data.error || 'Failed to initialize featured job payment.');
        setFeatureSubmitting(false);
      }
    } catch (e) {
      alert('Network error while connecting to Paystack.');
      setFeatureSubmitting(false);
    }
  };

  const openEditModal = (job) => {
    setEditingJob({
      id: job.id,
      title: job.title || '',
      description: job.description || '',
      additional_info: job.additional_info || '',
      location: job.location || '',
      apply_link: job.apply_link || '',
      deadline: job.deadline || '',
      is_urgent: !!job.is_urgent,
      is_remote: !!job.is_remote,
      category: job.category || 'Media & Journalism',
      salary_min: job.salary_min || '',
      salary_max: job.salary_max || '',
      salary_currency: job.salary_currency || 'KES',
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingJob) return;
    setEditSubmitting(true);
    try {
      const token = await fetchCsrfToken();
      const { id, ...payload } = editingJob;
      const res = await fetch(`${API_BASE}/jobs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token || '' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setSuccessMsg('Job listing updated.');
        setEditingJob(null);
        fetchJobs();
        fetchDashboard();
      } else {
        alert(data.error || 'Failed to update job.');
      }
    } catch (e) {
      alert('Error updating job.');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleRenewJob = async (jobId) => {
    try {
      const token = await fetchCsrfToken();
      const res = await fetch(`${API_BASE}/jobs/${jobId}/renew`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token || '' },
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok && data.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        alert(data.error || 'Failed to initialize renewal payment.');
      }
    } catch (e) {
      alert('Network error while connecting to Paystack.');
    }
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

  // Automatically filter out jobs older than 60 days (preserved behavior)
  const activeJobs = jobs.filter((job) => {
    if (!job.created_at) return true;
    const createdDate = new Date(job.created_at).getTime();
    const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;
    return Date.now() - createdDate <= sixtyDaysMs;
  });

  const featuredJobs = activeJobs.filter(isFeaturedActive);
  const regularJobs = activeJobs.filter((j) => !isFeaturedActive(j));

  // Google Jobs structured data (best-effort JSON-LD for this listing page)
  const jobPostingLd = activeJobs.slice(0, 30).map((job) => {
    const country = deriveCountryFromLocation(job.location);
    const jobLd = {
      '@context': 'https://schema.org/',
      '@type': 'JobPosting',
      title: job.title,
      description: job.description || job.additional_info || job.title,
      datePosted: job.created_at,
      validThrough: job.deadline || undefined,
      employmentType: (job.type || 'FULL_TIME').toUpperCase().replace('-', '_'),
      hiringOrganization: { '@type': 'Organization', name: job.company },
      jobLocation: {
        '@type': 'Place',
        address: {
          '@type': 'PostalAddress',
          addressLocality: job.location || 'Remote',
          ...(country ? { addressCountry: country } : {}),
        },
      },
      ...(job.is_remote ? { jobLocationType: 'TELECOMMUTE' } : {}),
      ...(job.education ? { educationRequirements: job.education } : {}),
      ...(job.salary_min || job.salary_max ? {
        baseSalary: {
          '@type': 'MonetaryAmount',
          currency: job.salary_currency || 'KES',
          value: {
            '@type': 'QuantitativeValue',
            minValue: job.salary_min || undefined,
            maxValue: job.salary_max || undefined,
            unitText: 'MONTH',
          },
        },
      } : {}),
    };
    return jobLd;
  });

  return (
    <div className="min-h-screen bg-paper pb-24 relative">
      {jobPostingLd.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jobPostingLd) }}
        />
      )}

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

          <div className="flex items-center gap-2 shrink-0">
            {isAuthenticated && dashboardJobs.length > 0 && (
              <button
                onClick={() => setShowDashboard((v) => !v)}
                className="bg-white/10 text-white font-bold uppercase text-xs tracking-wider px-5 py-3.5 rounded-full hover:bg-white hover:text-ink transition-all flex items-center gap-2"
              >
                <LayoutDashboard size={16} /> My Listings ({dashboardJobs.length})
              </button>
            )}
            {isAuthenticated ? (
              <button
                onClick={() => setShowModal(true)}
                className="bg-signal text-white font-bold uppercase text-xs tracking-wider px-7 py-3.5 rounded-full hover:bg-white hover:text-ink transition-all shadow-lg flex items-center gap-2"
              >
                <Plus size={16} /> Post Jobs (From KES 500)
              </button>
            ) : (
              <Link
                href="/login"
                className="bg-white/10 text-white font-bold uppercase text-xs tracking-wider px-7 py-3.5 rounded-full hover:bg-white hover:text-ink transition-all"
              >
                Sign in to Post
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* EMPLOYER DASHBOARD */}
      {showDashboard && isAuthenticated && (
        <div className="max-w-6xl mx-auto px-5 pt-6">
          <div className="bg-white rounded-2xl shadow-xs p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-black uppercase tracking-wide text-ink flex items-center gap-2">
                <LayoutDashboard size={16} className="text-signal" /> Your Job Listings
              </h2>
              <button onClick={() => setShowDashboard(false)} className="text-ink-400 hover:text-signal">
                <X size={16} />
              </button>
            </div>
            {dashboardLoading ? (
              <div className="space-y-2 py-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-10 bg-paper rounded-lg animate-pulse" />
                ))}
              </div>
            ) : dashboardJobs.length === 0 ? (
              <p className="text-xs text-ink-500 py-4 text-center">No job listings yet. Post your first job above.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-ink-400 uppercase text-[10px] font-bold border-b border-wire/60">
                      <th className="py-2 pr-4">Title</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Applicants</th>
                      <th className="py-2 pr-4">Days Left</th>
                      <th className="py-2 pr-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardJobs.map((job) => (
                      <tr key={job.id} className="border-b border-wire/30 last:border-0">
                        <td className="py-2.5 pr-4 font-semibold text-ink max-w-[200px] truncate">{job.title}</td>
                        <td className="py-2.5 pr-4">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                            job.status === 'active' && !job.is_expired ? 'bg-emerald-50 text-emerald-600'
                            : job.status === 'pending' ? 'bg-amber-50 text-amber-600'
                            : 'bg-ink-50 text-ink-500'
                          }`}>
                            {job.is_expired ? 'Expired' : job.status}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 flex items-center gap-1 text-ink-600"><Users size={11} /> {job.applicant_count || 0}</td>
                        <td className="py-2.5 pr-4 text-ink-500">{job.days_remaining}d</td>
                        <td className="py-2.5 pr-4">
                          <div className="flex items-center gap-2">
                            <button onClick={() => openEditModal(job)} title="Edit" className="text-ink-400 hover:text-signal"><Edit3 size={14} /></button>
                            <button onClick={() => openFeatureModal(job)} title="Feature" className="text-ink-400 hover:text-amber-500"><Star size={14} /></button>
                            {job.is_expired && (
                              <button onClick={() => handleRenewJob(job.id)} title="Renew" className="text-ink-400 hover:text-emerald-500"><RefreshCw size={14} /></button>
                            )}
                            <button onClick={() => handleDeleteJob(job.id)} title="Delete" className="text-ink-400 hover:text-signal"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SEARCH + FILTERS BAR */}
      <div className="max-w-6xl mx-auto px-5 pt-8">
        <div className="bg-white rounded-2xl shadow-xs p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-300" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search jobs, companies, keywords..."
                className="w-full bg-[#F4F4F6] rounded-lg pl-9 pr-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:bg-white focus:ring-1 focus:ring-ink"
              />
            </div>
            <button
              onClick={() => setShowFilters((v) => !v)}
              className="flex items-center justify-center gap-2 bg-[#F4F4F6] hover:bg-wire/40 rounded-lg px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-ink-600 shrink-0"
            >
              <SlidersHorizontal size={13} /> Filters
              {activeFilterCount > 0 && (
                <span className="bg-signal text-white rounded-full w-4 h-4 grid place-items-center text-[9px]">{activeFilterCount}</span>
              )}
            </button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-2 border-t border-wire/50">
              <select
                value={filters.type}
                onChange={(e) => updateFilter({ type: e.target.value })}
                className="bg-[#F4F4F6] rounded-lg px-2.5 py-2 text-[11px] font-semibold focus:outline-none"
              >
                <option value="">All Types</option>
                {EMPLOYMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>

              <select
                value={filters.category}
                onChange={(e) => updateFilter({ category: e.target.value })}
                className="bg-[#F4F4F6] rounded-lg px-2.5 py-2 text-[11px] font-semibold focus:outline-none"
              >
                <option value="">All Categories</option>
                {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
              </select>

              <select
                value={filters.sort}
                onChange={(e) => updateFilter({ sort: e.target.value })}
                className="bg-[#F4F4F6] rounded-lg px-2.5 py-2 text-[11px] font-semibold focus:outline-none"
              >
                <option value="newest">Newest</option>
                <option value="deadline">Closing Soon</option>
                <option value="popular">Most Popular</option>
              </select>

              <label className="flex items-center gap-1.5 bg-[#F4F4F6] rounded-lg px-2.5 py-2 text-[11px] font-semibold cursor-pointer">
                <input type="checkbox" checked={filters.remote} onChange={(e) => updateFilter({ remote: e.target.checked })} className="rounded text-signal w-3.5 h-3.5" />
                Remote Only
              </label>

              <label className="flex items-center gap-1.5 bg-[#F4F4F6] rounded-lg px-2.5 py-2 text-[11px] font-semibold cursor-pointer">
                <input type="checkbox" checked={filters.urgent} onChange={(e) => updateFilter({ urgent: e.target.checked })} className="rounded text-signal w-3.5 h-3.5" />
                Urgent Only
              </label>

              {activeFilterCount > 0 && (
                <button onClick={clearFilters} className="text-[11px] font-bold uppercase text-signal hover:underline">
                  Clear all
                </button>
              )}
            </div>
          )}

          {activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {filters.q && (
                <span className="bg-ink-50 text-ink-600 text-[10px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
                  "{filters.q}" <button onClick={() => { setSearchInput(''); updateFilter({ q: '' }); }}><X size={10} /></button>
                </span>
              )}
              {filters.type && (
                <span className="bg-ink-50 text-ink-600 text-[10px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
                  {filters.type} <button onClick={() => updateFilter({ type: '' })}><X size={10} /></button>
                </span>
              )}
              {filters.category && (
                <span className="bg-ink-50 text-ink-600 text-[10px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
                  {filters.category} <button onClick={() => updateFilter({ category: '' })}><X size={10} /></button>
                </span>
              )}
              {filters.remote && (
                <span className="bg-ink-50 text-ink-600 text-[10px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
                  Remote <button onClick={() => updateFilter({ remote: false })}><X size={10} /></button>
                </span>
              )}
              {filters.urgent && (
                <span className="bg-ink-50 text-ink-600 text-[10px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
                  Urgent <button onClick={() => updateFilter({ urgent: false })}><X size={10} /></button>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* FEATURED JOBS */}
      {featuredJobs.length > 0 && (
        <div className="max-w-6xl mx-auto px-5 pt-6">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-600 flex items-center gap-1.5 mb-3">
            <Star size={13} className="fill-amber-500 text-amber-500" /> Featured Opportunities
          </p>
          <div className="space-y-2.5">
            {featuredJobs.map((job) => {
              if (!job?.id) return null;
              return (
                <JobCard
                  key={job.id}
                  job={job}
                  featured
                  user={user}
                  isAdmin={isAdmin}
                  isSaved={savedIds.has(job.id)}
                  shareOpenId={shareOpenId}
                  setShareOpenId={setShareOpenId}
                  onApply={handleApplyClick}
                  onSave={toggleSaveJob}
                  onDelete={handleDeleteJob}
                  onFeature={openFeatureModal}
                  onEdit={openEditModal}
                  onCopyLink={copyShareLink}
                  shareLinks={shareLinks(job)}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* JOB LISTINGS */}
      <div className="max-w-6xl mx-auto px-5 pt-8">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-500">
            Active Opportunity Stream ({pagination.total || regularJobs.length})
          </p>
          <span className="text-[10px] text-ink-400 font-semibold uppercase">Auto-expires after 60 Days</span>
        </div>

        {loading ? (
          <div className="space-y-3 py-8">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 bg-white rounded-xl animate-pulse shadow-xs" />
            ))}
          </div>
        ) : loadError ? (
          <div className="bg-white rounded-2xl p-10 text-center shadow-xs my-6">
            <AlertCircle size={32} className="mx-auto text-signal mb-3" />
            <p className="text-sm font-bold text-ink mb-3">{loadError}</p>
            <button onClick={fetchJobs} className="bg-ink text-white text-[10px] font-bold uppercase px-5 py-2.5 rounded-full">
              Retry
            </button>
          </div>
        ) : regularJobs.length === 0 && featuredJobs.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-xs my-6">
            <Briefcase size={36} className="mx-auto text-ink-300 mb-3" />
            <p className="text-lg font-black uppercase tracking-tight text-ink mb-1">
              {activeFilterCount > 0 ? 'No jobs match your filters' : 'No active listings'}
            </p>
            <p className="text-xs font-medium text-ink-500 max-w-sm mx-auto mb-4">
              {activeFilterCount > 0
                ? 'Try widening your search or clearing some filters.'
                : 'Be the first employer to list a role and reach our audience of writers, creators, and media pros.'}
            </p>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="bg-ink text-white text-[10px] font-bold uppercase px-5 py-2.5 rounded-full">
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {regularJobs.map((job) => {
              if (!job?.id) return null;
              return (
                <JobCard
                  key={job.id}
                  job={job}
                  user={user}
                  isAdmin={isAdmin}
                  isSaved={savedIds.has(job.id)}
                  shareOpenId={shareOpenId}
                  setShareOpenId={setShareOpenId}
                  onApply={handleApplyClick}
                  onSave={toggleSaveJob}
                  onDelete={handleDeleteJob}
                  onFeature={openFeatureModal}
                  onEdit={openEditModal}
                  onCopyLink={copyShareLink}
                  shareLinks={shareLinks(job)}
                />
              );
            })}
          </div>
        )}

        {/* PAGINATION */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-6">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-4 py-2 rounded-full bg-white shadow-xs text-[10px] font-bold uppercase disabled:opacity-40"
            >
              Prev
            </button>
            <span className="text-[11px] font-semibold text-ink-500">Page {pagination.page} of {pagination.totalPages}</span>
            <button
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              className="px-4 py-2 rounded-full bg-white shadow-xs text-[10px] font-bold uppercase disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* JOB ALERTS SUBSCRIBE */}
      <div className="max-w-6xl mx-auto px-5 pt-12">
        <JobAlertsForm apiBase={API_BASE} fetchCsrfToken={fetchCsrfToken} />
      </div>

      {/* RSS FEED FOOTER LINK */}
      <div className="max-w-6xl mx-auto px-5 pt-6 text-center">
        <a
          href="/job/feed.xml"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-400 hover:text-signal"
        >
          <Rss size={12} /> Jobs RSS Feed
        </a>
      </div>

      {/* FEATURE JOB PAYMENT MODAL */}
      {featureModalJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 relative">
            <button onClick={() => setFeatureModalJob(null)} className="absolute top-4 right-4 text-ink-400 hover:text-signal">
              <X size={18} />
            </button>
            <h2 className="text-lg font-black uppercase tracking-tight text-ink flex items-center gap-2 mb-1">
              <Star size={16} className="text-amber-500" /> Feature Your Job
            </h2>
            <p className="text-xs text-ink-500 mb-4 truncate">"{featureModalJob.title}"</p>

            <div className="space-y-2 mb-4">
              <button
                onClick={() => setFeaturePlan('7')}
                className={`w-full p-3 rounded-xl border text-left transition-all ${featurePlan === '7' ? 'border-signal bg-signal/5' : 'border-wire/80'}`}
              >
                <p className="text-xs font-black uppercase">7 Days</p>
                <p className="text-lg font-black text-ink">KES 200</p>
              </button>
              <button
                onClick={() => setFeaturePlan('30')}
                className={`w-full p-3 rounded-xl border text-left transition-all ${featurePlan === '30' ? 'border-signal bg-signal/5' : 'border-wire/80'}`}
              >
                <p className="text-xs font-black uppercase">30 Days</p>
                <p className="text-lg font-black text-ink">KES 500</p>
              </button>
            </div>

            <button
              onClick={handleFeaturePayment}
              disabled={featureSubmitting}
              className="w-full bg-signal text-white font-bold uppercase text-[10px] tracking-wider py-3.5 rounded-full hover:bg-ink transition-colors shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <DollarSign size={14} /> {featureSubmitting ? 'Connecting...' : 'Proceed to Paystack'}
            </button>
          </div>
        </div>
      )}

      {/* EDIT JOB MODAL */}
      {editingJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setEditingJob(null)} className="absolute top-4 right-4 text-ink-400 hover:text-signal">
              <X size={18} />
            </button>
            <h2 className="text-lg font-black uppercase tracking-tight text-ink flex items-center gap-2 mb-4">
              <Edit3 size={16} className="text-signal" /> Edit Job Listing
            </h2>
            <form onSubmit={handleEditSubmit} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-ink-500 block mb-1">Title</label>
                <input
                  value={editingJob.title}
                  onChange={(e) => setEditingJob({ ...editingJob, title: e.target.value })}
                  className="w-full bg-[#F4F4F6] rounded-lg px-3.5 py-2.5 text-xs font-semibold focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-ink-500 block mb-1">Location</label>
                <input
                  value={editingJob.location}
                  onChange={(e) => setEditingJob({ ...editingJob, location: e.target.value })}
                  className="w-full bg-[#F4F4F6] rounded-lg px-3.5 py-2.5 text-xs font-semibold focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-ink-500 block mb-1">Application URL or Email</label>
                <input
                  value={editingJob.apply_link}
                  onChange={(e) => setEditingJob({ ...editingJob, apply_link: e.target.value })}
                  className="w-full bg-[#F4F4F6] rounded-lg px-3.5 py-2.5 text-xs font-semibold focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-ink-500 block mb-1">Category</label>
                <select
                  value={editingJob.category}
                  onChange={(e) => setEditingJob({ ...editingJob, category: e.target.value })}
                  className="w-full bg-[#F4F4F6] rounded-lg px-3.5 py-2.5 text-xs font-semibold focus:outline-none"
                >
                  {CATEGORIES.map((cat) => <option key={cat}>{cat}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-ink-500 block mb-1">Salary Min</label>
                  <input
                    type="number"
                    min="0"
                    value={editingJob.salary_min}
                    onChange={(e) => setEditingJob({ ...editingJob, salary_min: e.target.value })}
                    className="w-full bg-[#F4F4F6] rounded-lg px-3.5 py-2.5 text-xs font-semibold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-ink-500 block mb-1">Salary Max</label>
                  <input
                    type="number"
                    min="0"
                    value={editingJob.salary_max}
                    onChange={(e) => setEditingJob({ ...editingJob, salary_max: e.target.value })}
                    className="w-full bg-[#F4F4F6] rounded-lg px-3.5 py-2.5 text-xs font-semibold focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-ink-500 block mb-1">Currency</label>
                <select
                  value={editingJob.salary_currency}
                  onChange={(e) => setEditingJob({ ...editingJob, salary_currency: e.target.value })}
                  className="w-full bg-[#F4F4F6] rounded-lg px-3.5 py-2.5 text-xs font-semibold focus:outline-none"
                >
                  {SALARY_CURRENCIES.map((cur) => <option key={cur} value={cur}>{cur}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-ink-500 block mb-1">Closing Deadline</label>
                <input
                  type="date"
                  value={editingJob.deadline || ''}
                  onChange={(e) => setEditingJob({ ...editingJob, deadline: e.target.value })}
                  className="w-full bg-[#F4F4F6] rounded-lg px-3.5 py-2.5 text-xs font-semibold focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-ink-500 block mb-1">Description</label>
                <textarea
                  rows={3}
                  value={editingJob.description}
                  onChange={(e) => setEditingJob({ ...editingJob, description: e.target.value })}
                  className="w-full bg-[#F4F4F6] rounded-lg px-3.5 py-2.5 text-xs font-medium focus:outline-none resize-none"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingJob.is_remote}
                  onChange={(e) => setEditingJob({ ...editingJob, is_remote: e.target.checked })}
                  className="rounded text-signal w-4 h-4"
                />
                <span className="text-xs font-extrabold text-ink uppercase">Remote Position</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingJob.is_urgent}
                  onChange={(e) => setEditingJob({ ...editingJob, is_urgent: e.target.checked })}
                  className="rounded text-signal w-4 h-4"
                />
                <span className="text-xs font-extrabold text-ink uppercase flex items-center gap-1"><Flame size={12} className="text-signal" /> Mark as Urgent</span>
              </label>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditingJob(null)} className="flex-1 bg-paper text-ink font-bold uppercase text-[10px] tracking-wider py-3 rounded-full hover:bg-wire/40">
                  Cancel
                </button>
                <button type="submit" disabled={editSubmitting} className="flex-[2] bg-ink text-white font-bold uppercase text-[10px] tracking-wider py-3 rounded-full hover:bg-signal disabled:opacity-50">
                  {editSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                    {EMPLOYMENT_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-ink-500 block mb-1">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full bg-[#F4F4F6] rounded-lg px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:bg-white focus:ring-1 focus:ring-ink"
                  >
                    {CATEGORIES.map((cat) => <option key={cat}>{cat}</option>)}
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

                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.is_remote}
                      onChange={(e) => setForm({ ...form, is_remote: e.target.checked })}
                      className="rounded text-signal w-4 h-4"
                    />
                    <span className="text-xs font-extrabold text-ink uppercase">Remote Position</span>
                  </label>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-ink-500 block mb-1">Salary Min (optional)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.salary_min}
                    onChange={(e) => setForm({ ...form, salary_min: e.target.value })}
                    placeholder="e.g. 50000"
                    className="w-full bg-[#F4F4F6] rounded-lg px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:bg-white focus:ring-1 focus:ring-ink"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-ink-500 block mb-1">Salary Max (optional)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.salary_max}
                    onChange={(e) => setForm({ ...form, salary_max: e.target.value })}
                    placeholder="e.g. 100000"
                    className="w-full bg-[#F4F4F6] rounded-lg px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:bg-white focus:ring-1 focus:ring-ink"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-ink-500 block mb-1">Salary Currency</label>
                  <select
                    value={form.salary_currency}
                    onChange={(e) => setForm({ ...form, salary_currency: e.target.value })}
                    className="w-full bg-[#F4F4F6] rounded-lg px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:bg-white focus:ring-1 focus:ring-ink"
                  >
                    {SALARY_CURRENCIES.map((cur) => <option key={cur} value={cur}>{cur}</option>)}
                  </select>
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

function JobCard({
  job, featured, user, isAdmin, isSaved, shareOpenId, setShareOpenId,
  onApply, onSave, onDelete, onFeature, onEdit, onCopyLink, shareLinks,
}) {
  // Only check employer_id — the field the backend actually stores
  const isOwnerOrAdmin = user && (user.id === job.employer_id || isAdmin);
  const salaryLabel = formatSalary(job.salary_min, job.salary_max, job.salary_currency);
  const isShareOpen = shareOpenId === job.id;

  return (
    <div
      className={`bg-white rounded-xl p-4 shadow-[0_2px_10px_rgba(0,0,0,0.03)] hover:shadow-md transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs group ${
        featured ? 'border-2 border-amber-400' : ''
      }`}
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
            {featured && (
              <span className="bg-amber-50 text-amber-600 font-black text-[9px] px-2 py-0.5 rounded-full flex items-center gap-1 uppercase tracking-wider">
                <Star size={10} className="fill-amber-500" /> Featured
              </span>
            )}
            <h3 className="font-extrabold text-ink text-sm tracking-tight truncate">{job.title}</h3>

            {job.is_urgent && (
              <span className="bg-red-50 text-signal font-black text-[9px] px-2 py-0.5 rounded-full flex items-center gap-1 uppercase tracking-wider">
                <Flame size={10} /> Urgent
              </span>
            )}

            {job.category && (
              <span className={`font-semibold text-[9px] px-2 py-0.5 rounded-full uppercase ${CATEGORY_COLORS[job.category] || 'bg-ink-50 text-ink-600'}`}>
                {job.category}
              </span>
            )}

            {job.is_remote === 1 && (
              <span className="bg-green-50 text-green-600 font-semibold text-[9px] px-2 py-0.5 rounded-full uppercase">
                Remote
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
            {salaryLabel && (
              <span className="text-emerald-600 font-bold flex items-center gap-1">
                <DollarSign size={10} /> {salaryLabel}
              </span>
            )}
            {job.deadline && (
              <span className="text-amber-600 font-bold flex items-center gap-1">
                <Calendar size={10} /> Closes: {job.deadline}
              </span>
            )}
            {typeof job.applicant_count === 'number' && (
              <span className="flex items-center gap-1 text-ink-400">
                <Users size={10} /> {job.applicant_count} applicant{job.applicant_count === 1 ? '' : 's'}
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

      <div className="shrink-0 flex items-center gap-1.5 justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-wire/40 relative">
        <button
          onClick={() => onSave(job.id)}
          title={isSaved ? 'Unsave' : 'Save Job'}
          className={`p-2 rounded-full transition-colors ${isSaved ? 'text-signal bg-red-50' : 'text-ink-400 hover:text-signal hover:bg-red-50'}`}
        >
          <Bookmark size={15} className={isSaved ? 'fill-signal' : ''} />
        </button>

        <div className="relative">
          <button
            onClick={() => setShareOpenId(isShareOpen ? null : job.id)}
            title="Share"
            className="p-2 rounded-full text-ink-400 hover:text-signal hover:bg-red-50 transition-colors"
          >
            <Share2 size={15} />
          </button>
          {isShareOpen && (
            <div className="absolute right-0 top-full mt-1 bg-white shadow-lg rounded-xl p-2 z-10 w-40 space-y-1 border border-wire/50">
              <a href={shareLinks.whatsapp} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-ink-50 text-[11px] font-semibold text-ink-600">
                <MessageCircle size={13} /> WhatsApp
              </a>
              <a href={shareLinks.twitter} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-ink-50 text-[11px] font-semibold text-ink-600">
                <Share2 size={13} /> X / Twitter
              </a>
              <a href={shareLinks.linkedin} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-ink-50 text-[11px] font-semibold text-ink-600">
                <Share2 size={13} /> LinkedIn
              </a>
              <button onClick={() => onCopyLink(job)} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-ink-50 text-[11px] font-semibold text-ink-600">
                <Copy size={13} /> Copy Link
              </button>
            </div>
          )}
        </div>

        {isOwnerOrAdmin && (
          <>
            <button onClick={() => onEdit(job)} title="Edit" className="text-ink-400 hover:text-signal p-2 rounded-full hover:bg-red-50 transition-colors">
              <Edit3 size={15} />
            </button>
            {!featured && (
              <button onClick={() => onFeature(job)} title="Feature this job" className="text-ink-400 hover:text-amber-500 p-2 rounded-full hover:bg-amber-50 transition-colors">
                <Star size={15} />
              </button>
            )}
            <button
              onClick={() => onDelete(job.id)}
              className="text-ink-400 hover:text-signal p-2 rounded-full hover:bg-red-50 transition-colors"
              title="Delete Post"
            >
              <Trash2 size={15} />
            </button>
          </>
        )}

        <a
          href={formatApplyLink(job.apply_link)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onApply(job.id)}
          className="bg-ink text-white font-bold uppercase text-[10px] tracking-wider px-5 py-2.5 rounded-full hover:bg-signal transition-colors flex items-center gap-1.5 shadow-xs"
        >
          Apply <ExternalLink size={12} />
        </a>
      </div>
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