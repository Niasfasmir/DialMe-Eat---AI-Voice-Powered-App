
import { useState, useCallback, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type } from '@google/genai';

function decode(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function encode(bytes: Uint8Array) {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export function useAudioSession() {
  const [isActive, setIsActive] = useState(false);
  const [transcription, setTranscription] = useState<string[]>([]);
  
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const audioContextsRef = useRef<{ input: AudioContext; output: AudioContext } | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const micStreamRef = useRef<MediaStream | null>(null);
  const currentTurnTranscriptionRef = useRef({ user: '', model: '' });

  const stopSession = useCallback(() => {
    if (sessionPromiseRef.current) {
      sessionPromiseRef.current.then((session) => session.close()).catch(() => {});
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
    }
    sourcesRef.current.forEach(source => { try { source.stop(); } catch(e) {} });
    sourcesRef.current.clear();
    setIsActive(false);
    sessionPromiseRef.current = null;
    currentTurnTranscriptionRef.current = { user: '', model: '' };
  }, []);

  const startSession = useCallback(async (config: {
    systemInstruction: string;
    tools?: { functionDeclarations: FunctionDeclaration[] }[];
    onFunctionCall?: (name: string, args: any) => Promise<any>;
  }) => {
    try {
      const currentApiKey = process.env.API_KEY;
      if (!currentApiKey) return;

      const ai = new GoogleGenAI({ apiKey: currentApiKey });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextsRef.current = { input: inputCtx, output: outputCtx };

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: config.systemInstruction,
          tools: config.tools,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } },
          },
        },
        callbacks: {
          onopen: () => {
            setIsActive(true);
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                int16[i] = inputData[i] * 32768;
              }
              const pcmBlob = {
                data: encode(new Uint8Array(int16.buffer)),
                mimeType: 'audio/pcm;rate=16000',
              };
              sessionPromise.then(s => s.sendRealtimeInput({ media: pcmBlob })).catch(() => {});
            };

            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle Interruption
            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              currentTurnTranscriptionRef.current.model = '';
              return;
            }

            // Audio Playback
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              const ctx = audioContextsRef.current!.output;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              try {
                const buffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
                const source = ctx.createBufferSource();
                source.buffer = buffer;
                source.connect(ctx.destination);
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += buffer.duration;
                sourcesRef.current.add(source);
                source.onended = () => sourcesRef.current.delete(source);
              } catch (e) { console.error(e); }
            }

            // Transcription handling to prevent duplicates
            if (message.serverContent?.inputTranscription) {
              const text = message.serverContent.inputTranscription.text;
              currentTurnTranscriptionRef.current.user += text;
              setTranscription(prev => [...prev.filter(t => !t.startsWith('[User]')), `[User]: ${currentTurnTranscriptionRef.current.user}`]);
            }
            if (message.serverContent?.outputTranscription) {
              const text = message.serverContent.outputTranscription.text;
              currentTurnTranscriptionRef.current.model += text;
              setTranscription(prev => [...prev.filter(t => !t.startsWith('[DialMe]')), `[DialMe]: ${currentTurnTranscriptionRef.current.model}`]);
            }

            if (message.serverContent?.turnComplete) {
              const finalUser = currentTurnTranscriptionRef.current.user;
              const finalModel = currentTurnTranscriptionRef.current.model;
              if (finalUser || finalModel) {
                setTranscription(prev => [
                   ...prev.filter(t => !t.startsWith('[User]') && !t.startsWith('[DialMe]')),
                   ...(finalUser ? [`[User]: ${finalUser}`] : []),
                   ...(finalModel ? [`[DialMe]: ${finalModel}`] : [])
                ]);
              }
              currentTurnTranscriptionRef.current = { user: '', model: '' };
            }

            // Function Call handling
            if (message.toolCall && config.onFunctionCall) {
              for (const fc of message.toolCall.functionCalls) {
                const result = await config.onFunctionCall(fc.name, fc.args);
                sessionPromise.then(s => s.sendToolResponse({
                  functionResponses: { id: fc.id, name: fc.name, response: { result } }
                })).catch(() => {});
              }
            }
          },
          onerror: (e) => setIsActive(false),
          onclose: (e) => setIsActive(false),
        },
      });

      sessionPromiseRef.current = sessionPromise;
    } catch (error) { console.error(error); }
  }, []);

  const clearTranscription = useCallback(() => setTranscription([]), []);

  return { startSession, stopSession, isActive, transcription, clearTranscription };
}
