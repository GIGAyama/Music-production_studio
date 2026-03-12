import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Square, Music, Disc, Trash2, Plus, SlidersHorizontal, Download, CheckCircle2, Loader2, X, Edit2, Copy, ClipboardPaste, Settings2, HelpCircle, Keyboard, Sparkles, ExternalLink, Check } from 'lucide-react';

/* =========================================================================
   1. デザインシステム＆ヘルパー（ルビ付きテキスト）
   ========================================================================= */
const R = ({ t, r }) => (
  <span translate="no">
    <ruby className="tracking-widest">
      {t}<rt>{r}</rt>
    </ruby>
  </span>
);

const SCALES = {
  major: { name: '長調', notes: [ { name: '高C', sub: '高いド', freq: 523.25 }, { name: 'B', sub: 'シ', freq: 493.88 }, { name: 'A', sub: 'ラ', freq: 440.00 }, { name: 'G', sub: 'ソ', freq: 392.00 }, { name: 'F', sub: 'ファ', freq: 349.23 }, { name: 'E', sub: 'ミ', freq: 329.63 }, { name: 'D', sub: 'レ', freq: 293.66 }, { name: 'C', sub: 'ド', freq: 261.63 } ] },
  minorPenta: { name: '短調', notes: [ { name: '高C', sub: '高ド', freq: 523.25 }, { name: 'Bb', sub: 'シ♭', freq: 466.16 }, { name: 'G', sub: 'ソ', freq: 392.00 }, { name: 'F', sub: 'ファ', freq: 349.23 }, { name: 'Eb', sub: 'ミ♭', freq: 311.13 }, { name: 'C', sub: 'ド', freq: 261.63 }, { name: '低Bb', sub: '低シ♭', freq: 233.08 }, { name: '低G', sub: '低ソ', freq: 196.00 } ] },
  ryukyu: { name: '琉球', notes: [ { name: '高C', sub: '高ド', freq: 523.25 }, { name: 'B', sub: 'シ', freq: 493.88 }, { name: 'G', sub: 'ソ', freq: 392.00 }, { name: 'F', sub: 'ファ', freq: 349.23 }, { name: 'E', sub: 'ミ', freq: 329.63 }, { name: 'C', sub: 'ド', freq: 261.63 }, { name: '低B', sub: '低シ', freq: 246.94 }, { name: '低G', sub: '低ソ', freq: 196.00 } ] },
  yonanuki: { name: '祭囃子', notes: [ { name: '高C', sub: '高ド', freq: 523.25 }, { name: 'A', sub: 'ラ', freq: 440.00 }, { name: 'G', sub: 'ソ', freq: 392.00 }, { name: 'E', sub: 'ミ', freq: 329.63 }, { name: 'D', sub: 'レ', freq: 293.66 }, { name: 'C', sub: 'ド', freq: 261.63 }, { name: '低A', sub: '低ラ', freq: 220.00 }, { name: '低G', sub: '低ソ', freq: 196.00 } ] }
};

const INSTRUMENTS = [
  { id: 'piano', name: 'ピアノ' }, { id: 'musicbox', name: 'オルゴール' }, { id: '8bit', name: 'ゲーム' }, { id: 'brass', name: '金管' }, { id: 'flute', name: '笛' }, { id: 'space', name: '宇宙' }, { id: 'guitar', name: 'ギター' }
];

const DRUM_INSTRUMENTS = [
  { id: 'hihat', name: 'Hi-Hat', sub: 'チッ' }, { id: 'snare', name: 'Snare', sub: 'タン' }, { id: 'kick', name: 'Kick', sub: 'ドン' }
];

const STEPS_PER_PAGE = 16; 
const MAX_PAGES = 4;

const loadLameJS = () => {
  return new Promise((resolve, reject) => {
    if (window.lamejs) return resolve(window.lamejs);
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.1/lame.min.js';
    script.onload = () => resolve(window.lamejs);
    script.onerror = () => reject(new Error('MP3変換機能の読み込みに失敗しました'));
    document.body.appendChild(script);
  });
};

/* =========================================================================
   2. Audio Engine (再生・書き出し共通の音作りロジック)
   ========================================================================= */
const makeDistortionCurve = (amount) => {
  const k = amount; const n_samples = 44100; const curve = new Float32Array(n_samples); const deg = Math.PI / 180;
  for (let i = 0; i < n_samples; ++i) { const x = i * 2 / n_samples - 1; curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x)); }
  return curve;
};
const guitarDistortionCurve = makeDistortionCurve(50);

const playTone = (audioState, time, freq, instrumentId) => {
  if (!audioState.ctx) return;
  const ctx = audioState.ctx; const outGain = ctx.createGain();
  outGain.connect(audioState.masterGain); outGain.connect(audioState.delayNode); outGain.connect(audioState.convolver);

  switch (instrumentId) {
    case 'piano': {
      const osc1 = ctx.createOscillator(); const osc2 = ctx.createOscillator(); const gain = ctx.createGain();
      osc1.type = 'triangle'; osc2.type = 'sine'; osc1.frequency.value = freq; osc2.frequency.value = freq * 2;
      const osc2Gain = ctx.createGain(); osc2Gain.gain.value = 0.15; osc2.connect(osc2Gain); osc2Gain.connect(gain); osc1.connect(gain);
      gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(0.6, time + 0.02); gain.gain.exponentialRampToValueAtTime(0.001, time + 1.2);
      gain.connect(outGain); osc1.start(time); osc2.start(time); osc1.stop(time + 1.5); osc2.stop(time + 1.5);
      break;
    }
    case 'guitar': {
      const osc1 = ctx.createOscillator(); const osc2 = ctx.createOscillator(); const waveShaper = ctx.createWaveShaper(); const filter = ctx.createBiquadFilter(); const gain = ctx.createGain();
      osc1.type = 'sawtooth'; osc2.type = 'square'; osc1.frequency.value = freq; osc2.frequency.value = freq * 0.998; 
      waveShaper.curve = guitarDistortionCurve; waveShaper.oversample = '4x'; filter.type = 'lowpass'; filter.frequency.value = 4000;
      gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(0.25, time + 0.02); gain.gain.exponentialRampToValueAtTime(0.001, time + 1.2); 
      osc1.connect(waveShaper); osc2.connect(waveShaper); waveShaper.connect(filter); filter.connect(gain); gain.connect(outGain);
      osc1.start(time); osc2.start(time); osc1.stop(time + 1.3); osc2.stop(time + 1.3);
      break;
    }
    case 'flute': {
      const osc = ctx.createOscillator(); const lfo = ctx.createOscillator(); const gain = ctx.createGain(); const lfoGain = ctx.createGain();
      osc.type = 'sine'; osc.frequency.value = freq; lfo.type = 'sine'; lfo.frequency.value = 5.5; lfoGain.gain.value = freq * 0.015;
      lfo.connect(lfoGain); lfoGain.connect(osc.frequency);
      gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(0.5, time + 0.08); gain.gain.exponentialRampToValueAtTime(0.001, time + 0.6);
      osc.connect(gain); gain.connect(outGain); osc.start(time); lfo.start(time); osc.stop(time + 0.8); lfo.stop(time + 0.8);
      break;
    }
    case 'brass': {
      const osc = ctx.createOscillator(); const filter = ctx.createBiquadFilter(); const gain = ctx.createGain();
      osc.type = 'sawtooth'; osc.frequency.value = freq; filter.type = 'lowpass'; filter.frequency.setValueAtTime(freq, time);
      filter.frequency.linearRampToValueAtTime(freq * 3.5, time + 0.06); filter.frequency.exponentialRampToValueAtTime(freq * 1.5, time + 0.3);
      gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(0.4, time + 0.05); gain.gain.exponentialRampToValueAtTime(0.001, time + 0.4);
      osc.connect(filter); filter.connect(gain); gain.connect(outGain); osc.start(time); osc.stop(time + 0.5);
      break;
    }
    case 'musicbox': {
      const osc = ctx.createOscillator(); const clickOsc = ctx.createOscillator(); const gain = ctx.createGain(); const clickGain = ctx.createGain();
      osc.type = 'sine'; osc.frequency.value = freq; clickOsc.type = 'sine'; clickOsc.frequency.value = freq * 3.5;
      gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(0.6, time + 0.01); gain.gain.exponentialRampToValueAtTime(0.001, time + 0.8);
      clickGain.gain.setValueAtTime(0, time); clickGain.gain.linearRampToValueAtTime(0.15, time + 0.002); clickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);
      osc.connect(gain); clickOsc.connect(clickGain); gain.connect(outGain); clickGain.connect(outGain);
      osc.start(time); clickOsc.start(time); osc.stop(time + 1.0); clickOsc.stop(time + 0.1);
      break;
    }
    case '8bit': {
      const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.type = 'square'; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(0.15, time + 0.01); gain.gain.setValueAtTime(0.15, time + 0.15); gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);
      osc.connect(gain); gain.connect(outGain); osc.start(time); osc.stop(time + 0.3);
      break;
    }
    case 'space': {
      const osc = ctx.createOscillator(); const lfo = ctx.createOscillator(); const gain = ctx.createGain(); const lfoGain = ctx.createGain();
      osc.type = 'sine'; osc.frequency.value = freq; lfo.type = 'sine'; lfo.frequency.value = 3; lfoGain.gain.value = freq * 0.06;
      lfo.connect(lfoGain); lfoGain.connect(osc.frequency);
      gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(0.4, time + 0.2); gain.gain.exponentialRampToValueAtTime(0.001, time + 1.5);
      osc.connect(gain); gain.connect(outGain); osc.start(time); lfo.start(time); osc.stop(time + 2.0); lfo.stop(time + 2.0);
      break;
    }
    default: {
      const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.type = 'triangle'; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(0.5, time + 0.01); gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
      osc.connect(gain); gain.connect(outGain); osc.start(time); osc.stop(time + 0.4);
      break;
    }
  }
};

