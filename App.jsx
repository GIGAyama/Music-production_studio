import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Square, Music, Disc, Trash2, Plus, SlidersHorizontal, Download, CheckCircle2, Loader2, X, Edit2, Copy, ClipboardPaste, Settings2, HelpCircle, Keyboard } from 'lucide-react';

/* =========================================================================
   1. デザインシステム＆ヘルパー（ルビ付きテキスト）
   ========================================================================= */
const R = ({ t, r }) => (
  <ruby className="tracking-widest">
    {t}<rt>{r}</rt>
  </ruby>
);

const SCALES = {
  major: { name: <R t="長調" r="ちょうちょう" />, notes: [ { name: '高C', sub: '高いド', freq: 523.25 }, { name: 'B', sub: 'シ', freq: 493.88 }, { name: 'A', sub: 'ラ', freq: 440.00 }, { name: 'G', sub: 'ソ', freq: 392.00 }, { name: 'F', sub: 'ファ', freq: 349.23 }, { name: 'E', sub: 'ミ', freq: 329.63 }, { name: 'D', sub: 'レ', freq: 293.66 }, { name: 'C', sub: 'ド', freq: 261.63 } ] },
  minorPenta: { name: <R t="短調" r="たんちょう" />, notes: [ { name: '高C', sub: '高ド', freq: 523.25 }, { name: 'Bb', sub: 'シ♭', freq: 466.16 }, { name: 'G', sub: 'ソ', freq: 392.00 }, { name: 'F', sub: 'ファ', freq: 349.23 }, { name: 'Eb', sub: 'ミ♭', freq: 311.13 }, { name: 'C', sub: 'ド', freq: 261.63 }, { name: '低Bb', sub: '低シ♭', freq: 233.08 }, { name: '低G', sub: '低ソ', freq: 196.00 } ] },
  ryukyu: { name: <R t="琉球" r="りゅうきゅう" />, notes: [ { name: '高C', sub: '高ド', freq: 523.25 }, { name: 'B', sub: 'シ', freq: 493.88 }, { name: 'G', sub: 'ソ', freq: 392.00 }, { name: 'F', sub: 'ファ', freq: 349.23 }, { name: 'E', sub: 'ミ', freq: 329.63 }, { name: 'C', sub: 'ド', freq: 261.63 }, { name: '低B', sub: '低シ', freq: 246.94 }, { name: '低G', sub: '低ソ', freq: 196.00 } ] },
  yonanuki: { name: <R t="祭囃子" r="まつりばやし" />, notes: [ { name: '高C', sub: '高ド', freq: 523.25 }, { name: 'A', sub: 'ラ', freq: 440.00 }, { name: 'G', sub: 'ソ', freq: 392.00 }, { name: 'E', sub: 'ミ', freq: 329.63 }, { name: 'D', sub: 'レ', freq: 293.66 }, { name: 'C', sub: 'ド', freq: 261.63 }, { name: '低A', sub: '低ラ', freq: 220.00 }, { name: '低G', sub: '低ソ', freq: 196.00 } ] }
};

const INSTRUMENTS = [
  { id: 'piano', name: <R t="ピアノ" r="ぴあの" /> }, { id: 'musicbox', name: <R t="オルゴール" r="おるごーる" /> }, { id: '8bit', name: <R t="ゲーム" r="げーむ" /> }, { id: 'brass', name: <R t="金管" r="きんかん" /> }, { id: 'flute', name: <R t="笛" r="ふえ" /> }, { id: 'space', name: <R t="宇宙" r="うちゅう" /> }, { id: 'guitar', name: <R t="ギター" r="ぎたー" /> }
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
  const k = amount;
  const n_samples = 44100;
  const curve = new Float32Array(n_samples);
  const deg = Math.PI / 180;
  for (let i = 0; i < n_samples; ++i) {
    const x = i * 2 / n_samples - 1;
    curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
  }
  return curve;
};
const guitarDistortionCurve = makeDistortionCurve(50);

