"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { 
  ClipboardCheck, 
  CheckCircle2, 
  AlertCircle, 
  MinusCircle, 
  HardHat, 
  Construction, 
  Zap, 
  Wind, 
  Hand,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Layers,
  Anchor,
  Plus,
  Trash2,
  Package,
  User,
  Building2,
  Send,
  ListChecks,
  Pencil,
  XCircle,
  Save
} from 'lucide-react';

// Configuration
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzK4g9SnwmyNMulHoYcKWEDBBxMGFViEVY3UJFshVh8PKZjUAxR8sKKztqIzQjYxO9Tug/exec";

// Types
interface ChecklistItem {
  id: string;
  category: string;
  question: string;
}

interface ResponseState {
  status?: string;
  notes?: string;
}

interface BatchItem {
  id: string;
  assetRaw: string;
  equipment: string;
  attachment: string;
  operation: string;
  responsesRaw: Record<string, ResponseState>;
  asset: string;
  checklist: string;
  timestamp: string;
}

// Master Checklist Data based on OSHA 1910.179 & ASME B30
const CHECKLIST_DATABASE = {
  general: [
    { id: 'g1', category: 'General', question: 'Are all guardrails and toe boards in place and secure?' },
    { id: 'g2', category: 'Markings', question: 'Rated load capacity clearly marked on both sides of the crane/hoist?' },
  ],
  lifting: [
    { id: 'l1', category: 'Hooks', question: 'Hooks inspected for cracks, deformation, or throat opening (not exceeding 15%)?' },
    { id: 'l2', category: 'Hooks', question: 'Hook safety latches present and functioning correctly?' },
    { id: 'l3', category: 'Wire Rope/Chain', question: 'Is load medium free of kinking, crushing, bird-caging, or heat damage?' },
  ],
  equipment: {
    'Bridge Crane': [
      { id: 'e_b1', category: 'Bridge', question: 'Bridge rails and end stops secure and free of debris?' },
      { id: 'e_b2', category: 'Bridge', question: 'Wheel bearings and gears lubricated with no excessive noise?' },
      { id: 'e_b3', category: 'Bridge', question: 'Bridge bumpers in good condition and properly attached?' },
    ],
    'Gantry Crane': [
      { id: 'e_g1', category: 'Gantry', question: 'Gantry legs and bracing free of structural damage or deformation?' },
      { id: 'e_g2', category: 'Gantry', question: 'Floor track or wheels clear of obstructions and functional?' },
      { id: 'e_g3', category: 'Gantry', question: 'Travel alarms and warning lights operational?' },
    ],
    'Jib Crane': [
      { id: 'e_j1', category: 'Jib', question: 'Mast/pillar base bolts tight and foundation secure?' },
      { id: 'e_j2', category: 'Jib', question: 'Boom rotates freely and smooth throughout entire arc?' },
      { id: 'e_j3', category: 'Jib', question: 'Tie-rod and support pins properly seated and pinned?' },
    ],
    'Monorail': [
      { id: 'e_m1', category: 'Monorail', question: 'Monorail track hangars and supports secure and aligned?' },
      { id: 'e_m2', category: 'Monorail', question: 'Safety stops at open ends of the track present and secure?' },
      { id: 'e_m3', category: 'Monorail', question: 'Switches and interlocks (if applicable) functioning properly?' },
    ],
  },
  attachment: {
    'None (N/A)': [],
    'Wire Rope Hoist': [
      { id: 'a_w1', category: 'Hoist Unit', question: 'Rope drum grooves inspected for wear or scoring?' },
      { id: 'a_w2', category: 'Hoist Unit', question: 'Rope guide/tensioner functioning to prevent overlapping?' },
      { id: 'a_w3', category: 'Hoist Unit', question: 'Dead end socket and rope clips secure?' },
    ],
    'Chain Hoist': [
      { id: 'a_c1', category: 'Hoist Unit', question: 'Load chain container/bag secure and not overfilled?' },
      { id: 'a_c2', category: 'Hoist Unit', question: 'Chain pockets in sheave free of debris and excessive wear?' },
      { id: 'a_c3', category: 'Hoist Unit', question: 'Slack chain end stop present and secure?' },
    ],
    'Trolley Unit': [
      { id: 'a_t1', category: 'Trolley', question: 'Trolley wheels show no signs of flat spots or flange wear?' },
      { id: 'a_t2', category: 'Trolley', question: 'Side plates and connecting pins show no signs of bending?' },
      { id: 'a_t3', category: 'Trolley', question: 'Drive pinion and gear mesh lubricated and aligned?' },
    ],
  },
  operation: {
    'None (N/A)': [],
    'Electric': [
      { id: 'o_e1', category: 'Electrical', question: 'Pendant cable strain relief intact and controls clearly marked?' },
      { id: 'o_e2', category: 'Electrical', question: 'Emergency Stop button functions and cuts all power?' },
      { id: 'o_e3', category: 'Electrical', question: 'Limit switches (upper/lower) tested and stopping the hoist?' },
    ],
    'Pneumatic': [
      { id: 'o_p1', category: 'Pneumatics', question: 'Air lines free of leaks, cracks, or loose fittings?' },
      { id: 'o_p2', category: 'Pneumatics', question: 'Filter, Regulator, and Lubricator (FRL) units serviced and filled?' },
      { id: 'o_p3', category: 'Pneumatics', question: 'Exhaust mufflers in place and not obstructed?' },
    ],
    'Manual': [
      { id: 'o_ma1', category: 'Manual Hoist', question: 'Hand chain/lever moves freely through all positions?' },
      { id: 'o_ma2', category: 'Manual Hoist', question: 'Load brake holds weight securely without slipping?' },
      { id: 'o_ma3', category: 'Manual Hoist', question: 'Ratchet and pawl mechanism engaging correctly?' },
    ],
  }
};

