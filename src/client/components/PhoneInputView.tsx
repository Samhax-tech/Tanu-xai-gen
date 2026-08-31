import React, { useState } from 'react';
import { Smartphone, ArrowRight, Loader2, ShieldCheck, Sparkles, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { CountrySelect } from './CountrySelect';
import { COUNTRIES, Country } from '../data/countries';

interface PhoneInputViewProps {
  onSubmit: (phone: string) => void;
  isLoading: boolean;
  error?: string | null;
}

export const PhoneInputView: React.FC<PhoneInputViewProps> = ({ onSubmit, isLoading, error }) => {
  const [selectedCountry, setSelectedCountry] = useState<Country>(COUNTRIES[0]); // Default Pakistan (+92)
  const [phoneDigits, setPhoneDigits] = useState<string>('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleCountrySelect = (country: Country) => {
    setSelectedCountry(country);
    setLocalError(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalError(null);

    // If user pastes/types a number starting with +, check if it matches a country
    if (val.startsWith('+')) {
      const matched = COUNTRIES.find((c) => val.startsWith(c.dialCode));
      if (matched) {
        setSelectedCountry(matched);
        setPhoneDigits(val.slice(matched.dialCode.length).trim());
        return;
      }
    }

    setPhoneDigits(val);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    const cleanInput = phoneDigits.trim();
    if (!cleanInput) {
      setLocalError('Please enter your WhatsApp phone number.');
      return;
    }

    // Strip non-digits
    let digits = cleanInput.replace(/[^\d]/g, '');

    // Handle leading zeros (e.g. 03001234567 for Pakistan or 0812345678 for other countries)
    if (digits.startsWith('0')) {
      digits = digits.replace(/^0+/, '');
    }

    const countryDialDigits = selectedCountry.dialCode.replace(/[^\d]/g, '');

    // Check if the user already typed the country dial code inside the input box
    let fullNumber: string;
    if (digits.startsWith(countryDialDigits)) {
      fullNumber = digits;
    } else {
      fullNumber = `${countryDialDigits}${digits}`;
    }

    if (fullNumber.length < 10 || fullNumber.length > 16) {
      setLocalError('Please enter a valid phone number (10 to 15 digits).');
      return;
    }

    onSubmit(fullNumber);
  };

  const displayError = error || localError;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.25 }}
      className="w-full max-w-lg mx-auto bg-slate-900/80 border border-slate-800/80 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl"
    >
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 mb-3 shadow-inner">
          <Smartphone className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-white tracking-tight">WhatsApp Pairing Code</h2>
        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
          Select your country and enter your WhatsApp phone number to generate an official 8-digit linking code.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="phone-input" className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Country & Phone Number
            </label>
            <span className="text-[11px] text-cyan-400 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>{selectedCountry.name} ({selectedCountry.dialCode})</span>
            </span>
          </div>

          {/* Unified Input Group with Country Select trigger button */}
          <div className="relative flex items-center bg-slate-950/90 border border-slate-700/80 rounded-2xl overflow-visible focus-within:border-cyan-500 focus-within:ring-2 focus-within:ring-cyan-500/20 transition shadow-inner">
            <CountrySelect
              selectedCountry={selectedCountry}
              onSelect={handleCountrySelect}
              disabled={isLoading}
            />

            <input
              id="phone-input"
              type="tel"
              value={phoneDigits}
              onChange={handleInputChange}
              placeholder={selectedCountry.placeholder || '300 1234567'}
              disabled={isLoading}
              className="w-full px-4 py-3.5 bg-transparent text-white font-mono text-base tracking-wider placeholder:text-slate-600 focus:outline-none transition disabled:opacity-50"
              autoComplete="tel-national"
              autoFocus
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 px-1">
            <span>Example: {selectedCountry.dialCode} {selectedCountry.placeholder || '3001234567'}</span>
            <span className="font-mono text-slate-400">Direct Baileys v7 Auth</span>
          </div>
        </div>

        {displayError && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium"
          >
            {displayError}
          </motion.div>
        )}

        <button
          type="submit"
          id="generate-pairing-code-btn"
          disabled={isLoading}
          className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-sm tracking-wide transition-all shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed glow-cyan mt-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Connecting to WhatsApp Handshake...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-cyan-200" />
              <span>Generate Pairing Code</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      {/* Security Reassurance */}
      <div className="mt-6 pt-5 border-t border-slate-800/80 flex items-center justify-center gap-2 text-slate-500 text-xs">
        <ShieldCheck className="w-4 h-4 text-emerald-400/80" />
        <span>Zero database storage • Direct ephemeral Baileys v7 handshake</span>
      </div>
    </motion.div>
  );
};