const playKick = (audioState, time) => {
  if (!audioState.ctx) return;
  const osc = audioState.ctx.createOscillator(); const gain = audioState.ctx.createGain(); osc.type = 'sine';
  osc.frequency.setValueAtTime(150, time); osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);
  gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(1, time + 0.01); gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);
  osc.connect(gain); gain.connect(audioState.masterGain); gain.connect(audioState.delayNode); gain.connect(audioState.convolver);
  osc.start(time); osc.stop(time + 0.5);
};

const playSnare = (audioState, time) => {
  if (!audioState.ctx) return;
  const osc = audioState.ctx.createOscillator(); const oscGain = audioState.ctx.createGain(); osc.type = 'triangle';
  osc.frequency.setValueAtTime(250, time); oscGain.gain.setValueAtTime(0, time); oscGain.gain.linearRampToValueAtTime(0.6, time + 0.01); oscGain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
  osc.connect(oscGain); oscGain.connect(audioState.masterGain); oscGain.connect(audioState.delayNode); oscGain.connect(audioState.convolver);
  osc.start(time); osc.stop(time + 0.2);
  if (audioState.noiseBuffer) {
    const noise = audioState.ctx.createBufferSource(); noise.buffer = audioState.noiseBuffer;
    const noiseFilter = audioState.ctx.createBiquadFilter(); noiseFilter.type = 'highpass'; noiseFilter.frequency.value = 1000;
    const noiseGain = audioState.ctx.createGain(); noiseGain.gain.setValueAtTime(0, time); noiseGain.gain.linearRampToValueAtTime(0.6, time + 0.01); noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
    noise.connect(noiseFilter); noiseFilter.connect(noiseGain); noiseGain.connect(audioState.masterGain); noiseGain.connect(audioState.delayNode); noiseGain.connect(audioState.convolver);
    noise.start(time);
  }
};

const playHihat = (audioState, time) => {
  if (!audioState.ctx || !audioState.noiseBuffer) return;
  const noise = audioState.ctx.createBufferSource(); noise.buffer = audioState.noiseBuffer;
  const noiseFilter = audioState.ctx.createBiquadFilter(); noiseFilter.type = 'bandpass'; noiseFilter.frequency.value = 10000;
  const noiseGain = audioState.ctx.createGain(); noiseGain.gain.setValueAtTime(0, time); noiseGain.gain.linearRampToValueAtTime(0.4, time + 0.01); noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
  noise.connect(noiseFilter); noiseFilter.connect(noiseGain); noiseGain.connect(audioState.masterGain); noiseGain.connect(audioState.delayNode); noiseGain.connect(audioState.convolver);
  noise.start(time);
};

/* =========================================================================
   3. カスタムフック（機能ロジック）
   ========================================================================= */