const playTone = (audioState, time, freq, instrumentId) => {
  if (!audioState.ctx) return;
  const ctx = audioState.ctx;
  const outGain = ctx.createGain();
  outGain.connect(audioState.masterGain);
  outGain.connect(audioState.delayNode);
  outGain.connect(audioState.convolver);

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
    handlePointerDown, handlePointerEnter, initAudio, isExporting, showExportModal, setShowExportModal, exportToMP3, showClearConfirm, requestClearAll, executeClearAll, cancelClearAll
  };
}

/* =========================================================================
   4. ガイドツアー（チュートリアル）システム
   ========================================================================= */
const TUTORIAL_STEPS = [
  {
    title: <>ようこそ<R t="音楽" r="おんがく" />スタジオへ！</>,
    text: <>ここは<R t="君" r="きみ" />だけの<R t="曲" r="きょく" />を<R t="作" r="つく" />れる<R t="魔法" r="まほう" />のアプリ「キッズ・ビートメーカー」だよ。<br/>たった1<R t="分" r="ぷん" />で<R t="遊" r="あそ" />び<R t="方" r="かた" />を<R t="教" r="おし" />えるね！</>,
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
    return () => { clearTimeout(timer); window.removeEventListener('resize', updateRect); };
  }, [isActive, currentStep, stepData]);

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
            {targetRect && <rect x={targetRect.x} y={targetRect.y} width={targetRect.w} height={targetRect.h} rx="12" fill="black" />}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(15, 23, 42, 0.6)" mask="url(#tutorial-hole)" className="pointer-events-auto transition-all duration-300" />
      </svg>
      {targetRect && (
        <div className="absolute" style={{ left: targetRect.x, top: targetRect.y, width: targetRect.w, height: targetRect.h }} onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} />
      )}
      <div className="absolute bg-white rounded-2xl shadow-2xl p-5 md:p-6 w-[320px] md:w-[380px] flex flex-col gap-3 transition-all duration-300 pointer-events-auto" style={popoverStyle}>
        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
          <h3 className="text-lg font-bold text-indigo-700">{stepData.title}</h3>
          <span className="text-sm font-bold bg-indigo-50 text-indigo-500 px-2 py-1 rounded-md">{currentStep + 1} / {TUTORIAL_STEPS.length}</span>
        </div>
        <p className="text-slate-600 font-medium whitespace-pre-line leading-relaxed text-sm md:text-base">
          {stepData.text}
        </p>
        <div className="flex justify-between items-center mt-3 pt-2">
          <button onClick={endTutorial} className="text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors px-2 py-1">スキップ</button>
          <div className="flex gap-2">
            {currentStep > 0 && <button onClick={prevStep} className="px-4 py-2 rounded-lg font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"><R t="戻" r="もど" />る</button>}
            <button onClick={nextStep} className="px-5 py-2 rounded-lg font-bold text-white bg-indigo-500 hover:bg-indigo-600 shadow-sm transition-transform active:scale-95">{currentStep === TUTORIAL_STEPS.length - 1 ? 'はじめる！' : <><R t="次" r="つぎ" />へ</>}</button>
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

const ExportModal = ({ show, onClose, onExport, isExporting, bpm, activePages }) => {
  const [loops, setLoops] = useState(4);
  if (!show) return null;
  const stepsPerLoop = STEPS_PER_PAGE * activePages;
  const totalSeconds = (stepsPerLoop * (60.0 / bpm) * 0.25 * loops) + 3.0; 
  const mins = Math.floor(totalSeconds / 60); const secs = Math.floor(totalSeconds % 60);
  const timeString = `${mins > 0 ? `${mins}分` : ''}${secs.toString().padStart(2, '0')}秒`;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden transform transition-all">
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
            {isExporting ? <><Loader2 size={20} className="animate-spin" /> 作成中...</> : <><Download size={20} /> MP3ファイルとして保存</>}
          </button>
        </div>
      </div>
    </div>
  );
};

