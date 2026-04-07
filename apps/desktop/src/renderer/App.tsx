import React, { useState, useEffect, useRef } from 'react';
import logo from './assets/logo.png';
// Force-syncing file state to resolve HMR/Vite discrepancies.
import {
    Activity, Monitor, ArrowLeft, ArrowRight, Zap, LogOut, Copy, Settings, MousePointer2, Loader2, Play, KeyRound, Shield, Smartphone, Plus, Search, MoreVertical, CheckCircle2, X,
    RefreshCw, Eye, EyeOff, CreditCard, Power, Lock, Mail, Link, Sun, Moon, Edit2, Trash2, ShieldOff, LayoutGrid, PlusCircle, Radio, ShieldCheck, ArrowRightCircle, Check, DownloadCloud, MonitorOff, User,
    Globe, Folder, Maximize
} from 'lucide-react';

import { useImperativeHandle, forwardRef } from 'react';
import api from './lib/api';
import { useAuthStore } from './store/authStore';
import { SnowDashboard } from './components/SnowDashboard';
import { SnowSidebar } from './components/SnowSidebar';
import { SnowDevices } from './components/SnowDevices';
import { SnowRightBar } from './components/SnowRightBar';
import { SnowHost } from './components/SnowHost';
import { SnowBilling } from './components/SnowBilling';
import { SnowDocumentation } from './components/SnowDocumentation';
import { SnowProfile } from './components/SnowProfile';
import { SnowSupport } from './components/SnowSupport';
import { SnowSettings } from './components/SnowSettings';
import { SnowSplashScreen } from './components/SnowSplashScreen';

const mockPerformanceData = [
    { time: '10:00', latency: 45, network: 120 },
    { time: '10:01', latency: 48, network: 132 },
    { time: '10:02', latency: 40, network: 145 },
    { time: '10:03', latency: 50, network: 110 },
    { time: '10:04', latency: 38, network: 160 },
    { time: '10:05', latency: 42, network: 155 },
];
// --- Premium Mobile Device Frame ---
// Legacy frames removed for clean theater mode.