function useBeatMaker() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [currentStep, setCurrentStep] = useState(0);
  const [scaleKey, setScaleKey] = useState('major');
  const [instrument, setInstrument] = useState('piano');
  const [delayEnabled, setDelayEnabled] = useState(false);
  const [reverbEnabled, setReverbEnabled] = useState(false);
  const [activePages, setActivePages] = useState(1);
  const [currentPage, setCurrentPage] = useState(0);
  
  const MAX_STEPS = STEPS_PER_PAGE * MAX_PAGES;
  const defaultPageNames = Array.from({length: MAX_PAGES}, (_, i) => `小節 ${i + 1}`);
  const [pageNames, setPageNames] = useState(defaultPageNames);
  const [clipboard, setClipboard] = useState(null);

  const [melodyGrid, setMelodyGrid] = useState(Array(8).fill().map(() => Array(MAX_STEPS).fill(false)));
  const [drumGrid, setDrumGrid] = useState(Array(3).fill().map(() => Array(MAX_STEPS).fill(false)));

  const [isExporting, setIsExporting] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [saveStatus, setSaveStatus] = useState('saved');

  const refs = useRef({ melody: melodyGrid, drum: drumGrid, bpm, scaleKey, instrument, activePages });
  useEffect(() => {
    refs.current = { melody: melodyGrid, drum: drumGrid, bpm, scaleKey, instrument, activePages };
  }, [melodyGrid, drumGrid, bpm, scaleKey, instrument, activePages]);

  const initialLoadRef = useRef(true);
  useEffect(() => {
    if (initialLoadRef.current) {
      const data = localStorage.getItem('kidsBeatMakerData_master');
      if (data) {
        const p = JSON.parse(data);
        setMelodyGrid(p.melodyGrid); setDrumGrid(p.drumGrid); setBpm(p.bpm || 120); setScaleKey(p.scaleKey || 'major');
        setInstrument(p.instrument || p.waveform || 'piano'); setDelayEnabled(p.delayEnabled || false); setReverbEnabled(p.reverbEnabled || false);
        setActivePages(p.activePages || 1); if (p.pageNames) setPageNames(p.pageNames);
      }
      initialLoadRef.current = false;
      return;
    }
    setSaveStatus('saving');
    const saveData = { melodyGrid, drumGrid, bpm, scaleKey, instrument, delayEnabled, reverbEnabled, activePages, pageNames };
    localStorage.setItem('kidsBeatMakerData_master', JSON.stringify(saveData));
    const timer = setTimeout(() => setSaveStatus('saved'), 500);
    return () => clearTimeout(timer);
  }, [melodyGrid, drumGrid, bpm, scaleKey, instrument, delayEnabled, reverbEnabled, activePages, pageNames]);

  const audioStateRef = useRef({ ctx: null, masterGain: null, delayNode: null, delayGain: null, convolver: null, reverbGain: null, noiseBuffer: null });
  const timerIDs = useRef({ nextNoteTime: 0, currentStep: 0, timerID: null, drawRef: null, noteQueue: [], lastStepDrawn: -1 });

  const initAudio = useCallback(() => {
    if (!audioStateRef.current.ctx) {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const masterGain = ctx.createGain(); masterGain.connect(ctx.destination);
      const convolver = ctx.createConvolver(); const length = ctx.sampleRate * 2.0; const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
      for (let i = 0; i < length; i++) { const decay = Math.exp(-i / (ctx.sampleRate * 0.5)); impulse.getChannelData(0)[i] = (Math.random() * 2 - 1) * decay; impulse.getChannelData(1)[i] = (Math.random() * 2 - 1) * decay; }
      convolver.buffer = impulse; const reverbGain = ctx.createGain(); reverbGain.gain.value = 0; convolver.connect(reverbGain); reverbGain.connect(masterGain);
      const delayNode = ctx.createDelay(1.0); delayNode.delayTime.value = 0.375; const feedback = ctx.createGain(); feedback.gain.value = 0.35; delayNode.connect(feedback); feedback.connect(delayNode);
      const delayGain = ctx.createGain(); delayGain.gain.value = 0; delayNode.connect(delayGain); delayGain.connect(masterGain);
      const bufferSize = ctx.sampleRate * 1.0; const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      for (let i = 0; i < bufferSize; i++) buffer.getChannelData(0)[i] = Math.random() * 2 - 1;
      audioStateRef.current = { ctx, masterGain, delayNode, delayGain, convolver, reverbGain, noiseBuffer: buffer };
    }
    if (audioStateRef.current.ctx.state === 'suspended') audioStateRef.current.ctx.resume();
  }, []);

  useEffect(() => { if (audioStateRef.current.delayGain) audioStateRef.current.delayGain.gain.setTargetAtTime(delayEnabled ? 0.5 : 0, audioStateRef.current.ctx.currentTime, 0.1); }, [delayEnabled]);
  useEffect(() => { if (audioStateRef.current.reverbGain) audioStateRef.current.reverbGain.gain.setTargetAtTime(reverbEnabled ? 0.6 : 0, audioStateRef.current.ctx.currentTime, 0.1); }, [reverbEnabled]);
  useEffect(() => { if (audioStateRef.current.delayNode) audioStateRef.current.delayNode.delayTime.setTargetAtTime((60 / bpm) * 0.75, audioStateRef.current.ctx.currentTime, 0.1); }, [bpm]);

  const scheduleNote = useCallback((stepNumber, time) => {
    timerIDs.current.noteQueue.push({ note: stepNumber, time: time });
    const { melody, drum, scaleKey, instrument } = refs.current;
    const currentNotes = SCALES[scaleKey].notes;
    currentNotes.forEach((note, row) => { if (melody[row][stepNumber]) playTone(audioStateRef.current, time, note.freq, instrument); });
    if (drum[0][stepNumber]) playHihat(audioStateRef.current, time);
    if (drum[1][stepNumber]) playSnare(audioStateRef.current, time);
    if (drum[2][stepNumber]) playKick(audioStateRef.current, time);
  }, []);

  const scheduler = useCallback(() => {
    if (!audioStateRef.current.ctx) return;
    const scheduleAheadTime = 0.1; 
    while (timerIDs.current.nextNoteTime < audioStateRef.current.ctx.currentTime + scheduleAheadTime) {
      scheduleNote(timerIDs.current.currentStep, timerIDs.current.nextNoteTime);
      timerIDs.current.nextNoteTime += 0.25 * (60.0 / refs.current.bpm);
      timerIDs.current.currentStep++;
      if (timerIDs.current.currentStep === refs.current.activePages * STEPS_PER_PAGE) timerIDs.current.currentStep = 0;
    }
    timerIDs.current.timerID = setTimeout(scheduler, 25.0);
  }, [scheduleNote]);

  const draw = useCallback(() => {
    let drawNote = timerIDs.current.lastStepDrawn;
    const currentTime = audioStateRef.current.ctx.currentTime;
    while (timerIDs.current.noteQueue.length && timerIDs.current.noteQueue[0].time < currentTime) {
      drawNote = timerIDs.current.noteQueue[0].note; timerIDs.current.noteQueue.splice(0, 1);
    }
    if (timerIDs.current.lastStepDrawn !== drawNote) { setCurrentStep(drawNote); timerIDs.current.lastStepDrawn = drawNote; }
    timerIDs.current.drawRef = requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    if (isPlaying) {
      if (!audioStateRef.current.ctx) initAudio();
      if (audioStateRef.current.ctx.state === 'suspended') audioStateRef.current.ctx.resume();
      timerIDs.current.currentStep = 0; timerIDs.current.nextNoteTime = audioStateRef.current.ctx.currentTime + 0.05;
      timerIDs.current.noteQueue = []; timerIDs.current.lastStepDrawn = -1;
      scheduler(); timerIDs.current.drawRef = requestAnimationFrame(draw);
    } else {
      clearTimeout(timerIDs.current.timerID); cancelAnimationFrame(timerIDs.current.drawRef);
      setCurrentStep(0); setCurrentPage(0); 
    }
    return () => { clearTimeout(timerIDs.current.timerID); cancelAnimationFrame(timerIDs.current.drawRef); };
  }, [isPlaying, scheduler, draw, initAudio]);

  useEffect(() => {
    if (isPlaying) {
      const playingPage = Math.floor(currentStep / STEPS_PER_PAGE);
      if (playingPage !== currentPage) setCurrentPage(playingPage);
    }
  }, [currentStep, isPlaying, currentPage]);

  const isDraggingRef = useRef(false); const dragValueRef = useRef(false);
  const updateGrid = useCallback((type, row, globalCol, newValue) => {
    if (type === 'melody') setMelodyGrid(prev => { const next = [...prev]; next[row] = [...next[row]]; next[row][globalCol] = newValue; return next; });
    else setDrumGrid(prev => { const next = [...prev]; next[row] = [...next[row]]; next[row][globalCol] = newValue; return next; });
  }, []);

  const handlePointerDown = useCallback((type, row, globalCol) => {
    initAudio(); isDraggingRef.current = true;
    const currentVal = type === 'melody' ? melodyGrid[row][globalCol] : drumGrid[row][globalCol];
    dragValueRef.current = !currentVal; updateGrid(type, row, globalCol, dragValueRef.current);
    if (dragValueRef.current && audioStateRef.current.ctx) {
      const t = audioStateRef.current.ctx.currentTime;
      if (type === 'melody') playTone(audioStateRef.current, t, SCALES[scaleKey].notes[row].freq, instrument);
      else if (row === 0) playHihat(audioStateRef.current, t);
      else if (row === 1) playSnare(audioStateRef.current, t);
      else if (row === 2) playKick(audioStateRef.current, t);
    }
  }, [melodyGrid, drumGrid, updateGrid, initAudio, scaleKey, instrument]);

  const handlePointerEnter = useCallback((type, row, globalCol) => { if (!isDraggingRef.current) return; updateGrid(type, row, globalCol, dragValueRef.current); }, [updateGrid]);
  useEffect(() => { const handlePointerUp = () => { isDraggingRef.current = false; }; window.addEventListener('pointerup', handlePointerUp); return () => window.removeEventListener('pointerup', handlePointerUp); }, []);

  const copyPage = useCallback(() => {
    const startCol = currentPage * STEPS_PER_PAGE; const endCol = startCol + STEPS_PER_PAGE;
    setClipboard({ melody: melodyGrid.map(row => row.slice(startCol, endCol)), drum: drumGrid.map(row => row.slice(startCol, endCol)) });
  }, [currentPage, melodyGrid, drumGrid]);

  const pastePage = useCallback(() => {
    if (!clipboard) return; initAudio(); const startCol = currentPage * STEPS_PER_PAGE;
    setMelodyGrid(prev => prev.map((row, rIdx) => { const newRow = [...row]; for (let i = 0; i < STEPS_PER_PAGE; i++) newRow[startCol + i] = clipboard.melody[rIdx][i]; return newRow; }));
    setDrumGrid(prev => prev.map((row, rIdx) => { const newRow = [...row]; for (let i = 0; i < STEPS_PER_PAGE; i++) newRow[startCol + i] = clipboard.drum[rIdx][i]; return newRow; }));
  }, [currentPage, clipboard, initAudio]);

  const requestClearAll = () => setShowClearConfirm(true);
  const cancelClearAll = () => setShowClearConfirm(false);
  const executeClearAll = () => {
    setMelodyGrid(Array(8).fill().map(() => Array(MAX_STEPS).fill(false))); setDrumGrid(Array(3).fill().map(() => Array(MAX_STEPS).fill(false)));
    setIsPlaying(false); setActivePages(1); setCurrentPage(0); setScaleKey('major'); setInstrument('piano'); setDelayEnabled(false); setReverbEnabled(false); setPageNames(defaultPageNames); setClipboard(null); setShowClearConfirm(false);
  };

  // --- AIジェネレーター連携関数 ---
  const loadFromJson = (jsonString) => {
    try {
      // ```json などのマークダウン装飾を取り除く
      const cleanJson = jsonString.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      
      // 不完全なAIの出力でもクラッシュしないように安全にパースする
      if (parsed.melodyGrid && Array.isArray(parsed.melodyGrid)) {
        setMelodyGrid(prev => {
          const newGrid = [...prev];
          for(let r=0; r<8; r++) {
            if(parsed.melodyGrid[r]) {
              for(let c=0; c<MAX_STEPS; c++) newGrid[r][c] = !!parsed.melodyGrid[r][c];
            }
          }
          return newGrid;
        });
      }
      if (parsed.drumGrid && Array.isArray(parsed.drumGrid)) {
        setDrumGrid(prev => {
          const newGrid = [...prev];
          for(let r=0; r<3; r++) {
            if(parsed.drumGrid[r]) {
              for(let c=0; c<MAX_STEPS; c++) newGrid[r][c] = !!parsed.drumGrid[r][c];
            }
          }
          return newGrid;
        });
      }
      
      if (parsed.bpm) setBpm(Math.max(60, Math.min(200, parsed.bpm)));
      if (parsed.scaleKey && SCALES[parsed.scaleKey]) setScaleKey(parsed.scaleKey);
      if (parsed.instrument && INSTRUMENTS.find(i => i.id === parsed.instrument)) setInstrument(parsed.instrument);
      if (parsed.delayEnabled !== undefined) setDelayEnabled(!!parsed.delayEnabled);
      if (parsed.reverbEnabled !== undefined) setReverbEnabled(!!parsed.reverbEnabled);
      if (parsed.activePages) setActivePages(Math.max(1, Math.min(MAX_PAGES, parsed.activePages)));
      if (parsed.pageNames && Array.isArray(parsed.pageNames)) {
        const newNames = [...defaultPageNames];
        parsed.pageNames.forEach((n, i) => { if(i < MAX_PAGES && typeof n === 'string') newNames[i] = n; });
        setPageNames(newNames);
      }
      
      setCurrentPage(0);
      setIsPlaying(false);
      return true;
    } catch (e) {
      console.error("AI JSON Parse Error:", e);
      return false;
    }
  };

  const exportToMP3 = async (loopCount) => {
    setIsExporting(true); if (isPlaying) setIsPlaying(false);
    try {
      await loadLameJS();
      const totalSteps = STEPS_PER_PAGE * activePages * loopCount; const secondsPerStep = (60.0 / bpm) * 0.25; const tailSeconds = 3.0; const totalDuration = (totalSteps * secondsPerStep) + tailSeconds; const sampleRate = 44100;
      const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext; const offlineCtx = new OfflineCtx(2, sampleRate * totalDuration, sampleRate);
      const masterGain = offlineCtx.createGain(); masterGain.connect(offlineCtx.destination); masterGain.gain.setValueAtTime(1, totalDuration - tailSeconds); masterGain.gain.linearRampToValueAtTime(0, totalDuration);
      const convolver = offlineCtx.createConvolver(); const length = offlineCtx.sampleRate * 2.0; const impulse = offlineCtx.createBuffer(2, length, offlineCtx.sampleRate);
      for (let i = 0; i < length; i++) { const decay = Math.exp(-i / (offlineCtx.sampleRate * 0.5)); impulse.getChannelData(0)[i] = (Math.random() * 2 - 1) * decay; impulse.getChannelData(1)[i] = (Math.random() * 2 - 1) * decay; }
      convolver.buffer = impulse; const reverbGain = offlineCtx.createGain(); reverbGain.gain.value = reverbEnabled ? 0.6 : 0; convolver.connect(reverbGain); reverbGain.connect(masterGain);
      const delayNode = offlineCtx.createDelay(1.0); delayNode.delayTime.value = (60 / bpm) * 0.75; const feedback = offlineCtx.createGain(); feedback.gain.value = 0.35; delayNode.connect(feedback); feedback.connect(delayNode);
      const delayGain = offlineCtx.createGain(); delayGain.gain.value = delayEnabled ? 0.5 : 0; delayNode.connect(delayGain); delayGain.connect(masterGain);
      const bufferSize = offlineCtx.sampleRate * 1.0; const noiseBuffer = offlineCtx.createBuffer(1, bufferSize, offlineCtx.sampleRate);
      for (let i = 0; i < bufferSize; i++) noiseBuffer.getChannelData(0)[i] = Math.random() * 2 - 1;
      const offlineAudioState = { ctx: offlineCtx, masterGain, delayNode, delayGain, convolver, reverbGain, noiseBuffer };

      const currentNotes = SCALES[scaleKey].notes;
      for (let i = 0; i < totalSteps; i++) {
        const time = i * secondsPerStep; const gridCol = i % (STEPS_PER_PAGE * activePages);
        currentNotes.forEach((note, row) => { if (melodyGrid[row][gridCol]) playTone(offlineAudioState, time, note.freq, instrument); });
        if (drumGrid[0][gridCol]) playHihat(offlineAudioState, time); if (drumGrid[1][gridCol]) playSnare(offlineAudioState, time); if (drumGrid[2][gridCol]) playKick(offlineAudioState, time);
      }

      const renderedBuffer = await offlineCtx.startRendering();
      const mp3Encoder = new window.lamejs.Mp3Encoder(2, sampleRate, 128);
      const left = renderedBuffer.getChannelData(0); const right = renderedBuffer.getChannelData(1);
      const sampleBlockSize = 1152; const mp3Data = [];
      const floatToInt16 = (f32Array) => {
          const i16Array = new Int16Array(f32Array.length);
          for(let i = 0; i < f32Array.length; i++) { let s = Math.max(-1, Math.min(1, f32Array[i])); i16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF; }
          return i16Array;
      };
      const leftInt = floatToInt16(left); const rightInt = floatToInt16(right);
      for (let i = 0; i < leftInt.length; i += sampleBlockSize) {
        const leftChunk = leftInt.subarray(i, i + sampleBlockSize); const rightChunk = rightInt.subarray(i, i + sampleBlockSize);
        const mp3buf = mp3Encoder.encodeBuffer(leftChunk, rightChunk); if (mp3buf.length > 0) mp3Data.push(mp3buf);
      }
      const finalBuf = mp3Encoder.flush(); if (finalBuf.length > 0) mp3Data.push(finalBuf);
      const blob = new Blob(mp3Data, { type: 'audio/mp3' }); const url = URL.createObjectURL(blob); const a = document.createElement('a');
      a.href = url; a.download = `KidsBeatMaker_Track_${new Date().getTime()}.mp3`; a.click(); URL.revokeObjectURL(url);
      setShowExportModal(false);
    } catch (error) { console.error(error); alert("MP3の書き出しに失敗しました。"); } finally { setIsExporting(false); }
  };

  return {
    isPlaying, setIsPlaying, currentStep, bpm, setBpm, scaleKey, setScaleKey, instrument, setInstrument, delayEnabled, setDelayEnabled, reverbEnabled, setReverbEnabled,
    activePages, setActivePages, currentPage, setCurrentPage, pageNames, setPageNames, copyPage, pastePage, clipboard, melodyGrid, drumGrid, saveStatus,
    handlePointerDown, handlePointerEnter, initAudio, isExporting, showExportModal, setShowExportModal, exportToMP3, showClearConfirm, requestClearAll, executeClearAll, cancelClearAll,
    showAiModal, setShowAiModal, loadFromJson
  };
}

