import { useEffect, useState } from 'react';
import NavBar from '../components/NavBar';
import API_BASE from '../config';

const FALLBACK_IMAGE = "https://lh3.googleusercontent.com/aida-public/AB6AXuAJg7M74vhWnwlLMobUTWwGxs6TJMz8S9zRNL6eEdDnN6MKrf582pu5pWPErHxGE54YZMID-yguHuzCJq4q6XKfa6AlUeyN9czFt7HTJR2hKPJMYxuTJ61EK7Ur-EKxr1fBGbb86cTIjpeupc62vOTpBJoZ0bnzl_U2HwZ8TJKgzZHGQS2FhTjOLlZkgb6XsustxQBQeE2kHu96oG6_wIXNTqdYlufmlMEZgQlQczZXIo2rbvw5p7b6EkMV_Pdxeh3VI2yLeCJKMxTr";

export default function NewsPage() {
  const [articles, setArticles] = useState([]);
  const [sources, setSources] = useState([]);
  const [activeSource, setActiveSource] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Interactive selected article (left featured column)
  const [selectedArticle, setSelectedArticle] = useState(null);

  // Refresh & Pagination triggers
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [limit, setLimit] = useState(40);

  // Toast state for copy link share action
  const [showCopiedToast, setShowCopiedToast] = useState(false);

  // UTC clock sync logic (using requestAnimationFrame for sub-second precision without React re-renders)
  useEffect(() => {
    let active = true;
    const updateClock = () => {
      if (!active) return;
      const now = new Date();
      const hours = String(now.getUTCHours()).padStart(2, '0');
      const minutes = String(now.getUTCMinutes()).padStart(2, '0');
      const seconds = String(now.getUTCSeconds()).padStart(2, '0');
      const clockEl = document.getElementById('clock-val');
      if (clockEl) {
        clockEl.textContent = `${hours}:${minutes}:${seconds}`;
      }
      requestAnimationFrame(updateClock);
    };
    updateClock();
    return () => {
      active = false;
    };
  }, []);

  // Fetch sources list on mount
  useEffect(() => {
    fetch(`${API_BASE}/api/news/sources`)
      .then((res) => (res.ok ? res.json() : { sources: [] }))
      .then((data) => setSources(data.sources || []))
      .catch((err) => console.error('[News] Failed to fetch sources:', err));
  }, []);

  // Fetch articles based on active source, limit, and refresh triggers
  useEffect(() => {
    setLoading(true);
    setError(null);

    let url = `${API_BASE}/api/news?limit=${limit}`;
    if (activeSource !== 'all') {
      url += `&source=${activeSource}`;
    }

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch F1 news articles.');
        return res.json();
      })
      .then((data) => {
        const fetched = data.articles || [];
        setArticles(fetched);

        // Auto-select first article as featured if nothing is selected or if the active source changed
        if (fetched.length > 0) {
          setSelectedArticle(fetched[0]);
        } else {
          setSelectedArticle(null);
        }
      })
      .catch((err) => {
        console.error(err);
        setError(err.message);
      })
      .finally(() => {
        // Add a slight delay to show loading animation if desired
        setTimeout(() => setLoading(false), 300);
      });
  }, [activeSource, limit, refreshTrigger]);

  const handleRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleShare = (link) => {
    if (!link) return;
    navigator.clipboard.writeText(link)
      .then(() => {
        setShowCopiedToast(true);
        setTimeout(() => setShowCopiedToast(false), 2000);
      })
      .catch((err) => console.error('Failed to copy link:', err));
  };

  const getRelativeTime = (pubDate) => {
    if (!pubDate) return 'RECENT';
    const now = new Date();
    const published = new Date(pubDate);
    const diffMs = now - published;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'JUST NOW';
    if (diffMins < 60) return `${diffMins} MIN AGO`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}H AGO`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}D AGO`;
  };

  const formatUtcDate = (dateString) => {
    if (!dateString) return '';
    try {
      const d = new Date(dateString);
      const year = d.getUTCFullYear();
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      const hours = String(d.getUTCHours()).padStart(2, '0');
      const minutes = String(d.getUTCMinutes()).padStart(2, '0');
      return `PUBLISHED: ${year}-${month}-${day} ${hours}:${minutes} UTC`;
    } catch {
      return `PUBLISHED: ${dateString.toUpperCase()}`;
    }
  };

  // Determine current featured story content
  const featured = selectedArticle || articles[0];

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-on-surface font-mono selection:bg-[#e10600] selection:text-white flex flex-col">
      <NavBar />

      {/* Main Page Wrapper */}
      <main className="flex-grow pt-12 flex flex-col relative">

        {/* Copy Share Toast Notification */}
        {showCopiedToast && (
          <div className="fixed top-16 right-6 bg-[var(--bg-secondary)] border border-[#e10600] px-4 py-2 text-white text-[15px] font-bold uppercase tracking-wider z-[100] shadow-[0_0_15px_rgba(225,6,0,0.2)] rounded-[2px] animate-bounce">
            📋 Link Copied to Clipboard
          </div>
        )}

        {/* Page Title Row */}
        <div className="px-edge-margin h-10 flex items-center justify-between bg-[var(--bg-primary)] border-b border-[var(--border-color)]">
          <h1 className="text-[18px] font-bold text-white uppercase tracking-tight flex items-center gap-1.5">
            F1 NEWS FEED
          </h1>
          <div className="text-[13px] text-[#444552] font-mono tracking-widest" id="utc-clock">
            UTC: <span id="clock-val" className="text-white font-bold">00:00:00</span>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="px-edge-margin h-12 bg-[var(--bg-secondary)] border-b border-[var(--border-color)] flex items-center justify-between">
          <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
            <button
              onClick={() => setActiveSource('all')}
              className={`px-3 py-1 text-[15px] font-bold uppercase transition-colors duration-200 border rounded-[2px] ${activeSource === 'all'
                ? 'bg-[#1a0505] text-[#e10600] border-[#e10600]'
                : 'bg-transparent text-[var(--color-muted)] border-[#1c1c28] hover:text-white'
                }`}
            >
              All
            </button>
            {sources.map((src) => (
              <button
                key={src}
                onClick={() => setActiveSource(src)}
                className={`px-3 py-1 text-[15px] font-bold uppercase transition-colors duration-200 border rounded-[2px] ${activeSource === src
                  ? 'bg-[#1a0505] text-[#e10600] border-[#e10600]'
                  : 'bg-transparent text-[var(--color-muted)] border-[#1c1c28] hover:text-white'
                  }`}
              >
                {src}
              </button>
            ))}
          </div>

          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 text-[14px] font-black text-[var(--color-muted)] hover:text-white transition-colors tracking-tighter"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            REFRESH
          </button>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[50fr_50fr] flex-grow min-h-0">

          {/* Left Column: Featured Story */}
          <section className="border-r border-[var(--border-color)] p-edge-margin relative overflow-hidden min-h-[500px] bg-[var(--bg-primary)]">

            {/* Loading State Overlay */}
            {loading && (
              <div className="absolute inset-0 bg-[var(--bg-primary)] z-10 flex flex-col items-center justify-center" id="featured-loading">
                <div className="loading-pulse text-[#e10600] text-[16px] font-bold tracking-widest">
                  FETCHING NEWS FEED...
                </div>
              </div>
            )}

            {featured ? (
              <div className="flex flex-col gap-6">
                <div className="relative w-full max-w-[480px] aspect-video bg-[var(--bg-secondary)] border border-[var(--border-color)] overflow-hidden rounded-[2px]">
                  <img
                    className="w-full h-full object-cover grayscale-[0.4] hover:grayscale-0 transition-all duration-700"
                    src={featured.thumbnail || FALLBACK_IMAGE}
                    alt={featured.title}
                  />
                  <div className="absolute top-0 left-0 bg-[#e10600] text-white text-[14px] font-black px-3 py-1 uppercase tracking-wider">
                    Breaking
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-[#e10600] text-[15px] font-bold uppercase border border-[#e10600]/30 px-2 py-0.5 rounded-[2px] bg-[#1a0505]">
                    [{featured.source.toUpperCase()}]
                  </span>
                  <span className="text-[#444552] text-[14px] font-mono">
                    {formatUtcDate(featured.published)}
                  </span>
                </div>

                <h2 className="text-[28px] md:text-[34px] font-black text-white uppercase leading-[1.1] tracking-tighter font-display-lg">
                  {featured.title}
                </h2>

                <p className="text-[var(--color-muted)] text-[17px] leading-[1.8] max-w-3xl font-body-lg">
                  {featured.summary || "No summary available for this telemetry news stream item."}
                </p>

                <div className="flex gap-4 mt-2">
                  <a
                    href={featured.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-[#e10600] text-white text-[15px] font-bold px-6 py-3 uppercase hover:bg-[#ff1a14] transition-all flex items-center gap-2 rounded-[2px] no-underline"
                  >
                    OPEN ARTICLE <span className="material-symbols-outlined text-sm">trending_flat</span>
                  </a>
                  <button
                    onClick={() => handleShare(featured.link)}
                    className="border border-[#1c1c28] text-[var(--color-muted)] text-[15px] font-bold px-6 py-3 uppercase hover:bg-[var(--border-color)] hover:text-white transition-all flex items-center gap-2 rounded-[2px]"
                  >
                    SHARE <span className="material-symbols-outlined text-sm">share</span>
                  </button>
                </div>
              </div>
            ) : !loading ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-24">
                <span className="material-symbols-outlined text-[var(--color-muted)] text-4xl mb-2">article</span>
                <div className="text-[var(--color-muted)] text-[15px] font-bold uppercase tracking-widest">
                  NO ARTICLES FOUND FOR SELECTED CHANNEL
                </div>
              </div>
            ) : null}
          </section>

          {/* Right Column: Article List */}
          <section className="bg-[var(--bg-secondary)] flex flex-col h-full lg:max-h-[calc(100vh-140px)] border-t lg:border-t-0 border-[var(--border-color)]">
            <div className="px-6 py-4 border-b border-[var(--border-color)] flex justify-between items-center">
              <h3 className="text-[15px] font-black text-white uppercase tracking-widest">
                LATEST ARTICLES
              </h3>
              <div className="h-1 w-12 bg-[#e10600]"></div>
            </div>

            <div className="flex-grow overflow-y-auto data-scroll">
              {error ? (
                <div className="p-8 text-center flex flex-col items-center gap-2" id="error-state">
                  <span className="material-symbols-outlined text-[#e10600] text-3xl">warning</span>
                  <div className="text-[#e10600] text-[14px] font-bold uppercase tracking-widest">
                    NEWS FEED UNAVAILABLE
                  </div>
                  <div className="text-[#444552] text-[13px] uppercase">
                    {error}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col">
                  {articles.map((art, idx) => {
                    const isSelected = featured && featured.link === art.link;
                    return (
                      <div
                        key={`${art.link}-${idx}`}
                        onClick={() => setSelectedArticle(art)}
                        className={`group border-b border-[var(--border-color)] p-4 flex flex-col gap-2 hover:bg-[var(--bg-secondary)] cursor-pointer transition-colors duration-150 relative ${isSelected ? 'bg-[#0f0708] border-l-2 border-l-[#e10600]' : ''
                          }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-[#e10600] text-[13px] font-bold uppercase">
                            [{art.source.toUpperCase()}]
                          </span>
                          <span className="text-[#444552] text-[13px] font-mono">
                            {getRelativeTime(art.published)}
                          </span>
                        </div>
                        <h4 className="text-white text-[15px] font-bold uppercase group-hover:text-[#e10600] transition-colors leading-relaxed">
                          {art.title}
                        </h4>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              onClick={() => setLimit((prev) => prev + 20)}
              className="w-full bg-[var(--bg-primary)] py-6 text-[14px] font-black text-[var(--color-muted)] hover:text-white transition-all uppercase tracking-[0.2em] border-t border-[var(--border-color)]"
            >
              LOAD MORE DATA +
            </button>
          </section>

        </div>
      </main>
    </div>
  );
}