const generateBatchId = () => `BCH-${Date.now().toString(36).toUpperCase()}`;

const App = () => {
  // Session State
  const [inspectorName, setInspectorName] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [batchId, setBatchId] = useState<string>(generateBatchId());
  
  // Current Item State
  const [assetName, setAssetName] = useState<string>('');
  const [equipmentType, setEquipmentType] = useState<string>('Bridge Crane');
  const [attachmentType, setAttachmentType] = useState<string>('Wire Rope Hoist');
  const [operationType, setOperationType] = useState<string>('Electric');
  const [responses, setResponses] = useState<Record<string, ResponseState>>({});

  // Editing State
  const [editingId, setEditingId] = useState<string | null>(null);

  // Batch Storage
  const [batch, setBatch] = useState<BatchItem[]>([]);
  
  // App Logic State
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const isHoistSelected = useMemo(() => {
    return attachmentType.toLowerCase().includes('hoist');
  }, [attachmentType]);

  const currentQuestions = useMemo(() => {
    return [
      ...CHECKLIST_DATABASE.general,
      ...(isHoistSelected ? CHECKLIST_DATABASE.lifting : []),
      ...(CHECKLIST_DATABASE.equipment[equipmentType as keyof typeof CHECKLIST_DATABASE.equipment] || []),
      ...(CHECKLIST_DATABASE.attachment[attachmentType as keyof typeof CHECKLIST_DATABASE.attachment] || []),
      ...(CHECKLIST_DATABASE.operation[operationType as keyof typeof CHECKLIST_DATABASE.operation] || [])
    ];
  }, [equipmentType, attachmentType, operationType, isHoistSelected]);

  const handleResponseChange = (id: string, status?: string, notes?: string) => {
    setResponses(prev => ({
      ...prev,
      [id]: { 
        ...prev[id], 
        status: status || prev[id]?.status || 'Pass',
        notes: notes !== undefined ? notes : (prev[id]?.notes || '')
      }
    }));
  };

  const clearForm = () => {
    setAssetName('');
    setResponses({});
    setEditingId(null);
  };

  const addToBatch = () => {
    if (!inspectorName || !customerName || !assetName) {
      setFeedback({ type: 'error', message: 'Inspector, Customer, and Asset Name are required.' });
      return;
    }

    const incomplete = currentQuestions.some(q => !responses[q.id]?.status);
    if (incomplete) {
      setFeedback({ type: 'error', message: 'Please complete all checklist items for this unit.' });
      return;
    }

    const fullAssetName = `${equipmentType} / ${attachmentType} - ${assetName} (${operationType})`;
    
    const checklistSummary = currentQuestions.map(q => {
      const res = responses[q.id] || { status: 'N/A', notes: '' };
      return `${q.question} [${res.status}]: ${res.notes || 'No notes'}`;
    }).join(' | ');

    const entryData = {
      assetRaw: assetName,
      equipment: equipmentType,
      attachment: attachmentType,
      operation: operationType,
      responsesRaw: { ...responses },
      asset: fullAssetName,
      checklist: checklistSummary,
      timestamp: new Date().toISOString()
    };

    if (editingId) {
      setBatch(prev => prev.map(item => item.id === editingId ? { ...entryData, id: editingId } : item));
      setFeedback({ type: 'success', message: 'Unit updated in batch!' });
    } else {
      setBatch(prev => [...prev, { ...entryData, id: crypto.randomUUID() }]);
      setFeedback({ type: 'success', message: 'Equipment added to batch successfully!' });
    }
    
    clearForm();
    const el = document.getElementById('equipment-id');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const loadFromBatch = (item: BatchItem) => {
    setEditingId(item.id);
    setAssetName(item.assetRaw);
    setEquipmentType(item.equipment);
    setAttachmentType(item.attachment);
    setOperationType(item.operation);
    setResponses(item.responsesRaw);
    setFeedback(null);
    
    const el = document.getElementById('equipment-id');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const removeFromBatch = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (editingId === id) clearForm();
    setBatch(prev => prev.filter(item => item.id !== id));
  };

  const submitFullBatch = async () => {
    if (batch.length === 0) return;
    
    setSubmitting(true);
    setFeedback(null);

    const payload = {
      batchId,
      customer: customerName,
      inspector: inspectorName,
      totalItems: batch.length,
      inspections: batch.map(({ id, ...rest }) => rest)
    };

    try {
      await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      setTimeout(() => {
        setFeedback({ type: 'success', message: `Batch ${batchId} submitted successfully!` });
        setBatch([]);
        setBatchId(generateBatchId());
        clearForm();
        setSubmitting(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 1500);

    } catch (err) {
      setFeedback({ type: 'error', message: 'Failed to submit batch. Data remains in session.' });
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans p-4 md:p-8 pb-32">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="bg-blue-700 rounded-2xl shadow-xl overflow-hidden border border-blue-800">
          <div className="p-6 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <HardHat className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight uppercase">Batch Safety Inspection</h1>
                <p className="text-blue-100 text-sm opacity-90">OSHA 1910.179 / ASME B30</p>
              </div>
            </div>
            <div className="flex flex-col md:items-end bg-blue-800/40 p-3 rounded-xl border border-blue-500/30">
              <span className="text-[10px] uppercase font-bold text-blue-200 tracking-widest">Active Batch ID</span>
              <span className="text-lg font-mono font-bold tracking-wider">{batchId}</span>
            </div>
          </div>
        </div>

        {/* 1. Session Details */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
            <User className="w-4 h-4" /> Customer & Inspector Info
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500">CUSTOMER / FACILITY</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="New Customer Name"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  disabled={batch.length > 0}
                />
              </div>
              {batch.length > 0 && <p className="text-[10px] text-blue-600 font-medium ml-1 italic">Customer locked for current batch</p>}
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500">INSPECTOR NAME</label>
              <div className="relative">
                <User className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  value={inspectorName}
                  onChange={(e) => setInspectorName(e.target.value)}
                  placeholder="Inspector Full Name"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  disabled={batch.length > 0}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 2. New Inspection Unit Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden transition-all" id="equipment-id">
          <div className={`${editingId ? 'bg-orange-50' : 'bg-slate-50'} border-b border-slate-200 p-4 px-6 flex justify-between items-center transition-colors`}>
            <h2 className="text-xs font-bold text-slate-600 uppercase tracking-widest flex items-center gap-2">
              {editingId ? <Pencil className="w-4 h-4 text-orange-600" /> : <Plus className="w-4 h-4 text-blue-600" />}
              {editingId ? 'Editing Unit in Batch' : 'Current Unit Entry'}
            </h2>
            {editingId && (
              <button 
                onClick={clearForm}
                className="text-[10px] font-bold text-orange-600 bg-white px-3 py-1 rounded border border-orange-200 hover:bg-orange-100 flex items-center gap-1 transition-colors"
              >
                <XCircle className="w-3 h-3" /> Cancel Edit
              </button>
            )}
            {!editingId && (
              <div className="text-[10px] font-bold text-slate-400 bg-white px-2 py-1 rounded border border-slate-200 uppercase">
                UNIT #{batch.length + 1}
              </div>
            )}
          </div>
          
          <div className="p-6 space-y-8">
            {/* Identification Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5 lg:col-span-1">
                <label className="text-[10px] font-black text-slate-400 uppercase">Serial / ID</label>
                <input 
                  type="text" 
                  value={assetName}
                  onChange={(e) => setAssetName(e.target.value)}
                  placeholder="Asset #"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase">Equipment</label>
                <select 
                  value={equipmentType}
                  onChange={(e) => setEquipmentType(e.target.value)}
                  className="w-full px-2 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                >
                  {Object.keys(CHECKLIST_DATABASE.equipment).map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase">Attachment</label>
                <select 
                  value={attachmentType}
                  onChange={(e) => setAttachmentType(e.target.value)}
                  className="w-full px-2 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                >
                  {Object.keys(CHECKLIST_DATABASE.attachment).map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase">Operation</label>
                <select 
                  value={operationType}
                  onChange={(e) => setOperationType(e.target.value)}
                  className="w-full px-2 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                >
                  {Object.keys(CHECKLIST_DATABASE.operation).map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>

            {(!isHoistSelected || operationType === 'None (N/A)') && (
              <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl flex items-center gap-3 text-blue-700 text-xs font-medium">
                <Anchor className="w-4 h-4 shrink-0" />
                <span>
                  {operationType === 'None (N/A)' 
                    ? "Operation set to N/A. Power-specific checks are hidden." 
                    : "Configured without lifting media. Hooks and Wire Rope/Chain checks are hidden."}
                </span>
              </div>
            )}

            {/* Checklist Section */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800 uppercase flex items-center gap-2">
                  <ListChecks className="w-4 h-4 text-blue-600" /> Dynamic Checklist
                </h3>
                <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded-full font-mono font-bold tracking-tight">
                  {currentQuestions.length} REQUIREMENTS
                </span>
              </div>
              
              <div className="grid grid-cols-1 gap-3">
                {currentQuestions.map((q, idx) => (
                  <div key={q.id} className="p-4 border border-slate-100 bg-slate-50/30 rounded-xl space-y-3 transition-all hover:border-slate-200">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                      <p className="text-sm font-semibold text-slate-700 leading-tight">
                        <span className="text-slate-300 font-mono text-xs mr-2">{idx + 1}.</span>
                        {q.question}
                      </p>
                      <div className="flex bg-white p-1 rounded-lg shadow-sm shrink-0 border border-slate-200">
                        {['Pass', 'Fail', 'N/A'].map(status => (
                          <button
                            key={status}
                            type="button"
                            onClick={() => handleResponseChange(q.id, status)}
                            className={`px-4 py-1.5 rounded-md text-[10px] font-black transition-all ${
                              responses[q.id]?.status === status 
                                ? status === 'Pass' ? 'bg-green-600 text-white shadow-lg shadow-green-200' :
                                  status === 'Fail' ? 'bg-red-600 text-white shadow-lg shadow-red-200' :
                                  'bg-slate-500 text-white shadow-lg shadow-slate-200'
                                : 'text-slate-400 hover:bg-slate-50'
                            }`}
                          >
                            {status}
                          </button>
                        ))}
                      </div>
                    </div>
                    <textarea 
                      placeholder="Maintenance notes or repair recommendations..."
                      className="w-full text-xs bg-white p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all resize-none"
                      rows={1}
                      value={responses[q.id]?.notes || ''}
                      onChange={(e) => handleResponseChange(q.id, undefined, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={addToBatch}
                className={`w-full py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-3 group shadow-sm border-2 border-dashed ${
                  editingId 
                    ? 'bg-orange-50 text-orange-700 border-orange-200 hover:border-orange-500 hover:bg-orange-100' 
                    : 'bg-white text-blue-700 border-blue-200 hover:border-blue-500 hover:bg-blue-50'
                }`}
              >
                <div className={`p-1 rounded-full transition-colors ${
                  editingId 
                    ? 'bg-orange-100 group-hover:bg-orange-600 group-hover:text-white' 
                    : 'bg-blue-100 group-hover:bg-blue-600 group-hover:text-white'
                }`}>
                  {editingId ? <Save className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                </div>
                {editingId ? 'Save Changes to Unit' : 'Add This Unit to Batch'}
              </button>
            </div>
          </div>
        </div>

        {/* 3. Batch Review Section */}
        <div className="bg-slate-800 rounded-2xl shadow-xl overflow-hidden border border-slate-900 transition-all">
          <div className="p-6 border-b border-slate-700 flex items-center justify-between bg-slate-900/50">
            <div className="flex items-center gap-3 text-white">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Package className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h2 className="font-bold uppercase tracking-widest text-sm">Inspection Batch Summary</h2>
                <p className="text-[10px] text-slate-400 font-medium">Click a unit to reopen/edit</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-500 uppercase mr-1">Units staged:</span>
              <span className="bg-blue-600 text-white text-xs font-black px-3 py-1 rounded-full shadow-lg shadow-blue-900/40">
                {batch.length}
              </span>
            </div>
          </div>
          
          <div className="p-6">
            {batch.length === 0 ? (
              <div className="py-16 text-center border-2 border-dashed border-slate-700 rounded-2xl">
                <ClipboardCheck className="w-12 h-12 text-slate-700 mx-auto mb-4 opacity-50" />
                <p className="text-slate-500 text-sm italic max-w-xs mx-auto">No units staged yet. Use the form above to add inspections to this batch.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {batch.map((item, i) => (
                  <div 
                    key={item.id} 
                    onClick={() => loadFromBatch(item)}
                    className={`p-4 rounded-xl flex items-center justify-between group animate-in fade-in zoom-in-95 duration-300 cursor-pointer border transition-all ${
                      editingId === item.id 
                        ? 'bg-orange-500/20 border-orange-500 shadow-lg shadow-orange-500/10' 
                        : 'bg-slate-700/40 border-slate-600 hover:bg-slate-700 hover:border-blue-500/50'
                    }`}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black border transition-colors ${
                        editingId === item.id 
                          ? 'bg-orange-600 text-white border-orange-400' 
                          : 'bg-slate-800 text-slate-500 border-slate-600 group-hover:border-blue-500 group-hover:text-blue-400'
                      }`}>
                        {editingId === item.id ? <Pencil className="w-3 h-3" /> : i + 1}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-white text-sm font-bold truncate pr-2">{item.asset}</h4>
                        <p className={`text-[10px] font-bold uppercase tracking-tighter opacity-80 ${
                          editingId === item.id ? 'text-orange-400' : 'text-blue-400'
                        }`}>
                          {item.equipment} / {item.operation}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={(e) => removeFromBatch(e, item.id)}
                        className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        title="Remove unit"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <Pencil className="w-3 h-3 text-slate-600 group-hover:text-blue-400" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Submission Controls */}
            <div className="mt-8 pt-6 border-t border-slate-700 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex-1 max-w-md w-full">
                {feedback && (
                  <div className={`p-4 rounded-xl flex items-center gap-3 animate-in slide-in-from-left-4 ${
                    feedback.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}>
                    {feedback.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                    <span className="text-xs font-bold uppercase tracking-wide">{feedback.message}</span>
                  </div>
                )}
              </div>
              
              <button
                onClick={submitFullBatch}
                disabled={batch.length === 0 || submitting || !!editingId}
                className={`w-full md:w-auto px-10 py-4 rounded-2xl font-black text-sm tracking-widest uppercase shadow-2xl transition-all flex items-center justify-center gap-3 active:scale-95 ${
                  batch.length === 0 || submitting || !!editingId
                    ? 'bg-slate-700 text-slate-500 cursor-not-allowed border border-slate-600'
                    : 'bg-blue-600 hover:bg-blue-500 text-white hover:shadow-blue-500/20 hover:-translate-y-1'
                }`}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Transmitting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" /> 
                    {editingId ? 'Save Edits First' : 'Submit Complete Batch'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] pb-10">
          Industrial Safety Compliance Engine • {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
};

export default App;