const ClearConfirmModal = ({ show, onConfirm, onCancel }) => {
  if (!show) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden transform transition-all p-6 text-center">
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
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden transform transition-all">
        <div className="bg-indigo-50 px-6 py-4 flex justify-between items-center border-b border-indigo-100">
          <h3 className="text-lg font-bold text-indigo-800 flex items-center gap-2"><Keyboard size={20}/> <R t="操作一覧" r="ショートカット" /></h3>
          <button onClick={onClose} className="text-indigo-400 hover:text-indigo-600 transition-colors"><X size={24}/></button>
        </div>
        <div className="p-6 flex flex-col gap-3">
          <ShortcutRow label={<R t="再生 / 停止" r="さいせい / ていし" />} keys={["Space"]} />
          <ShortcutRow label={<R t="小節をコピー" r="しょうせつをコピー" />} keys={["C"]} />
          <ShortcutRow label={<R t="小節を貼り付け" r="しょうせつをはりつけ" />} keys={["V"]} />
          <ShortcutRow label={<R t="前の小節 / 次の小節" r="まえ / つぎ" />} keys={["←", "→"]} />
          <ShortcutRow label={<R t="MP3出力" r="ダウンロード" />} keys={["M"]} />
          <ShortcutRow label={<R t="全消去" r="すべてけす" />} keys={["Backspace", "Delete"]} />
          <ShortcutRow label={<R t="操作一覧を開く" r="ショートカット" />} keys={["?"]} />
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
  <nav className="bg-slate-900 border-b-[3px] border-indigo-500 px-6 py-3 flex justify-between items-center shadow-md z-10 flex-shrink-0">
    <div className="flex items-center gap-3">
      <div className="bg-indigo-500/20 p-2 rounded-lg text-indigo-400"><SlidersHorizontal size={22} strokeWidth={2.5} /></div>
      <h1 className="text-xl font-bold text-white tracking-wide"><R t="音楽制作" r="おんがくせいさく" /> <span className="text-indigo-400">スタジオ</span></h1>
    </div>
    <div className="flex items-center gap-3">
      <button 
        onClick={onShortcutsClick}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-lg font-bold text-sm transition-colors border border-slate-700"
      >
        <Keyboard size={16} /> <span className="hidden sm:inline"><R t="操作一覧" r="ショートカット" /></span>
      </button>
      <button 
        onClick={onHelpClick}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-lg font-bold text-sm transition-colors border border-slate-700"
      >
        <HelpCircle size={16} /> <R t="使い方" r="あそびかた" />
      </button>
    </div>
  </nav>
);

const Footer = () => (
  <footer className="w-full bg-slate-50 border-t border-slate-200 pt-3 pb-2 text-center text-xs text-slate-500 font-medium flex-shrink-0 z-10">
    <p>© {new Date().getFullYear()} 音楽制作スタジオ <a href="https://note.com/cute_borage86" target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:underline">GIGA山</a></p>
  </footer>
);

