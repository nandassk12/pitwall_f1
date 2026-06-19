import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Logo from '../components/Logo';

export default function LandingPage() {
  const [timeStr, setTimeStr] = useState('15:06:45.430');

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');
      const ms = String(now.getMilliseconds()).padStart(3, '0');
      setTimeStr(`${h}:${m}:${s}.${ms}`);
    };
    updateClock();
    const intervalId = setInterval(updateClock, 100);
    return () => clearInterval(intervalId);
  }, []);

  return (
    <main className="relative min-h-screen w-full flex flex-col items-center select-none">
      {/* Hero Section */}
      <section className="relative w-full h-screen flex flex-col items-center justify-center overflow-hidden px-edge-margin">
        {/* Background Layer */}
        <div className="absolute inset-0 z-0">
          {/* Base Layer: Dark grayscale F1 car image across the entire background (old style) */}
          <div className="absolute inset-0">
            <img
              alt="F1 car in tunnel background"
              className="w-full h-full object-cover opacity-100 grayscale contrast-125 scale-105"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAd9QDmTS7dOW8odyEMS9s3KNhmMe-iMT7Ui9Jw0m4Sm83wTCLlzA__jUgS1PLyGm-MMJsv5nYM6LoG1GoqXEQ0QRir7oIUZ6BiI1geuFrJrFFA7IQmDEGnwhPbAG7tTsOHTFRK00hb_jGVHZr3JDsLv9RHyIYcdxawtNN2tYfvea66Mv4x38x2x-TlM5D3CA5n_wvn3724-u1ueBI7dD2kF0B2BxRhfCKn5JFkld_p-Y-Cs5EIw97ohLn1ITgZieRaGPKfoPiVDUKZ"
            />
            <div className="absolute inset-0 bg-black/40"></div>
          </div>

          {/* Technical Grid across entire background */}
          <div className="technical-grid absolute inset-0 opacity-15"></div>

          {/* Left Layer: Original color version with higher opacity, clipped to the left side */}
          <div
            className="absolute inset-0"
            style={{ clipPath: 'polygon(0 0, 70% 0, 30% 100%, 0 100%)' }}
          >
            <img
              alt="F1 car in tunnel color highlight"
              className="w-full h-full object-cover opacity-70 contrast-125 scale-105"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAd9QDmTS7dOW8odyEMS9s3KNhmMe-iMT7Ui9Jw0m4Sm83wTCLlzA__jUgS1PLyGm-MMJsv5nYM6LoG1GoqXEQ0QRir7oIUZ6BiI1geuFrJrFFA7IQmDEGnwhPbAG7tTsOHTFRK00hb_jGVHZr3JDsLv9RHyIYcdxawtNN2tYfvea66Mv4x38x2x-TlM5D3CA5n_wvn3724-u1ueBI7dD2kF0B2BxRhfCKn5JFkld_p-Y-Cs5EIw97ohLn1ITgZieRaGPKfoPiVDUKZ"
            />
          </div>


          {/* Overlays for lighting/scanline */}
          <div className="absolute inset-0 bg-gradient-to-b from-[var(--bg-primary)] via-transparent to-[var(--bg-primary)] pointer-events-none"></div>
          <div className="scanline"></div>
        </div>

        {/* Hero Content */}
        <div className="relative z-10 flex flex-col items-center text-center space-y-8 max-w-4xl">
          <div className="flex items-center gap-6 mb-2">
            <span className="w-20 h-[1px] bg-primary-container"></span>
            <p className="font-label-caps text-base tracking-[0.7em] text-on-secondary-container font-semibold uppercase">
              Race Monitoring Interface
            </p>
            <span className="w-20 h-[1px] bg-primary-container"></span>
          </div>

          <div className="space-y-4">
            <Logo size="lg" />
            <p className="font-headline-sm text-white/80 tracking-tight uppercase">
              Formula 1 Telemetry &amp; Analytics
            </p>
          </div>

          <div className="pt-10">
            <Link
              className="group relative inline-flex items-center justify-center px-16 py-6 bg-primary-container text-white font-headline-sm text-headline-sm uppercase tracking-[0.2em] transition-all hover:bg-[#ff0700] hover:shadow-[0_0_60px_rgba(225,6,0,0.4)] active:scale-95 overflow-hidden"
              to="/home"
            >
              <span className="relative z-10 glitch-text">Enter Dashboard</span>
              <span className="material-symbols-outlined ml-3 text-lg group-hover:translate-x-1 transition-transform">
                chevron_right
              </span>
              <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-white opacity-40"></div>
              <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-white opacity-40"></div>
            </Link>
          </div>

          <div className="flex gap-16 pt-12 font-label-caps text-label-caps text-on-secondary-container uppercase tracking-[0.2em]">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">signal_wifi_off</span>
              System Online
            </div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">monitoring</span>
              Data Engine
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-100">
          <span className="font-label-caps text-[11px] tracking-[3px] uppercase">Scroll to Explore</span>
          <div className="w-[5px] h-12 bg-gradient-to-b from-primary-container to-transparent"></div>
        </div>
      </section>

      {/* Value Proposition Section */}
      <section className="w-full bg-surface-container-lowest py-24 px-edge-margin border-t border-outline-variant/10">
        <div className="max-w-[1000px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
            <div className="space-y-4">
              <p className="text-primary-container font-display-lg text-[32px] font-bold">2018 – 2026</p>
              <p className="text-on-secondary-container/40 text-[10px] tracking-[3px] font-label-caps uppercase">
                Historical Depth
              </p>
            </div>
            <div className="space-y-4 border-x border-outline-variant/10">
              <p className="text-white font-display-lg text-[32px] font-bold">98.2%</p>
              <p className="text-on-secondary-container/40 text-[10px] tracking-[3px] font-label-caps uppercase">
                Data Accuracy
              </p>
            </div>
            <div className="space-y-4">
              <p className="text-white font-display-lg text-[32px] font-bold">20+</p>
              <p className="text-on-secondary-container/40 text-[10px] tracking-[3px] font-label-caps uppercase">
                Interactive Modules
              </p>
            </div>
          </div>
          <div className="mt-20 text-center max-w-2xl mx-auto font-body-lg text-body-lg text-on-surface-variant leading-relaxed italic">
            <p>
              "Precision is not an act, it is a habit. F1 Pitwall converts raw session telemetry into the
              high-fidelity visualizations used by race engineers on the pit wall."
            </p>
          </div>
        </div>
      </section>

      {/* Navigation Cards */}
      <section className="w-full bg-surface py-32 px-edge-margin">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-4">
            <div className="space-y-2">
              <h2 className="font-label-caps text-label-caps tracking-[4px] text-primary-container uppercase">
                Operations
              </h2>
              <p className="font-display-lg text-[32px] text-white">System Architecture</p>
            </div>
            <div className="h-[1px] flex-grow bg-outline-variant/20 mx-10 hidden md:block mb-4"></div>
            <p className="text-on-secondary-container/60 text-sm max-w-xs text-right">
              Access the core components of the Pitwall analytical engine.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Race Analytics */}
            <Link
              className="group relative bg-surface-container/30 border border-outline-variant/10 p-10 hover:border-primary-container/40 transition-all duration-500"
              to="/analytics"
            >
              <div className="mb-8">
                <span className="material-symbols-outlined text-4xl text-primary-container/80 group-hover:scale-110 transition-transform">
                  query_stats
                </span>
              </div>
              <h3 className="text-white font-bold text-[14px] tracking-[3px] font-label-caps mb-4 uppercase">
                Race Analytics
              </h3>
              <p className="text-on-secondary-container/60 text-sm leading-relaxed mb-8">
                Full session-by-session telemetry, sector deltas, and tyre degradation modeling.
              </p>
              <div className="flex items-center text-primary-container text-[11px] font-label-caps tracking-widest uppercase">
                Initialize Module
                <span className="material-symbols-outlined ml-2 text-sm group-hover:translate-x-1 transition-transform">
                  arrow_forward
                </span>
              </div>
            </Link>

            {/* Championship */}
            <Link
              className="group relative bg-surface-container/30 border border-outline-variant/10 p-10 hover:border-primary-container/40 transition-all duration-500"
              to="/championship"
            >
              <div className="mb-8">
                <span className="material-symbols-outlined text-4xl text-white/80 group-hover:scale-110 transition-transform">
                  military_tech
                </span>
              </div>
              <h3 className="text-white font-bold text-[14px] tracking-[3px] font-label-caps mb-4 uppercase">
                Championship
              </h3>
              <p className="text-on-secondary-container/60 text-sm leading-relaxed mb-8">
                Season-long standings, ranking evolution, and comparative performance metrics.
              </p>
              <div className="flex items-center text-primary-container text-[11px] font-label-caps tracking-widest uppercase">
                View Standings
                <span className="material-symbols-outlined ml-2 text-sm group-hover:translate-x-1 transition-transform">
                  arrow_forward
                </span>
              </div>
            </Link>

            {/* Calendar */}
            <Link
              className="group relative bg-surface-container/30 border border-outline-variant/10 p-10 hover:border-primary-container/40 transition-all duration-500"
              to="/calendar"
            >
              <div className="mb-8">
                <span className="material-symbols-outlined text-4xl text-white/80 group-hover:scale-110 transition-transform">
                  calendar_month
                </span>
              </div>
              <h3 className="text-white font-bold text-[14px] tracking-[3px] font-label-caps mb-4 uppercase">
                Race Calendar
              </h3>
              <p className="text-on-secondary-container/60 text-sm leading-relaxed mb-8">
                Strategic schedule with precise session timings and circuit technical data.
              </p>
              <div className="flex items-center text-primary-container text-[11px] font-label-caps tracking-widest uppercase">
                Open Schedule
                <span className="material-symbols-outlined ml-2 text-sm group-hover:translate-x-1 transition-transform">
                  arrow_forward
                </span>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* Refined Footer */}
      <footer className="w-full border-t border-outline-variant/10 py-12 px-edge-margin bg-surface-container-lowest">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-10">
          <div className="space-y-2">
            <div className="flex items-baseline gap-3">
              <p className="font-data-mono text-xl text-primary-container">{timeStr}</p>
              <span className="font-label-caps text-[9px] text-on-secondary-container/100 tracking-widest uppercase">
                System Clock
              </span>
            </div>
            <p className="font-data-mono text-[10px] text-on-secondary-container/100 uppercase tracking-widest">
              PITWALL ENGINE
            </p>
          </div>
          <div className="flex flex-col items-center gap-4">
            <Link
              className="bg-primary-container text-white text-[11px] font-label-caps px-12 py-3 uppercase tracking-[0.2em] hover:bg-[#ff0700] transition-all hover:shadow-lg"
              to="/home"
            >
              Launch Application
            </Link>
            <p className="text-on-secondary-container/100 text-[9px] font-body-md">
              Unofficial project · Not affiliated with F1 or FIA
            </p>
          </div>
          <div className="text-right space-y-2 hidden md:block">
            <p className="font-label-caps text-[10px] text-primary-container/100 tracking-widest uppercase">
              Data Sources
            </p>
            <div className="flex gap-4 justify-end">
              <span className="text-on-surface-variant text-[11px] font-data-mono">FastF1 (2018+)</span>
              <span className="text-on-surface-variant text-[11px] font-data-mono">OpenF1 (2023+)</span>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
