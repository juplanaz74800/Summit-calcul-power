import { useState } from 'react';
import { Gauge, Timer, Crosshair, Mountain } from 'lucide-react';
import VeloTab from './components/VeloTab';
import CourseTab from './components/CourseTab';
import PredireTab from './components/PredireTab';
import TrailTab from './components/TrailTab';

const TABS = [
  { id: 'cycling', label: 'Vélo', icon: Gauge },
  { id: 'running', label: 'Course', icon: Timer },
  { id: 'prediction', label: 'Prédire', icon: Crosshair },
  { id: 'trail', label: 'Trail', icon: Mountain },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('running');

  const renderTab = () => {
    switch (activeTab) {
      case 'cycling': return <VeloTab />;
      case 'running': return <CourseTab />;
      case 'prediction': return <PredireTab />;
      case 'trail': return <TrailTab />;
      default: return <CourseTab />;
    }
  };

  return (
    <div className="min-h-screen font-inter text-on-surface pb-24 sm:pb-10 selection:bg-primary/10 selection:text-primary bg-surface transition-colors duration-500">
      {/* Desktop Header — glassmorphism as per Summit spec */}
      <header className="hidden sm:block bg-surface/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between h-20 items-center">
            <div className="flex items-center gap-4 group cursor-pointer">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br from-primary to-primary-container text-white font-black text-xl shadow-2xl shadow-primary/30 transform transition-transform group-hover:scale-105">
                ST
              </div>
              <div>
                <p className="text-xl font-black text-on-surface tracking-tight leading-none font-lexend">Summitraining</p>
                <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-tertiary mt-1">L'Analyse Athlétique Précise</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse"></div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-tertiary">Live System</span>
            </div>
          </div>
        </div>
      </header>

      {/* Desktop Tab Nav — Tonal Layering (No-Line Rule) */}
      <div className="hidden sm:block sticky top-20 z-40 py-4 bg-gradient-to-b from-surface via-surface to-transparent pointer-events-none">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 pointer-events-auto">
          <div className="bg-surface-container-low/90 backdrop-blur-md shadow-2xl shadow-on-surface/5 p-1.5 rounded-[2rem] flex items-center justify-between">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-3 py-3.5 px-6 text-sm font-extrabold whitespace-nowrap transition-all duration-300 rounded-[1.5rem]
                    ${isActive
                      ? 'bg-linear-to-r from-primary to-primary-container text-white shadow-xl shadow-primary/25 scale-[1.02]'
                      : 'text-tertiary hover:bg-surface-container-high hover:text-on-surface'
                    }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : ''}`} />
                  <span className="font-lexend tracking-tight">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mobile Header */}
      <header className="sm:hidden bg-surface/90 backdrop-blur-md sticky top-0 z-50 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-primary to-primary-container text-white font-black text-base shadow-lg shadow-primary/20">
            ST
          </div>
          <div>
            <p className="text-base font-black text-on-surface tracking-tight leading-none font-lexend">Summitraining</p>
            <p className="text-[9px] uppercase tracking-[0.2em] font-bold text-tertiary">Analyse</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        <div className="transition-all duration-500 ease-in-out">
          {renderTab()}
        </div>
      </main>

      {/* Mobile Bottom Tab Bar — Glassmorphism */}
      <nav className="sm:hidden fixed bottom-6 left-4 right-4 z-50 bg-surface-container/95 backdrop-blur-2xl shadow-2xl shadow-on-surface/10 rounded-[2rem] px-3 pb-[env(safe-area-inset-bottom)] border border-primary/5">
        <div className="flex justify-around py-3">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center gap-1.5 py-2 px-4 rounded-2xl transition-all duration-300 ${isActive
                    ? 'text-primary scale-110'
                    : 'text-tertiary active:scale-95'
                  }`}
              >
                <div className={`p-2 rounded-xl transition-all ${isActive ? 'bg-primary/10 shadow-inner' : ''}`}>
                  <Icon className={`w-6 h-6 ${isActive ? 'stroke-[2.5]' : ''}`} />
                </div>
                <span className={`text-[10px] font-bold font-lexend ${isActive ? 'text-primary' : 'text-tertiary/60'}`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Footer — Editorial Feel */}
      <footer className="hidden sm:block text-center py-12">
        <div className="flex items-center justify-center gap-3 mb-4 opacity-20">
          <div className="h-px w-12 bg-on-surface"></div>
          <p className="font-lexend text-xs font-black uppercase tracking-[0.5em]">Summit</p>
          <div className="h-px w-12 bg-on-surface"></div>
        </div>
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-tertiary/40">
          &copy; {new Date().getFullYear()} Precision Athletics Performance.
        </p>
      </footer>
    </div>
  );
}