/* =========================================================================
   4. ガイドツアー（チュートリアル）システム
   ========================================================================= */
const TUTORIAL_STEPS = [
  {
    title: <>ようこそ<R t="音楽" r="おんがく" />スタジオへ！</>,
    text: <>ここは<R t="君" r="きみ" />だけの<R t="曲" r="きょく" />を<R t="作" r="つく" />れる<R t="魔法" r="まほう" />のアプリ「音楽制作スタジオ」だよ。<br/>たった1<R t="分" r="ぷん" />で<R t="遊" r="あそ" />び<R t="方" r="かた" />を<R t="教" r="おし" />えるね！</>,
    targetId: null
  },
  {
    title: <>1. メロディを<R t="作" r="つく" />ろう</>,
    text: <><R t="上" r="うえ" />の<R t="段" r="だん" />はメロディ（<R t="旋律" r="せんりつ" />）のトラック。<br/>マスを【クリック】するか【なぞって】<R t="色" r="いろ" />を<R t="塗" r="ぬ" />ると、その<R t="場所" r="ばしょ" />でドレミの<R t="音" r="おと" />が<R t="鳴" r="な" />るよ！</>,
    targetId: 'tutorial-melody'
  },
  {
    title: <>2. リズムを<R t="重" r="かさ" />ねよう</>,
    text: <><R t="下" r="した" />の<R t="段" r="だん" />はドラムセット！<br/>「ドン・タン・チッ」の<R t="音" r="おと" />を<R t="組" r="く" />み<R t="合" r="あ" />わせて、かっこいいビートを<R t="作" r="つく" />ってみよう。</>,
    targetId: 'tutorial-drum'
  },
  {
    title: <>3. <R t="音楽" r="おんがく" />を<R t="再生" r="さいせい" />！</>,
    text: <><R t="音" r="おと" />を<R t="置" r="お" />いたら【<R t="再生" r="さいせい" />】ボタンを<R t="押" r="お" />してみて！<br/><R t="時間" r="じかん" />を<R t="示" r="しめ" />す<R t="光" r="ひかり" />が<R t="動" r="うご" />き<R t="出" r="だ" />して、<R t="君" r="きみ" />の<R t="作" r="つく" />った<R t="曲" r="きょく" />が<R t="流" r="なが" />れ<R t="出" r="だ" />すよ。</>,
    targetId: 'tutorial-play'
  },
  {
    title: <>4. <R t="魔法" r="まほう" />のサウンド<R t="設定" r="せってい" /></>,
    text: <>「<R t="音階" r="おんかい" />」や「<R t="楽器" r="がっき" />」を<R t="変" r="か" />えると、<R t="同" r="おな" />じ<R t="置" r="お" />き<R t="方" r="かた" />でも<R t="曲" r="きょく" />の<R t="雰囲気" r="ふんいき" />がガラッと<R t="変" r="か" />わるよ！<br/>『<R t="反響" r="はんきょう" />（やまびこ）』を<R t="入" r="い" />れるとプロっぽい<R t="音" r="おと" />になるよ。</>,
    targetId: 'tutorial-settings'
  },
  {
    title: <>5. <R t="曲" r="きょく" />の<R t="保存" r="ほぞん" />とダウンロード</>,
    text: <><R t="作" r="つく" />った<R t="曲" r="きょく" />は<R t="自動" r="じどう" />で<R t="保存" r="ほぞん" />されるから<R t="安心" r="あんしん" />してね。<br/>【MP3<R t="出力" r="しゅつりょく" />】を<R t="押" r="お" />せば、<R t="音声" r="おんせい" />ファイルとしてパソコンにダウンロードもできるよ！</>,
    targetId: 'tutorial-export'
  },
  {
    title: <><R t="準備完了" r="じゅんびかんりょう" />！</>,
    text: <>これで<R t="使" r="つか" />い<R t="方" r="かた" />はバッチリ！<br/>わからなくなったら、<R t="右" r="みぎ" /><R t="上" r="うえ" />の【？ボタン】を<R t="押" r="お" />してね。<br/>さあ、<R t="君" r="きみ" />だけのオリジナル<R t="曲" r="きょく" />を<R t="作" r="つく" />ろう！</>,
    targetId: null
  }
];

function useTutorial() {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const isCompleted = localStorage.getItem('kidsBeatMaker_tutorialCompleted');
    if (!isCompleted) setIsActive(true);
  }, []);

  const startTutorial = () => { setCurrentStep(0); setIsActive(true); };
  const endTutorial = () => { setIsActive(false); localStorage.setItem('kidsBeatMaker_tutorialCompleted', 'true'); };
  const nextStep = () => { if (currentStep < TUTORIAL_STEPS.length - 1) setCurrentStep(s => s + 1); else endTutorial(); };
  const prevStep = () => { if (currentStep > 0) setCurrentStep(s => s - 1); };

  return { isActive, currentStep, startTutorial, endTutorial, nextStep, prevStep };
}

