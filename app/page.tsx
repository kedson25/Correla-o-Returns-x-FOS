'use client';

import React, { useState, useRef, useMemo } from 'react';
import { 
  Upload, 
  FileSpreadsheet, 
  Play, 
  CheckCircle2, 
  XCircle, 
  Sparkles, 
  Download, 
  Copy, 
  Check, 
  RefreshCw, 
  Search, 
  Trash2,
  Volume2,
  Keyboard,
  CornerDownLeft,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// === TYPES ===
interface ParsedData {
  fileName: string;
  fileSize: string;
  headers: string[];
  rows: Record<string, string>[];
}

interface MatchedItem {
  id10: string;
  id20: string;
  motivo: string;
  data: string;
}

// === ROBUST CSV PARSER ===
function parseCSV(rawText: string): { headers: string[]; rows: Record<string, string>[] } {
  const cleanText = rawText.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = cleanText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  if (lines.length === 0) return { headers: [], rows: [] };
  
  const firstLine = lines[0];
  let delimiter = ',';
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;
  
  if (semicolonCount > commaCount && semicolonCount > tabCount) {
    delimiter = ';';
  } else if (tabCount > commaCount && tabCount > semicolonCount) {
    delimiter = '\t';
  }

  const splitLine = (line: string): string[] => {
    const result: string[] = [];
    let currentCell = '';
    let insideQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === delimiter && !insideQuotes) {
        result.push(currentCell.trim());
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
    result.push(currentCell.trim());
    return result.map(v => v.replace(/^"|"$/g, '').trim());
  };

  const headers = splitLine(lines[0]);
  const rows = lines.slice(1).map(line => {
    const values = splitLine(line);
    const rowObj: Record<string, string> = {};
    headers.forEach((header, index) => {
      rowObj[header] = values[index] ?? '';
    });
    return rowObj;
  });

  return { headers, rows };
}

export default function Home() {
  // === STATE ===
  const [invData, setInvData] = useState<ParsedData | null>(null);
  const [fosData, setFosData] = useState<ParsedData | null>(null);

  const [invKey, setInvKey] = useState<string>('');
  const [fosKey, setFosKey] = useState<string>('');
  const [fosReasonKey, setFosReasonKey] = useState<string>('');
  const [fosDateKey, setFosDateKey] = useState<string>('');

  const [dragInv, setDragInv] = useState(false);
  const [dragFos, setDragFos] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<{
    matches: MatchedItem[];
    unmatched: string[];
  } | null>(null);

  const [matchSearch, setMatchSearch] = useState('');
  const [unmatchedSearch, setUnmatchedSearch] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedUnmatched, setCopiedUnmatched] = useState(false);

  // === MODO BIP STATE ===
  const [isBipMode, setIsBipMode] = useState(false);
  const [bipSelectedIndex, setBipSelectedIndex] = useState(0);
  const [bipCopyTarget, setBipCopyTarget] = useState<'id20' | 'id10'>('id20');
  const bipInputRef = useRef<HTMLInputElement>(null);

  const fileInputInvRef = useRef<HTMLInputElement>(null);
  const fileInputFosRef = useRef<HTMLInputElement>(null);

  // Som do BIP customizado usando a Web Audio API (agradável e ágil)
  const playBipSound = (frequency = 600, duration = 0.08) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);
      
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      console.warn("Feedback de áudio não inicializado:", e);
    }
  };

  const toggleBipMode = () => {
    const nextState = !isBipMode;
    setIsBipMode(nextState);
    if (nextState) {
      setBipSelectedIndex(0);
      playBipSound(580, 0.08);
      setTimeout(() => playBipSound(880, 0.1), 90);
      // Focar no painel do modo Bip
      setTimeout(() => {
        const inputEl = document.getElementById('bip-command-capture');
        if (inputEl) inputEl.focus();
        
        // Auto scroll suave até os resultados conciliados
        const resEl = document.getElementById('column-conciliados');
        if (resEl) {
          resEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 200);
    } else {
      playBipSound(400, 0.15);
    }
  };

  const triggerBipCopyNext = () => {
    const currentMatches = filteredMatches;
    if (!results || currentMatches.length === 0) return;
    
    let currentIndex = bipSelectedIndex;
    if (currentIndex < 0 || currentIndex >= currentMatches.length) {
      currentIndex = 0;
    }
    
    const item = currentMatches[currentIndex];
    const textToCopy = bipCopyTarget === 'id20' ? item.id20 : item.id10;
    
    // Copiar para o clipboard real
    navigator.clipboard.writeText(textToCopy);
    setCopiedIndex(currentIndex);
    
    // Emitir som do bip agudo super agradável de sucesso
    playBipSound(780, 0.09);
    
    // Efeito de flash na tela ou contorno
    const itemEl = document.getElementById(`bip-item-${currentIndex}`);
    if (itemEl) {
      itemEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Avançar índice ciclando suavemente
    const nextIdx = (currentIndex + 1) % currentMatches.length;
    setBipSelectedIndex(nextIdx);

    // Se concluiu a lista completa e reiniciou, alertar sonoramente com toque curto duplo
    if (nextIdx === 0 && currentMatches.length > 1) {
      setTimeout(() => {
        playBipSound(1050, 0.05);
        setTimeout(() => playBipSound(1050, 0.05), 60);
      }, 150);
    }
  };

  const selectBipIndexDirect = (index: number) => {
    setBipSelectedIndex(index);
    playBipSound(620, 0.06);
    setTimeout(() => {
      const inputEl = document.getElementById('bip-command-capture');
      if (inputEl) inputEl.focus();
    }, 50);
  };

  // === READ & PROCESS FILE LOADERS ===
  const handleFileLoad = (file: File, type: 'inv' | 'fos') => {
    const sizeStr = (file.size / 1024).toFixed(1) + ' KB';
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      const dataObj: ParsedData = {
        fileName: file.name,
        fileSize: sizeStr,
        headers: parsed.headers,
        rows: parsed.rows
      };
      
      if (type === 'inv') {
        setInvData(dataObj);
        const match = parsed.headers.find(h => 
          /pacote/i.test(h) || /packet/i.test(h) || /id.*1/i.test(h) || /barcode/i.test(h) || /id/i.test(h)
        );
        setInvKey(match || parsed.headers[0] || '');
      } else {
        setFosData(dataObj);
        const matchKey = parsed.headers.find(h => 
          /shipment/i.test(h) || /pacotes.*fossa/i.test(h) || /id.*shipment/i.test(h) || /id.*2/i.test(h) || /cruzado/i.test(h)
        );
        const matchReasonKey = parsed.headers.find(h => 
          /motivo/i.test(h) || /devolu/i.test(h) || /status/i.test(h) || /reason/i.test(h)
        );
        const matchDateKey = parsed.headers.find(h => 
          /data/i.test(h) || /horario/i.test(h) || /date/i.test(h) || /criado/i.test(h)
        );
        setFosKey(matchKey || parsed.headers[0] || '');
        setFosReasonKey(matchReasonKey || '');
        setFosDateKey(matchDateKey || '');
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const onDragOver = (e: React.DragEvent, type: 'inv' | 'fos') => {
    e.preventDefault();
    if (type === 'inv') setDragInv(true);
    else setDragFos(true);
  };

  const onDragLeave = (type: 'inv' | 'fos') => {
    if (type === 'inv') setDragInv(false);
    else setDragFos(false);
  };

  const onDrop = (e: React.DragEvent, type: 'inv' | 'fos') => {
    e.preventDefault();
    if (type === 'inv') setDragInv(false);
    else setDragFos(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) {
      handleFileLoad(file, type);
    }
  };

  const clearFile = (type: 'inv' | 'fos') => {
    if (type === 'inv') {
      setInvData(null);
      setInvKey('');
    } else {
      setFosData(null);
      setFosKey('');
      setFosReasonKey('');
      setFosDateKey('');
    }
    setResults(null);
  };

  const loadSampleData = () => {
    const mockInvHeaders = ['Pacote', 'ID Loja', 'Responsável'];
    const mockInvRows = Array.from({ length: 15 }, (_, i) => {
      const id10 = (46001001 + i).toString();
      return {
        'Pacote': id10,
        'ID Loja': `LJ-0${(i % 3) + 1}`,
        'Responsável': ['Carlos Silva', 'Ana Oliveira', 'Marcos Souza'][i % 3]
      };
    });

    const mockFosHeaders = ['ID shipment', 'Motivo da devolução', 'Data e horário da devolução'];
    const reasons = [
      'Cliente ausente nas 3 tentativas',
      'Endereço incorreto / Não localizado',
      'Recusado pelo destinatário',
      'Avaria constatada no transporte',
      'Mudança do cliente'
    ];
    
    const mockFosRows: Record<string, string>[] = [];
    for (let i = 0; i < 11; i++) {
      const id10 = (46001001 + i).toString();
      const id20 = (47009001 + i).toString();
      const day = 20 + (i % 7);
      mockFosRows.push({
        'ID shipment': `${id20} - ${id10}`,
        'Motivo da devolução': reasons[i % reasons.length],
        'Data e horário da devolução': `2026-05-${day} ${10 + (i % 12)}:${15 + (i * 3) % 45}:30`
      });
    }
    for (let i = 0; i < 3; i++) {
      const id10 = (46099001 + i).toString();
      const id20 = (47099001 + i).toString();
      mockFosRows.push({
        'ID shipment': `${id20} - ${id10}`,
        'Motivo da devolução': 'Cliente desconhecido no local',
        'Data e horário da devolução': `2026-05-24 16:22:45`
      });
    }

    setInvData({
      fileName: 'Exemplo_Inventario_Returns.csv',
      fileSize: '1.2 KB',
      headers: mockInvHeaders,
      rows: mockInvRows
    });
    setInvKey('Pacote');

    setFosData({
      fileName: 'Exemplo_Base_FOS_Packages.csv',
      fileSize: '2.8 KB',
      headers: mockFosHeaders,
      rows: mockFosRows
    });
    setFosKey('ID shipment');
    setFosReasonKey('Motivo da devolução');
    setFosDateKey('Data e horário da devolução');

    setResults(null);
  };

  const runCorrelation = () => {
    if (!invData || !fosData || !invKey || !fosKey) return;
    setIsProcessing(true);

    setTimeout(() => {
      const fosMap = new Map<string, { id20: string; motivo: string; data: string }>();
      
      fosData.rows.forEach(row => {
        const rawShipment = row[fosKey] || '';
        const idx = rawShipment.indexOf(' - ');
        
        if (idx === -1) return;
        
        const id20 = rawShipment.slice(0, idx).trim();
        const id10 = rawShipment.slice(idx + 3).trim();
        
        if (id10) {
          fosMap.set(id10, {
            id20,
            motivo: fosReasonKey ? row[fosReasonKey] || 'Não informado' : 'Não mapeado',
            data: fosDateKey ? row[fosDateKey] || 'Não informada' : 'Não mapeada'
          });
        }
      });

      const matches: MatchedItem[] = [];
      const unmatched: string[] = [];

      invData.rows.forEach(row => {
        const pacoteId = (row[invKey] || '').trim();
        if (!pacoteId) return;

        if (fosMap.has(pacoteId)) {
          const detail = fosMap.get(pacoteId)!;
          matches.push({
            id10: pacoteId,
            id20: detail.id20,
            motivo: detail.motivo,
            data: detail.data
          });
        } else {
          unmatched.push(pacoteId);
        }
      });

      setResults({
        matches,
        unmatched: Array.from(new Set(unmatched))
      });
      setIsProcessing(false);
    }, 400);
  };

  const filteredMatches = (() => {
    if (!results) return [];
    let items = [...results.matches];
    if (matchSearch) {
      const query = matchSearch.toLowerCase();
      items = items.filter(item => 
        item.id10.toLowerCase().includes(query) ||
        item.id20.toLowerCase().includes(query) ||
        item.motivo.toLowerCase().includes(query)
      );
    }
    return items;
  })();

  const filteredUnmatched = (() => {
    if (!results) return [];
    let items = [...results.unmatched];
    if (unmatchedSearch) {
      const query = unmatchedSearch.toLowerCase();
      items = items.filter(id => id.toLowerCase().includes(query));
    }
    return items;
  })();

  const copyId20 = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  const copyAllUnmatched = () => {
    if (!results || results.unmatched.length === 0) return;
    navigator.clipboard.writeText(results.unmatched.join(', '));
    setCopiedUnmatched(true);
    setTimeout(() => setCopiedUnmatched(false), 1500);
  };

  const downloadResultsCSV = () => {
    if (!results || results.matches.length === 0) return;
    const headers = ['ID 1.0 (Pacote)', 'ID 2.0 (FOS)', 'Motivo de Devolucao', 'Data e Horario'];
    const csvContent = [
      headers.join(';'),
      ...results.matches.map(item => [
        item.id10,
        item.id20,
        `"${item.motivo.replace(/"/g, '""')}"`,
        `"${item.data.replace(/"/g, '""')}"`
      ].join(';'))
    ].join('\r\n');

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'relatorio_conciliacao.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="app-root" className="max-w-5xl mx-auto p-4 md:p-8 space-y-6 select-none font-sans">
      
      {/* HEADER */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-5 border-b border-brand-border gap-4">
        <div>
          <h1 className="text-2xl font-light tracking-tight text-brand-text">
            Conciliador <span className="font-semibold text-brand-accent">Returns × FOS</span>
          </h1>
          <p className="text-xs text-brand-muted mt-1">
            Cruze o inventário de devoluções (IDs 1.0) com os pacotes FOS (IDs 2.0).
          </p>
        </div>
        
        <div className="flex items-center gap-2 self-start sm:self-center">
          <motion.button 
            type="button" 
            id="btn-sample-data"
            onClick={loadSampleData}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-surface2 border border-brand-border text-xs text-brand-accent hover:border-brand-accent hover:text-white transition duration-200 cursor-pointer font-medium"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Dados de Exemplo</span>
          </motion.button>
          
          {(invData || fosData || results) && (
            <motion.button 
              type="button"
              id="btn-clear-all"
              onClick={() => {
                clearFile('inv');
                clearFile('fos');
                setResults(null);
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-950/20 border border-red-900/40 text-xs text-brand-danger hover:bg-brand-danger hover:text-black hover:border-brand-danger transition duration-200 cursor-pointer font-medium"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Resetar</span>
            </motion.button>
          )}
        </div>
      </header>

      {/* COMPACT UPLOADERS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="upload-grid-container">
        
        {/* INVENTÁRIO (ARQUIVO 1) */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-[10px] font-mono text-brand-muted uppercase tracking-wider">
            <span>Arquivo 1: Inventário Dev.</span>
            {invData && <span className="text-brand-accent">{invData.rows.length} registros</span>}
          </div>
          <div
            id="zone-returns-upload"
            className={`border rounded-xl p-6 text-center cursor-pointer transition relative group ${
              dragInv ? 'border-brand-accent bg-brand-accent-dim' : 'border-brand-border bg-brand-surface hover:border-brand-accent/60'
            } ${invData ? 'border-solid border-brand-accent/30 bg-brand-surface' : 'border-dashed'}`}
            onDragOver={(e) => onDragOver(e, 'inv')}
            onDragLeave={() => onDragLeave('inv')}
            onDrop={(e) => onDrop(e, 'inv')}
            onClick={() => !invData && fileInputInvRef.current?.click()}
          >
            <input 
              type="file" 
              accept=".csv" 
              id="file-returns"
              ref={fileInputInvRef}
              onChange={(e) => e.target.files?.[0] && handleFileLoad(e.target.files[0], 'inv')}
              className="hidden" 
            />

            {invData ? (
              <div className="flex items-center justify-between text-left">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2.5 bg-brand-accent-dim border border-brand-accent-border text-brand-accent rounded-lg shrink-0">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-medium text-brand-text truncate pr-1" title={invData.fileName}>
                      {invData.fileName}
                    </h4>
                    <p className="text-[10px] text-brand-muted font-mono">{invData.fileSize} • Coluna: {invKey}</p>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={(e) => { e.stopPropagation(); clearFile('inv'); }}
                  className="p-1 hover:bg-brand-surface2 rounded text-brand-danger shrink-0 transition"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-2 py-2">
                <div className="w-10 h-10 rounded-full bg-brand-surface2 border border-brand-border flex items-center justify-center mx-auto text-brand-muted group-hover:text-brand-accent transition">
                  <Upload className="w-4 h-4" />
                </div>
                <p className="text-xs text-brand-text">
                  Carregar CSV de Devoluções ou <span className="text-brand-accent font-medium underline">clicar</span>
                </p>
                <p className="text-[10px] text-brand-muted/70 font-mono">Formatos suportados: .csv</p>
              </div>
            )}
          </div>
        </div>

        {/* FOS (ARQUIVO 2) */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-[10px] font-mono text-brand-muted uppercase tracking-wider">
            <span>Arquivo 2: Base FOS</span>
            {fosData && <span className="text-brand-accent">{fosData.rows.length} registros</span>}
          </div>
          <div
            id="zone-fos-upload"
            className={`border rounded-xl p-6 text-center cursor-pointer transition relative group ${
              dragFos ? 'border-brand-accent bg-brand-accent-dim' : 'border-brand-border bg-brand-surface hover:border-brand-accent/60'
            } ${fosData ? 'border-solid border-brand-accent/30 bg-brand-surface' : 'border-dashed'}`}
            onDragOver={(e) => onDragOver(e, 'fos')}
            onDragLeave={() => onDragLeave('fos')}
            onDrop={(e) => onDrop(e, 'fos')}
            onClick={() => !fosData && fileInputFosRef.current?.click()}
          >
            <input 
              type="file" 
              accept=".csv" 
              id="file-fos"
              ref={fileInputFosRef}
              onChange={(e) => e.target.files?.[0] && handleFileLoad(e.target.files[0], 'fos')}
              className="hidden" 
            />

            {fosData ? (
              <div className="flex items-center justify-between text-left">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2.5 bg-brand-accent-dim border border-brand-accent-border text-brand-accent rounded-lg shrink-0">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-medium text-brand-text truncate pr-1" title={fosData.fileName}>
                      {fosData.fileName}
                    </h4>
                    <p className="text-[10px] text-brand-muted font-mono">{fosData.fileSize} • Coluna: {fosKey}</p>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={(e) => { e.stopPropagation(); clearFile('fos'); }}
                  className="p-1 hover:bg-brand-surface2 rounded text-brand-danger shrink-0 transition"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-2 py-2">
                <div className="w-10 h-10 rounded-full bg-brand-surface2 border border-brand-border flex items-center justify-center mx-auto text-brand-muted group-hover:text-brand-accent transition">
                  <Upload className="w-4 h-4" />
                </div>
                <p className="text-xs text-brand-text">
                  Carregar CSV da Base FOS ou <span className="text-brand-accent font-medium underline">clicar</span>
                </p>
                <p className="text-[10px] text-brand-muted/70 font-mono">Formato esperado: .csv</p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* CORE TRIGGER RECTANGLE BUTTON */}
      <div className="text-center">
        <motion.button
          type="button"
          id="btn-run-correlation"
          onClick={runCorrelation}
          disabled={!invData || !fosData || isProcessing}
          whileHover={invData && fosData && !isProcessing ? { scale: 1.01 } : {}}
          whileTap={invData && fosData && !isProcessing ? { scale: 0.99 } : {}}
          className={`w-full py-3.5 px-6 rounded-xl font-mono text-xs font-bold tracking-wider transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
            invData && fosData && !isProcessing
              ? 'bg-brand-accent text-[#0e0e0f] shadow-[0_4px_15px_rgba(0,229,160,0.2)] hover:bg-[#00ffd0]'
              : 'bg-brand-surface2 border border-brand-border text-brand-muted cursor-not-allowed opacity-60'
          }`}
        >
          {isProcessing ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-[#0e0e0f]" />
              <span>PROCESSANDO DADOS...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 text-[#0e0e0f] fill-[#0e0e0f]" />
              <span>RODAR CONCILIAÇÃO DE PLANILHAS</span>
            </>
          )}
        </motion.button>
      </div>

      {/* LIST OF RESULTS */}
      <AnimatePresence>
        {results && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2"
          >
            
            {/* COLUMN 1: CONCILIADOS (MATCHES) */}
            <div id="column-conciliados" className="bg-brand-surface border border-brand-border rounded-xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-brand-border/60 pb-3 gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-brand-accent flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Conciliados ({results.matches.length})</span>
                  </h3>
                  <p className="text-[11px] text-brand-muted">Mapeados com sucesso FOS (ID 2.0)</p>
                </div>
                
                {results.matches.length > 0 && (
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                    <button
                      type="button"
                      id="btn-toggle-bip"
                      onClick={toggleBipMode}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-mono leading-none transition-all duration-200 cursor-pointer ${
                        isBipMode 
                          ? 'bg-brand-accent text-[#0e0e0f] border border-brand-accent shadow-[0_0_12px_rgba(0,229,160,0.4)] font-bold' 
                          : 'bg-brand-surface2 hover:bg-brand-surface border border-brand-border text-brand-accent hover:border-brand-accent/50'
                      }`}
                      title="Ativar escuta de comando Enter para cópia consecutiva inteligente em tela dividida"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>{isBipMode ? 'Bip Ativo' : 'Modo Bip'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={downloadResultsCSV}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-brand-surface2 hover:bg-brand-surface border border-brand-border rounded-md text-[11px] text-brand-text font-mono transition leading-none cursor-pointer"
                      title="Exportar CSV com os matches"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Baixar CSV</span>
                    </button>
                  </div>
                )}
              </div>

              {/* PAINEL DE COMANDOS DO MODO BIP */}
              <AnimatePresence>
                {isBipMode && filteredMatches.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-brand-bg/95 border-2 border-brand-accent/70 rounded-xl p-4 space-y-3.5 shadow-[0_0_20px_rgba(0,229,160,0.15)] overflow-hidden"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-2 w-2 shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-accent opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-accent"></span>
                        </span>
                        <span className="text-[10px] font-bold font-mono text-brand-accent tracking-wider uppercase truncate">
                          MÓDULO BIP TELA DIVIDIDA
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => { setBipCopyTarget('id20'); playBipSound(650, 0.05); }}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-mono transition font-semibold leading-none ${bipCopyTarget === 'id20' ? 'bg-brand-accent text-[#0e0e0f]' : 'bg-brand-surface2 text-brand-muted hover:text-brand-text'}`}
                        >
                          Copiar FOS
                        </button>
                        <button
                          type="button"
                          onClick={() => { setBipCopyTarget('id10'); playBipSound(650, 0.05); }}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-mono transition font-semibold leading-none ${bipCopyTarget === 'id10' ? 'bg-brand-accent text-[#0e0e0f]' : 'bg-brand-surface2 text-brand-muted hover:text-brand-text'}`}
                        >
                          Copiar Inv
                        </button>
                      </div>
                    </div>

                    {/* EXIBIÇÃO EM DESTAQUE DO ITEM SELECIONADO ATUALMENTE */}
                    {(() => {
                      const idx = bipSelectedIndex < filteredMatches.length ? bipSelectedIndex : 0;
                      const currentItem = filteredMatches[idx];
                      if (!currentItem) return null;
                      
                      return (
                        <div className="bg-brand-surface2/80 rounded-lg p-3 border border-brand-border/60 flex flex-col sm:flex-row items-center sm:justify-between gap-3 text-center sm:text-left">
                          <div className="space-y-1 min-w-0 flex-1">
                            <span className="text-[9px] text-brand-muted uppercase tracking-wider font-mono block">
                              Próximo no Gatilho ({idx + 1} de {filteredMatches.length})
                            </span>
                            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 leading-none">
                              <span className="text-sm font-bold font-mono text-brand-text max-w-full truncate">
                                {bipCopyTarget === 'id20' ? currentItem.id20 : currentItem.id10}
                              </span>
                              <span className="text-[9px] text-brand-muted font-mono bg-brand-surface px-1 py-0.5 rounded border border-brand-border">
                                {bipCopyTarget === 'id20' ? 'FOS 2.0' : 'Inven 1.0'}
                              </span>
                            </div>
                            <p className="text-[10px] text-brand-muted/80 truncate max-w-full block" title={currentItem.motivo}>
                              Motivo: {currentItem.motivo}
                            </p>
                          </div>

                          <div className="flex items-center gap-1 shrink-0 self-stretch sm:self-center justify-center">
                            <button
                              type="button"
                              onClick={() => {
                                const prev = (idx - 1 + filteredMatches.length) % filteredMatches.length;
                                selectBipIndexDirect(prev);
                              }}
                              className="p-1.5 bg-brand-surface hover:bg-brand-border border border-brand-border rounded text-brand-text transition cursor-pointer"
                              title="Item Anterior"
                            >
                              <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                            </button>
                            <button
                              type="button"
                              onClick={triggerBipCopyNext}
                              className="px-2.5 py-1.5 bg-brand-surface hover:bg-brand-border border border-brand-border rounded text-brand-accent font-mono text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                              title="Copiar Atual e Avançar"
                            >
                              <Copy className="w-3 h-3" />
                              <span>Pular/Copiar</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const next = (idx + 1) % filteredMatches.length;
                                selectBipIndexDirect(next);
                              }}
                              className="p-1.5 bg-brand-surface hover:bg-brand-border border border-brand-border rounded text-brand-text transition cursor-pointer"
                              title="Próximo Item"
                            >
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })()}

                    {/* O CAPTURADORES DE COMANDOS DEDICADO DO TECLADO */}
                    <div className="relative group/input">
                      <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-brand-accent">
                        <Keyboard className="w-4 h-4 animate-pulse shrink-0" />
                      </div>
                      <input
                        type="text"
                        id="bip-command-capture"
                        ref={bipInputRef}
                        placeholder="Clique aqui! Pressione [ENTER] em tela dividida..."
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            triggerBipCopyNext();
                          }
                        }}
                        className="w-full bg-brand-surface border-2 border-brand-accent/50 group-hover/input:border-brand-accent rounded-lg pl-9 pr-24 py-2.5 text-xs text-brand-text font-mono placeholder-brand-muted/70 focus:border-brand-accent focus:outline-none transition-all shadow-[inset_0_2px_8px_rgba(0,0,0,0.5)]"
                      />
                      <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none text-[9px] text-brand-muted font-mono uppercase gap-1 shrink-0">
                        <span>Aperte</span>
                        <kbd className="bg-brand-surface2 border border-brand-border px-1 py-0.5 rounded text-brand-accent font-bold">ENTER</kbd>
                        <CornerDownLeft className="w-2.5 h-2.5 text-brand-accent" />
                      </div>
                    </div>
                    
                    <div className="text-[10px] text-brand-muted/90 flex flex-col sm:flex-row sm:items-center justify-between gap-1 px-1 pt-0.5">
                      <div className="flex items-center gap-1 font-mono">
                        <Volume2 className="w-3 h-3 text-brand-accent" />
                        <span>Bip sonoro ativo ao copiar</span>
                      </div>
                      <span className="font-sans text-[9px] text-brand-muted/65 sm:text-right">Dica: clique fora do campo se quiser digitar em outro lugar</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {results.matches.length > 0 && (
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 w-3.5 h-3.5 text-brand-muted" />
                  <input
                    type="text"
                    placeholder="Filtrar por ID ou motivo..."
                    value={matchSearch}
                    onChange={(e) => setMatchSearch(e.target.value)}
                    className="w-full bg-brand-surface2 border border-brand-border rounded-lg pl-7.5 pr-3 py-1.5 text-xs text-brand-text outline-none focus:border-brand-accent/60 transition"
                  />
                </div>
              )}

              <div className="max-h-[380px] overflow-y-auto space-y-2 pr-1.5" id="bip-matches-container">
                {filteredMatches.map((item, index) => {
                  const isCurrentlyBipFocused = isBipMode && bipSelectedIndex === index;
                  return (
                    <div 
                      key={index}
                      id={`bip-item-${index}`}
                      onClick={() => isBipMode && selectBipIndexDirect(index)}
                      className={`p-3 rounded-lg space-y-2 transition-all duration-200 cursor-pointer relative ${
                        isCurrentlyBipFocused
                          ? 'bg-brand-accent-dim/30 border-2 border-brand-accent/80 shadow-[0_0_15px_rgba(0,229,160,0.15)] ring-1 ring-brand-accent/30'
                          : 'bg-brand-surface2/60 border border-brand-border/40 hover:border-brand-accent/20'
                      }`}
                    >
                      {isCurrentlyBipFocused && (
                        <span className="absolute -top-1.5 -right-1 bg-brand-accent text-[#0e0e0f] text-[8px] font-bold font-mono px-1 py-0.5 rounded uppercase tracking-wider shadow">
                          Foco no Gatilho
                        </span>
                      )}

                      <div className="flex justify-between items-center text-xs font-mono">
                        <span className="text-brand-text font-semibold">Inven: {item.id10}</span>
                        <div className="flex items-center gap-1">
                          <span className={`font-semibold ${isCurrentlyBipFocused ? 'text-[#00ffd0]' : 'text-brand-accent'}`}>
                            FOS: {item.id20}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); copyId20(item.id20, index); playBipSound(700, 0.05); }}
                            className="p-1 hover:bg-brand-surface rounded text-brand-muted hover:text-brand-accent transition cursor-pointer"
                          >
                            {copiedIndex === index ? (
                              <Check className="w-3" />
                            ) : (
                              <Copy className="w-3" />
                            )}
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px] text-brand-muted leading-tight border-t border-brand-border/20 pt-1.5 font-mono">
                        <div className="truncate" title={item.motivo}>
                          <span className="block text-[9px] uppercase text-brand-muted/70 font-sans">Motivo</span>
                          {item.motivo}
                        </div>
                        <div className="truncate" title={item.data}>
                          <span className="block text-[9px] uppercase text-brand-muted/70 font-sans">Data</span>
                          {item.data}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {filteredMatches.length === 0 && (
                  <div className="text-center py-10 text-xs text-brand-muted font-sans">
                    {results.matches.length === 0 ? 'Nenhum match encontrado.' : 'Nenhum resultado corresponde à busca.'}
                  </div>
                )}
              </div>
            </div>

            {/* COLUMN 2: NÃO LOCALIZADOS (UNMATCHED) */}
            <div className="bg-brand-surface border border-brand-border rounded-xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-brand-border/60 pb-3 gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-brand-danger flex items-center gap-1.5">
                    <XCircle className="w-4 h-4" />
                    <span>Não Encontrados ({results.unmatched.length})</span>
                  </h3>
                  <p className="text-[11px] text-brand-muted">IDs do Inventário inexistentes na base FOS</p>
                </div>

                {results.unmatched.length > 0 && (
                  <button
                    type="button"
                    onClick={copyAllUnmatched}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-brand-surface2 hover:bg-brand-surface border border-brand-border rounded-md text-[11px] text-brand-text font-mono transition"
                    title="Copiar lista de IDs separados por vírgula"
                  >
                    {copiedUnmatched ? <Check className="w-3.5 h-3.5 text-brand-accent" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedUnmatched ? 'Copiado!' : 'Copiar Lista'}</span>
                  </button>
                )}
              </div>

              {results.unmatched.length > 0 && (
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 w-3.5 h-3.5 text-brand-muted" />
                  <input
                    type="text"
                    placeholder="Filtrar ID do inventário..."
                    value={unmatchedSearch}
                    onChange={(e) => setUnmatchedSearch(e.target.value)}
                    className="w-full bg-brand-surface2 border border-brand-border rounded-lg pl-7.5 pr-3 py-1.5 text-xs text-brand-text outline-none focus:border-brand-accent/60 transition"
                  />
                </div>
              )}

              <div className="max-h-[380px] overflow-y-auto space-y-1.5 pr-1.5">
                {filteredUnmatched.map((id) => (
                  <div 
                    key={id}
                    className="flex items-center justify-between p-2.5 bg-brand-surface2/40 border border-brand-border/30 rounded-lg text-xs font-mono text-brand-muted select-text hover:text-brand-text hover:border-brand-danger/20 transition-all duration-200"
                  >
                    <span>ID Pacote: <strong className="text-brand-text font-semibold">{id}</strong></span>
                    <span className="text-[9px] font-mono uppercase bg-red-950/20 text-brand-danger border border-red-900/30 px-1.5 py-0.5 rounded-md">Sem Registro</span>
                  </div>
                ))}

                {filteredUnmatched.length === 0 && (
                  <div className="text-center py-10 text-xs text-brand-muted font-sans/40">
                    {results.unmatched.length === 0 ? 'Parabéns! Coesão máxima atingida (tudo conciliado).' : 'Nenhum resultado corresponde ao filtro.'}
                  </div>
                )}
              </div>
            </div>

          </motion.div>
        )}
      </AnimatePresence>

      {/* FOOTER */}
      <footer className="pt-4 text-center text-[10px] text-brand-muted font-mono">
        Correlação Returns Operations • Distribuição Fossa Logística
      </footer>

    </div>
  );
}
