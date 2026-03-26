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
    <div className="min-h-screen font-sans text-stone-800 pb-24 sm:pb-10 selection:bg-emerald-100 selection:text-emerald-900">
      {/* Desktop Header — hidden on mobile */}
      <header className="hidden sm:block bg-white/80 backdrop-blur-md border-b border-stone-200/60 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-extrabold text-lg shadow-lg shadow-emerald-500/25">
                ST
              </div>
              <div>
                <p className="text-base font-extrabold text-stone-800 tracking-tight leading-none">Summitraining</p>
                <p className="text-[9px] uppercase tracking-[0.25em] font-bold text-stone-400 mt-0.5">Mon espace analyse</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Desktop Tab Nav — hidden on mobile */}
      <div className="hidden sm:block sticky top-16 z-40 pt-3 pb-2 bg-gradient-to-b from-[#faf9f7] via-[#faf9f7] to-transparent pointer-events-none">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 pointer-events-auto">
          <div className="bg-white/90 backdrop-blur-sm shadow-[0_4px_20px_rgb(0,0,0,0.04)] border border-stone-100 p-1 rounded-2xl flex">
            {TABS.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-bold whitespace-nowrap transition-all rounded-xl
                    ${activeTab === tab.id
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/20'
                      : 'text-stone-400 hover:bg-stone-50 hover:text-stone-600'
                    }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mobile Header — shown only on mobile */}
      <header className="sm:hidden bg-white/90 backdrop-blur-md border-b border-stone-200/60 sticky top-0 z-50 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-extrabold text-sm shadow-md shadow-emerald-500/25">
            ST
          </div>
          <div>
            <p className="text-sm font-extrabold text-stone-800 tracking-tight leading-none">Summitraining</p>
            <p className="text-[8px] uppercase tracking-[0.2em] font-bold text-stone-400">Mon espace analyse</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="transition-all duration-300 ease-in-out">
          {renderTab()}
        </div>
      </main>

      {/* Mobile Bottom Tab Bar */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-t border-stone-200/60 px-2 pb-[env(safe-area-inset-bottom)]">
        <div className="flex justify-around py-1.5">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-xl transition-all ${isActive
                    ? 'text-emerald-600'
                    : 'text-stone-300 active:text-stone-500'
                  }`}
              >
                <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-emerald-50' : ''}`}>
                  <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : ''}`} />
                </div>
                <span className={`text-[10px] font-bold ${isActive ? 'text-emerald-700' : 'text-stone-400'}`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Footer — desktop only */}
      <footer className="hidden sm:block text-center py-8">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-300">
          Propulsé par les modèles Puissance critique & Riegel
        </p>
      </footer>
    </div>
  );
}