const TutorialOverlay = ({ isActive, currentStep, nextStep, prevStep, endTutorial }) => {
  const [targetRect, setTargetRect] = useState(null);
  const stepData = TUTORIAL_STEPS[currentStep];

  useEffect(() => {
    if (!isActive) return;

    // ガイドツアー用のキーボード操作
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        nextStep();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevStep();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        endTutorial();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    const updateRect = () => {
      if (stepData.targetId) {
        const el = document.getElementById(stepData.targetId);
        if (el) {
          const rect = el.getBoundingClientRect();
          setTargetRect({ x: rect.left - 8, y: rect.top - 8, w: rect.width + 16, h: rect.height + 16 });
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else setTargetRect(null);
      } else setTargetRect(null);
    };
    
    updateRect();
    const timer = setTimeout(updateRect, 300);
    window.addEventListener('resize', updateRect);
    return () => { 
      clearTimeout(timer); 
      window.removeEventListener('resize', updateRect); 
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isActive, currentStep, stepData, nextStep, prevStep, endTutorial]);

  if (!isActive) return null;

  let popoverStyle = {};
  if (targetRect) {
    const isTopHalf = targetRect.y < window.innerHeight / 2;
    const popoverY = isTopHalf ? targetRect.y + targetRect.h + 16 : window.innerHeight - targetRect.y + 16;
    const targetCenter = targetRect.x + targetRect.w / 2;
    const halfWidth = 180;

    if (targetCenter < halfWidth + 16) {
      popoverStyle = isTopHalf ? { top: popoverY, left: 16 } : { bottom: popoverY, left: 16 };
    } else if (window.innerWidth - targetCenter < halfWidth + 16) {
      popoverStyle = isTopHalf ? { top: popoverY, right: 16 } : { bottom: popoverY, right: 16 };
    } else {
      popoverStyle = isTopHalf 
        ? { top: popoverY, left: targetCenter, transform: 'translateX(-50%)' } 
        : { bottom: popoverY, left: targetCenter, transform: 'translateX(-50%)' };
    }
  } else {
    popoverStyle = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  }

  return (
    <div className="fixed inset-0 z-[100]">
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <mask id="tutorial-hole">
            <rect width="100%" height="100%" fill="white" />
            <rect 
              x={targetRect ? targetRect.x : 0} 
              y={targetRect ? targetRect.y : 0} 
              width={targetRect ? targetRect.w : 0} 
              height={targetRect ? targetRect.h : 0} 
              rx="12" 
              fill="black" 
              opacity={targetRect ? 1 : 0}
            />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(15, 23, 42, 0.6)" mask="url(#tutorial-hole)" className="pointer-events-auto transition-all duration-300" />
      </svg>
      <div 
        className="absolute" 
        style={{ 
          display: targetRect ? 'block' : 'none',
          left: targetRect ? targetRect.x : 0, 
          top: targetRect ? targetRect.y : 0, 
          width: targetRect ? targetRect.w : 0, 
          height: targetRect ? targetRect.h : 0 
        }} 
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} 
      />
      <div className="absolute bg-white rounded-2xl shadow-2xl p-5 md:p-6 w-[320px] md:w-[380px] flex flex-col gap-3 transition-all duration-300 pointer-events-auto" style={popoverStyle}>
        
        {/* key属性を付与して、ステップが変わるたびに中身をクリーンに再構築させる */}
        <div key={`tut-content-${currentStep}`} className="flex flex-col gap-3">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <h3 className="text-lg font-bold text-indigo-700"><span>{stepData.title}</span></h3>
            <span className="text-sm font-bold bg-indigo-50 text-indigo-500 px-2 py-1 rounded-md">{currentStep + 1} / {TUTORIAL_STEPS.length}</span>
          </div>
          <div className="text-slate-600 font-medium whitespace-pre-line leading-relaxed text-sm md:text-base">
            <span>{stepData.text}</span>
          </div>
        </div>

        <div className="flex justify-between items-center mt-3 pt-2">
          <button onClick={endTutorial} className="text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors px-2 py-1">スキップ</button>
          <div className="flex gap-2">
            {currentStep > 0 && <button key={`tut-prev-${currentStep}`} onClick={prevStep} className="px-4 py-2 rounded-lg font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"><R t="戻" r="もど" />る</button>}
            
            {/* ボタン自体にもkeyを付与し、文字列とReact要素の切り替わりエラーを防ぐ */}
            <button key={`tut-next-${currentStep}`} onClick={nextStep} className="px-5 py-2 rounded-lg font-bold text-white bg-indigo-500 hover:bg-indigo-600 shadow-sm transition-transform active:scale-95">
              <span>{currentStep === TUTORIAL_STEPS.length - 1 ? 'はじめる！' : <><R t="次" r="つぎ" />へ</>}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* =========================================================================
   5. UIコンポーネント (見た目)
   ========================================================================= */

const RowLabel = ({ title, sub }) => (
  <div className="w-20 md:w-24 flex-shrink-0 text-right pr-3 flex flex-col justify-center select-none">
    <span className="text-sm font-bold text-slate-700">{title}</span>
    {sub && <span className="text-[10px] font-medium text-slate-400 leading-none mt-0.5">{sub}</span>}
  </div>
);

// 新規追加：AI作曲モーダル
const AiComposerModal = ({ show, onClose, onLoad }) => {
  const [jsonInput, setJsonInput] = useState('');
  const [copyStatus, setCopyStatus] = useState('copy');
  const [errorMsg, setErrorMsg] = useState('');

  if (!show) return null;

  const promptText = `あなたはプロの作曲家であり、子供向け音楽アプリのジェネレーターです。
以下の手順で対話してください。

1. 「どんなイメージの曲を作りたいですか？（例：明るい探検、宇宙の不思議など）」と聞いてください。
2. 私が答えたら、そのイメージに合わせた曲データをJSON形式で生成してください。
3. 出力は **JSONコードブロックのみ** とし、他の文章や説明は一切含めないでください。

【JSONフォーマットと制約】
{
  "bpm": 120, // 60〜200の整数
  "scaleKey": "major", // "major", "minorPenta", "ryukyu", "yonanuki" のいずれか
  "instrument": "piano", // "piano", "musicbox", "8bit", "brass", "flute", "space", "guitar" のいずれか
  "delayEnabled": false, // true または false
  "reverbEnabled": false, // true または false
  "activePages": 2, // 1〜4の整数
  "pageNames": ["Aメロ", "Bメロ", "小節 3", "小節 4"], // 要素数4の文字列配列
  "melodyGrid": [[false, false, ...], ...], // 8行×64列のtrue/false配列。1行目が高音。
  "drumGrid": [[false, false, ...], ...] // 3行×64列のtrue/false配列。1行目:ハイハット, 2:スネア, 3:キック。
}
- melodyGridとdrumGridは必ず指定サイズの二次元配列にすること。
- activePages * 16 の列数まで音符(true)を配置し、それ以降の列はfalseにすること。
- 子供が聞いて楽しく、音楽的に成立する美しいパターンを生成すること。`;

  const handleCopyPrompt = () => {
    const textarea = document.createElement('textarea');
    textarea.value = promptText;
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('copy'), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
    document.body.removeChild(textarea);
  };

  const handleLoadData = () => {
    setErrorMsg('');
    if (!jsonInput.trim()) return;
    const success = onLoad(jsonInput);
    if (success) {
      setJsonInput('');
      onClose();
    } else {
      setErrorMsg('データの読み込みに失敗しました。AIが出力したJSONコードを正しく貼り付けたか確認してね。');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        {/* ヘッダー */}
        <div className="bg-gradient-to-r from-purple-500 to-indigo-500 px-6 py-4 flex justify-between items-center flex-shrink-0">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Sparkles size={24} className="text-yellow-300"/> <span>AI一発<R t="作曲" r="さっきょく" /></span>
          </h3>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors bg-white/10 rounded-full p-1"><X size={24}/></button>
        </div>
        
        {/* コンテンツエリア（スクロール可能） */}
        <div className="p-6 overflow-y-auto flex flex-col gap-6 custom-scrollbar">
          <p className="text-slate-600 font-bold text-sm">
            AIと<R t="相談" r="そうだん" />して、イメージ通りの<R t="曲" r="きょく" />を<R t="自動" r="じどう" />で<R t="作" r="つく" />ってもらおう！
          </p>

          {/* ステップ1 */}
          <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
            <div className="flex items-center gap-3 mb-3">
              <span className="bg-purple-500 text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-sm">1</span>
              <h4 className="font-bold text-purple-800"><R t="指示" r="プロンプト" />をコピーする</h4>
            </div>
            <button 
              onClick={handleCopyPrompt}
              className={`w-full py-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2 border-b-[3px] ${copyStatus === 'copied' ? 'bg-emerald-500 border-emerald-600 text-white' : 'bg-white border-slate-200 text-purple-700 hover:bg-purple-100 hover:border-purple-300'}`}
            >
              {copyStatus === 'copied' ? <><Check size={18}/> <span>コピー<R t="完了" r="かんりょう" />！</span></> : <><Copy size={18}/> <span>AIへの<R t="指示" r="プロンプト" />をコピー</span></>}
            </button>
          </div>

          {/* ステップ2 */}
          <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
            <div className="flex items-center gap-3 mb-3">
              <span className="bg-indigo-500 text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-sm">2</span>
              <h4 className="font-bold text-indigo-800">AIのサイトで<R t="指示" r="プロンプト" />を送る</h4>
            </div>
            <p className="text-xs text-indigo-600/80 mb-3 font-bold">
              <R t="好" r="す" />きなAIを<R t="開" r="ひら" />いて、コピーした<R t="指示" r="プロンプト" />を<R t="送" r="おく" />ってみてね！
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <a href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 py-2.5 bg-white rounded-lg text-slate-700 font-bold border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm text-sm">
                ChatGPT <ExternalLink size={14} className="text-slate-400"/>
              </a>
              <a href="https://gemini.google.com/" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 py-2.5 bg-white rounded-lg text-slate-700 font-bold border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm text-sm">
                Gemini <ExternalLink size={14} className="text-slate-400"/>
              </a>
              <a href="https://claude.ai/" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 py-2.5 bg-white rounded-lg text-slate-700 font-bold border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm text-sm">
                Claude <ExternalLink size={14} className="text-slate-400"/>
              </a>
            </div>
          </div>

          {/* ステップ3 */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <div className="flex items-center gap-3 mb-3">
              <span className="bg-slate-500 text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-sm">3</span>
              <h4 className="font-bold text-slate-800">コードを<R t="貼" r="は" />り<R t="付" r="つ" />けて<R t="読" r="よ" />み<R t="込" r="こ" />む</h4>
            </div>
            <textarea 
              value={jsonInput} 
              onChange={e => setJsonInput(e.target.value)}
              placeholder="AIが作ってくれたコードを、ここにペースト（貼り付け）してね！"
              className="w-full h-32 p-3 rounded-lg border border-slate-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none resize-none font-mono text-xs text-slate-600 shadow-inner"
            />
            {errorMsg && <p className="text-rose-500 text-xs font-bold mt-2">{errorMsg}</p>}
            <button 
              onClick={handleLoadData}
              disabled={!jsonInput.trim()}
              className={`w-full mt-3 py-3.5 rounded-xl font-bold text-white transition-all active:scale-95 flex items-center justify-center gap-2 border-b-[3px] ${!jsonInput.trim() ? 'bg-slate-300 border-slate-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-500 border-purple-800 shadow-sm'}`}
            >
              <Sparkles size={20} /> <span><R t="魔法" r="まほう" />で<R t="曲" r="きょく" />を<R t="生成" r="せいせい" />！</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const ExportModal = ({ show, onClose, onExport, isExporting, bpm, activePages }) => {
  const [loops, setLoops] = useState(4);
  if (!show) return null;
  const stepsPerLoop = STEPS_PER_PAGE * activePages;
  const totalSeconds = (stepsPerLoop * (60.0 / bpm) * 0.25 * loops) + 3.0; 
  const mins = Math.floor(totalSeconds / 60); const secs = Math.floor(totalSeconds % 60);
  const timeString = `${mins > 0 ? `${mins}分` : ''}${secs.toString().padStart(2, '0')}秒`;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={!isExporting ? onClose : undefined}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden transform transition-all" onClick={e => e.stopPropagation()}>
        <div className="bg-indigo-50 px-6 py-4 flex justify-between items-center border-b border-indigo-100">
          <h3 className="text-lg font-bold text-indigo-800 flex items-center gap-2"><Download size={20}/> <R t="MP3出力" r="ダウンロード" /></h3>
          {!isExporting && <button onClick={onClose} className="text-indigo-400 hover:text-indigo-600 transition-colors"><X size={24}/></button>}
        </div>
        <div className="p-6 flex flex-col gap-6">
          <div>
            <label className="block text-sm font-bold text-slate-600 mb-2"><R t="反復回数" r="ループかいすう" /></label>
            <div className="flex items-center gap-4">
              <input type="range" min="1" max="20" value={loops} onChange={e => setLoops(Number(e.target.value))} className="flex-grow accent-indigo-500" disabled={isExporting} />
              <span className="font-bold text-xl text-indigo-600 w-12 text-right">{loops}<span className="text-sm text-slate-500 ml-1">回</span></span>
            </div>
          </div>
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex justify-between items-center">
            <span className="font-bold text-slate-500 text-sm"><R t="予想時間" r="よそうじかん" /></span>
            <span className="font-bold text-lg text-slate-800">{timeString}</span>
          </div>
          <button onClick={() => onExport(loops)} disabled={isExporting} className={`w-full py-3.5 rounded-xl font-bold text-white transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm border-b-[3px] ${isExporting ? 'bg-indigo-400 border-indigo-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 border-indigo-700'}`}>
            {isExporting ? <><Loader2 size={20} className="animate-spin" /> <span>作成中...</span></> : <><Download size={20} /> <span>MP3ファイルとして保存</span></>}
          </button>
        </div>
      </div>
    </div>
  );
};

const ClearConfirmModal = ({ show, onConfirm, onCancel }) => {
  if (!show) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden transform transition-all p-6 text-center" onClick={e => e.stopPropagation()}>
        <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4 text-rose-500"><Trash2 size={32} /></div>
        <h3 className="text-xl font-bold text-slate-800 mb-2"><R t="全消去" r="すべてけす" /></h3>
        <p className="text-slate-500 text-sm font-medium mb-6">本当に全ての音符を消去しますか？<br/>この操作は元に戻せません。</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-all active:scale-95 border-b-[3px] border-slate-300">やめる</button>
          <button onClick={onConfirm} className="flex-1 py-3 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl transition-all active:scale-95 border-b-[3px] border-rose-700">ぜんぶ消す</button>
        </div>
      </div>
    </div>
  );
};

const ShortcutsModal = ({ show, onClose }) => {
  if (!show) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden transform transition-all" onClick={(e) => e.stopPropagation()}>
        <div className="bg-indigo-50 px-6 py-4 flex justify-between items-center border-b border-indigo-100">
          <h3 className="text-lg font-bold text-indigo-800 flex items-center gap-2"><Keyboard size={20}/> <span><R t="操作一覧" r="ショートカット" /></span></h3>
          <button onClick={onClose} className="text-indigo-400 hover:text-indigo-600 transition-colors"><X size={24}/></button>
        </div>
        <div className="p-6 flex flex-col gap-3">
          <ShortcutRow label={<span><R t="再生" r="さいせい" /> / <R t="停止" r="ていし" /></span>} keys={["Space"]} />
          <ShortcutRow label={<span><R t="小節" r="しょうせつ" />をコピー</span>} keys={["C"]} />
          <ShortcutRow label={<span><R t="小節" r="しょうせつ" />を<R t="貼" r="は" />り<R t="付" r="つ" />け</span>} keys={["V"]} />
          <ShortcutRow label={<span><R t="前" r="まえ" />の<R t="小節" r="しょうせつ" /> / <R t="次" r="つぎ" />の<R t="小節" r="しょうせつ" /></span>} keys={["←", "→"]} />
          <ShortcutRow label={<span>AI<R t="作曲" r="さっきょく" />を<R t="開閉" r="かいへい" /></span>} keys={["A"]} />
          <ShortcutRow label={<span>MP3<R t="出力" r="しゅつりょく" />を<R t="開閉" r="かいへい" /></span>} keys={["M"]} />
          <ShortcutRow label={<span><R t="全消去" r="すべてけす" /></span>} keys={["Backspace", "Delete"]} />
          <ShortcutRow label={<span><R t="操作一覧" r="そうさいちらん" />の<R t="開閉" r="かいへい" /></span>} keys={["?"]} />
          <ShortcutRow label={<span><R t="画面" r="がめん" />を<R t="閉" r="と" />じる</span>} keys={["Esc"]} />
        </div>
      </div>
    </div>
  );
};

const ShortcutRow = ({ label, keys }) => (
  <div className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
    <span className="text-sm font-bold text-slate-600">{label}</span>
    <div className="flex gap-1.5">
      {keys.map((k, i) => (
        <span key={i} className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-xs font-bold text-slate-500 shadow-sm">{k}</span>
      ))}
    </div>
  </div>
);

const Header = ({ onHelpClick, onShortcutsClick }) => (
  <nav className="bg-slate-900 border-b-[3px] border-indigo-500 px-4 md:px-6 py-2.5 md:py-3 flex justify-between items-center shadow-md z-10 flex-shrink-0">
    <div className="flex items-center gap-2 md:gap-3">
      <div className="bg-indigo-500/20 p-1.5 md:p-2 rounded-lg text-indigo-400"><SlidersHorizontal size={20} strokeWidth={2.5} /></div>
      <h1 className="text-lg md:text-xl font-bold text-white tracking-wide"><span><R t="音楽制作" r="おんがくせいさく" /> <span className="text-indigo-400">スタジオ</span></span></h1>
    </div>
    <div className="flex items-center gap-2 md:gap-3">
      <button 
        onClick={onShortcutsClick}
        className="flex items-center gap-1 md:gap-1.5 px-2.5 md:px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-lg font-bold text-xs md:text-sm transition-colors border border-slate-700"
      >
        <Keyboard size={16} /> <span className="hidden sm:inline"><R t="操作一覧" r="ショートカット" /></span>
      </button>
      <button 
        onClick={onHelpClick}
        className="flex items-center gap-1 md:gap-1.5 px-2.5 md:px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-lg font-bold text-xs md:text-sm transition-colors border border-slate-700"
      >
        <HelpCircle size={16} /> <span className="hidden xs:inline"><R t="使い方" r="あそびかた" /></span><span className="xs:hidden">ヘルプ</span>
      </button>
    </div>
  </nav>
);

const Footer = () => (
  <footer className="w-full bg-slate-50 border-t border-slate-200 pt-3 pb-2 text-center text-xs text-slate-500 font-medium flex-shrink-0 z-10">
    <p>© {new Date().getFullYear()} 音楽制作スタジオ <a href="https://note.com/cute_borage86" target="_blank" rel="noopener noreferrer" className="text-slate-500 cursor-default outline-none">GIGA山</a></p>
  </footer>
);

const MainBoard = ({ onToggleShortcuts, isShortcutsOpen, isTutorialActive }) => {
  const {
    isPlaying, setIsPlaying, currentStep, bpm, setBpm, scaleKey, setScaleKey, instrument, setInstrument, delayEnabled, setDelayEnabled, reverbEnabled, setReverbEnabled,
    activePages, setActivePages, currentPage, setCurrentPage, pageNames, setPageNames, copyPage, pastePage, clipboard, melodyGrid, drumGrid, saveStatus,
    handlePointerDown, handlePointerEnter, initAudio, isExporting, showExportModal, setShowExportModal, exportToMP3, showClearConfirm, requestClearAll, executeClearAll, cancelClearAll,
    showAiModal, setShowAiModal, loadFromJson
  } = useBeatMaker();

  const currentNotes = SCALES[scaleKey].notes;
  const [editingPageIdx, setEditingPageIdx] = useState(-1);
  const [tempPageName, setTempPageName] = useState("");
  const [copySuccess, setCopySuccess] = useState(false);
  const [pasteSuccess, setPasteSuccess] = useState(false);

  const handleEditName = () => { setEditingPageIdx(currentPage); setTempPageName(pageNames[currentPage]); };
  const savePageName = (idx) => { const newNames = [...pageNames]; newNames[idx] = tempPageName.trim() || `小節 ${idx + 1}`; setPageNames(newNames); setEditingPageIdx(-1); };
  
  const handleCopy = useCallback(() => { 
    copyPage(); setCopySuccess(true); setTimeout(() => setCopySuccess(false), 1500); 
  }, [copyPage]);
  
  const handlePaste = useCallback(() => { 
    if (!clipboard) return;
    pastePage(); setPasteSuccess(true); setTimeout(() => setPasteSuccess(false), 1500); 
  }, [pastePage, clipboard]);

  // キーボードショートカットの登録
  useEffect(() => {
    const handleKeyDown = (e) => {
      // チュートリアル中や文字入力中はショートカットを無効化
      if (isTutorialActive) return;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      const isModalOpen = showAiModal || showExportModal || showClearConfirm || isShortcutsOpen;

      // Escキーで開いているモーダルを閉じる
      if (e.key === 'Escape') {
        if (showAiModal) setShowAiModal(false);
        else if (showExportModal) setShowExportModal(false);
        else if (showClearConfirm) cancelClearAll();
        else if (isShortcutsOpen) onToggleShortcuts(); 
        return;
      }

      // トグル（開閉）操作のショートカット
      if ((e.key === 'a' || e.key === 'A') && !showExportModal && !showClearConfirm && !isShortcutsOpen) {
        setShowAiModal(prev => !prev);
        return;
      }
      if ((e.key === 'm' || e.key === 'M') && !showAiModal && !showClearConfirm && !isShortcutsOpen) {
        setShowExportModal(prev => !prev);
        return;
      }
      if (e.key === '?' || e.key === '/') {
        if (!showAiModal && !showExportModal && !showClearConfirm) {
           onToggleShortcuts();
        }
        return;
      }

      // 何かのモーダルが開いている時は背後の操作を無効にする
      if (isModalOpen) return;

      // 通常時のショートカット
      switch (e.key) {
        case ' ':
          e.preventDefault();
          setIsPlaying(prev => {
            if (!prev) initAudio();
            return !prev;
          });
          break;
        case 'c':
        case 'C':
          handleCopy(); break;
        case 'v':
        case 'V':
          handlePaste(); break;
        case 'ArrowLeft':
          setCurrentPage(prev => Math.max(prev - 1, 0)); break;
        case 'ArrowRight':
          setCurrentPage(prev => Math.min(prev + 1, activePages - 1)); break;
        case 'Backspace':
        case 'Delete':
          requestClearAll(); break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [initAudio, setIsPlaying, handleCopy, handlePaste, setShowAiModal, setShowExportModal, setCurrentPage, activePages, requestClearAll, onToggleShortcuts, showAiModal, showExportModal, showClearConfirm, isShortcutsOpen, isTutorialActive, cancelClearAll]);

  return (
    <div className="flex flex-col md:flex-row h-full w-full overflow-hidden ruby-text-container bg-slate-100">
      
      {/* ＝＝＝ 左側（スマホ時は下部）：サイドパネル（設定・操作エリア）＝＝＝ */}
      {/* 💡 スマホ時（md以下）は order-2 で下側に配置し、最大高さ（max-h）を指定してスクロールさせる */}
      <div className="order-2 md:order-1 w-full md:w-64 lg:w-72 flex-shrink-0 bg-white border-t md:border-t-0 md:border-r border-slate-200 p-3 md:p-5 flex flex-col gap-4 md:gap-6 overflow-y-auto custom-scrollbar z-10 max-h-[40vh] md:max-h-full">
        
        <div id="tutorial-play" className="flex flex-col gap-2 md:gap-3">
          <button 
            onClick={() => setIsPlaying(!isPlaying)}
            className={`w-full py-2.5 md:py-3.5 rounded-xl font-bold text-white transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm border-b-[4px] ${
              isPlaying ? 'bg-rose-500 hover:bg-rose-600 border-rose-700' : 'bg-emerald-500 hover:bg-emerald-400 border-emerald-600'
            }`}
          >
            {isPlaying ? <Square size={18} className="md:w-5 md:h-5" /> : <Play size={18} fill="currentColor" className="md:w-5 md:h-5" />}
            <span className="text-base md:text-lg">{isPlaying ? <R t="停止" r="ていし" /> : <R t="再生" r="さいせい" />}</span>
          </button>

          <div className="flex flex-col gap-1 md:gap-1.5 bg-slate-50 p-2.5 md:p-3.5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-1">
              <span className="font-bold text-xs md:text-sm text-slate-600"><R t="速度" r="テンポ" /></span>
              <span className="font-bold text-base md:text-lg text-indigo-600">{bpm}</span>
            </div>
            <input type="range" min="60" max="200" value={bpm} onChange={(e) => setBpm(Number(e.target.value))} className="w-full accent-indigo-500 cursor-pointer" />
          </div>
        </div>

        <div className="hidden md:block h-px bg-slate-200 w-full rounded-full"></div>

        {/* 💡 スマホ時はサウンド設定と下部ボタンを横並び(grid)にするなど、スペースを有効活用 */}
        <div className="flex flex-col sm:flex-row md:flex-col gap-4 md:gap-4">
          <div id="tutorial-settings" className="flex flex-col gap-3 md:gap-4 flex-1">
            <h3 className="text-xs md:text-sm font-bold text-slate-400 flex items-center gap-1.5"><Settings2 size={14} className="md:w-4 md:h-4"/> サウンド設定</h3>
            
            <div className="flex flex-col gap-1 md:gap-1.5">
              <label className="text-[10px] md:text-xs font-bold text-slate-500"><R t="音階" r="スケール" /></label>
              <select value={scaleKey} onChange={e => { initAudio(); setScaleKey(e.target.value); }} className="bg-slate-50 border border-slate-200 p-2 md:p-2.5 rounded-lg text-xs md:text-sm font-bold text-slate-700 outline-none cursor-pointer focus:ring-2 focus:ring-indigo-200 shadow-sm">
                {Object.entries(SCALES).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1 md:gap-1.5">
              <label className="text-[10px] md:text-xs font-bold text-slate-500"><R t="楽器" r="がっき" /></label>
              <select value={instrument} onChange={e => { initAudio(); setInstrument(e.target.value); }} className="bg-slate-50 border border-slate-200 p-2 md:p-2.5 rounded-lg text-xs md:text-sm font-bold text-slate-700 outline-none cursor-pointer focus:ring-2 focus:ring-indigo-200 shadow-sm">
                {INSTRUMENTS.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-2 md:gap-3 bg-slate-50 p-2.5 md:p-3.5 rounded-xl border border-slate-200 shadow-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={delayEnabled} onChange={e => { initAudio(); setDelayEnabled(e.target.checked); }} className="w-3.5 h-3.5 md:w-4 md:h-4 accent-indigo-500 rounded"/>
                <span className="text-xs md:text-sm font-bold text-slate-700"><R t="反響" r="ディレイ" /></span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={reverbEnabled} onChange={e => { initAudio(); setReverbEnabled(e.target.checked); }} className="w-3.5 h-3.5 md:w-4 md:h-4 accent-indigo-500 rounded"/>
                <span className="text-xs md:text-sm font-bold text-slate-700"><R t="残響" r="リバーブ" /></span>
              </label>
            </div>
          </div>

          <div id="tutorial-export" className="flex flex-col gap-2 md:gap-3 flex-1 md:mt-auto md:pt-4 justify-end">
            <div className={`flex justify-center items-center gap-1 md:gap-1.5 text-[10px] md:text-xs font-bold px-2 py-2 md:px-3 md:py-2.5 rounded-lg md:rounded-xl transition-colors ${saveStatus === 'saved' ? 'text-emerald-600 bg-emerald-50 border border-emerald-100' : 'text-slate-400 bg-slate-50 border border-slate-100'}`}>
               {saveStatus === 'saved' ? <CheckCircle2 size={14} className="md:w-4 md:h-4"/> : <Loader2 size={14} className="animate-spin md:w-4 md:h-4"/>}
               <span><R t="自動保存済" r="じどうほぞんずみ" /></span>
            </div>

            <div className="flex flex-col gap-2">
              <button onClick={() => setShowExportModal(true)} className="w-full py-2.5 md:py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg md:rounded-xl font-bold text-sm transition-all active:scale-95 border border-indigo-200 flex items-center justify-center gap-1.5 md:gap-2">
                <Download size={16} className="md:w-[18px] md:h-[18px]"/> <span>MP3<R t="出力" r="しゅつりょく" /></span>
              </button>
              <button onClick={requestClearAll} className="w-full py-2.5 md:py-3 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg md:rounded-xl font-bold text-sm transition-all active:scale-95 border border-rose-200 flex items-center justify-center gap-1.5 md:gap-2">
                <Trash2 size={16} className="md:w-[18px] md:h-[18px]"/> <span><R t="全消去" r="すべてけす" /></span>
              </button>
              <button onClick={() => setShowAiModal(true)} className="w-full py-3 md:py-3.5 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white rounded-lg md:rounded-xl font-bold text-sm transition-all active:scale-95 border-b-[3px] border-indigo-700 flex items-center justify-center gap-1.5 md:gap-2 shadow-sm">
                <Sparkles size={18} className="text-yellow-300 md:w-[20px] md:h-[20px]"/> <span>AI<R t="作曲" r="さっきょく" /></span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ＝＝＝ 右側（スマホ時は上部）：メインエリア（シーケンサー）＝＝＝ */}
      {/* 💡 スマホ時は order-1 で上側に配置し、画面の大半を占有させる */}
      <div className="order-1 md:order-2 flex-grow flex flex-col min-w-0 p-2 md:p-5 overflow-hidden bg-slate-100">
        
        {/* ページ（小節）切り替え ＆ 操作ツールバー */}
        <div className="flex flex-col sm:flex-row gap-2 md:gap-3 sm:items-center justify-between mb-2 md:mb-4 flex-shrink-0">
          <div className="flex gap-1.5 md:gap-2 overflow-x-auto bg-white p-1 md:p-1.5 rounded-lg md:rounded-xl border border-slate-200 shadow-sm custom-scrollbar pb-1.5 md:pb-1.5">
            {Array.from({ length: activePages }).map((_, idx) => (
              <div key={idx} className="flex-shrink-0">
                {editingPageIdx === idx ? (
                  <input type="text" value={tempPageName} onChange={e => setTempPageName(e.target.value)} onBlur={() => savePageName(idx)} onKeyDown={e => e.key === 'Enter' && savePageName(idx)} autoFocus className="px-2 md:px-3 py-1 md:py-1.5 rounded-md font-bold text-xs md:text-sm text-indigo-700 w-20 md:w-24 outline-none border-2 border-indigo-400 bg-indigo-50 shadow-inner" maxLength={10} />
                ) : (
                  <button onClick={() => setCurrentPage(idx)} className={`px-2.5 md:px-4 py-1 md:py-1.5 rounded-md font-bold text-xs md:text-sm transition-all border-b-2 whitespace-nowrap min-w-[4rem] md:min-w-[5rem] ${currentPage === idx ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-inner' : 'bg-transparent border-transparent text-slate-500 hover:bg-slate-50'} ${isPlaying && Math.floor(currentStep / STEPS_PER_PAGE) === idx ? 'ring-2 ring-indigo-300' : ''}`}>
                    {pageNames[idx]}
                  </button>
                )}
              </div>
            ))}
            {activePages < MAX_PAGES && (
              <button onClick={() => { setActivePages(p => p + 1); setCurrentPage(activePages); }} className="px-2 md:px-4 py-1 md:py-1.5 rounded-md font-bold text-xs md:text-sm bg-slate-50 border-b-2 border-slate-200 text-slate-600 hover:bg-slate-100 flex items-center gap-1 whitespace-nowrap active:scale-95 flex-shrink-0 ml-1">
                <Plus size={12} className="md:w-3.5 md:h-3.5"/> <span><R t="追加" r="ついか" /></span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 md:gap-2 px-1.5 md:px-2 py-1 md:py-1.5 bg-white rounded-lg md:rounded-xl border border-slate-200 shadow-sm overflow-x-auto custom-scrollbar pb-1 md:pb-1.5">
            <span className="text-[9px] md:text-[10px] font-bold text-slate-400 mr-0.5 md:mr-1 whitespace-nowrap hidden xs:inline"><span><R t="操作" r="そうさ" />:</span></span>
            <button onClick={handleEditName} disabled={editingPageIdx !== -1} className="flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-1 md:py-1.5 rounded text-[10px] md:text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors whitespace-nowrap active:scale-95 disabled:opacity-50">
              <Edit2 size={10} className="md:w-3 md:h-3"/> <span><R t="名前" r="なまえ" /></span>
            </button>
            <div className="w-px h-3 md:h-5 bg-slate-200 mx-0.5 md:mx-1"></div>
            <button onClick={handleCopy} className="flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-1 md:py-1.5 rounded text-[10px] md:text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors whitespace-nowrap active:scale-95">
              {copySuccess ? <CheckCircle2 size={10} className="md:w-3 md:h-3 text-emerald-500" /> : <Copy size={10} className="md:w-3 md:h-3"/>} <span>{copySuccess ? 'コピー完了' : 'コピー'}</span>
            </button>
            <button onClick={handlePaste} disabled={!clipboard} className={`flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-1 md:py-1.5 rounded text-[10px] md:text-xs font-bold transition-colors whitespace-nowrap active:scale-95 ${clipboard ? 'text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100' : 'text-slate-400 bg-slate-100 border border-slate-200 opacity-60 cursor-not-allowed'}`}>
              {pasteSuccess ? <CheckCircle2 size={10} className="md:w-3 md:h-3 text-emerald-500" /> : <ClipboardPaste size={10} className="md:w-3 md:h-3"/>} <span>{pasteSuccess ? '貼り付け完了' : <R t="貼付" r="はりつけ" />}</span>
            </button>
          </div>
        </div>

        <div className="flex-grow bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden flex flex-col relative">
          
          <div className="bg-slate-50 border-b border-slate-200 px-2 md:px-4 py-2 md:py-3 flex gap-2 md:gap-6 flex-shrink-0 z-10 shadow-sm relative text-xs md:text-sm">
            <div className="flex items-center gap-1.5 md:gap-2 font-bold text-indigo-600 w-1/2">
              <Music size={14} className="md:w-[18px] md:h-[18px]"/> <span><R t="旋律" r="メロディ" /> <span className="hidden xs:inline">トラック</span></span>
            </div>
            <div className="flex items-center gap-1.5 md:gap-2 font-bold text-teal-600 w-1/2 justify-end md:justify-start">
              <Disc size={14} className="md:w-[18px] md:h-[18px]"/> <span><R t="律動" r="リズム" /> <span className="hidden xs:inline">トラック</span></span>
            </div>
          </div>

          <div className="flex-grow overflow-auto custom-scrollbar p-2 md:p-4 pb-8 md:pb-12">
            <div className="flex flex-col gap-4 md:gap-6 min-w-max">
              
              <div id="tutorial-melody" className="flex flex-col gap-1 md:gap-1.5 p-1 rounded-xl">
                {currentNotes.map((note, row) => (
                  <div key={`m-${row}`} className="flex gap-1 md:gap-1.5 items-center">
                    {/* スマホ時はラベル幅を縮小 */}
                    <div className="w-14 md:w-24 flex-shrink-0 text-right pr-1.5 md:pr-3 flex flex-col justify-center select-none">
                      <span className="text-[10px] md:text-sm font-bold text-slate-700 leading-tight">{note.name}</span>
                      {note.sub && <span className="text-[8px] md:text-[10px] font-medium text-slate-400 leading-none mt-0.5">{note.sub}</span>}
                    </div>
                    {Array.from({ length: STEPS_PER_PAGE }).map((_, col) => {
                      const globalCol = currentPage * STEPS_PER_PAGE + col;
                      const isActive = melodyGrid[row][globalCol];
                      return (
                        <button
                          key={col}
                          onPointerDown={(e) => { e.target.releasePointerCapture(e.pointerId); handlePointerDown('melody', row, globalCol); }}
                          onPointerEnter={() => handlePointerEnter('melody', row, globalCol)}
                          // 💡 スマホ時はマス目を小さく（w-7 h-7 ~ w-8 h-8）、PC時は大きく（md:w-12 md:h-12）
                          className={`touch-none w-[28px] h-[28px] sm:w-10 sm:h-10 md:w-12 md:h-12 rounded md:rounded-md transition-all border-b-[2px] md:border-b-[3px] flex-shrink-0 ${
                             isActive ? 'bg-indigo-500 border-indigo-700 shadow-inner' : 'bg-slate-100 border-slate-200 hover:bg-slate-200'
                          } ${currentStep === globalCol && isPlaying ? 'ring-2 ring-indigo-400/60 scale-105 z-10 relative' : ''}`}
                        />
                      )
                    })}
                  </div>
                ))}
              </div>

              <div className="h-px bg-slate-200 w-full ml-14 md:ml-24 my-0 md:my-1"></div>

              <div id="tutorial-drum" className="flex flex-col gap-1 md:gap-1.5 p-1 rounded-xl">
                {DRUM_INSTRUMENTS.map((drum, row) => (
                  <div key={`d-${row}`} className="flex gap-1 md:gap-1.5 items-center">
                    <div className="w-14 md:w-24 flex-shrink-0 text-right pr-1.5 md:pr-3 flex flex-col justify-center select-none">
                      <span className="text-[10px] md:text-sm font-bold text-slate-700 leading-tight">{drum.name}</span>
                      {drum.sub && <span className="text-[8px] md:text-[10px] font-medium text-slate-400 leading-none mt-0.5">{drum.sub}</span>}
                    </div>
                    {Array.from({ length: STEPS_PER_PAGE }).map((_, col) => {
                      const globalCol = currentPage * STEPS_PER_PAGE + col;
                      const isActive = drumGrid[row][globalCol];
                      return (
                        <button
                          key={col}
                          onPointerDown={(e) => { e.target.releasePointerCapture(e.pointerId); handlePointerDown('drum', row, globalCol); }}
                          onPointerEnter={() => handlePointerEnter('drum', row, globalCol)}
                          className={`touch-none w-[28px] h-[28px] sm:w-10 sm:h-10 md:w-12 md:h-12 rounded md:rounded-md transition-all border-b-[2px] md:border-b-[3px] flex-shrink-0 ${
                             isActive ? 'bg-teal-500 border-teal-700 shadow-inner' : 'bg-slate-100 border-slate-200 hover:bg-slate-200'
                          } ${currentStep === globalCol && isPlaying ? 'ring-2 ring-teal-400/60 scale-105 z-10 relative' : ''}`}
                        />
                      )
                    })}
                  </div>
                ))}
              </div>

            </div>
          </div>
        </div>
      </div>

      <ExportModal show={showExportModal} onClose={() => setShowExportModal(false)} onExport={exportToMP3} isExporting={isExporting} bpm={bpm} activePages={activePages}/>
      <ClearConfirmModal show={showClearConfirm} onConfirm={executeClearAll} onCancel={cancelClearAll}/>
      <AiComposerModal show={showAiModal} onClose={() => setShowAiModal(false)} onLoad={loadFromJson} />
    </div>
  );
};

export default function App() {
  const tutorial = useTutorial();
  const [showShortcuts, setShowShortcuts] = useState(false);

  return (
    <div className="h-screen flex flex-col bg-slate-100 overflow-hidden" translate="no">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap');
        body { font-family: 'Noto Sans JP', sans-serif; overflow: hidden; }
        .ruby-text-container { line-height: 2.2; }
        ruby { ruby-align: center; }
        rt { font-size: 0.65em; color: #94a3b8; font-weight: 500; user-select: none; transform: translateY(-2px); }
        .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>
      <Header onHelpClick={tutorial.startTutorial} onShortcutsClick={() => setShowShortcuts(true)} />
      <main className="flex-grow flex overflow-hidden">
        <MainBoard 
          onToggleShortcuts={() => setShowShortcuts(prev => !prev)} 
          isShortcutsOpen={showShortcuts}
          isTutorialActive={tutorial.isActive}
        />
      </main>
      <Footer />
      <TutorialOverlay {...tutorial} />
      <ShortcutsModal show={showShortcuts} onClose={() => setShowShortcuts(false)} />
    </div>
  );
}