// --- Video Player Component (Hybrid: WebRTC Track + Legacy WebCodecs) ---
interface VideoPlayerProps {
    viewerStatus: string;
    setViewerStatus: (status: any) => void;
    sessionCode: string;
    onDisconnect: () => void;
    onControlEvent: (event: any) => void;
    remoteStream: MediaStream | null;
    deviceType?: string;
    deviceName?: string;
    controlChannelRef: React.RefObject<RTCDataChannel | null>;
}
const VideoPlayer = forwardRef<any, VideoPlayerProps>(({
    viewerStatus,
    setViewerStatus,
    sessionCode,
    onDisconnect,
    onControlEvent,
    remoteStream,
    deviceType,
    deviceName,
    controlChannelRef
}, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const decoderRef = useRef<any>(null);
    const [latency, setLatency] = useState(0);
    const [transferProgress, setTransferProgress] = useState<{ name: string, p: number } | null>(null);
    const [zoomMode, setZoomMode] = useState<'fit' | 'original'>('fit');
    const [isFullScreen, setIsFullScreen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [hasReceivedKeyframe, setHasReceivedKeyframe] = useState(false);
    const [packetsReceived, setPacketsReceived] = useState(0);
    const [lastPacketTime, setLastPacketTime] = useState<number | null>(null);
    const [decodeErrors, setDecodeErrors] = useState(0);
    const reassemblyMap = useRef(new Map<bigint, { fragments: (Uint8Array | null)[], count: number, total: number }>());
    const [localMouse, setLocalMouse] = useState<{ x: number, y: number } | null>(null);

    // --- Black Screen Watchdog ---
    // If we have a stream but videoWidth is 0, request a recovery keyframe every 3s
    useEffect(() => {
        if (viewerStatus !== 'streaming' || !remoteStream) return;

        const watchdog = setInterval(() => {
            const vw = videoRef.current?.videoWidth || 0;
            const vh = videoRef.current?.videoHeight || 0;
            
            if ((vw === 0 || vh === 0) && controlChannelRef?.current?.readyState === 'open') {
                console.warn('[Watchdog] Black screen detected (0x0). Requesting recovery keyframe from host...');
                try {
                    controlChannelRef.current.send(JSON.stringify({ type: 'request-keyframe' }));
                } catch (err) {
                    console.error('[Watchdog] Failed to send keyframe request:', err);
                }
            }
        }, 3000);

        // Immediate check on mount/stream change
        if (controlChannelRef?.current?.readyState === 'open') {
            controlChannelRef.current.send(JSON.stringify({ type: 'request-keyframe' }));
        }

        return () => clearInterval(watchdog);
    }, [viewerStatus, remoteStream, controlChannelRef]);

    useEffect(() => {
        if (videoRef.current && remoteStream) {
            videoRef.current.srcObject = remoteStream;
            // Force a play attempt to wake the decoder
            videoRef.current.play().catch(() => {});
        }
    }, [remoteStream]);

    useImperativeHandle(ref, () => ({
        feed: (data: Uint8Array) => {
            setPacketsReceived(p => p + 1);
            setLastPacketTime(Date.now());
            if (remoteStream) return; // Ignore custom data if using standard stream

            if (data.length < 10) return;
            const view = new DataView(data.buffer, data.byteOffset, 10);
            const ts = view.getBigInt64(0, true);
            const fragIdx = view.getUint8(8);
            const totalFrags = view.getUint8(9);

            let entry = reassemblyMap.current.get(ts);
            if (!entry) {
                entry = { fragments: new Array(totalFrags).fill(null), count: 0, total: totalFrags };
                reassemblyMap.current.set(ts, entry);
            }

            if (!entry.fragments[fragIdx]) {
                entry.fragments[fragIdx] = data.slice(10);
                entry.count++;
            }

            if (entry.count === entry.total) {
                const totalSize = entry.fragments.reduce((acc, f) => acc + (f ? f.length : 0), 0);
                const fullNAL = new Uint8Array(totalSize);
                let offset = 0;
                for (const f of entry.fragments) {
                    if (f) {
                        fullNAL.set(f, offset);
                        offset += f.length;
                    }
                }

                feedToDecoder(fullNAL, ts);
                reassemblyMap.current.delete(ts);

                if (reassemblyMap.current.size > 20) {
                    const oldestTs = Array.from(reassemblyMap.current.keys()).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
                    reassemblyMap.current.delete(oldestTs[0]);
                }
            }
        }
    }));

    const feedToDecoder = (chunkData: Uint8Array, timestamp: bigint) => {
        if (!decoderRef.current) return;

        // 1. Manually Split Annex-B Chunk into individual NALs
        const nals: Uint8Array[] = [];
        let i = 0;
        while (i < chunkData.length - 3) {
            if (chunkData[i] === 0 && chunkData[i + 1] === 0 && chunkData[i + 2] === 1) {
                const start = i + 3;
                let end = chunkData.length;
                for (let j = start; j < chunkData.length - 2; j++) {
                    if (chunkData[j] === 0 && chunkData[j + 1] === 0 && (chunkData[j + 2] === 1 || (chunkData[j + 2] === 0 && chunkData[j + 3] === 1))) {
                        end = j;
                        break;
                    }
                }
                nals.push(chunkData.subarray(start, end));
                i = end;
            } else if (chunkData[i] === 0 && chunkData[i + 1] === 0 && chunkData[i + 2] === 0 && chunkData[i + 3] === 1) {
                const start = i + 4;
                let end = chunkData.length;
                for (let j = start; j < chunkData.length - 2; j++) {
                    if (chunkData[j] === 0 && chunkData[j + 1] === 0 && (chunkData[j + 2] === 1 || (chunkData[j + 2] === 0 && chunkData[j + 3] === 1))) {
                        end = j;
                        break;
                    }
                }
                nals.push(chunkData.subarray(start, end));
                i = end;
            } else {
                i++;
            }
        }

        if (nals.length === 0) {
            console.warn(`[VideoPlayer] Received chunk of ${chunkData.length} bytes but NO NAL units found!`);
            return;
        }

        // 2. Extract SPS / PPS & Reconfigure WebCodecs (Required on Windows)
        let sps: Uint8Array | null = null;
        let pps: Uint8Array | null = null;
        let type: 'key' | 'delta' = 'delta';
        let nalTypesFound = [];

        for (const nal of nals) {
            const nalType = nal[0] & 0x1F;
            nalTypesFound.push(nalType);
            if (nalType === 7) sps = nal;
            if (nalType === 8) pps = nal;
            if (nalType === 5) type = 'key';
        }

        console.log(`[VideoPlayer] Chunk parsed! Found ${nals.length} NALs. Types: [${nalTypesFound.join(', ')}]`);

        let isCurrentlyConfigured = hasReceivedKeyframe;

        if (sps && pps && !hasReceivedKeyframe) {
            console.log(`[VideoPlayer] Constructing Extradata... SPS Length: ${sps.length}, PPS Length: ${pps.length}`);
            const extradata = new Uint8Array(11 + sps.length + pps.length);
            extradata.set([0x01, sps[1], sps[2], sps[3], 0xFF, 0xE1, (sps.length >> 8) & 0xFF, sps.length & 0xFF], 0);
            extradata.set(sps, 8);
            extradata.set([0x01, (pps.length >> 8) & 0xFF, pps.length & 0xFF], 8 + sps.length);
            extradata.set(pps, 8 + sps.length + 3);

            const codecString = `avc1.${[sps[1], sps[2], sps[3]].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
            console.log(`[VideoPlayer] Configuring Hardware Engine: ${codecString}`);

            decoderRef.current.configure({
                codec: codecString,
                description: extradata,
                optimizeForLatency: true
            });

            console.log(`[VideoPlayer] Decoder successfully configured with AVCDecoderConfigurationRecord.`);
            setHasReceivedKeyframe(true);
            isCurrentlyConfigured = true; // Local override to allow this specific chunk to decode
        }

        if (!isCurrentlyConfigured) {
            if (Math.random() < 0.05) console.warn(`[VideoPlayer] Dropping ${nalTypesFound.join(',')} frame because no SPS/PPS Keyframe initialized engine yet.`);
            return;
        }

        if (viewerStatus !== 'streaming') {
            console.log(`[VideoPlayer] Transitioning to STREAMING. UI should update.`);
            setViewerStatus('streaming');
        }

        // 3. Rebuild chunk in AVCC 4-byte length-prefix format
        // CRITICAL: We MUST filter out SPS/PPS if they are also provided in the 'description' 
        // to prevent decoder failures on Windows Media Foundation.
        const vclNals = nals.filter(nal => {
            const type = nal[0] & 0x1F;
            return type === 1 || type === 5;
        });

        if (vclNals.length === 0) return; // No actual video data in this chunk

        const avccLength = vclNals.reduce((acc, nal) => acc + 4 + nal.length, 0);
        const avccData = new Uint8Array(avccLength);
        let offset = 0;
        for (const nal of vclNals) {
            const view = new DataView(avccData.buffer, avccData.byteOffset + offset, 4);
            view.setUint32(0, nal.length, false);
            avccData.set(nal, offset + 4);
            offset += 4 + nal.length;
        }

        try {
            const EncodedVideoChunk = (window as any).EncodedVideoChunk;
            if (!EncodedVideoChunk) return;

            const encodedChunk = new EncodedVideoChunk({
                type: type,
                timestamp: Number(timestamp),
                data: avccData,
            });
            decoderRef.current.decode(encodedChunk);
        } catch (e) {
            console.error('[VideoPlayer] Decoder CRASHED on chunk processing:', e);
        }
    };

    const viewerContainerRef = useRef<HTMLDivElement>(null);

    // --- Handshake Watchdog (Force Image Recovery) ---
    useEffect(() => {
        let timer: any;
        // Focus the container to ensure keyboard events are captured
        if (viewerStatus === 'streaming') {
            viewerContainerRef.current?.focus();
        }

        // Watchdog should start if we are "connecting" or "connected" but no data has flowed for 5 seconds
        if ((viewerStatus === 'streaming' || viewerStatus === 'connected' || viewerStatus === 'connecting') && !hasReceivedKeyframe && !remoteStream) {
            timer = setTimeout(() => {
                console.log('[VideoPlayer] Screen timeout (black) - Requesting keyframe recovery...');
                onControlEvent({ type: 'request-keyframe' });
            }, 5000); // 5s timeout
        }
        return () => clearTimeout(timer);
    }, [viewerStatus, hasReceivedKeyframe, remoteStream, onControlEvent]);

    // --- Keyboard Handlers ---
    useEffect(() => {
        if ((viewerStatus !== 'streaming' && viewerStatus !== 'connected') || !onControlEvent) return;

        console.warn(`[DIAGNOSTIC] REMOTE CAPTURE ACTIVE. Monitoring all keystrokes in ${viewerStatus} mode.`);

        const handleKeyDown = (e: KeyboardEvent) => {
            // Prevent browser shortcuts when in the viewer (except basic ones if needed)
            if (['Tab', 'Backspace', 'Enter', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
            }

            // Map JS keys and special characters to Windows-style VK codes
            const vkMap: Record<string, number> = {
                'Enter': 0x0D, 'Backspace': 0x08, 'Tab': 0x09, 'Escape': 0x1B, ' ': 0x20,
                'ArrowLeft': 0x25, 'ArrowUp': 0x26, 'ArrowRight': 0x27, 'ArrowDown': 0x28,
                'Delete': 0x2E, 'Home': 0x24, 'End': 0x23, 'Insert': 0x2D, 'PageUp': 0x21, 'PageDown': 0x22,
                'F1': 0x70, 'F2': 0x71, 'F3': 0x72, 'F4': 0x73, 'F5': 0x74, 'F6': 0x75, 'F7': 0x76, 'F8': 0x77, 'F9': 0x78, 'F10': 0x79, 'F11': 0x7A, 'F12': 0x7B,
                'Shift': 0x10, 'Control': 0x11, 'Alt': 0x12, 'Meta': 0x5B, 'CapsLock': 0x14, 'ScrollLock': 0x91, 'NumLock': 0x90
            };

            const vk = vkMap[e.key] || e.keyCode; // Fallback for letters/numbers
            console.log(`[Diagnostic] Capture: Key ${e.key} -> VK ${vk.toString(16)}`);
            onControlEvent({ type: 'keydown', keyCode: vk });
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            const vkMap: Record<string, number> = {
                'Enter': 0x0D, 'Backspace': 0x08, 'Tab': 0x09, 'Escape': 0x1B, ' ': 0x20,
                'ArrowLeft': 0x25, 'ArrowUp': 0x26, 'ArrowRight': 0x27, 'ArrowDown': 0x28,
                'Shift': 0x10, 'Control': 0x11, 'Alt': 0x12, 'Meta': 0x5B
            };
            const vk = vkMap[e.key] || e.keyCode;
            onControlEvent({ type: 'keyup', keyCode: vk });
        };

        // Use capturing phase to ensure we beat button/input focus
        window.addEventListener('keydown', handleKeyDown, true);
        window.addEventListener('keyup', handleKeyUp, true);
        return () => {
            window.removeEventListener('keydown', handleKeyDown, true);
            window.removeEventListener('keyup', handleKeyUp, true);
        };
    }, [viewerStatus, onControlEvent]);

    const initDecoder = () => {
        if (remoteStream || !canvasRef.current) return;
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        if (decoderRef.current) {
            try { decoderRef.current.close(); } catch { }
        }

        const VideoDecoder = (window as any).VideoDecoder;
        if (!VideoDecoder) {
            console.warn('[VideoPlayer] VideoDecoder not available in this environment.');
            return;
        }

        const decoder = new VideoDecoder({
            output: (frame: any) => {
                if (!canvasRef.current || (decoderRef.current && decoderRef.current.state === 'closed')) {
                    frame.close();
                    return;
                }
                if (!hasReceivedKeyframe) setHasReceivedKeyframe(true);
                if (Math.random() < 0.01) console.log(`[VideoPlayer] Output Frame: ${frame.displayWidth}x${frame.displayHeight}`);
                try {
                    ctx.drawImage(frame, 0, 0, canvasRef.current!.width, canvasRef.current!.height);
                } catch (err) {
                    console.error('[VideoPlayer] Draw error:', err);
                }
                frame.close();
            },
            error: (e: any) => {
                console.error('[VideoPlayer] Decoder hardware error:', e);
                setDecodeErrors(d => d + 1);
                setHasReceivedKeyframe(false);
                setTimeout(initDecoder, 1000);
            },
        });

        decoder.configure({
            codec: 'avc1.42E029',
            optimizeForLatency: true,
        });

        decoderRef.current = decoder;
        console.log('[VideoPlayer] Decoder initialized.');
    };

    useEffect(() => {
        initDecoder();
        return () => {
            if (decoderRef.current) decoderRef.current.close();
            decoderRef.current = null;
        };
    }, [remoteStream]);

    // Assign stream to video element whenever it changes
    useEffect(() => {
        if (videoRef.current && remoteStream) {
            videoRef.current.srcObject = remoteStream;
            videoRef.current.play().catch(err => {
                console.warn('[VideoPlayer] Auto-play blocked:', err);
            });
        }
    }, [remoteStream]);

    // --- Manual Wheel Listener (Fixes Passive event error) ---
    useEffect(() => {
        const target = remoteStream ? videoRef.current : canvasRef.current;
        if (!target) return;

        const onWheel = (e: Event) => {
            const we = e as WheelEvent;
            we.preventDefault();
            onControlEvent({ type: 'wheel', deltaX: we.deltaX, deltaY: we.deltaY });
        };

        target.addEventListener('wheel', onWheel, { passive: false });
        return () => target.removeEventListener('wheel', onWheel);
    }, [remoteStream, onControlEvent, zoomMode]);

    const lastMouseMoveRef = useRef<number>(0);
    const MOUSE_THROTTLE_MS = 16; // ~60fps

    const uiTimeoutRef = useRef<any>(null);

    const resetUITimeout = () => {
        if (viewerContainerRef.current) {
            viewerContainerRef.current.setAttribute('data-ui-hidden', 'false');
        }
        clearTimeout(uiTimeoutRef.current);
        uiTimeoutRef.current = setTimeout(() => {
            if (viewerContainerRef.current) {
                viewerContainerRef.current.setAttribute('data-ui-hidden', 'true');
            }
        }, 2000);
    };

    const handleMouseEvent = (e: React.MouseEvent, type: string) => {
        resetUITimeout();

        const target = remoteStream ? videoRef.current : canvasRef.current;
        const rect = target?.getBoundingClientRect();
        if (rect && target) {
            // Get intrinsic video/canvas dimensions for letterbox correction
            let videoWidth: number, videoHeight: number;
            if (remoteStream && videoRef.current) {
                videoWidth = videoRef.current.videoWidth;
                videoHeight = videoRef.current.videoHeight;
            } else if (canvasRef.current) {
                videoWidth = canvasRef.current.width;   // intrinsic 1920
                videoHeight = canvasRef.current.height; // intrinsic 1080
            } else {
                videoWidth = 0; videoHeight = 0;
            }

            if (videoWidth === 0 || videoHeight === 0) {
                // Fallback to simple client-to-element ratio if stream isn't reporting intrinsic dimensions yet
                let x = (e.clientX - rect.left) / rect.width;
                let y = (e.clientY - rect.top) / rect.height;
                if (type === 'mousedown') console.warn('[Diagnostic] Tap: Fallback used (videoWidth 0)');

                // Clamp to 0.0–1.0
                x = Math.max(0, Math.min(1, x));
                y = Math.max(0, Math.min(1, y));

                if (type === 'mousemove') {
                    setLocalMouse({ x: e.clientX, y: e.clientY });
                    const now = Date.now();
                    if (now - lastMouseMoveRef.current < MOUSE_THROTTLE_MS) return;
                    lastMouseMoveRef.current = now;
                }

                onControlEvent({ type, button: (e as any).button, x, y });
                return;
            }

            let x: number, y: number;
            if (zoomMode === 'fit') {
                const containerWidth = rect.width;
                const containerHeight = rect.height;
                const containerRatio = containerWidth / containerHeight;
                const videoRatio = videoWidth / videoHeight;

                let actualWidth, actualHeight, offsetX, offsetY;
                if (containerRatio > videoRatio) {
                    // Pillarboxed: black bars on left/right
                    actualHeight = containerHeight;
                    actualWidth = containerHeight * videoRatio;
                    offsetX = (containerWidth - actualWidth) / 2;
                    offsetY = 0;
                } else {
                    // Letterboxed: black bars on top/bottom
                    actualWidth = containerWidth;
                    actualHeight = containerWidth / videoRatio;
                    offsetX = 0;
                    offsetY = (containerHeight - actualHeight) / 2;
                }

                x = (e.clientX - (rect.left + offsetX)) / actualWidth;
                y = (e.clientY - (rect.top + offsetY)) / actualHeight;

                // Diagnostic: Log mapping for user if it feels 'off'
                if ((e as any).button !== undefined && type === 'mousedown') {
                    console.log(`[Diagnostic] Tap Mapping: (${e.clientX}, ${e.clientY}) -> (${x.toFixed(4)}, ${y.toFixed(4)}) | Video: ${videoWidth}x${videoHeight}`);
                }
            } else {
                x = (e.clientX - rect.left) / rect.width;
                y = (e.clientY - rect.top) / rect.height;
            }

            // Clamp to 0.0–1.0
            x = Math.max(0, Math.min(1, x));
            y = Math.max(0, Math.min(1, y));

            if (type === 'mousemove') {
                setLocalMouse({ x: e.clientX, y: e.clientY });
                const now = Date.now();
                if (now - lastMouseMoveRef.current < MOUSE_THROTTLE_MS) return;
                lastMouseMoveRef.current = now;
            }

            onControlEvent({ type, button: (e as any).button, x, y });
        }
    };

    const handleWheelEvent = (e: React.WheelEvent) => {
        // Handled by manual listener above to avoid passive event error
    };

    const isMobileDevice = deviceType?.toLowerCase() === 'mobile' || deviceType?.toLowerCase() === 'android' || deviceType?.toLowerCase() === 'ios';

    const renderContent = () => {
        const videoProps = {
            className: `transition-all duration-300 select-none ${zoomMode === 'fit' ? (isMobileDevice ? 'w-full h-full object-fill' : 'w-full h-full object-contain') : 'w-auto h-auto object-none'} ${!hasReceivedKeyframe ? 'opacity-0' : 'opacity-100'}`,
            style: { backgroundColor: '#000', outline: 'none' },
            onMouseMove: (e: React.MouseEvent) => handleMouseEvent(e, 'mousemove'),
            onMouseDown: (e: React.MouseEvent) => handleMouseEvent(e, 'mousedown'),
            onMouseUp: (e: React.MouseEvent) => handleMouseEvent(e, 'mouseup'),
            onWheel: handleWheelEvent,
            onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
        };

        const contentNode = remoteStream ? (
            <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                onLoadedMetadata={(e) => {
                    e.currentTarget.play().catch(console.error);
                    setHasReceivedKeyframe(true);
                }}
                onMouseEnter={() => { }}
                onMouseLeave={() => setLocalMouse(null)}
                {...videoProps}
            />
        ) : (
            <div className="relative w-full h-full flex items-center justify-center bg-black">
                {!hasReceivedKeyframe && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#060608] animate-in fade-in duration-500">
                        {/* Ambient glow */}
                        <div className="absolute inset-0 pointer-events-none">
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/5 blur-[160px] rounded-full" />
                        </div>

                        {/* Logo mark */}
                        <div className="relative mb-8 z-10">
                            <div className="w-20 h-20 rounded-[28px] bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shadow-2xl overflow-hidden">
                                <img src={logo} alt="SyncLink" className="w-12 h-12 object-contain opacity-70" />
                            </div>
                            {/* Orbiting ring */}
                            <div className="absolute inset-0 rounded-[28px] border border-blue-500/20 animate-ping" style={{ animationDuration: '2s' }} />
                        </div>

                        <span className="text-[13px] font-bold text-white/60 tracking-[0.35em] uppercase z-10 mb-2">Establishing Link</span>
                        <span className="text-[10px] text-white/20 font-medium z-10 mb-8">Negotiating secure P2P channel...</span>

                        {/* Step indicators */}
                        <div className="flex items-center gap-3 z-10 mb-10">
                            {['ICE', 'DTLS', 'STREAM'].map((step, i) => {
                                const active = (packetsReceived > 0 && i === 2) || (i < 2);
                                return (
                                    <React.Fragment key={step}>
                                        <div className="flex flex-col items-center gap-1.5">
                                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-all ${active ? 'bg-blue-500/20 border-blue-500/40 text-blue-400' : 'bg-white/5 border-white/10 text-white/20'}`}>
                                                {active ? <CheckCircle2 size={12} /> : <div className="w-1.5 h-1.5 rounded-full bg-white/20" />}
                                            </div>
                                            <span className={`text-[8px] font-bold uppercase tracking-widest ${active ? 'text-blue-400/60' : 'text-white/15'}`}>{step}</span>
                                        </div>
                                        {i < 2 && <div className={`w-8 h-px mb-4 ${active ? 'bg-blue-500/30' : 'bg-white/10'}`} />}
                                    </React.Fragment>
                                );
                            })}
                        </div>

                        {/* Telemetry pill */}
                        <div className="flex items-center gap-5 px-5 py-3 bg-white/[0.03] border border-white/[0.06] rounded-2xl z-10">
                            <div className="flex flex-col items-center gap-0.5">
                                <span className="text-[8px] font-bold text-white/25 uppercase tracking-widest">Packets</span>
                                <span className="text-sm font-mono text-blue-400/80 font-bold tabular-nums">{packetsReceived}</span>
                            </div>
                            <div className="w-px h-8 bg-white/[0.06]" />
                            <div className="flex flex-col items-center gap-0.5">
                                <span className="text-[8px] font-bold text-white/25 uppercase tracking-widest">Errors</span>
                                <span className="text-sm font-mono text-red-400/80 font-bold tabular-nums">{decodeErrors}</span>
                            </div>
                            <div className="w-px h-8 bg-white/[0.06]" />
                            <div className="flex flex-col items-center gap-0.5">
                                <span className="text-[8px] font-bold text-white/25 uppercase tracking-widest">Signal</span>
                                <span className={`text-sm font-bold uppercase ${lastPacketTime && (Date.now() - lastPacketTime < 2000) ? 'text-emerald-400/80' : 'text-white/20'}`}>
                                    {lastPacketTime && (Date.now() - lastPacketTime < 2000) ? 'HOT' : '—'}
                                </span>
                            </div>
                        </div>

                        {lastPacketTime && (
                            <span className="text-[8px] text-white/15 font-bold uppercase tracking-[0.2em] mt-4 z-10">
                                Last signal: {Math.round((Date.now() - lastPacketTime) / 1000)}s ago
                            </span>
                        )}
                    </div>
                )}
                <canvas
                    ref={canvasRef}
                    width={1920}
                    height={1080}
                    {...videoProps}
                />
            </div>
        );
        return (
            <div className="w-full h-full flex items-center justify-center relative bg-[#060608]">
                {isMobileDevice && zoomMode === 'fit' ? (
                    <div className="relative flex items-center justify-center py-12 px-4 w-full h-full max-h-screen">
                        {/* Phone Frame wrapper */}
                        <div className="relative rounded-[48px] p-3 bg-[#1C1C1C] border border-white/[0.08] shadow-[0_30px_100px_rgba(0,0,0,0.8)] h-[95%] aspect-[9/19.5] flex-shrink-0 flex items-center justify-center max-h-[900px]">
                            {/* Bezel inner */}
                            <div className="relative w-full h-full rounded-[38px] overflow-hidden bg-black isolation-auto pointer-events-auto shadow-[inset_0_0_2px_rgba(255,255,255,0.2)] flex items-center justify-center">
                                {contentNode}
                            </div>
                            {/* Dynamic Island / Camera Notch */}
                            <div className="absolute top-5 left-1/2 -translate-x-1/2 w-[120px] h-[30px] bg-black rounded-full pointer-events-none z-50 flex items-center justify-center border border-white/[0.04] shadow-sm">
                                <div className="w-3 h-3 rounded-full bg-blue-900/30 ml-auto mr-4 flex items-center justify-center">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#1A1A1A] shadow-[inset_0.5px_0.5px_1px_rgba(255,255,255,0.3)]">
                                        <div className="w-0.5 h-0.5 rounded-full bg-blue-500/50 mt-[1px] ml-[1px]" />
                                    </div>
                                </div>
                            </div>

                            {/* Hardware Buttons */}
                            <div className="absolute top-32 -left-1 w-1 h-12 bg-[#2A2A2A] rounded-l-md" />
                            <div className="absolute top-48 -left-1 w-1 h-20 bg-[#2A2A2A] rounded-l-md" />
                            <div className="absolute top-48 -right-1 w-1 h-24 bg-[#2A2A2A] rounded-r-md" />
                        </div>
                    </div>
                ) : (
                    contentNode
                )}
            </div>
        );
    };

    return (
        <div
            ref={viewerContainerRef}
            tabIndex={0}
            data-ui-hidden="false"
            className="w-full h-full flex flex-col animate-in fade-in duration-700 relative bg-[#060608] outline-none"
        >
            {/* Floating Glassmorphism Toolbar */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3 py-2 rounded-2xl bg-[#0a0a0ade] border border-white/[0.08] backdrop-blur-2xl shadow-2xl shadow-black/40 transition-all duration-500 opacity-100 pointer-events-auto [[data-ui-hidden='true']_&]:opacity-0 [[data-ui-hidden='true']_&]:-translate-y-4 [[data-ui-hidden='true']_&]:pointer-events-none hover:!opacity-100 hover:!translate-y-0 hover:!pointer-events-auto">
                {/* Back */}
                <button
                    onClick={onDisconnect}
                    title="Disconnect"
                    className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 hover:bg-red-500/20 text-white/50 hover:text-red-400 transition-all active:scale-95 border border-white/5"
                >
                    <ArrowLeft size={14} />
                </button>

                <div className="w-px h-5 bg-white/[0.06] mx-1" />

                {/* Device identity */}
                <div className="flex items-center gap-2.5 px-1">
                    <div className="w-7 h-7 rounded-xl bg-white/10 flex items-center justify-center">
                        {isMobileDevice ? <Smartphone size={13} className="text-white/70" /> : <Monitor size={13} className="text-white/70" />}
                    </div>
                    <div className="flex flex-col leading-none">
                        <span className="text-[11px] font-bold text-white/90 tracking-tight max-w-[120px] truncate">{deviceName || 'Remote Node'}</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-[9px] font-bold text-emerald-400/80 uppercase tracking-widest">{latency > 0 ? `${latency}ms` : 'LIVE'}</span>
                        </div>
                    </div>
                </div>

                <div className="w-px h-5 bg-white/[0.06] mx-1" />

                {/* Controls */}
                <div className="flex items-center gap-0.5">
                    <button onClick={() => setZoomMode(zoomMode === 'fit' ? 'original' : 'fit')} title="Toggle Scale" className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all border ${zoomMode === 'original' ? 'bg-blue-500/20 border-blue-500/30 text-blue-400' : 'bg-white/5 border-white/5 text-white/40 hover:text-white/80 hover:bg-white/10'}`}>
                        <Search size={13} />
                    </button>
                    <button onClick={() => { if (!document.fullscreenElement) { containerRef.current?.requestFullscreen(); setIsFullScreen(true); } else { document.exitFullscreen(); setIsFullScreen(false); } }} title="Fullscreen" className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/5 border border-white/5 text-white/40 hover:text-white/80 hover:bg-white/10 transition-all">
                        <Maximize size={13} />
                    </button>
                </div>

                <div className="w-px h-5 bg-white/[0.06] mx-1" />

                {/* Action buttons */}
                <div className="flex items-center gap-0.5">
                    {[
                        { icon: Activity, action: 'task_manager', title: 'Task Manager', color: '' },
                        { icon: Globe, action: 'browser', title: 'Browser', color: '' },
                        { icon: Folder, action: 'explorer', title: 'Explorer', color: '' },
                        { icon: Sun, action: 'wakeup', title: 'Wake Screen', color: 'hover:text-yellow-400 hover:bg-yellow-500/10' },
                        { icon: Lock, action: 'lock', title: 'Lock Screen', color: 'hover:text-blue-400 hover:bg-blue-500/10' },
                        { icon: Power, action: 'shutdown', title: 'Shutdown', color: 'hover:text-red-400 hover:bg-red-500/10' },
                    ].map(({ icon: Icon, action, title, color }) => (
                        <button key={action} onClick={() => onControlEvent({ type: 'action', action })} title={title}
                            className={`w-8 h-8 rounded-xl flex items-center justify-center bg-white/5 border border-white/5 text-white/40 hover:text-white/80 hover:bg-white/10 transition-all ${color}`}>
                            <Icon size={13} />
                        </button>
                    ))}
                    <button onClick={() => onControlEvent({ type: 'request-keyframe' })} title="Refresh Stream"
                        className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/5 border border-white/5 text-emerald-400/60 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all">
                        <RefreshCw size={13} />
                    </button>
                </div>

                <div className="w-px h-5 bg-white/[0.06] mx-1" />

                {/* File transfer */}
                <input type="file" ref={fileInputRef} className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    const channel = controlChannelRef.current;
                    if (!channel) {
                        console.error('[FileTransfer] No active control channel.');
                        return;
                    }

                    // Ensure threshold is set for onbufferedamountlow
                    channel.bufferedAmountLowThreshold = 65536; // 64KB

                    const waitForBuffer = () => {
                        if (channel.bufferedAmount < 262144) return Promise.resolve(); // 256KB target
                        return new Promise<void>((resolve) => {
                            const handler = () => {
                                channel.removeEventListener('bufferedamountlow', handler);
                                resolve();
                            };
                            channel.addEventListener('bufferedamountlow', handler);
                        });
                    };

                    const CHUNK_SIZE = 16 * 1024;
                    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
                    setTransferProgress({ name: file.name, p: 0 });

                    try {
                        for (let i = 0; i < totalChunks; i++) {
                            // FLOW CONTROL: Wait if network buffer is saturated
                            await waitForBuffer();

                            const start = i * CHUNK_SIZE;
                            const end = Math.min(start + CHUNK_SIZE, file.size);
                            const chunk = file.slice(start, end);
                            const arrayBuffer = await chunk.arrayBuffer();
                            const header = JSON.stringify({ type: 'file-chunk', name: file.name, totalSize: file.size, offset: start, chunkIndex: i, totalChunks });
                            const headerBuffer = new TextEncoder().encode(header);
                            const fullBuffer = new Uint8Array(4 + headerBuffer.length + arrayBuffer.byteLength);
                            const view = new DataView(fullBuffer.buffer);
                            view.setUint32(0, headerBuffer.length, true);
                            fullBuffer.set(headerBuffer, 4);
                            fullBuffer.set(new Uint8Array(arrayBuffer), 4 + headerBuffer.length);

                            onControlEvent(fullBuffer);

                            if (i % 20 === 0) {
                                console.log(`[Diagnostic] File Upload: Sent chunk ${i + 1}/${totalChunks} (${Math.round((i + 1) / totalChunks * 100)}%)`);
                                setTransferProgress({ name: file.name, p: Math.round(((i + 1) / totalChunks) * 100) });
                            }
                        }
                        setTransferProgress({ name: file.name, p: 100 });
                    } catch (err: any) {
                        console.error('[FileTransfer] FAILED:', err);
                    }

                    setTimeout(() => setTransferProgress(null), 2000);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                }} />
                <button onClick={() => fileInputRef.current?.click()} title="Transfer File"
                    className="w-8 h-8 rounded-xl flex items-center justify-center bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-all">
                    <Plus size={13} />
                </button>

                {/* Transfer progress */}
                {transferProgress && (
                    <>
                        <div className="w-px h-5 bg-white/[0.06] mx-1" />
                        <div className="flex items-center gap-2 px-2">
                            <span className="text-[9px] font-bold text-white/40 uppercase tracking-wider max-w-[80px] truncate">{transferProgress.name}</span>
                            <div className="w-20 h-1 bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-400 transition-all duration-300 rounded-full" style={{ width: `${transferProgress.p}%` }} />
                            </div>
                            <span className="text-[9px] font-mono text-blue-400">{transferProgress.p}%</span>
                        </div>
                    </>
                )}
            </div>

            {/* Main Video Area */}
            <div
                ref={containerRef}
                className={`flex-grow flex items-center justify-center relative overflow-hidden bg-[#060608] ${zoomMode === 'original' ? 'cursor-grab active:cursor-grabbing overflow-auto' : ''}`}
            >
                <div className="w-full h-full relative">
                    {renderContent()}
                    {/* Deep edge vignette */}
                    <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: 'inset 0 0 120px rgba(0,0,0,0.7)' }} />
                </div>
            </div>
        </div>
    );
});

