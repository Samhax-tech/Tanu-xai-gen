import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, ChevronDown, Check, Globe, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { COUNTRIES, Country, POPULAR_COUNTRY_CODES } from '../data/countries';

interface CountrySelectProps {
  selectedCountry: Country;
  onSelect: (country: Country) => void;
  disabled?: boolean;
}

export const CountrySelect: React.FC<CountrySelectProps> = ({
  selectedCountry,
  onSelect,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Focus search input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // ESC key listener
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen]);

  // Filter countries
  const filteredCountries = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.dialCode.includes(q) ||
        c.code.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const popularCountries = useMemo(() => {
    return COUNTRIES.filter((c) => POPULAR_COUNTRY_CODES.includes(c.code));
  }, []);

  const handleSelectCountry = (country: Country) => {
    onSelect(country);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        id="country-select-button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="h-full px-3.5 py-3.5 bg-slate-950/80 hover:bg-slate-800/80 border-r border-slate-800 flex items-center gap-2 text-slate-200 hover:text-white transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group focus:outline-none"
        title="Select Country"
      >
        <span className="text-xl leading-none select-none">{selectedCountry.flag}</span>
        <span className="text-xs font-semibold font-mono text-slate-300 group-hover:text-cyan-400 transition">
          {selectedCountry.dialCode}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-cyan-400' : ''
          }`}
        />
      </button>

      {/* Dropdown Modal / Popover */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute left-0 top-full mt-2 w-80 sm:w-96 bg-slate-900 border border-slate-700/90 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col backdrop-blur-xl"
            style={{ maxHeight: '420px' }}
          >
            {/* Search Header */}
            <div className="p-3 border-b border-slate-800 bg-slate-950/70">
              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search country or code (e.g. +92, US, India)..."
                  className="w-full pl-9 pr-8 py-2 text-xs bg-slate-900 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 transition font-sans"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 p-1 text-slate-500 hover:text-slate-300 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Country List */}
            <div className="overflow-y-auto flex-1 p-2 space-y-1 divide-y divide-slate-800/40 text-xs">
              {/* Popular countries quick strip if not searching */}
              {!searchQuery && (
                <div className="pb-2">
                  <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Globe className="w-3 h-3 text-cyan-400" />
                    <span>Popular Destinations</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 mt-1">
                    {popularCountries.slice(0, 8).map((c) => {
                      const isSelected = selectedCountry.code === c.code;
                      return (
                        <button
                          key={`popular-${c.code}`}
                          type="button"
                          onClick={() => handleSelectCountry(c)}
                          className={`flex items-center gap-2 px-2.5 py-2 rounded-xl text-left transition cursor-pointer ${
                            isSelected
                              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-medium'
                              : 'hover:bg-slate-800 text-slate-300 hover:text-white'
                          }`}
                        >
                          <span className="text-base leading-none">{c.flag}</span>
                          <span className="truncate flex-1 font-medium">{c.name}</span>
                          <span className="font-mono text-[10px] text-slate-400">{c.dialCode}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Full or filtered country list */}
              <div className="pt-1 space-y-0.5">
                {!searchQuery && (
                  <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    All Countries ({COUNTRIES.length})
                  </div>
                )}

                {filteredCountries.length === 0 ? (
                  <div className="py-8 text-center text-slate-500 text-xs">
                    No country found matching "{searchQuery}"
                  </div>
                ) : (
                  filteredCountries.map((c) => {
                    const isSelected = selectedCountry.code === c.code;
                    return (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => handleSelectCountry(c)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition cursor-pointer ${
                          isSelected
                            ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/30 font-medium'
                            : 'hover:bg-slate-800/80 text-slate-300 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-lg leading-none">{c.flag}</span>
                          <span className="truncate">{c.name}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                            {c.code}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 pl-2">
                          <span className="font-mono font-semibold text-slate-400 group-hover:text-cyan-400">
                            {c.dialCode}
                          </span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Footer Notice */}
            <div className="p-2 border-t border-slate-800 bg-slate-950/60 text-[10px] text-slate-400 text-center">
              Select your WhatsApp registered phone region
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
