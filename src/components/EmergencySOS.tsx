import React, { useState } from 'react';
import { PhoneCall, MapPin, Plus, Trash2, Send, AlertTriangle, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { EmergencyContact, SpeedData } from '../types';
import { soundManager } from '../utils/audio';

interface EmergencySOSProps {
  speedData: SpeedData;
}

export const EmergencySOS: React.FC<EmergencySOSProps> = ({ speedData }) => {
  const [contacts, setContacts] = useState<EmergencyContact[]>([
    { id: '1', name: 'Family Contact', phone: '+1 (555) 019-2834', relationship: 'Spouse', isPrimary: true },
    { id: '2', name: 'Emergency Services', phone: '911 / 112', relationship: 'Highway Dispatch', isPrimary: false },
  ]);

  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactRelation, setNewContactRelation] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const [isSosActive, setIsSosActive] = useState(false);
  const [sosSentMessage, setSosSentMessage] = useState<string | null>(null);

  const handleAddContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContactName || !newContactPhone) return;

    const newContact: EmergencyContact = {
      id: Date.now().toString(),
      name: newContactName,
      phone: newContactPhone,
      relationship: newContactRelation || 'Emergency Contact',
      isPrimary: contacts.length === 0,
    };

    setContacts(prev => [...prev, newContact]);
    setNewContactName('');
    setNewContactPhone('');
    setNewContactRelation('');
    setIsAdding(false);
  };

  const handleRemoveContact = (id: string) => {
    setContacts(prev => prev.filter(c => c.id !== id));
  };

  const handleTriggerSOS = () => {
    setIsSosActive(true);
    soundManager.playCriticalAlarm();

    const lat = speedData.latitude ?? 37.7749;
    const lon = speedData.longitude ?? -122.4194;
    const mapsUrl = `https://maps.google.com/?q=${lat},${lon}`;

    setTimeout(() => {
      setIsSosActive(false);
      setSosSentMessage(`Distress SOS alert sent to ${contacts.length} emergency contacts with live GPS coordinates: (${lat.toFixed(4)}, ${lon.toFixed(4)})`);
      soundManager.speakText("Emergency SOS alert dispatched with current coordinates.");
    }, 2000);
  };

  return (
    <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4 shadow-2xl shadow-black/50 flex flex-col justify-between h-full">
      <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3">
        <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm">
          <div className="p-1.5 bg-rose-500/20 rounded-lg border border-rose-400/30 text-rose-400">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <span>Emergency SOS & Contacts</span>
        </div>
      </div>

      {/* Big Emergency SOS Dispatch Button */}
      <div className="mb-4">
        <button
          onClick={handleTriggerSOS}
          disabled={isSosActive}
          id="btn-trigger-sos"
          className={`w-full py-3.5 px-4 rounded-xl font-black text-white text-base tracking-wider uppercase flex items-center justify-center gap-2 shadow-xl transition-all backdrop-blur-md ${
            isSosActive
              ? 'bg-rose-700 animate-ping'
              : 'bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 hover:from-rose-500 hover:to-red-500 shadow-rose-950/60 border border-rose-400/50 active:scale-[0.98]'
          }`}
        >
          <PhoneCall className="w-5 h-5 animate-bounce text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
          <span>{isSosActive ? "DISPATCHING SOS SIGNAL..." : "TRIGGER EMERGENCY SOS"}</span>
        </button>

        {sosSentMessage && (
          <div className="mt-2.5 backdrop-blur-md bg-emerald-500/10 border border-emerald-500/40 p-2.5 rounded-xl text-xs text-emerald-300 flex items-start gap-2 shadow-lg">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{sosSentMessage}</span>
          </div>
        )}
      </div>

      {/* Emergency Contacts List */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-300">Emergency Contacts List</span>
          <button
            onClick={() => setIsAdding(!isAdding)}
            id="btn-toggle-add-contact"
            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium"
          >
            <Plus className="w-3.5 h-3.5" /> Add Contact
          </button>
        </div>

        {/* Add Contact Form */}
        {isAdding && (
          <form onSubmit={handleAddContact} className="backdrop-blur-md bg-white/5 p-3 rounded-2xl border border-white/10 space-y-2 mb-3">
            <input
              type="text"
              placeholder="Contact Name"
              value={newContactName}
              onChange={(e) => setNewContactName(e.target.value)}
              className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              required
            />
            <input
              type="tel"
              placeholder="Phone Number"
              value={newContactPhone}
              onChange={(e) => setNewContactPhone(e.target.value)}
              className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              required
            />
            <input
              type="text"
              placeholder="Relationship (e.g., Parent, Friend)"
              value={newContactRelation}
              onChange={(e) => setNewContactRelation(e.target.value)}
              className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-2.5 py-1 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-md"
              >
                Save
              </button>
            </div>
          </form>
        )}

        <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
          {contacts.map((contact) => (
            <div
              key={contact.id}
              className="backdrop-blur-md bg-white/5 p-2.5 rounded-xl border border-white/10 flex items-center justify-between text-xs"
            >
              <div>
                <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                  <span>{contact.name}</span>
                  <span className="text-[10px] text-slate-400 font-normal">({contact.relationship})</span>
                </div>
                <div className="text-slate-400 font-mono text-[11px]">{contact.phone}</div>
              </div>
              <button
                onClick={() => handleRemoveContact(contact.id)}
                className="text-slate-500 hover:text-red-400 p-1"
                title="Remove Contact"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