// --- Main App Component ---
export default function App() {
    const isElectron = !!(window as any).electronAPI;

    useEffect(() => {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
    }, []);

    const [loading, setLoading] = useState(true);
    const [showSplash, setShowSplash] = useState(false);
    const { user, accessToken, login: storeLogin, register: storeRegister, logout: storeLogout, checkAuth, setAuth } = useAuthStore();
    const isAuthenticated = !!accessToken;

    const [currentView, setCurrentView] = useState<'dashboard' | 'devices' | 'settings' | 'host' | 'billing' | 'documentation' | 'profile' | 'support'>('dashboard');
    const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [signupName, setSignupName] = useState('');
    const [showLoginPassword, setShowLoginPassword] = useState(false);
    const [sessionCode, setSessionCode] = useState('');
    const [accessPassword, setAccessPassword] = useState('');
    const [showManualPassword, setShowManualPassword] = useState(false);
    // Initialize as viewer window early if URL points to it
    const isViewer = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('view') === 'viewer';
    const [isViewerWindow, setIsViewerWindow] = useState(isViewer);

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isRightBarOpen, setIsRightBarOpen] = useState(false);

    // Persistent Client ID for signaling stability (survives re-mounts/Strict Mode)
    const [viewerClientId] = useState(() => {
        if (typeof window === 'undefined') return '';
        let cid = sessionStorage.getItem('viewer_client_id');
        if (!cid) {
            cid = 'v-' + Math.random().toString(36).substring(2, 15);
            sessionStorage.setItem('viewer_client_id', cid);
            return cid;
        }
        return cid;
    });

    const [windowDeviceName, setWindowDeviceName] = useState('');
    const [errorModal, setErrorModal] = useState<{ show: boolean, title: string, message: string } | null>(null);

    const showError = (title: string, message: string) => {
        setErrorModal({ show: true, title: title || 'System Error', message });
    };

    const [hostSessionId, setHostSessionId] = useState('');
    const [hostStatus, setHostStatus] = useState<'idle' | 'connecting' | 'error' | 'status' | ''>('');
    const [hostMessage, setHostMessage] = useState('');
    const [hostError, setHostError] = useState('');
    const [hostAccessKey, setHostAccessKey] = useState('');
    const [devicePassword, setDevicePassword] = useState(localStorage.getItem('device_password') || '');
    const [isAutoHostEnabled, setIsAutoHostEnabled] = useState(localStorage.getItem('is_auto_host_enabled') === 'true');
    const [showHostPassword, setShowHostPassword] = useState(false);
    const [showSetPasswordModal, setShowSetPasswordModal] = useState(false);
    const [setupPassword, setSetupPassword] = useState('');
    const [setupPasswordConfirm, setSetupPasswordConfirm] = useState('');
    const [setupPasswordError, setSetupPasswordError] = useState('');

    const [serverIP, setServerIP] = useState('159.65.84.190'); // HARDCODED
    const [localIP, setLocalIP] = useState('127.0.0.1');
    const [showSettings, setShowSettings] = useState(false);
    const [isPackaged, setIsPackaged] = useState(false);

    useEffect(() => {
        if ((window as any).electronAPI?.isPackaged) {
            (window as any).electronAPI.isPackaged().then(setIsPackaged);
        }
    }, []);


    const [viewerStatus, setViewerStatus] = useState<'idle' | 'connecting' | 'error' | 'connected' | 'streaming' | 'connection_lost'>('idle');
    const [viewerError, setViewerError] = useState('');
    const videoPlayerRef = useRef<any>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const candidatesBuffer = useRef<RTCIceCandidateInit[]>([]);
    const controlChannelRef = useRef<RTCDataChannel | null>(null);
    const volumeIntervalRef = useRef<any>(null);
    const reassemblyMap = useRef<Map<bigint, any>>(new Map());

    // Throttled mouse movement
    const lastMouseMoveRef = useRef<number>(0);
    const lastBufferWarningRef = useRef<number>(0);
    const MOUSE_THROTTLE_MS = 16; // ~60fps mouse updates

    const onControlEvent = (event: any) => {
        const channel = controlChannelRef.current;
        if (channel?.readyState === 'open') {
            try {
                if (event instanceof Uint8Array) {
                    // Binary packets (files) are critical, never drop them here.
                    // Flow control is handled by the caller.
                    channel.send(event as any);
                } else {
                    // Congestion Guard: Drop mousemove if buffer is saturating
                    if (channel.bufferedAmount > 65536) { // 64KB threshold
                        if (event.type === 'mousemove') return; // Drop travel

                        // Extreme congestion: Drop almost everything except clicks/keys
                        if (channel.bufferedAmount > 1048576 && event.type !== 'mousedown' && event.type !== 'keydown') {
                            const now = Date.now();
                            if (now - lastBufferWarningRef.current > 5000) {
                                console.warn(`[Diagnostic] DataChannel Saturated: ${Math.round(channel.bufferedAmount / 1024)}KB queued. Dropping sync...`);
                                lastBufferWarningRef.current = now;
                            }
                            return;
                        }
                    }
                    channel.send(JSON.stringify(event)); // JSON (input)
                }
            } catch (err: any) {
                console.error(`[Diagnostic] Failed to send control event: ${err.message}`);
            }
        }
    };

    const throttledMouseMove = (event: any) => {
        const now = Date.now();
        if (now - lastMouseMoveRef.current < MOUSE_THROTTLE_MS) return;
        lastMouseMoveRef.current = now;
        onControlEvent(event);
    };

    const handleLogout = async () => {
        await storeLogout();
    };
    const lastClipboardRef = useRef<string>('');


    // --- New Device Management State ---
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [devices, setDevices] = useState<any[]>([]);
    const [selectedDevice, setSelectedDevice] = useState<any | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const [showPasswordPrompt, setShowPasswordPrompt] = useState<any | null>(null); // { device }
    const [promptPassword, setPromptPassword] = useState('');
    const [promptRemember, setPromptRemember] = useState(true);
    const [showPromptPassword, setShowPromptPassword] = useState(false);

    const [showAddModal, setShowAddModal] = useState(false);
    const [addKey, setAddKey] = useState('');
    const [addPassword, setAddPassword] = useState('');
    const [showAddPassword, setShowAddPassword] = useState(false);

    const [contextMenuMsg, setContextMenuMsg] = useState(''); // Tooltip offline
    const [contextMenuId, setContextMenuId] = useState<string | null>(null);
    const [globalError, setGlobalError] = useState('');

    const [actionModal, setActionModal] = useState<{ type: 'rename' | 'password' | 'remove' | 'regenerate', device: any } | null>(null);
    const [actionValue, setActionValue] = useState('');

    // --- Dynamic Notifications ---
    const [notifications, setNotifications] = useState<any[]>([
        { action: 'Security scan completed.', time: 'Just now', icon: ShieldCheck, color: 'bg-[#E6F1FD]' },
        { action: 'Client initialized.', time: 'Just now', icon: Activity, color: 'bg-[#E6F1FD]' },
    ]);
    const [activeSessionCount, setActiveSessionCount] = useState(0);

    const addNotification = (action: string, iconType: 'host' | 'security' | 'session' | 'system' = 'system') => {
        const iconMap = {
            host: Radio,
            security: ShieldCheck,
            session: User,
            system: Activity
        };
        const colorMap = {
            host: 'bg-[#EDEEFC]',
            security: 'bg-[#E6F1FD]',
            session: 'bg-[#F2F2F2]',
            system: 'bg-[#E6F1FD]'
        };

        const newNotif = {
            action,
            time: 'Just now',
            icon: iconMap[iconType],
            color: colorMap[iconType]
        };
        setNotifications(prev => [newNotif, ...prev.slice(0, 9)]);
    };

    // Sync actionValue when modal opens
    useEffect(() => {
        if (actionModal) {
            if (actionModal.type === 'rename') setActionValue(actionModal.device?.device_name || '');
            else if (actionModal.type === 'password') setActionValue('');
            else setActionValue('');
        }
    }, [actionModal]);

    useEffect(() => {
        const handleGlobalClick = () => { if (contextMenuId) setContextMenuId(null); };
        window.addEventListener('click', handleGlobalClick);
        return () => window.removeEventListener('click', handleGlobalClick);
    }, [contextMenuId]);

    const handleDisconnect = () => {
        if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
        }
        setRemoteStream(null);
        setViewerStatus('idle');
        pollDevices();
    };

    // Initialize Viewer Window from URL - runs only once on true mount
    const viewerConnectedRef = useRef(false);
    useEffect(() => {
        if (viewerConnectedRef.current) return; // Guard for React Strict Mode double-fire
        const params = new URLSearchParams(window.location.search);
        if (params.get('view') === 'viewer') {
            viewerConnectedRef.current = true;
            const sid = params.get('sessionId') || '';
            const sip = params.get('serverIP') || '';
            const tok = params.get('token') || '';
            const dname = params.get('deviceName') || '';

            setSessionCode(sid);
            setServerIP(sip);
            setAuth({ email: 'node.viewer@synclink.io' } as any, tok, '', false);
            setWindowDeviceName(dname);

            console.log(`[Window] Launched in Viewer Mode for Node: ${sid}`);
            console.log(`[Window] Joining with Persistent ID: ${viewerClientId}`);

            setViewerStatus('connecting');
            if (isElectron) {
                (window as any).electronAPI.connectToHost(sid, sip, tok, viewerClientId).then(() => {
                    setViewerStatus('connected');
                }).catch((e: any) => {
                    viewerConnectedRef.current = false; // Allow retry on error
                    showError('Mesh Fault', e.message || 'The secure connection could not be established.');
                });
            } else {
                showError('Browser Limitation', 'Mesh connections require the native desktop application.');
                setViewerStatus('error');
            }
        }
    }, []); // Empty deps: only run once on mount

    useEffect(() => {
        if (!isElectron) return;
        const removeHostStatusListener = (window as any).electronAPI.onHostStatus((status: string) => {
            console.log(`[Renderer] Host Status: ${status}`);
            if (status.startsWith('Registered:')) {
                const sid = status.split('Registered: ')[1];
                setHostSessionId(sid);
                setHostStatus('status');
            } else if (status.startsWith('WebRTC:')) {
                setHostStatus('status');
            } else if (status === 'error' || status === 'disconnected') {
                setHostStatus('idle');
            }
        });
        return () => removeHostStatusListener();
    }, [isElectron]);

    const pollDevices = async () => {
        try {
            const { data } = await api.get('/api/devices/mine');
            setDevices(data);
            setGlobalError('');

            // Auto-sync local host status if we find ourselves in the list as online
            const self = data.find((d: any) => d.access_key === hostAccessKey);
            if (self && self.is_online) {
                setHostStatus('status');
                setHostSessionId(self.access_key);
            }
        } catch (e: any) {
            if (e.response?.status === 401 && !isViewerWindow) {
                // Handled by api interceptor mostly, but ensure we reflect it
                handleLogout();
                showError('Session Expired', 'Your authentication session has timed out. Please sign in again.');
            }
        }
    };

    useEffect(() => {
        if (isAuthenticated && (accessToken || isViewerWindow)) {
            // If we are a viewer window and don't have a token yet, wait for it
            if (isViewerWindow && !accessToken) return;

            pollDevices();

            // Establish long-lived presence monitor
            const getWsUrl = () => {
                if (isPackaged) {
                    return `ws://${serverIP}/api/signal`;
                }
                return `ws://${serverIP}/api/signal`;
            };
            const wsUrl = getWsUrl();
            const monitor = new WebSocket(wsUrl);

            monitor.onopen = () => {
                api.get('/api/devices/mine').then(({ data }) => {
                    setDevices(data);
                    // Standardize keys before subscription to signaling service (V5 Sync)
                    const keys = data.map((d: any) => String(d.access_key || '').toLowerCase().replace(/\s/g, ''));
                    monitor.send(JSON.stringify({
                        type: 'subscribe-presence',
                        accessKeys: keys
                    }));
                }).catch(err => {
                    console.error('[Monitor] Initial fetch failed:', err);
                });
            };

            monitor.onmessage = (e) => {
                try {
                    const data = JSON.parse(e.data);
                    if (data.type === 'presence-update') {
                        const incomingId = String(data.sessionId || '').toLowerCase().replace(/\s/g, '');
                        const deviceMatch = devices.find(d => String(d.access_key || '').toLowerCase().replace(/\s/g, '') === incomingId);
                        if (deviceMatch && deviceMatch.is_online !== (data.status === 'online')) {
                            addNotification(`${deviceMatch.device_name} is now ${data.status}`, 'host');
                        }
                        setDevices(prev => prev.map(d => {
                            const localId = String(d.access_key || '').toLowerCase().replace(/\s/g, '');
                            return localId === incomingId ? { ...d, is_online: data.status === 'online' } : d;
                        }));
                    } else if (data.type === 'global-stats') {
                        setActiveSessionCount(data.activeSessions || 0);
                    }
                } catch (err) {
                    console.error('[Monitor] Message parse error:', err);
                }
            };

            const handleFocus = () => pollDevices();
            window.addEventListener('focus', handleFocus);

            return () => {
                monitor.close();
                window.removeEventListener('focus', handleFocus);
            };
        }
    }, [isAuthenticated, accessToken, serverIP, isViewerWindow]);

    // Handlers for the UI
    const handleDeviceClick = async (device: any) => {
        if (!device.is_online) {
            showError('Endpoint Unreachable', `${device.device_name} is currently offline. Please ensure the host service is running.`);
            return;
        }

        // Attempt direct connection bypass
        try {
            const { data } = await api.post('/api/devices/verify-access', { accessKey: device.access_key, password: '' });
            // Launch in NEW WINDOW
            if (isElectron) {
                await (window as any).electronAPI.openViewerWindow(device.access_key, serverIP, data.token, device.device_name, device.device_type);
            }
        } catch (e: any) {
            if (e.response?.status === 401) {
                setShowPasswordPrompt(device);
                setPromptPassword('');
                setPromptRemember(false);
            } else {
                showError('Handshake Failed', e.response?.data?.error || e.message || 'The secure connection could not be established.');
            }
        }
    };

    const handleBulkDelete = async (ids: string[]) => {
        try {
            await Promise.all(ids.map(id => api.delete(`/api/devices/${id}`)));
            pollDevices();
            setGlobalError(`Successfully removed ${ids.length} devices.`);
        } catch (e: any) {
            setGlobalError('Failed to remove some devices: ' + e.message);
        }
    };

    const submitPasswordPrompt = async () => {
        if (!showPasswordPrompt || !promptPassword) return;
        const device = showPasswordPrompt;
        setViewerStatus('connecting');
        try {
            const { data } = await api.post('/api/devices/verify-access', { accessKey: device.access_key, password: promptPassword });
            if (promptRemember) {
                await api.post(`/api/devices/${device.id}/trust`);
            }
            if (isElectron) {
                await (window as any).electronAPI.openViewerWindow(device.access_key, serverIP, data.token, device.device_name, device.device_type);
            }
            setViewerStatus('idle');
            setShowPasswordPrompt(null);
        } catch (e: any) {
            setViewerStatus('idle');
            setGlobalError(e.message || 'Connection failed.');
        }
    };

    const handleAddDevice = async () => {
        try {
            await api.post('/api/devices/add-existing', { accessKey: addKey.replace(/\s/g, ''), password: addPassword });
            setShowAddModal(false);
            setAddKey('');
            setAddPassword('');
            pollDevices();
        } catch (e: any) {
            setGlobalError(e.response?.data?.error || e.message || 'Network error adding device');
        }
    };

    const handleRename = async (device: any) => {
        try {
            const creds = await (window as any).electronAPI.getToken();
            await api.patch(`/api/devices/${device.id}/name`, { device_name: actionValue });
            pollDevices();
            setActionModal(null);
            if (selectedDevice?.id === device.id) setSelectedDevice({ ...selectedDevice, device_name: actionValue });
        } catch (e: any) { setGlobalError(e.message); }
    };

    const handleRemove = async (device: any) => {
        try {
            const creds = await (window as any).electronAPI.getToken();
            await api.delete(`/api/devices/${device.id}`);
            pollDevices();
            setActionModal(null);
            if (selectedDevice?.id === device.id) setSelectedDevice(null);
        } catch (e: any) { setGlobalError(e.message); }
    };

    const handleRevokeTrust = async (id: string) => {
        try {
            const creds = await (window as any).electronAPI.getToken();
            await api.delete(`/api/devices/${id}/trust`);
            setGlobalError('Success: Trust revoked for this device.');
            pollDevices();
        } catch (e) { }
    };



    const handleSetPassword = async (device: any) => {
        try {
            const creds = await (window as any).electronAPI.getToken();

            // If "device" is null, we are updating the local machine's access password
            if (!device) {
                setDevicePassword(actionValue);
                localStorage.setItem('device_password', actionValue);
                if (deviceId) {
                    await api.post('/api/devices/set-password', { deviceId: deviceId, password: actionValue });
                }
                setActionModal(null);
                setActionValue('');
            } else {
                await api.post('/api/devices/set-password', { deviceId: device.id, password: actionValue });
                pollDevices();
                setActionModal(null);
                setActionValue('');
            }
        } catch (e: any) { setGlobalError(e.message); }
    };


    const [deviceId, setDeviceId] = useState('');
    const [viewerStep, setViewerStep] = useState<1 | 2>(1);
    const [hostStats, setHostStats] = useState<{ bandwidth: string, activeUsers: number }>({ bandwidth: '0.00', activeUsers: 0 });
    const [lastPingTime, setLastPingTime] = useState<number>(Date.now());

    // 1. Viewer-side Clipboard Polling (500ms)
    useEffect(() => {
        if (viewerStatus !== 'streaming' || !isElectron) return;

        const interval = setInterval(async () => {
            try {
                const text = await (window as any).electronAPI.clipboard.readText();
                if (text && text !== lastClipboardRef.current) {
                    lastClipboardRef.current = text;
                    if (controlChannelRef.current?.readyState === 'open') {
                        console.log(`[Diagnostic] Local clipboard changed. Syncing to host... (${text.substring(0, 20)}...)`);
                        controlChannelRef.current.send(JSON.stringify({ type: 'clipboard', text }));
                    }
                }
            } catch (e) { }
        }, 500);

        return () => clearInterval(interval);
    }, [viewerStatus, isElectron]);

    useEffect(() => {
        if (!isElectron) return;
        const unsub = (window as any).electronAPI.onHostStats((stats: any) => {
            setHostStats(stats);
        });
        return () => unsub();
    }, [isElectron]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (viewerStatus === 'streaming' && controlChannelRef.current?.readyState === 'open') {
                controlChannelRef.current.send(JSON.stringify({ type: 'keydown', keyCode: e.keyCode }));
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (viewerStatus === 'streaming' && controlChannelRef.current?.readyState === 'open') {
                controlChannelRef.current.send(JSON.stringify({ type: 'keyup', keyCode: e.keyCode }));
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [viewerStatus]);

    useEffect(() => {
        if (viewerStatus !== 'streaming' || !isElectron) return;
        const interval = setInterval(async () => {
            const text = await (window as any).electronAPI.clipboard.readText();
            if (text && text !== lastClipboardRef.current) {
                lastClipboardRef.current = text;
                if (controlChannelRef.current?.readyState === 'open') {
                    controlChannelRef.current.send(JSON.stringify({ type: 'clipboard', text }));
                }
            }
        }, 500);
        return () => clearInterval(interval);
    }, [viewerStatus]);

    const [showBillingModal, setShowBillingModal] = useState(false);
    const [billingPlans, setBillingPlans] = useState<any[]>([]);
    const [currentPlan, setCurrentPlan] = useState<any>(null);
    const [billingLoading, setBillingLoading] = useState(false);

    const [fileReceivedModal, setFileReceivedModal] = useState<{ name: string, path: string, isRemote: boolean } | null>(null);

    useEffect(() => {
        if (!isElectron) return;
        const api = (window as any).electronAPI;
        if (!api?.onFileReceived) return;
        const unsub = api.onFileReceived((data: any) => {
            setFileReceivedModal(data);
        });
        return () => unsub();
    }, [isElectron]);

    const fetchBillingInfo = async () => {
        try {
            setShowBillingModal(true);
            setBillingLoading(true);
            const creds = isElectron ? await (window as any).electronAPI.getToken() : { token: accessToken };
            if (!creds?.token) return;

            const [plansRes, currentRes] = await Promise.all([
                fetch(`http://${serverIP}/billing/plans`),
                fetch(`http://${serverIP}/billing/current`, {
                    headers: { 'Authorization': `Bearer ${creds.token}` }
                })
            ]);

            if (plansRes.ok) setBillingPlans(await plansRes.json());
            if (currentRes.ok) setCurrentPlan(await currentRes.json());
        } catch (err: any) {
            console.error('Failed to fetch billing info', err);
            setGlobalError('Failed to load billing details: ' + err.message);
            setShowBillingModal(false);
        } finally {
            setBillingLoading(false);
        }
    };

    const handleSubscribe = async (planName: string) => {
        try {
            setBillingLoading(true);
            const creds = isElectron ? await (window as any).electronAPI.getToken() : { token: accessToken };
            const res = await fetch(`http://${serverIP}/billing/subscribe`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${creds.token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan: planName, paymentMethodId: 'pm_card_visa' })
            });
            if (!res.ok) throw new Error(await res.text());
            fetchBillingInfo();
        } catch (err: any) {
            setGlobalError('Subscription failed: ' + err.message);
            setBillingLoading(false);
        }
    };

    const loadDeviceInfo = async () => {
        try {
            const creds = isElectron ? await (window as any).electronAPI.getToken() : { token: accessToken };
            if (!creds?.token) return;

            let localKey = isElectron ? await (window as any).electronAPI.getDeterministicKey() : null;
            let deviceUuid = '';

            // 1. Fetch what the server thinks are our devices
            const { data: fetchedDevices } = await api.get('/api/devices/mine');
            setDevices(fetchedDevices);

            // 2. Check if our local identity is still valid in the DB
            let existingInDb = null;
            if (localKey && Array.isArray(fetchedDevices)) {
                existingInDb = fetchedDevices.find((d: any) => d.access_key === localKey);
            }

            if (!localKey || !existingInDb) {
                // We have no key, or our key was deleted from the server. Register fresh!
                console.log(`[Identity] No valid local key found${localKey ? ' (Stale)' : ''}. Registering...`);
                const machineName = (isElectron && (window as any).electronAPI.getMachineName)
                    ? await (window as any).electronAPI.getMachineName()
                    : 'RemoteLink Web User';
                const { data: newDevice } = await api.post('/api/devices/register', {
                    name: machineName,
                    accessKey: localKey || undefined
                });

                localKey = newDevice.access_key;
                deviceUuid = newDevice.id;
                console.log(`[Identity] Registered NEW Identity: ${localKey}`);
                pollDevices(); // Update the list again
            } else {
                deviceUuid = existingInDb.id;
                console.log(`[Identity] Verified existing identity: ${localKey}`);
            }

            if (localKey) {
                setDeviceId(deviceUuid);
                setHostAccessKey(localKey);
                setHostSessionId(localKey); // Update the visual registration code
            }
        } catch (e: any) {
            console.error('[Identity] Load failed:', e);
        }
    };

    useEffect(() => {
        if (isAuthenticated) loadDeviceInfo();
    }, [isAuthenticated, serverIP]);

    // Fetch real billing data when billing view is opened
    useEffect(() => {
        if (currentView === 'billing' && isAuthenticated && !currentPlan) {
            (async () => {
                try {
                    const creds = isElectron ? await (window as any).electronAPI.getToken() : { token: accessToken };
                    if (!creds?.token) return;
                    const res = await fetch(`http://${serverIP}/billing/current`, {
                        headers: { 'Authorization': `Bearer ${creds.token}` }
                    });
                    if (res.ok) setCurrentPlan(await res.json());
                } catch (err) {
                    console.error('[Billing] Failed to fetch current plan:', err);
                }
            })();
        }
    }, [currentView, isAuthenticated]);

    // --- Persistent Hosting Auto-Start ---
    useEffect(() => {
        // If all required identity info is loaded and auto-host is enabled, start hosting.
        // hostStatus "" or "idle" means it hasn't started yet.
        if (isAuthenticated && hostAccessKey && deviceId && devicePassword && isAutoHostEnabled && (hostStatus === 'idle' || hostStatus === '')) {
            console.log('[Auto-Host] Identity ready, initiating automatic start...');
            handleStartHosting();
        }
    }, [isAuthenticated, hostAccessKey, deviceId, devicePassword, isAutoHostEnabled]);

    useEffect(() => {
        checkAuth().finally(() => setLoading(false));

        if (!isElectron) return;

        // Listen for Google OAuth deep link success
        const unsubDeepLink = (window as any).electronAPI.onAuthDeepLinkSuccess?.(async (tokens: any) => {
            console.log('[Auth] Deep link success received in renderer');
            // Store tokens first so the API interceptor can use them
            await setAuth({ id: '', email: '', name: '', plan: 'FREE', avatar: null }, tokens.accessToken, tokens.refreshToken);
            // Then fetch real user data from /me
            checkAuth();
        });

        if (isElectron) {
            (window as any).electronAPI.getLocalIP().then(setLocalIP);
        }

        if (isElectron) {
            // Synchronize initial hosting status from main process
            (window as any).electronAPI.getHostStatus?.().then((res: any) => {
                if (res && res.status === 'status') {
                    console.log(`[Renderer] Syncing active host session: ${res.sessionId}`);
                    setHostSessionId(res.sessionId);
                    setHostStatus('status');
                }
            });
        }

        const removeHostListener = isElectron ? (window as any).electronAPI.onHostStatus((status: string) => {
            setHostMessage(status);
        }) : () => { };

        const removeSignalingListener = isElectron ? (window as any).electronAPI.onSignalingMessage(async (data: any) => {
            console.log(`[Renderer] Received signaling FROM MAIN: ${data.type}`);
            if (data.type === 'offer') {
                console.log('[Renderer] Handling OFFER from host...');
                const pc = new RTCPeerConnection({
                    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
                });
                pcRef.current = pc;

                pc.onicegatheringstatechange = () => {
                    console.log(`[Renderer] ICE Gathering State: ${pc.iceGatheringState}`);
                };

                pc.onconnectionstatechange = () => {
                    console.log(`[Renderer] Connection State: ${pc.connectionState}`);
                    if (pc.connectionState === 'connected') {
                        setViewerStatus('connected');
                        clearTimeout(connectionTimeout);
                    } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                        console.log('[Renderer] WebRTC connection dropped.');
                        setViewerStatus('connection_lost');
                        clearTimeout(connectionTimeout);
                    } else if (pc.connectionState === 'closed') {
                        clearTimeout(connectionTimeout);
                    }
                };

                const connectionTimeout = setTimeout(() => {
                    if (pc.connectionState !== 'connected' && pc.connectionState !== 'closed') {
                        console.warn('[Renderer] WebRTC Connection timeout (Viewer). Status:', pc.connectionState);
                        setViewerStatus('connection_lost');
                        pc.close();
                    }
                }, 30000); // 30s timeout for ICE/handshake to be safer

                pc.ontrack = (event) => {
                    console.log('[Renderer] Standard Video Track received!');
                    setRemoteStream(event.streams[0]);
                    if (viewerStatus !== 'streaming') setViewerStatus('streaming');
                };

                pc.onicecandidate = (event) => {
                    if (event.candidate) {
                        console.log(`[Renderer] Generated local ICE candidate: ${event.candidate.candidate.substring(0, 30)}...`);
                        if (isElectron) {
                            (window as any).electronAPI.sendSignalingMessage({
                                type: 'ice-candidate',
                                candidate: event.candidate.candidate,
                                sdpMid: event.candidate.sdpMid,
                                sdpMLineIndex: event.candidate.sdpMLineIndex,
                                targetId: sessionCode.replace(/\s/g, '')
                            });
                        }
                    }
                };

                pc.ondatachannel = (event) => {
                    const channel = event.channel;
                    console.log(`[Renderer] DataChannel received: ${channel.label}`);
                    if (channel.label === 'video') {
                        channel.binaryType = 'arraybuffer';
                        channel.onmessage = (msg: MessageEvent) => {
                            const data = new Uint8Array(msg.data);
                            if (Math.random() < 0.01) console.log(`[Renderer] DataChannel MSG: ${data.length} bytes`);
                            if (videoPlayerRef.current) {
                                videoPlayerRef.current.feed(data);
                            } else {
                                if (viewerStatus !== 'streaming') setViewerStatus('streaming');
                            }
                        };
                    } else if (channel.label === 'control') {
                        controlChannelRef.current = channel;

                        const sendKeyframeRequest = () => {
                            if (channel.readyState === 'open') {
                                console.log('[Renderer] Control DataChannel ACTIVE. Requesting keyframe...');
                                channel.send(JSON.stringify({ type: 'request-keyframe' }));
                            }
                        };

                        if (channel.readyState === 'open') {
                            sendKeyframeRequest();
                        } else {
                            channel.onopen = sendKeyframeRequest;
                        }

                        const clipboardInterval = setInterval(async () => {
                            if (viewerStatus === 'streaming' && channel.readyState === 'open') {
                                const text = await (window as any).electronAPI.clipboard.readText();
                                if (text && text !== lastClipboardRef.current) {
                                    lastClipboardRef.current = text;
                                    channel.send(JSON.stringify({ type: 'clipboard', text }));
                                }
                            }
                        }, 1000);

                        let viewerFileTransfers = new Map<string, { chunks: (Uint8Array | null)[], received: number, total: number }>();

                        channel.onmessage = (e) => {
                            try {
                                // 1. Handle Binary File Chunks
                                if (e.data instanceof ArrayBuffer || e.data instanceof Blob) {
                                    const blob = e.data instanceof Blob ? e.data : new Blob([e.data]);
                                    blob.arrayBuffer().then(buf => {
                                        const view = new DataView(buf, 0, 4);
                                        const headerLen = view.getUint32(0, true);
                                        const headerStr = new TextDecoder().decode(new Uint8Array(buf, 4, headerLen));
                                        const header = JSON.parse(headerStr);
                                        const chunk = new Uint8Array(buf, 4 + headerLen);

                                        if (header.type === 'file-chunk') {
                                            console.log(`[Diagnostic] File Download: Received chunk ${header.chunkIndex + 1}/${header.totalChunks} from host`);
                                            let transfer = viewerFileTransfers.get(header.name);
                                            if (!transfer) {
                                                transfer = { chunks: new Array(header.totalChunks).fill(null), received: 0, total: header.totalChunks };
                                                viewerFileTransfers.set(header.name, transfer);
                                            }

                                            if (!transfer.chunks[header.chunkIndex]) {
                                                transfer.chunks[header.chunkIndex] = chunk;
                                                transfer.received++;
                                            }

                                            if (transfer.received === transfer.total) {
                                                const totalSize = (transfer.chunks as Uint8Array[]).reduce((acc, c) => acc + c.length, 0);
                                                const finalBuffer = new Uint8Array(totalSize);
                                                let offset = 0;
                                                for (const c of (transfer.chunks as Uint8Array[])) {
                                                    finalBuffer.set(c, offset);
                                                    offset += c.length;
                                                }

                                                // Save locally on viewer machine
                                                if (isElectron) {
                                                    (window as any).electronAPI.saveFileLocally(header.name, finalBuffer).then((path: string) => {
                                                        setFileReceivedModal({ name: header.name, path, isRemote: false });
                                                        addNotification(`Received ${header.name} from host.`, 'system');
                                                    });
                                                }
                                                viewerFileTransfers.delete(header.name);
                                            }
                                        }
                                    });
                                    return;
                                }

                                // 2. Handle JSON Commands
                                const data = JSON.parse(e.data);
                                console.log(`[Diagnostic] Received DataChannel JSON:`, data);
                                if (data.type === 'clipboard' && data.text) {
                                    lastClipboardRef.current = data.text;
                                    if (isElectron) {
                                        (window as any).electronAPI.clipboard.writeText(data.text);
                                    }
                                } else if (data.type === 'file-sent') {
                                    // This is a confirmation of a file WE sent to the remote host
                                    setFileReceivedModal({ ...data, isRemote: true });
                                } else if (data.type === 'ping') {
                                    setLastPingTime(Date.now());
                                }
                            } catch (err) { }
                        };

                        channel.onopen = () => {
                            console.log('[Renderer] Control DataChannel ready. Requesting initial keyframe...');
                            channel.send(JSON.stringify({ type: 'request-keyframe' }));
                        };
                        channel.onclose = () => {
                            console.log('[Renderer] Control Channel closed.');
                            clearInterval(clipboardInterval);
                        };
                    }
                };

                try {
                    console.log('[Renderer] Setting remote description (Offer)...');
                    await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: data.sdp }));
                    console.log('[Renderer] Remote description set. Creating Answer...');
                    const answer = await pc.createAnswer();
                    console.log('[Renderer] Answer created. Setting local description...');
                    await pc.setLocalDescription(answer);
                    console.log('[Renderer] Local description set. Sending ANSWER to host...');

                    if (isElectron) {
                        (window as any).electronAPI.sendSignalingMessage({
                            type: 'answer',
                            sdp: answer.sdp,
                            targetId: sessionCode.replace(/\s/g, '')
                        });
                    }

                    console.log(`[Renderer] Draining ${candidatesBuffer.current.length} buffered candidates`);
                    candidatesBuffer.current.forEach(c => pc.addIceCandidate(c).catch(err => console.error('[Renderer] Add candidate error:', err)));
                    candidatesBuffer.current = [];
                } catch (e) {
                    console.error('[Renderer] Error in WebRTC handshake:', e);
                }

            } else if (data.type === 'ice-candidate') {
                console.log('[Renderer] Received ICE candidate from host');
                const cand: RTCIceCandidateInit = {
                    candidate: data.candidate,
                    sdpMid: data.sdpMid || data.mid,
                    sdpMLineIndex: data.sdpMLineIndex ?? 0
                };
                if (pcRef.current && pcRef.current.remoteDescription) {
                    pcRef.current.addIceCandidate(cand).catch(err => console.error('[Renderer] Add remote candidate error:', err));
                } else {
                    console.log('[Renderer] Buffering remote candidate (No remote description yet)');
                    candidatesBuffer.current.push(cand);
                }
            }
        }) : () => { };

        const removeSignalingDisconnected = isElectron ? (window as any).electronAPI.onSignalingDisconnected?.(() => {
            console.log('[Renderer] Signaling disconnected unexpectedly.');
            setViewerStatus('connection_lost');
        }) : null;

        return () => {
            if (isElectron) {
                if (unsubDeepLink) unsubDeepLink();
                removeHostListener();
                removeSignalingListener();
                if (removeSignalingDisconnected) removeSignalingDisconnected();
                pcRef.current?.close();
            }
        };
    }, [sessionCode, isElectron]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await storeLogin(email, password);
            setShowSplash(true);
            setTimeout(() => setShowSplash(false), 2000);
            localStorage.setItem('remote_link_server_ip', serverIP);
        } catch (err: any) {
            showError('Authentication Failed', err.response?.data?.error || `Could not establish secure link to ${serverIP}. Check your credentials and server status.`);
        } finally {
            setLoading(false);
        }
    };

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!signupName.trim()) { showError('Registration Failed', 'Display name is required.'); return; }
        setLoading(true);
        try {
            await storeRegister(signupName.trim(), email, password);
            setShowSplash(true);
            setTimeout(() => setShowSplash(false), 2000);
            localStorage.setItem('remote_link_server_ip', serverIP);
        } catch (err: any) {
            showError('Registration Failed', err.response?.data?.error || 'Could not create account. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = () => {
        const oauthUrl = `http://${serverIP}/api/auth/oauth/google?platform=desktop`;
        if (isElectron && (window as any).electronAPI?.openExternal) {
            (window as any).electronAPI.openExternal(oauthUrl);
        } else {
            window.location.href = oauthUrl;
        }
    };

    const copyAccessKey = () => {
        navigator.clipboard.writeText(hostAccessKey);
        // Simple visual feedback could go here
    };

    const handleStartHosting = async () => {
        if (isViewerWindow) {
            console.log('[Host-Guard] Blocked handleStartHosting in Viewer Window.');
            return;
        }
        setHostStatus('connecting');
        setHostError('');
        try {
            // 1. Get Auth Credentials
            const creds = isElectron ? await (window as any).electronAPI.getToken() : { token: accessToken };
            if (!creds?.token) throw new Error('Please sign in first');

            if (!hostAccessKey) {
                throw new Error('Permanent identity not loaded. Please wait or re-sign in.');
            }

            if (!devicePassword) {
                setShowSetPasswordModal(true);
                setHostStatus('idle');
                return;
            }
            if (!deviceId) {
                throw new Error('Please wait for your device identity to load or restart the app.');
            }

            // 2. Set/Sync Password
            localStorage.setItem('device_password', devicePassword);
            await api.post('/api/devices/set-password', { deviceId, password: devicePassword });

            // 3. Start Signaling with permanent Access Key
            if (!isElectron) {
                showError('Browser Limitation', 'Hosting features require the native desktop application.');
                setHostStatus('error');
                return;
            }
            const sessionId = await (window as any).electronAPI.startHosting(hostAccessKey);
            console.log(`[Host] Identity Registered with signaling: ${sessionId}`);

            if (!sessionId) throw new Error('Signaling server did not return a Session ID');

            setHostSessionId(sessionId);
            setHostStatus('status');

            // Instant UI Update: Mark our local device as online in the list
            setDevices(prev => prev.map(d =>
                d.access_key === hostAccessKey ? { ...d, is_online: true } : d
            ));

            addNotification('Broadcasting active.', 'host');

            // Update sidebar status immediately so it doesn't show "Offline"
            // Added a 1.5s retry to account for propagation delay across services/Redis
            await pollDevices();
            setTimeout(async () => {
                await pollDevices();
            }, 1500);

            // Persist hosting state
            setIsAutoHostEnabled(true);
            localStorage.setItem('is_auto_host_enabled', 'true');
        } catch (e: any) {
            console.error('[Host] Start failed:', e);
            setHostStatus('error');
            setHostError(e.message);
            addNotification(`Hosting failed: ${e.message}`, 'system');
        }
    };

    const handleStopHosting = async () => {
        try {
            if (isElectron) {
                await (window as any).electronAPI.stopHosting();
            }
            setHostStatus('idle');

            // Instant UI Update: Mark our local device as offline in the list
            setDevices(prev => prev.map(d =>
                d.access_key === hostAccessKey ? { ...d, is_online: false } : d
            ));

            addNotification('Broadcasting deactivated.', 'host');

            // Persist state
            setIsAutoHostEnabled(false);
            localStorage.setItem('is_auto_host_enabled', 'false');
        } catch (e: any) {
            console.error('[Host] Stop failed:', e);
        }
    };

    const handleFindDevice = async () => {
        if (!sessionCode) return;
        setViewerStatus('connecting');
        setViewerError('');
        try {
            const cleanKey = sessionCode.replace(/\s/g, '');
            const { data } = await api.get(`/api/devices/status?key=${cleanKey}`);
            if (!data.exists) throw new Error('Device not found. Check the access key.');
            if (!data.online) throw new Error('This machine is currently offline.');

            setViewerStep(2);
            setViewerStatus('idle');
        } catch (e: any) {
            setViewerStatus('error');
            setViewerError(e.message);
        }
    };

    const handleConnectToHost = async () => {
        if (!sessionCode || !accessPassword) return;
        setViewerStatus('connecting');
        setViewerError('');
        try {
            // 1. Verify Access and Get Token
            const { data: authData } = await api.post('/api/devices/verify-access', {
                accessKey: sessionCode.replace(/\s/g, ''),
                password: accessPassword
            });

            // 2. Connect to Signaling with One-Time Token
            if (isElectron) {
                await (window as any).electronAPI.connectToHost(sessionCode.replace(/\s/g, ''), serverIP, authData.token);
                setViewerStatus('connected');
            } else {
                showError('Browser Limitation', 'Remote viewer connections require the native desktop application.');
                setViewerStatus('error');
            }
        } catch (e: any) {
            setViewerStatus('error');
            setViewerError(e.message);
        }
    };

    const formatCode = (code: string) => {
        if (!code) return '';
        const clean = code.replace(/[^0-9]/g, '');
        if (clean.length === 9) {
            return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6, 9)}`;
        }
        return clean.match(/.{1,3}/g)?.join(' ') || clean;
    };

    // --- V8 ABSOLUTE PRIORITY ROUTING: Bypass EVERYTHING for Viewer Windows ---
    if (isViewerWindow || viewerStatus === 'streaming' || viewerStatus === 'connected' || viewerStatus === 'connection_lost') {
        return (
            <div className="h-screen bg-white flex flex-col relative overflow-hidden">
                {isViewerWindow && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[9999] px-6 py-2 bg-white rounded-full shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-6 duration-700">
                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                        <span className="text-[10px] font-black text-[#1C1C1C] uppercase tracking-[0.2em]">{windowDeviceName || 'SECURE LINK'}</span>
                    </div>
                )}
                {viewerStatus === 'connection_lost' && (
                    <div className="absolute inset-0 z-[100] bg-white/95 backdrop-blur-2xl flex flex-col items-center justify-center animate-in fade-in duration-700">
                        <div className="w-24 h-24 bg-red-50 rounded-[32px] flex items-center justify-center mb-8 border border-red-100 shadow-2xl">
                            <MonitorOff className="text-red-500 w-10 h-10" />
                        </div>
                        <h2 className="text-4xl font-black text-[#1C1C1C] mb-4 uppercase tracking-tighter">Connection Fault</h2>
                        <p className="text-[10px] text-[rgba(28,28,28,0.4)] mb-12 tracking-[0.2em] font-black uppercase">The remote node has severed the secure link</p>
                        <div className="flex gap-4">
                            <button
                                onClick={isViewerWindow ? () => window.close() : handleDisconnect}
                                className="snow-btn-secondary !px-12"
                            >
                                TERMINATE
                            </button>
                            <button
                                onClick={() => handleFindDevice()}
                                className="snow-btn !px-12"
                            >
                                RE-ESTABLISH
                            </button>
                        </div>
                    </div>
                )}

                <div className="flex-grow flex flex-col min-h-0">
                    <VideoPlayer
                        ref={videoPlayerRef}
                        viewerStatus={viewerStatus}
                        setViewerStatus={setViewerStatus}
                        sessionCode={sessionCode}
                        onDisconnect={isViewerWindow ? () => window.close() : handleDisconnect}
                        remoteStream={remoteStream}
                        deviceType={isViewerWindow ? 'desktop' : selectedDevice?.device_type}
                        deviceName={isViewerWindow ? windowDeviceName : (selectedDevice?.device_name || 'Remote Node')}
                        onControlEvent={(event: any) => {
                            if (controlChannelRef.current?.readyState !== 'open') {
                                console.warn('[Viewer] Control channel not open yet. Event ignored.');
                                return;
                            }

                            if (event instanceof Uint8Array) {
                                (controlChannelRef.current as any).send(event);
                            } else if (event.type === 'mousemove') {
                                throttledMouseMove(event);
                            } else {
                                controlChannelRef.current.send(JSON.stringify(event));
                            }
                        }}
                        controlChannelRef={controlChannelRef}
                    />
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <div className="h-screen w-full flex overflow-hidden bg-white font-inter select-none">
                <SnowSplashScreen isReady={!loading} />
                {/* LEFT — Branded Input Panel */}
                <div className="flex-1 flex flex-col items-center justify-center px-12 lg:px-20 py-12 animate-in fade-in slide-in-from-left-8 duration-700 overflow-y-auto">
                    <div className="w-full max-w-sm">
                        {/* Logo */}
                        <div className="flex items-center gap-3 mb-10 group cursor-default">
                            <div className="w-14 h-14 rounded-2xl bg-[#1C1C1C] flex items-center justify-center shadow-xl shadow-black/10 group-hover:scale-105 transition-transform duration-300 overflow-hidden border border-white/5">
                                <img src={logo} alt="SyncLink" className="w-10 h-10 object-contain" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xl font-bold text-[#1C1C1C] tracking-tighter leading-none">SyncLink</span>
                                <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[rgba(28,28,28,0.2)] mt-1">Desktop Auth</span>
                            </div>
                        </div>

                        {/* Auth Mode Tabs */}
                        <div className="flex bg-[#F8F9FA] rounded-2xl p-1 mb-8 border border-[rgba(28,28,28,0.04)]">
                            {(['login', 'signup'] as const).map(mode => (
                                <button
                                    key={mode}
                                    type="button"
                                    onClick={() => { setAuthMode(mode); setEmail(''); setPassword(''); setSignupName(''); }}
                                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${authMode === mode ? 'bg-white text-[#1C1C1C] shadow-sm' : 'text-[rgba(28,28,28,0.3)] hover:text-[rgba(28,28,28,0.6)]'}`}
                                >
                                    {mode === 'login' ? 'Sign In' : 'Create Account'}
                                </button>
                            ))}
                        </div>

                        <h1 className="text-3xl font-extrabold text-[#1C1C1C] tracking-tight mb-2">
                            {authMode === 'login' ? 'Welcome Back' : 'Get Started'}
                        </h1>
                        <p className="text-sm font-medium text-[rgba(28,28,28,0.4)] mb-8 leading-relaxed">
                            {authMode === 'login' ? 'Enter your credentials to access your secure network.' : 'Create a free account to join the SyncLink mesh.'}
                        </p>

                        {/* Google Button */}
                        <button
                            type="button"
                            onClick={handleGoogleLogin}
                            className="w-full flex items-center justify-center gap-3 bg-white border border-[rgba(28,28,28,0.08)] text-[#1C1C1C] hover:bg-[#F8F9FA] hover:border-[rgba(28,28,28,0.2)] transition-all py-3.5 rounded-2xl text-sm font-semibold group shadow-sm active:scale-[0.99] mb-6"
                        >
                            <svg className="w-5 h-5 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                            </svg>
                            {authMode === 'login' ? 'Continue with Google' : 'Sign up with Google'}
                        </button>

                        <div className="relative flex items-center justify-center mb-6">
                            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[rgba(28,28,28,0.06)]" /></div>
                            <span className="relative z-10 bg-white px-4 text-[10px] text-[rgba(28,28,28,0.2)] uppercase tracking-widest font-bold">or with email</span>
                        </div>

                        <form onSubmit={authMode === 'login' ? handleLogin : handleSignup} className="space-y-4">
                            {authMode === 'signup' && (
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-[rgba(28,28,28,0.4)] uppercase tracking-wider block ml-1">Display Name</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-4 flex items-center text-[rgba(28,28,28,0.2)] group-focus-within:text-[#1C1C1C] transition-colors">
                                            <User size={16} />
                                        </div>
                                        <input
                                            type="text"
                                            required
                                            className="w-full bg-[#F8F9FA] border border-[rgba(28,28,28,0.06)] text-[#1C1C1C] rounded-[18px] pl-12 pr-4 py-3.5 text-sm font-medium focus:bg-white focus:border-[rgba(28,28,28,0.2)] focus:ring-4 focus:ring-black/5 outline-none transition-all placeholder:text-[rgba(28,28,28,0.2)]"
                                            value={signupName}
                                            placeholder="Your name"
                                            onChange={(e) => setSignupName(e.target.value)}
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-[rgba(28,28,28,0.4)] uppercase tracking-wider block ml-1">Email Address</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-4 flex items-center text-[rgba(28,28,28,0.2)] group-focus-within:text-[#1C1C1C] transition-colors">
                                        <Mail size={16} />
                                    </div>
                                    <input
                                        type="email"
                                        required
                                        className="w-full bg-[#F8F9FA] border border-[rgba(28,28,28,0.06)] text-[#1C1C1C] rounded-[18px] pl-12 pr-4 py-3.5 text-sm font-medium focus:bg-white focus:border-[rgba(28,28,28,0.2)] focus:ring-4 focus:ring-black/5 outline-none transition-all placeholder:text-[rgba(28,28,28,0.2)]"
                                        value={email}
                                        placeholder="name@company.com"
                                        onChange={(e) => setEmail(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between ml-1">
                                    <label className="text-[11px] font-bold text-[rgba(28,28,28,0.4)] uppercase tracking-wider">Password</label>
                                    {authMode === 'login' && <button type="button" className="text-[10px] font-bold text-blue-600 hover:opacity-80 transition-opacity">Forgot?</button>}
                                </div>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-4 flex items-center text-[rgba(28,28,28,0.2)] group-focus-within:text-[#1C1C1C] transition-colors">
                                        <Lock size={16} />
                                    </div>
                                    <input
                                        type={showLoginPassword ? "text" : "password"}
                                        required
                                        className="w-full bg-[#F8F9FA] border border-[rgba(28,28,28,0.06)] text-[#1C1C1C] rounded-[18px] pl-12 pr-12 py-3.5 text-sm font-medium focus:bg-white focus:border-[rgba(28,28,28,0.2)] focus:ring-4 focus:ring-black/5 outline-none transition-all placeholder:text-[rgba(28,28,28,0.2)]"
                                        value={password}
                                        placeholder="••••••••"
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                    <button type="button" onClick={() => setShowLoginPassword(!showLoginPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[rgba(28,28,28,0.2)] hover:text-[#1C1C1C] transition-colors">
                                        {showLoginPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <button type="submit" disabled={loading} className="w-full py-4 bg-[#1C1C1C] text-white rounded-2xl font-bold text-sm shadow-xl shadow-black/10 hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-50">
                                {loading ? <RefreshCw size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                                {authMode === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'}
                            </button>

                            <div className="pt-2 flex flex-col items-center gap-4">
                                <button
                                    type="button"
                                    onClick={() => setShowSettings(!showSettings)}
                                    className="flex items-center gap-2 text-[10px] font-bold text-[rgba(28,28,28,0.3)] hover:text-[#1C1C1C] uppercase tracking-widest transition-colors"
                                >
                                    <Settings size={12} /> signaling server configuration
                                </button>

                                {showSettings && (
                                    <div className="w-full p-5 bg-[#F9F9FA] rounded-2xl border border-[rgba(28,28,28,0.04)] space-y-4 animate-in slide-in-from-top-4 duration-300">
                                        <div className="space-y-2">
                                            <span className="text-[9px] font-black text-[rgba(28,28,28,0.3)] uppercase tracking-[0.2em] ml-1">Current Node IP</span>
                                            <input
                                                type="text"
                                                className="w-full bg-white border border-[rgba(28,28,28,0.06)] rounded-xl px-4 py-2.5 text-xs font-mono font-bold text-[#1C1C1C] outline-none"
                                                value={serverIP}
                                                onChange={(e) => setServerIP(e.target.value)}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between px-1">
                                            <span className="text-[10px] font-bold text-[rgba(28,28,28,0.2)] uppercase">Interface Detect</span>
                                            <span className="text-[10px] font-mono font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{localIP}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </form>

                    </div>

                    <div className="mt-8 text-[10px] font-bold text-[rgba(28,28,28,0.2)] uppercase tracking-[0.3em]">
                        Team Zain • SyncLink Engine v1.0
                    </div>
                </div>

                {/* RIGHT — High Contrast Brand Panel */}
                <div className="w-[45%] bg-[#1C1C1C] relative flex flex-col items-center justify-center p-20 overflow-hidden animate-in fade-in slide-in-from-right-8 duration-1000">
                    {/* Abstract Visual Elements */}
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/10 blur-[120px] rounded-full -mr-32 -mt-32" />
                    <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-white/5 blur-[100px] rounded-full -ml-32 -mb-32" />

                    <div className="relative z-10 flex flex-col items-center text-center">
                        <div className="w-24 h-24 rounded-[32px] bg-white text-[#1C1C1C] flex items-center justify-center shadow-2xl shadow-black/40 mb-10 group hover:rotate-6 transition-transform duration-500">
                            <Link size={48} />
                        </div>

                        <h2 className="text-5xl font-extrabold text-white tracking-tighter mb-4 leading-tight">
                            Secure Mesh<br />Connectivity.
                        </h2>
                        <p className="text-white/40 text-lg font-medium max-w-sm leading-relaxed mb-12">
                            Unifying cross-platform nodes with hardware-level security and ultra-low latency.
                        </p>

                        <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
                            {[
                                { label: 'E2EE Setup', icon: ShieldCheck },
                                { label: 'P2P Relay', icon: Radio },
                                { label: 'Zero Trust', icon: Shield },
                                { label: 'Cross Node', icon: LayoutGrid }
                            ].map((feat, idx) => (
                                <div key={idx} className="p-4 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-sm flex flex-col items-start gap-3 hover:bg-white/10 hover:border-white/10 transition-all cursor-default">
                                    <feat.icon size={18} className="text-white/80" />
                                    <span className="text-[10px] font-bold text-white uppercase tracking-widest">{feat.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Decorative Floor */}
                    <div className="absolute bottom-0 inset-x-0 h-1/2 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
                </div>
            </div>
        );
    }


    return (
        <div className="h-screen w-full bg-[#F8F9FA] text-[#1C1C1C] flex overflow-hidden font-inter selection:bg-blue-500/20 select-none">
            <SnowSplashScreen isReady={!loading} />

            {/* THEATER MODE VIEWER (Standard or Dedicated Window) */}
            {isViewerWindow && (
                <div className="fixed inset-0 z-[500] bg-black">
                    <VideoPlayer
                        ref={videoPlayerRef}
                        viewerStatus={viewerStatus}
                        setViewerStatus={setViewerStatus}
                        sessionCode={sessionCode}
                        onDisconnect={() => {
                            handleDisconnect();
                            if (isViewerWindow) window.close();
                        }}
                        onControlEvent={onControlEvent}
                        remoteStream={remoteStream}
                        deviceType={windowDeviceName.includes('iPhone') || windowDeviceName.includes('Android') ? 'mobile' : 'desktop'}
                        deviceName={windowDeviceName}
                        controlChannelRef={controlChannelRef}
                    />
                </div>
            )}

            {globalError && (
                <div className="fixed top-0 left-0 right-0 bg-red-500 text-white text-center py-3 text-xs font-bold z-[50] flex justify-between px-6 items-center shadow-lg">
                    <span>{globalError}</span>
                    <button onClick={() => setGlobalError('')} className="bg-white/20 p-1 rounded-md hover:bg-white/30 transition-colors"><X className="w-4 h-4" /></button>
                </div>
            )}

            {/* --- SNOW UI SIDEBAR NAV --- */}
            <SnowSidebar
                currentView={currentView}
                selectedDevice={selectedDevice}
                setCurrentView={(v) => { setCurrentView(v); setIsSidebarOpen(false); }}
                setSelectedDevice={setSelectedDevice}
                handleLogout={() => {
                    storeLogout();
                    setAuth({} as any, '', '');
                }}
                user={user}
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
            />

            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/20 backdrop-blur-sm z-20 md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            <div className={`flex-1 flex overflow-hidden transition-all duration-300 relative ${isAuthenticated ? 'md:ml-[212px]' : ''}`}>
                <main className="flex-1 flex flex-col overflow-hidden relative bg-white">
                    {/* Workspace Header - Re-structured for Breadcrumbs */}
                    <header className="h-[64px] flex items-center justify-between px-4 md:px-8 flex-shrink-0 z-10 w-full bg-[#F8F9FA]/60 backdrop-blur-md border-b border-[rgba(28,28,28,0.04)]">
                        <div className="flex items-center gap-4">
                            {/* Mobile Menu Toggle */}
                            <button
                                onClick={() => setIsSidebarOpen(true)}
                                className="p-2 md:hidden hover:bg-[rgba(28,28,28,0.05)] rounded-lg transition-colors"
                            >
                                <LayoutGrid size={20} className="text-[#1C1C1C]" />
                            </button>

                            <div className="flex flex-col gap-0.5 md:gap-1.5">
                                <div className="flex items-center gap-1.5 text-[9px] md:text-[10px] font-bold text-[rgba(28,28,28,0.2)] uppercase tracking-widest">
                                    <span className="hover:text-[rgba(28,28,28,0.4)] cursor-pointer transition-colors hidden sm:inline" onClick={() => setCurrentView('dashboard')}>SyncLink Nodes</span>
                                    <span className="opacity-50 hidden sm:inline">/</span>
                                    <span className="text-[rgba(28,28,28,0.6)]">{selectedDevice ? 'Terminal' : currentView === 'host' ? 'Host' : currentView}</span>
                                </div>
                                <h1 className="text-lg md:text-2xl font-bold text-[#1C1C1C] tracking-tight capitalize truncate max-w-[120px] md:max-w-none">
                                    {selectedDevice ? selectedDevice.device_name : currentView === 'host' ? 'Host This Device' : currentView}
                                </h1>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 md:gap-6">
                            <div className="hidden sm:flex items-center bg-white rounded-xl border border-[rgba(28,28,28,0.06)] pl-4 pr-1 py-1 shadow-sm focus-within:ring-2 focus-within:ring-blue-100 transition-all w-48 md:w-64 h-9">
                                <Search className="w-3.5 h-3.5 text-[rgba(28,28,28,0.2)] mr-2" />
                                <input
                                    type="text"
                                    placeholder="Search nodes..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="bg-transparent text-[11px] font-medium text-[#1C1C1C] outline-none w-full placeholder:text-[rgba(28,28,28,0.2)]"
                                />
                            </div>

                            <div className="flex items-center gap-2 md:gap-4">
                                <button onClick={pollDevices} className="p-2 text-[rgba(28,28,28,0.4)] hover:text-[#1C1C1C] transition-colors" title="Refresh Sync">
                                    <RefreshCw className="w-4 h-4" />
                                </button>
                                <div className="w-8 h-8 rounded-xl bg-[rgba(28,28,28,0.04)] border border-[rgba(0,0,0,0.04)] flex items-center justify-center text-[10px] font-bold text-[#1C1C1C]">ZB</div>

                                {/* Right Bar Toggle for Tablet/Smaller */}
                                <button
                                    onClick={() => setIsRightBarOpen(!isRightBarOpen)}
                                    className="p-2 xl:hidden hover:bg-[rgba(28,28,28,0.05)] rounded-lg transition-colors"
                                >
                                    <Activity size={20} className={isRightBarOpen ? 'text-blue-600' : 'text-[#1C1C1C]'} />
                                </button>
                            </div>
                        </div>
                    </header>

                    <div className="flex-1 overflow-y-auto custom-scrollbar px-8 pb-8">
                        {selectedDevice ? (
                            /* --- INDIVIDUAL DEVICE PREVIEW VIEW --- */
                            <div className="max-w-4xl mx-auto min-h-full py-12 flex flex-col items-center justify-center animate-in fade-in slide-in-from-bottom-8 duration-500 font-inter">
                                <div className="relative mb-6">
                                    <div className="w-32 h-32 rounded-[32px] flex items-center justify-center shadow-lg bg-[#1C1C1C]">
                                        {selectedDevice.device_type?.toLowerCase() === 'ios' || selectedDevice.device_type?.toLowerCase() === 'android' ?
                                            <Smartphone className="text-white w-14 h-14" /> :
                                            <Monitor className="text-white w-14 h-14" />
                                        }
                                    </div>
                                    <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-[#71DD8C] rounded-full border-4 border-[#F8F9FA]" />
                                </div>

                                <h2 className="text-3xl font-extrabold text-[#1C1C1C] tracking-tight mb-2 uppercase">{selectedDevice.device_name}</h2>
                                <div className="flex items-center gap-3 text-[rgba(28,28,28,0.4)] text-[11px] font-bold mb-10 tracking-widest uppercase">
                                    <span className="bg-[rgba(28,28,28,0.05)] px-2 py-1 rounded-lg font-mono text-[#1C1C1C]">#{selectedDevice.access_key}</span>
                                    <div className="w-1.5 h-1.5 rounded-full bg-[rgba(28,28,28,0.1)]" />
                                    <span>Secure Link Ready</span>
                                </div>

                                <div className="flex gap-4 w-full max-w-sm">
                                    <button
                                        onClick={() => setSelectedDevice(null)}
                                        className="flex-1 py-3.5 rounded-2xl font-bold text-[11px] uppercase tracking-widest text-[rgba(28,28,28,0.4)] hover:text-[#1C1C1C] bg-white border border-[rgba(28,28,28,0.06)] hover:border-[rgba(28,28,28,0.2)] transition shadow-sm"
                                    >
                                        Go Back
                                    </button>
                                    <button
                                        onClick={() => handleDeviceClick(selectedDevice)}
                                        disabled={viewerStatus === 'connecting'}
                                        className="flex-1 py-3.5 rounded-2xl font-bold text-[11px] uppercase tracking-widest text-white bg-[#1C1C1C] shadow-lg shadow-black/10 flex items-center justify-center gap-2 transition active:scale-[0.98]"
                                    >
                                        {viewerStatus === 'connecting' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <>Establish Link <Zap size={14} /></>}
                                    </button>
                                </div>
                            </div>
                        ) : currentView === 'dashboard' ? (
                            /* --- SNOW UI DASHBOARD VIEW --- */
                            <div className="w-full animate-in fade-in duration-700">
                                <SnowDashboard devices={devices} activeSessionCount={activeSessionCount} />
                            </div>
                        ) : currentView === 'host' ? (
                            /* --- HOST THIS DEVICE VIEW --- */
                            <div className="w-full pt-4 animate-in fade-in duration-700">
                                <SnowHost
                                    status={hostStatus}
                                    accessKey={hostAccessKey}
                                    isAutoHost={isAutoHostEnabled}
                                    setIsAutoHost={(val) => {
                                        setIsAutoHostEnabled(val);
                                        localStorage.setItem('is_auto_host_enabled', String(val));
                                    }}
                                    handleStartHosting={handleStartHosting}
                                    handleStopHosting={handleStopHosting}
                                    copyAccessKey={copyAccessKey}
                                    openPasswordModal={() => setActionModal({ type: 'password', device: null })}
                                    bandwidth={hostStats.bandwidth}
                                    activeUsers={hostStats.activeUsers}
                                />
                            </div>
                        ) : currentView === 'billing' ? (
                            /* --- BILLING VIEW --- */
                            <div className="w-full pt-4 animate-in fade-in duration-700">
                                <SnowBilling user={user} currentPlan={currentPlan} onUpgrade={fetchBillingInfo} invoices={[]} />
                            </div>
                        ) : currentView === 'documentation' ? (
                            /* --- SNOW UI DOCUMENTATION VIEW --- */
                            <div className="w-full h-full animate-in fade-in duration-700">
                                <SnowDocumentation onNavigateToSupport={() => setCurrentView('support')} />
                            </div>
                        ) : currentView === 'profile' ? (
                            /* --- SNOW UI PROFILE VIEW --- */
                            <div className="w-full h-full pt-8 animate-in fade-in duration-700 px-8">
                                <SnowProfile user={user} logout={storeLogout} />
                            </div>
                        ) : currentView === 'support' ? (
                            /* --- SNOW UI SUPPORT VIEW --- */
                            <div className="w-full h-full pt-8 animate-in fade-in duration-700 px-8">
                                <SnowSupport />
                            </div>
                        ) : currentView === 'devices' ? (
                            /* --- SNOW UI DEVICES VIEW --- */
                            <div className="w-full h-full animate-in fade-in duration-700 pt-2">
                                <SnowDevices
                                    devices={devices}
                                    searchQuery={searchQuery}
                                    setSearchQuery={setSearchQuery}
                                    setSelectedDevice={setSelectedDevice}
                                    handleDeviceClick={handleDeviceClick}
                                    setActionModal={setActionModal}
                                    setShowAddModal={setShowAddModal}
                                    handleBulkDelete={handleBulkDelete}
                                />
                            </div>
                        ) : currentView === 'settings' ? (
                            /* --- SETTINGS VIEW --- */
                            <div className="w-full pt-2 animate-in fade-in duration-500">
                                <SnowSettings
                                    serverIP={serverIP}
                                    isAutoHostEnabled={isAutoHostEnabled}
                                    setIsAutoHostEnabled={(val) => {
                                        setIsAutoHostEnabled(val);
                                        localStorage.setItem('is_auto_host_enabled', String(val));
                                    }}
                                    onRenameNode={() => setActionModal({ type: 'rename', device: null })}
                                />
                            </div>
                        ) : null}
                    </div>
                </main>

                {/* --- SNOW UI RIGHT SIDEBAR --- */}
                <SnowRightBar
                    devices={devices}
                    notifications={notifications}
                    onDeviceClick={(dev) => { setSelectedDevice(dev); setCurrentView('devices'); setIsRightBarOpen(false); }}
                    isOpen={isRightBarOpen}
                    onClose={() => setIsRightBarOpen(false)}
                />
            </div>

            {/* MODALS LAYER */}

            {/* Set Password Before Hosting Modal */}
            {showSetPasswordModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-[#1C1C1C]/20 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="w-full max-w-sm bg-white p-8 rounded-[28px] shadow-2xl border border-[rgba(28,28,28,0.06)] animate-in zoom-in-95 duration-300">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-orange-50 rounded-2xl flex items-center justify-center"><Shield size={18} className="text-orange-500" /></div>
                                <div>
                                    <h3 className="text-sm font-bold text-[#1C1C1C]">Set Access Password</h3>
                                    <p className="text-[10px] text-[rgba(28,28,28,0.4)]">Required before this device can host</p>
                                </div>
                            </div>
                            <button onClick={() => { setShowSetPasswordModal(false); setSetupPassword(''); setSetupPasswordConfirm(''); setSetupPasswordError(''); }} className="p-2 text-[rgba(28,28,28,0.2)] hover:text-[#1C1C1C] rounded-xl hover:bg-[#F9F9FA] transition-colors"><X className="w-4 h-4" /></button>
                        </div>
                        <p className="text-xs text-[rgba(28,28,28,0.5)] mb-5 leading-relaxed">Viewers will need this password to connect to your device. Choose something secure.</p>
                        <div className="space-y-3 mb-5">
                            <input
                                type="password"
                                placeholder="Create password"
                                value={setupPassword}
                                onChange={e => { setSetupPassword(e.target.value); setSetupPasswordError(''); }}
                                className="w-full px-4 py-3 bg-[#F9F9FA] rounded-2xl border border-[rgba(28,28,28,0.06)] text-sm text-[#1C1C1C] font-mono outline-none"
                                autoFocus
                            />
                            <input
                                type="password"
                                placeholder="Confirm password"
                                value={setupPasswordConfirm}
                                onChange={e => { setSetupPasswordConfirm(e.target.value); setSetupPasswordError(''); }}
                                className="w-full px-4 py-3 bg-[#F9F9FA] rounded-2xl border border-[rgba(28,28,28,0.06)] text-sm text-[#1C1C1C] font-mono outline-none"
                            />
                            {setupPasswordError && (
                                <p className="text-[11px] text-red-500 font-medium px-1">{setupPasswordError}</p>
                            )}
                        </div>
                        <button
                            onClick={() => {
                                if (!setupPassword) { setSetupPasswordError('Please enter a password.'); return; }
                                if (setupPassword.length < 4) { setSetupPasswordError('Password must be at least 4 characters.'); return; }
                                if (setupPassword !== setupPasswordConfirm) { setSetupPasswordError('Passwords do not match.'); return; }
                                setDevicePassword(setupPassword);
                                localStorage.setItem('device_password', setupPassword);
                                setShowSetPasswordModal(false);
                                setSetupPassword('');
                                setSetupPasswordConfirm('');
                                setSetupPasswordError('');
                                setTimeout(() => handleStartHosting(), 100);
                            }}
                            disabled={!setupPassword || !setupPasswordConfirm}
                            className="w-full py-3.5 bg-[#1C1C1C] text-white rounded-2xl text-sm font-bold disabled:opacity-40 hover:opacity-90 transition-all"
                        >
                            Set Password & Start Hosting
                        </button>
                    </div>
                </div>
            )}

            {/* Password Prompt Modal */}
            {showPasswordPrompt && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-[#1C1C1C]/20 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="w-full max-w-md bg-white p-8 rounded-[24px] shadow-2xl border border-[rgba(28,28,28,0.06)] animate-in zoom-in-95 duration-300">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-xl font-bold text-[#1C1C1C] tracking-tight uppercase">Authentication Required</h3>
                            <button onClick={() => setShowPasswordPrompt(null)} className="p-2 text-[rgba(28,28,28,0.2)] hover:text-[#1C1C1C] hover:bg-[#F8F9FA] rounded-xl transition-colors"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="relative mb-8">
                            <input
                                type={showPromptPassword ? "text" : "password"}
                                placeholder="Network Hardware Key"
                                value={promptPassword}
                                onChange={e => setPromptPassword(e.target.value)}
                                className="purity-input font-mono text-center text-2xl tracking-[0.2em] pr-12"
                                autoFocus
                            />
                            <button onClick={() => setShowPromptPassword(!showPromptPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[rgba(28,28,28,0.2)] hover:text-[#1C1C1C] transition-colors">
                                {showPromptPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                        <label className="flex items-center gap-3 cursor-pointer mb-8 p-4 rounded-2xl bg-[#F8F9FA] border border-[rgba(28,28,28,0.04)] hover:border-[rgba(28,28,28,0.1)] transition-all">
                            <input type="checkbox" checked={promptRemember} onChange={e => setPromptRemember(e.target.checked)} className="w-4 h-4 rounded border-[rgba(28,28,28,0.2)] text-[#1C1C1C] focus:ring-[#1C1C1C]" />
                            <span className="text-xs font-bold text-[rgba(28,28,28,0.4)] uppercase tracking-widest">Remember this machine</span>
                        </label>
                        <button onClick={submitPasswordPrompt} disabled={!promptPassword || viewerStatus === 'connecting'} className="snow-btn w-full">ESTABLISH SECURE LINK</button>
                    </div>
                </div>
            )}

            {/* Add Device Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-[#1C1C1C]/20 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="w-full max-w-md bg-white p-8 rounded-[24px] shadow-2xl border border-[rgba(28,28,28,0.06)] animate-in zoom-in-95 duration-300">
                        <div className="flex justify-between items-center mb-8">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-[#F8F9FA] rounded-[18px] flex items-center justify-center text-[#1C1C1C] shadow-sm border border-[rgba(28,28,28,0.04)]">
                                    <Plus className="w-6 h-6" />
                                </div>
                                <h3 className="text-lg font-bold text-[#1C1C1C] tracking-tight uppercase">Import Node</h3>
                            </div>
                            <button onClick={() => setShowAddModal(false)} className="p-2 text-[rgba(28,28,28,0.2)] hover:text-[#1C1C1C] hover:bg-[#F8F9FA] rounded-xl transition-colors"><X className="w-5 h-5" /></button>
                        </div>

                        <div className="space-y-6 mb-10">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-[rgba(28,28,28,0.4)] uppercase tracking-[0.2em] ml-1">Network ID</label>
                                <input type="text" placeholder="000 000 000" value={addKey} onChange={e => setAddKey(formatCode(e.target.value))} className="purity-input font-mono text-center tracking-[0.2em]" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-[rgba(28,28,28,0.4)] uppercase tracking-[0.2em] ml-1">Security Token</label>
                                <div className="relative">
                                    <input type={showAddPassword ? "text" : "password"} placeholder="••••••••" value={addPassword} onChange={e => setAddPassword(e.target.value)} className="purity-input font-mono text-center pr-12" />
                                    <button onClick={() => setShowAddPassword(!showAddPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[rgba(28,28,28,0.2)] hover:text-[#1C1C1C] transition-colors">
                                        {showAddPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                        </div>
                        <button onClick={handleAddDevice} disabled={!addKey || !addPassword} className="snow-btn w-full disabled:opacity-50 tracking-widest">ADD TO MESH NETWORK</button>
                    </div>
                </div>
            )}

            {/* Device Action Modal */}
            {actionModal && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-[#1C1C1C]/20 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="w-full max-w-sm bg-white p-8 rounded-[24px] shadow-2xl border border-[rgba(28,28,28,0.06)] animate-in zoom-in-95 duration-300">
                        <div className="mb-8 text-center">
                            <h3 className="text-xl font-black text-[#1C1C1C] mb-2 tracking-tight uppercase">
                                {actionModal.type === 'rename' ? 'Modify Identity' :
                                    actionModal.type === 'password' ? 'Hardware Key' :
                                        actionModal.type === 'remove' ? 'Sever Connection' : ''}
                            </h3>
                            <p className="text-[10px] font-bold text-[rgba(28,28,28,0.4)] leading-relaxed uppercase tracking-[0.2em]">
                                {actionModal.type === 'rename' ? 'Set a persistent nickname for this machine.' :
                                    actionModal.type === 'password' ? 'Update the hardware access credentials.' :
                                        actionModal.type === 'remove' ? `Unlink ${actionModal.device.device_name} from your account?` : ''}
                            </p>
                        </div>

                        {(actionModal.type === 'rename' || actionModal.type === 'password') && (
                            <div className="space-y-4">
                                <input
                                    autoFocus
                                    type={actionModal.type === 'password' ? 'password' : 'text'}
                                    placeholder={actionModal.type === 'password' ? 'Secure Crypt Key' : 'e.g. Workstation Alpha'}
                                    className="purity-input w-full font-mono text-center tracking-widest"
                                    value={actionValue}
                                    onChange={e => setActionValue(e.target.value)}
                                />
                            </div>
                        )}

                        <div className="flex gap-4">
                            <button
                                onClick={() => setActionModal(null)}
                                className="snow-btn-secondary flex-1 uppercase text-[10px] font-black tracking-widest"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    if (actionModal.type === 'rename') handleRename(actionModal.device);
                                    if (actionModal.type === 'remove') handleRemove(actionModal.device);
                                    if (actionModal.type === 'password') handleSetPassword(actionModal.device);
                                }}
                                className={`snow-btn flex-1 uppercase text-[10px] font-black tracking-widest ${actionModal.type === 'remove' ? 'bg-red-600 hover:bg-red-700 !shadow-none' : ''}`}
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Profile/Billing Modal */}
            {showBillingModal && (
                <div className="fixed inset-0 z-[200] bg-[#1C1C1C]/20 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in" onClick={() => setShowBillingModal(false)}>
                    <div className="bg-white shadow-2xl rounded-[32px] p-10 w-[800px] max-w-full max-h-[90vh] overflow-y-auto custom-scrollbar relative border border-[rgba(28,28,28,0.06)]" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-start mb-12 border-b border-[rgba(28,28,28,0.06)] pb-8">
                            <div className="flex items-center gap-6">
                                <div className="w-16 h-16 bg-[#F8F9FA] rounded-[24px] flex items-center justify-center text-[#1C1C1C] border border-[rgba(28,28,28,0.08)]">
                                    <CreditCard className="w-8 h-8" />
                                </div>
                                <div>
                                    <h3 className="text-3xl font-black text-[#1C1C1C] tracking-tighter uppercase">Cloud Topology</h3>
                                    <div className="flex items-center gap-3 mt-2">
                                        <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-widest border border-blue-100/50">{currentPlan?.plan || 'Global Basic'}</span>
                                        <span className="text-[10px] font-bold text-[rgba(28,28,28,0.2)] uppercase tracking-widest">System Service Plan</span>
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => setShowBillingModal(false)} className="p-2 text-[rgba(28,28,28,0.2)] hover:text-[#1C1C1C] hover:bg-[#F8F9FA] rounded-[14px] transition-all">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {billingLoading && !billingPlans.length ? (
                            <div className="py-20 flex justify-center"><RefreshCw className="w-10 h-10 animate-spin text-[#1C1C1C]/10" /></div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {billingPlans.map((plan: any) => (
                                    <div key={plan.name} className={`p-8 rounded-[28px] border transition-all duration-300 ${currentPlan?.plan === plan.name ? 'bg-blue-50/20 border-blue-100 shadow-sm' : 'bg-white border-[rgba(28,28,28,0.06)] hover:border-[rgba(28,28,28,0.2)] hover:shadow-xl hover:shadow-black/5'}`}>
                                        <div className="flex justify-between items-center mb-6">
                                            <h4 className="font-bold text-[#1C1C1C] text-lg uppercase tracking-tight">{plan.name}</h4>
                                            <span className="text-3xl font-black text-[#1C1C1C]">${plan.price}</span>
                                        </div>
                                        <ul className="text-[11px] space-y-4 mb-10 text-[rgba(28,28,28,0.5)] font-bold uppercase tracking-widest">
                                            {plan.features.map((f: string, i: number) => <li key={i} className="flex items-start gap-3"><Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> {f}</li>)}
                                        </ul>
                                        <button
                                            onClick={() => handleSubscribe(plan.name)}
                                            disabled={currentPlan?.plan === plan.name || billingLoading}
                                            className={`w-full py-4 rounded-none text-[10px] font-black uppercase tracking-[0.2em] transition-all ${currentPlan?.plan === plan.name ? 'bg-[rgba(28,28,28,0.04)] text-[rgba(28,28,28,0.2)] cursor-not-allowed' : 'bg-[#1C1C1C] text-white hover:opacity-90 active:scale-[0.98]'}`}
                                        >
                                            {currentPlan?.plan === plan.name ? 'CURRENT ACTIVE TIER' : 'RESTRUCTURE NODE'}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* File Received Modal */}
            {fileReceivedModal && (
                <div className="fixed inset-0 z-[300] bg-[#1C1C1C]/20 backdrop-blur-md flex items-center justify-center p-6 animate-in zoom-in duration-300">
                    <div className="bg-white border border-[rgba(28,28,28,0.06)] shadow-2xl rounded-[32px] p-10 w-[500px] max-w-full flex flex-col items-center text-center relative">
                        <div className={`w-20 h-20 rounded-[24px] flex items-center justify-center mb-8 shadow-sm border ${fileReceivedModal.isRemote ? 'bg-blue-50 text-blue-500 border-blue-100' : 'bg-emerald-50 text-emerald-500 border-emerald-100'}`}>
                            <DownloadCloud className="w-10 h-10" />
                        </div>
                        <h3 className="text-2xl font-black text-[#1C1C1C] mb-1 uppercase tracking-tighter">
                            {fileReceivedModal.isRemote ? 'Payload Deployed' : 'Payload Received'}
                        </h3>
                        <p className="text-[10px] font-bold text-[rgba(28,28,28,0.4)] mb-8 uppercase tracking-[0.2em]">
                            Successfully stored in {fileReceivedModal.isRemote ? 'Host' : 'Viewer'} storage
                        </p>

                        <div className="w-full bg-[#F8F9FA] rounded-2xl p-5 border border-[rgba(28,28,28,0.04)] mb-10 text-left overflow-hidden">
                            <div className="flex flex-col gap-1.5">
                                <span className="text-[8px] font-black text-[rgba(28,28,28,0.2)] uppercase tracking-widest">Absolute Destination Path</span>
                                <p className="text-[11px] font-mono font-bold text-[#1C1C1C] break-all leading-relaxed" title={fileReceivedModal.path}>
                                    {fileReceivedModal.path}
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-4 w-full">
                            <button
                                onClick={() => setFileReceivedModal(null)}
                                className="snow-btn-secondary flex-1 uppercase text-[10px] font-black tracking-widest"
                            >
                                DISMISS
                            </button>
                            {!fileReceivedModal.isRemote && (
                                <button
                                    onClick={() => {
                                        (window as any).electronAPI.openPath(fileReceivedModal.path);
                                        setFileReceivedModal(null);
                                    }}
                                    className="snow-btn flex-1 uppercase text-[10px] font-black tracking-widest"
                                >
                                    REVEAL FILE
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Global Error Modal */}
            {errorModal && errorModal.show && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-[#1C1C1C]/40 backdrop-blur-xl animate-in fade-in duration-300">
                    <div className="w-full max-w-md bg-white p-10 rounded-[32px] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)] border border-[rgba(28,28,28,0.06)] animate-in zoom-in-95 duration-300 text-center">
                        <div className="w-20 h-20 bg-red-50 rounded-[28px] flex items-center justify-center text-red-500 mx-auto mb-8 border border-red-100">
                            <ShieldOff className="w-10 h-10" />
                        </div>
                        <h3 className="text-2xl font-black text-[#1C1C1C] mb-3 tracking-tighter uppercase">{errorModal.title}</h3>
                        <p className="text-xs font-bold text-[rgba(28,28,28,0.4)] leading-relaxed uppercase tracking-[0.1em] mb-10">
                            {errorModal.message}
                        </p>
                        <button
                            onClick={() => setErrorModal(null)}
                            className="snow-btn w-full tracking-[0.2em] font-black"
                        >
                            ACKNOWLEDGE
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}