const MainBoard = ({ onOpenShortcuts }) => {
  const {
    isPlaying, setIsPlaying, currentStep, bpm, setBpm, scaleKey, setScaleKey, instrument, setInstrument, delayEnabled, setDelayEnabled, reverbEnabled, setReverbEnabled,
    activePages, setActivePages, currentPage, setCurrentPage, pageNames, setPageNames, copyPage, pastePage, clipboard, melodyGrid, drumGrid, saveStatus,
    handlePointerDown, handlePointerEnter, initAudio, isExporting, showExportModal, setShowExportModal, exportToMP3, showClearConfirm, requestClearAll, executeClearAll, cancelClearAll
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
      // フォーム入力中はショートカットを無効化
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

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
          handleCopy();
          break;
        case 'v':
        case 'V':
          handlePaste();
          break;
        case 'm':
        case 'M':
          setShowExportModal(true);
          break;
        case 'ArrowLeft':
          setCurrentPage(prev => Math.max(prev - 1, 0));
          break;
        case 'ArrowRight':
          setCurrentPage(prev => Math.min(prev + 1, activePages - 1));
          break;
        case 'Backspace':
        case 'Delete':
          requestClearAll();
          break;
        case '?':
        case '/':
          onOpenShortcuts();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [initAudio, setIsPlaying, handleCopy, handlePaste, setShowExportModal, setCurrentPage, activePages, requestClearAll, onOpenShortcuts]);

  return (
    <div className="flex flex-col md:flex-row h-full w-full overflow-hidden ruby-text-container bg-slate-100">
      
      {/* ＝＝＝ 左側：サイドパネル（設定・操作エリア）＝＝＝ */}
      <div className="w-full md:w-64 lg:w-72 flex-shrink-0 bg-white border-r border-slate-200 p-4 md:p-5 flex flex-col gap-6 overflow-y-auto custom-scrollbar z-10">
        
        <div id="tutorial-play" className="flex flex-col gap-3">
          <button 
            onClick={() => setIsPlaying(!isPlaying)}
            className={`w-full py-3.5 rounded-xl font-bold text-white transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm border-b-[4px] ${
              isPlaying ? 'bg-rose-500 hover:bg-rose-600 border-rose-700' : 'bg-emerald-500 hover:bg-emerald-400 border-emerald-600'
            }`}
          >
            {isPlaying ? <Square size={20} /> : <Play size={20} fill="currentColor" />}
            <span className="text-lg">{isPlaying ? <R t="停止" r="ていし" /> : <R t="再生" r="さいせい" />}</span>
          </button>

          <div className="flex flex-col gap-1.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-1">
              <span className="font-bold text-sm text-slate-600"><R t="速度" r="テンポ" /></span>
              <span className="font-bold text-lg text-indigo-600">{bpm}</span>
            </div>
            <input type="range" min="60" max="200" value={bpm} onChange={(e) => setBpm(Number(e.target.value))} className="w-full accent-indigo-500 cursor-pointer" />
          </div>
        </div>

        <div className="h-px bg-slate-200 w-full rounded-full"></div>

        <div id="tutorial-settings" className="flex flex-col gap-4">
          <h3 className="text-sm font-bold text-slate-400 flex items-center gap-1.5"><Settings2 size={16}/> サウンド設定</h3>
          
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-500"><R t="音階" r="スケール" /></label>
            <select value={scaleKey} onChange={e => { initAudio(); setScaleKey(e.target.value); }} className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-sm font-bold text-slate-700 outline-none cursor-pointer focus:ring-2 focus:ring-indigo-200 shadow-sm">
              {Object.entries(SCALES).map(([k, v]) => <option key={k} value={k}>{v.name.props.t}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-500"><R t="楽器" r="がっき" /></label>
            <select value={instrument} onChange={e => { initAudio(); setInstrument(e.target.value); }} className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-sm font-bold text-slate-700 outline-none cursor-pointer focus:ring-2 focus:ring-indigo-200 shadow-sm">
              {INSTRUMENTS.map(i => <option key={i.id} value={i.id}>{i.name.props.t}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 shadow-sm">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={delayEnabled} onChange={e => { initAudio(); setDelayEnabled(e.target.checked); }} className="w-4 h-4 accent-indigo-500 rounded"/>
              <span className="text-sm font-bold text-slate-700"><R t="反響" r="ディレイ" /></span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={reverbEnabled} onChange={e => { initAudio(); setReverbEnabled(e.target.checked); }} className="w-4 h-4 accent-indigo-500 rounded"/>
              <span className="text-sm font-bold text-slate-700"><R t="残響" r="リバーブ" /></span>
            </label>
          </div>
        </div>

        <div id="tutorial-export" className="mt-auto flex flex-col gap-3 pt-4">
          <div className={`flex justify-center items-center gap-1.5 text-xs font-bold px-3 py-2.5 rounded-xl transition-colors ${saveStatus === 'saved' ? 'text-emerald-600 bg-emerald-50 border border-emerald-100' : 'text-slate-400 bg-slate-50 border border-slate-100'}`}>
             {saveStatus === 'saved' ? <CheckCircle2 size={16}/> : <Loader2 size={16} className="animate-spin"/>}
             <R t="自動保存済" r="じどうほぞんずみ" />
          </div>
          
          <button onClick={() => setShowExportModal(true)} className="w-full py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-bold transition-all active:scale-95 border border-indigo-200 flex items-center justify-center gap-2">
            <Download size={18}/> <R t="MP3出力" r="ダウンロード" />
          </button>

          <button onClick={requestClearAll} className="w-full py-3 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl font-bold transition-all active:scale-95 border border-rose-200 flex items-center justify-center gap-2">
            <Trash2 size={18}/> <R t="全消去" r="すべてけす" />
          </button>
        </div>
      </div>

      {/* ＝＝＝ 右側：メインエリア（シーケンサー）＝＝＝ */}
      <div className="flex-grow flex flex-col min-w-0 p-3 md:p-5 overflow-hidden">
        
        <div className="flex flex-col xl:flex-row gap-3 xl:items-center justify-between mb-4 flex-shrink-0">
          <div className="flex gap-2 overflow-x-auto bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm custom-scrollbar">
            {Array.from({ length: activePages }).map((_, idx) => (
              <div key={idx} className="flex-shrink-0">
                {editingPageIdx === idx ? (
                  <input type="text" value={tempPageName} onChange={e => setTempPageName(e.target.value)} onBlur={() => savePageName(idx)} onKeyDown={e => e.key === 'Enter' && savePageName(idx)} autoFocus className="px-3 py-1.5 rounded-md font-bold text-sm text-indigo-700 w-24 outline-none border-2 border-indigo-400 bg-indigo-50 shadow-inner" maxLength={10} />
                ) : (
                  <button onClick={() => setCurrentPage(idx)} className={`px-4 py-1.5 rounded-md font-bold transition-all border-b-2 whitespace-nowrap min-w-[5rem] ${currentPage === idx ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-inner' : 'bg-transparent border-transparent text-slate-500 hover:bg-slate-50'} ${isPlaying && Math.floor(currentStep / STEPS_PER_PAGE) === idx ? 'ring-2 ring-indigo-300' : ''}`}>
                    {pageNames[idx]}
                  </button>
                )}
              </div>
            ))}
            {activePages < MAX_PAGES && (
              <button onClick={() => { setActivePages(p => p + 1); setCurrentPage(activePages); }} className="px-4 py-1.5 rounded-md font-bold bg-slate-50 border-b-2 border-slate-200 text-slate-600 hover:bg-slate-100 flex items-center gap-1 whitespace-nowrap active:scale-95 flex-shrink-0 ml-1">
                <Plus size={14}/> <R t="追加" r="ついか" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 px-2 py-1.5 bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto custom-scrollbar pb-1.5">
            <span className="text-[10px] font-bold text-slate-400 mr-1 whitespace-nowrap"><R t="操作" r="そうさ" />:</span>
            <button onClick={handleEditName} disabled={editingPageIdx !== -1} className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors whitespace-nowrap active:scale-95 disabled:opacity-50">
              <Edit2 size={12}/> <R t="名前変更" r="なまえ" />
            </button>
            <div className="w-px h-5 bg-slate-200 mx-1"></div>
            <button onClick={handleCopy} className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors whitespace-nowrap active:scale-95">
              {copySuccess ? <CheckCircle2 size={12} className="text-emerald-500" /> : <Copy size={12}/>} {copySuccess ? 'コピー完了' : <R t="コピー" r="コピー" />}
            </button>
            <button onClick={handlePaste} disabled={!clipboard} className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-colors whitespace-nowrap active:scale-95 ${clipboard ? 'text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100' : 'text-slate-400 bg-slate-100 border border-slate-200 opacity-60 cursor-not-allowed'}`}>
              {pasteSuccess ? <CheckCircle2 size={12} className="text-emerald-500" /> : <ClipboardPaste size={12}/>} {pasteSuccess ? '貼り付け完了' : <R t="貼り付け" r="はりつけ" />}
            </button>
          </div>
        </div>

        <div className="flex-grow bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden flex flex-col relative">
          
          <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex gap-6 flex-shrink-0 z-10 shadow-sm relative">
            <div className="flex items-center gap-2 font-bold text-indigo-600 w-1/2">
              <Music size={18}/> <R t="旋律" r="メロディ" /> トラック
            </div>
            <div className="flex items-center gap-2 font-bold text-teal-600 w-1/2 justify-end md:justify-start">
              <Disc size={18}/> <R t="律動" r="リズム" /> トラック
            </div>
          </div>

          <div className="flex-grow overflow-auto custom-scrollbar p-4 pb-12">
            <div className="flex flex-col gap-6 min-w-max">
              
              <div id="tutorial-melody" className="flex flex-col gap-1.5 p-1 rounded-xl">
                {currentNotes.map((note, row) => (
                  <div key={`m-${row}`} className="flex gap-1.5 items-center">
                    <RowLabel title={note.name} sub={note.sub} />
                    {Array.from({ length: STEPS_PER_PAGE }).map((_, col) => {
                      const globalCol = currentPage * STEPS_PER_PAGE + col;
                      const isActive = melodyGrid[row][globalCol];
                      return (
                        <button
                          key={col}
                          onPointerDown={(e) => { e.target.releasePointerCapture(e.pointerId); handlePointerDown('melody', row, globalCol); }}
                          onPointerEnter={() => handlePointerEnter('melody', row, globalCol)}
                          className={`touch-none w-10 h-10 md:w-12 md:h-12 rounded-md transition-all border-b-[3px] ${
                             isActive ? 'bg-indigo-500 border-indigo-700 shadow-inner' : 'bg-slate-100 border-slate-200 hover:bg-slate-200'
                          } ${currentStep === globalCol && isPlaying ? 'ring-2 ring-indigo-400/60 scale-105 z-10 relative' : ''}`}
                        />
                      )
                    })}
                  </div>
                ))}
              </div>

              <div className="h-px bg-slate-200 w-full ml-20 md:ml-24 my-1"></div>

              <div id="tutorial-drum" className="flex flex-col gap-1.5 p-1 rounded-xl">
                {DRUM_INSTRUMENTS.map((drum, row) => (
                  <div key={`d-${row}`} className="flex gap-1.5 items-center">
                    <RowLabel title={drum.name} sub={drum.sub} />
                    {Array.from({ length: STEPS_PER_PAGE }).map((_, col) => {
                      const globalCol = currentPage * STEPS_PER_PAGE + col;
                      const isActive = drumGrid[row][globalCol];
                      return (
                        <button
                          key={col}
                          onPointerDown={(e) => { e.target.releasePointerCapture(e.pointerId); handlePointerDown('drum', row, globalCol); }}
                          onPointerEnter={() => handlePointerEnter('drum', row, globalCol)}
                          className={`touch-none w-10 h-10 md:w-12 md:h-12 rounded-md transition-all border-b-[3px] ${
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
    </div>
  );
};

export default function App() {
  const tutorial = useTutorial();
  const [showShortcuts, setShowShortcuts] = useState(false);

  return (
    <div className="h-screen flex flex-col bg-slate-100 overflow-hidden">
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
        <MainBoard onOpenShortcuts={() => setShowShortcuts(true)} />
      </main>
      <Footer />
      <TutorialOverlay {...tutorial} />
      <ShortcutsModal show={showShortcuts} onClose={() => setShowShortcuts(false)} />
    </div>
  );
}
