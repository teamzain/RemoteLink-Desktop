import React, { useState, useEffect, useRef } from 'react';
import logo from './assets/logo.png';
// Force-syncing file state to resolve HMR/Vite discrepancies.
import {
    Activity, Monitor, ArrowLeft, ArrowRight, Zap, LogOut, Copy, Settings, MousePointer2, Loader2, Play, KeyRound, Shield, Smartphone, Plus, Search, MoreVertical, CheckCircle2, X,
    RefreshCw, Eye, EyeOff, CreditCard, Power, Lock, Mail, Link, Sun, Moon, Edit2, Trash2, ShieldOff, LayoutGrid, PlusCircle, Radio, ShieldCheck, ArrowRightCircle, Check, DownloadCloud, MonitorOff, User,
    Globe, Folder, Maximize, Info, Home, ChevronLeft, ChevronRight, ChevronDown, Layers, BellDot, Command, Book, Bell, ExternalLink
} from 'lucide-react';

import { useImperativeHandle, forwardRef } from 'react';
import api from './lib/api';
import { useAuthStore } from './store/authStore';
import { SnowPremiumDashboard } from './components/SnowPremiumDashboard';
import { SnowPremiumSettings } from './components/SnowPremiumSettings';
import { SnowPremiumSidebar } from './components/SnowPremiumSidebar';
import { SnowSettingsModal } from './components/SnowSettingsModal';
import { SnowSidebar } from './components/SnowSidebar';
import { SnowDevices } from './components/SnowDevices';
import { SnowRightBar } from './components/SnowRightBar';
import { SnowHost } from './components/SnowHost';
import { SnowBilling } from './components/SnowBilling';
import { SnowDocumentation } from './components/SnowDocumentation';
import { SnowSupport } from './components/SnowSupport';
import { SnowSettings } from './components/SnowSettings';
import { SnowOrgSettings } from './components/SnowOrgSettings';
import { SnowAdminSettings } from './components/SnowAdminSettings';
import { SnowSplashScreen } from './components/SnowSplashScreen';
import { SnowMembers } from './components/SnowMembers';
import { SnowOrgs } from './components/SnowOrgs';
import { SnowOnboard } from './components/SnowOnboard';
import { SnowNotificationPanel } from './components/SnowNotificationPanel';
import { t } from './lib/translations';

import { SnowAnalytics } from './components/SnowAnalytics';
import { SnowHome } from './components/SnowHome';
import { SnowOrgDetail } from './components/SnowOrgDetail';
import UpdateBanner from './components/UpdateBanner';
import { playUISound, fireNotification } from './components/SnowUserSettings';

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
    remoteCursor: { x: number, y: number, visible: boolean } | null;
    showDiagnostics: boolean;
    setShowDiagnostics: (val: boolean) => void;
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
    controlChannelRef,
    remoteCursor,
    showDiagnostics,
    setShowDiagnostics
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
    const [isAutoPlayBlocked, setIsAutoPlayBlocked] = useState(false);
    const [showShortcutsHUD, setShowShortcutsHUD] = useState(false);

    // --- Global Theme & Font Size ---
    useEffect(() => {
        if (user) {
            // Apply Dark Mode
            if (user.darkMode) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }

            // Apply Global Font Size
            const size = user.fontSize || 16;
            document.documentElement.style.setProperty('--base-font-size', `${size}px`);
        }
    }, [user?.darkMode, user?.fontSize]);

    // --- Black Screen Watchdog ---
    // If we have a stream but videoWidth is 0, request a recovery keyframe every 2s
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
        }, 5000); // Check every 5s instead of 2s

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
            videoRef.current.play().catch(() => { });
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
        if ((viewerStatus === 'streaming' || viewerStatus === 'connected' || viewerStatus === 'connecting') && !hasReceivedKeyframe) {
            timer = setTimeout(() => {
                console.log('[VideoPlayer] Screen timeout (black) - Requesting keyframe recovery...');
                onControlEvent({ type: 'request-keyframe' });
            }, 10000); // 10s timeout for initial handshake recovery
        }
        return () => clearTimeout(timer);
    }, [viewerStatus, hasReceivedKeyframe, remoteStream, onControlEvent]);

    // --- Keyboard Handlers ---
    useEffect(() => {
        if ((viewerStatus !== 'streaming' && viewerStatus !== 'connected') || !onControlEvent) return;

        console.warn(`[DIAGNOSTIC] REMOTE CAPTURE ACTIVE. Monitoring all keystrokes in ${viewerStatus} mode.`);

        const handleKeyDown = (e: KeyboardEvent) => {
            // -- Round 9: System Shortcuts (Android Global Actions) --
            // Escape -> Back (1)
            // Alt + H -> Home (2)
            // Alt + R -> Recents (3)
            // Alt + N -> Notifications (4)
            if (e.key === 'Escape') {
                e.preventDefault();
                onControlEvent({ type: 'globalAction', action: 1 });
                return;
            }
            if (e.altKey && e.key.toLowerCase() === 'h') {
                e.preventDefault();
                onControlEvent({ type: 'globalAction', action: 2 });
                return;
            }
            if (e.altKey && e.key.toLowerCase() === 'r') {
                e.preventDefault();
                onControlEvent({ type: 'globalAction', action: 3 });
                return;
            }
            if (e.altKey && e.key.toLowerCase() === 'n') {
                e.preventDefault();
                onControlEvent({ type: 'globalAction', action: 4 });
                return;
            }

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
            codec: 'avc1.42E01F', // Baseline 3.1 - Most universal H264 profile
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
        if (!videoRef.current || !remoteStream) return;

        console.log('[VideoPlayer] Stream received. Initializing decoder...');
        const video = videoRef.current;
        video.srcObject = remoteStream;

        const tryPlay = async () => {
            try {
                await video.play();
                setIsAutoPlayBlocked(false);
            } catch (err: any) {
                console.warn('[VideoPlayer] Auto-play blocked:', err);
                if (err.name !== 'AbortError') {
                    setIsAutoPlayBlocked(true);
                }
            }
        };
        tryPlay();

        // Round 10: Elite Mode Guard
        // Browser sometimes "freezes" the video tag if the tab was inactive. 
        // We just ensure play() is active without destructive srcObject resets.
        const recoveryId = setInterval(() => {
            if (sessionCode && video.videoWidth === 0) {
                console.log('[VideoPlayer] Resolution 0x0. Ensuring play() active...');
                tryPlay();
            }
        }, 5000);

        return () => clearInterval(recoveryId);
    }, [remoteStream, sessionCode]);

    // --- Manual Wheel Listener (Fixes Passive event error) ---
    useEffect(() => {
        const target = remoteStream ? videoRef.current : canvasRef.current;
        if (!target) return;

        const onWheel = (e: Event) => {
            const we = e as WheelEvent;
            we.preventDefault();
            const { x, y } = normalizedMouseRef.current;
            onControlEvent({ type: 'wheel', deltaX: we.deltaX, deltaY: we.deltaY, x, y });
        };

        target.addEventListener('wheel', onWheel, { passive: false });
        return () => target.removeEventListener('wheel', onWheel);
    }, [remoteStream, onControlEvent, zoomMode]);

    const lastMouseMoveRef = useRef<number>(0);
    const MOUSE_THROTTLE_MS = 16; // ~60fps
    // Track the last normalized mouse position so wheel events can include it
    const normalizedMouseRef = useRef<{ x: number; y: number }>({ x: 0.5, y: 0.5 });
    const isDraggingRef = useRef<boolean>(false);

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

                normalizedMouseRef.current = { x, y };

                if (type === 'mousedown') {
                    isDraggingRef.current = true;
                } else if (type === 'mouseup') {
                    isDraggingRef.current = false;
                } else if (type === 'mousemove') {
                    if (e.buttons === 0) {
                        if (isDraggingRef.current) {
                            onControlEvent({ type: 'mouseup', button: 0, x, y });
                            isDraggingRef.current = false;
                        }
                        if (zoomMode === 'fit') return; // Don't spam layout with hover moves on mobile
                    }
                    setLocalMouse({ x: e.clientX, y: e.clientY });
                    const now = Date.now();
                    if (now - lastMouseMoveRef.current < MOUSE_THROTTLE_MS) return;
                    lastMouseMoveRef.current = now;
                }

                onControlEvent({ type, button: (e as any).button, x, y });
                return;
            }

            let x: number, y: number;

            // Standard proportional containment math
            const containerWidth = rect.width;
            const containerHeight = rect.height;
            const containerRatio = containerWidth / containerHeight;
            const videoRatio = videoWidth / videoHeight;

            let actualWidth, actualHeight, offsetX, offsetY;
            if (containerRatio > videoRatio) {
                // Pillarboxed (bars on sides)
                actualHeight = containerHeight;
                actualWidth = containerHeight * videoRatio;
                offsetX = (containerWidth - actualWidth) / 2;
                offsetY = 0;
            } else {
                // Letterboxed (bars on top/bottom)
                actualWidth = containerWidth;
                actualHeight = containerWidth / videoRatio;
                offsetX = 0;
                offsetY = (containerHeight - actualHeight) / 2;
            }

            // Avoid division by zero if video dimensions are not yet available
            x = actualWidth > 0 ? (e.clientX - (rect.left + offsetX)) / actualWidth : 0.5;
            y = actualHeight > 0 ? (e.clientY - (rect.top + offsetY)) / actualHeight : 0.5;

            // -- Round 9: Edge-to-Edge Calibration --
            // If we are at the very top (y < 0.01), ensure mathematical 0.0 to trigger notifications easily
            if (y < 0.01) y = 0;
            if (y > 0.99) y = 1;
            if (x < 0.01) x = 0;
            if (x > 0.99) x = 1;

            // Clamp to 0.0–1.0
            x = Math.max(0, Math.min(1, x));
            y = Math.max(0, Math.min(1, y));

            // Always keep the latest normalized position for wheel events
            normalizedMouseRef.current = { x, y };

            if (type === 'mousedown') {
                isDraggingRef.current = true;
            } else if (type === 'mouseup') {
                isDraggingRef.current = false;
            } else if (type === 'mousemove') {
                if (e.buttons === 0) {
                    // Mouse released without us catching onMouseUp (dragged outside the window or iframe)
                    if (isDraggingRef.current) {
                        onControlEvent({ type: 'mouseup', button: 0, x, y });
                        isDraggingRef.current = false;
                    }
                    // For mobile, hover is irrelevant. Keep it purely to valid drags.
                    // For Desktop PC, we might still want hover tracking. 
                    // But if zoomMode === 'fit', it's mobile viewing.
                    // Let's filter it generally if no button is pushed for mobile.
                }

                setLocalMouse({ x: e.clientX, y: e.clientY });
                const now = Date.now();
                if (now - lastMouseMoveRef.current < MOUSE_THROTTLE_MS) return;
                lastMouseMoveRef.current = now;

                // Early exit for Mobile specifically
                if (e.buttons === 0 && (!deviceType || deviceType.toLowerCase() === 'mobile' || deviceType.toLowerCase() === 'android' || deviceType.toLowerCase() === 'ios')) {
                    return;
                }
            }

            onControlEvent({ type, button: (e as any).button, x, y });
        }
    };

    const handleWheelEvent = (e: React.WheelEvent) => {
        // Handled by manual listener above to avoid passive event error
    };

    const isMobileDevice = deviceType?.toLowerCase() === 'mobile' || deviceType?.toLowerCase() === 'android' || deviceType?.toLowerCase() === 'ios';

    const renderContent = () => {
        // When inside the phone mockup frame, the video must fill the bezel directly.
        // Wrapping with p-8 or a nested aspect-ratio div causes getBoundingClientRect()
        // to return wrong geometry, making taps land ~32-44px above the intended target.
        const isInMockup = isMobileDevice && zoomMode === 'fit';

        const videoProps = {
            className: `transition-opacity duration-700 select-none w-full h-full object-contain cursor-none ${(!hasReceivedKeyframe) ? 'opacity-0' : 'opacity-100'}`,
            style: { backgroundColor: '#000', outline: 'none' },
            onMouseMove: (e: React.MouseEvent) => handleMouseEvent(e, 'mousemove'),
            onMouseDown: (e: React.MouseEvent) => handleMouseEvent(e, 'mousedown'),
            onMouseUp: (e: React.MouseEvent) => handleMouseEvent(e, 'mouseup'),
            onWheel: handleWheelEvent,
            onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
        };

        const contentNode = remoteStream ? (
            <div className="relative w-full h-full group flex items-center justify-center bg-[#0a0a0c] overflow-hidden cursor-none">
                {!hasReceivedKeyframe && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/40 backdrop-blur-md animate-in fade-in duration-700">
                        <div className="w-20 h-20 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 animate-pulse">
                            <img src="/logo.png" className="w-10 h-10 opacity-100 grayscale" alt="" />
                        </div>
                        <h2 className="text-sm font-bold tracking-[0.2em] text-white/80 uppercase">Establishing Link...</h2>
                    </div>
                )}
                <div className={`relative transition-all duration-700 ease-out shadow-[0_40px_100px_rgba(0,0,0,0.8)] ${!isInMockup && isMobileDevice ? 'h-full aspect-[9/19.5] rounded-[3rem] border-[12px] border-[#1a1a1c] bg-black overflow-hidden' : 'w-full h-full'}`}>
                    <video
                        ref={videoRef}
                        autoPlay
                        muted
                        playsInline
                        onLoadedMetadata={(e) => {
                            const video = e.currentTarget;
                            if (video.videoWidth > 0 && video.videoHeight > 0) {
                                console.log(`[VideoPlayer] Decoder ACTIVE: ${video.videoWidth}x${video.videoHeight}`);
                                setHasReceivedKeyframe(true);
                                video.play().then(() => {
                                    setIsAutoPlayBlocked(false);
                                }).catch((err: any) => {
                                    console.warn('[VideoPlayer] Play failed on metadata:', err);
                                    if (err.name !== 'AbortError') {
                                        setIsAutoPlayBlocked(true);
                                    }
                                });
                            }
                        }}
                        onMouseEnter={() => { }}
                        onMouseLeave={() => setLocalMouse(null)}
                        {...videoProps}
                    />
                </div>

                {/* Auto-play recovery overlay */}
                {isAutoPlayBlocked && (
                    <div
                        className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm cursor-none"
                        onClick={() => {
                            videoRef.current?.play().then(() => setIsAutoPlayBlocked(false)).catch(console.error);
                        }}
                    >
                        <div className="w-16 h-16 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center mb-4 animate-pulse">
                            <Play size={32} className="text-blue-400 fill-blue-400" />
                        </div>
                        <span className="text-white/80 font-bold text-sm tracking-widest uppercase">Click to Resume Stream</span>
                    </div>
                )}

                {/* --- Side-Notches have been removed for mobile view to prevent UI overlap --- */}
                {/* Shortcuts HUD */}
                {showShortcutsHUD && (
                    <div className="absolute inset-0 z-[130] bg-black/60 backdrop-blur-md flex items-center justify-center animate-in fade-in duration-300">
                        <div className="bg-[#1C1C1C] border border-white/10 rounded-3xl p-8 max-w-md w-full shadow-2xl">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                                    <Command size={16} className="text-blue-400" /> System Shortcuts
                                </h3>
                                <button onClick={() => setShowShortcutsHUD(false)} className="text-white/80 hover:text-white"><X size={20} /></button>
                            </div>
                            <div className="space-y-4">
                                {[
                                    { k: 'Esc', v: 'Back' },
                                    { k: 'Alt + H', v: 'Home' },
                                    { k: 'Alt + R', v: 'Recents' },
                                    { k: 'Alt + N', v: 'Notifications' },
                                    { k: 'Mouse Top', v: 'Hold top for 1s to view Status' }
                                ].map((s, i) => (
                                    <div key={i} className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                                        <span className="text-[10px] font-bold text-white/95 uppercase tracking-widest">{s.v}</span>
                                        <span className="px-2 py-1 bg-white/10 rounded-md text-[10px] font-mono text-blue-400 font-bold">{s.k}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Remote Cursor Overlay */}
                {remoteCursor && remoteCursor.visible && (
                    <div
                        className="absolute pointer-events-none z-50 transition-all duration-75"
                        style={{
                            left: `${remoteCursor.x * 100}%`,
                            top: `${remoteCursor.y * 100}%`,
                            transform: 'translate(-3px, -3px)'
                        }}
                    >
                        <MousePointer2 size={20} className="text-white fill-[#1C1C1C] drop-shadow-md" />
                    </div>
                )}

                {/* Stream Diagnostics HUD */}
                <div className="absolute top-4 right-4 z-[110] flex flex-col gap-2">
                    <button
                        onClick={(e) => { e.stopPropagation(); setShowDiagnostics(!showDiagnostics); }}
                        className="w-8 h-8 rounded-lg bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/95 hover:text-white/80 transition-colors"
                    >
                        <Info size={14} />
                    </button>

                    {showDiagnostics && (
                        <div className="p-4 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/10 shadow-2xl min-w-[200px] animate-in fade-in zoom-in-95 duration-200">
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-white/95 uppercase tracking-widest">Resolution</span>
                                    <span className="text-xs font-mono text-blue-400 font-bold">
                                        {videoRef.current?.videoWidth || 0} x {videoRef.current?.videoHeight || 0}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-white/95 uppercase tracking-widest">Track Status</span>
                                    <span className={`text-[10px] font-bold uppercase ${remoteStream?.getVideoTracks()[0]?.enabled ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {remoteStream?.getVideoTracks()[0]?.enabled ? 'Active' : 'Muted'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-white/95 uppercase tracking-widest">Decoder</span>
                                    <span className="text-[10px] font-bold text-white/80">Hardware/NVENC</span>
                                </div>
                                <div className="h-px bg-white/5 w-full" />
                                <div className="text-[9px] text-white/30 italic  
">
                                    NAL units are aggregated for sync.
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
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
                            <div className="w-20 h-20 rounded-[28px] bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shadow-2xl overflow-hidden cursor-none">
                                <img src={logo} alt="Connect-X" className="w-12 h-12 object-contain opacity-70" />
                            </div>
                            {/* Orbiting ring */}
                            <div className="absolute inset-0 rounded-[28px] border border-blue-500/20 animate-ping" style={{ animationDuration: '2s' }} />
                        </div>

                        <span className="text-[13px] font-bold text-white/60 tracking-[0.35em] uppercase z-10 mb-2">Establishing Link</span>
                        <span className="text-[10px] text-white/80 font-medium z-10 mb-8">Negotiating secure P2P channel...</span>

                        {/* Step indicators */}
                        <div className="flex items-center gap-3 z-10 mb-10">
                            {['ICE', 'DTLS', 'STREAM'].map((step, i) => {
                                const active = (hasReceivedKeyframe && i === 2) || (i < 2);
                                return (
                                    <React.Fragment key={step}>
                                        <div className="flex flex-col items-center gap-1.5">
                                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-all ${active ? 'bg-blue-500/20 border-blue-500/40 text-blue-400' : 'bg-white/5 border-white/10 text-white/80'}`}>
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
                                <span className="text-sm font-mono text-blue-400/80 font-bold tabular-nums">
                                    {packetsReceived}
                                </span>
                            </div>
                            <div className="w-px h-8 bg-white/[0.06]" />
                            <div className="flex flex-col items-center gap-0.5">
                                <span className="text-[8px] font-bold text-white/25 uppercase tracking-widest">Errors</span>
                                <span className="text-sm font-mono text-red-400/80 font-bold tabular-nums">{decodeErrors}</span>
                            </div>
                            <div className="w-px h-8 bg-white/[0.06]" />
                            <div className="flex flex-col items-center gap-0.5">
                                <span className="text-[8px] font-bold text-white/25 uppercase tracking-widest">Signal</span>
                                <span className={`text-sm font-bold uppercase ${lastPacketTime && (Date.now() - lastPacketTime < 2000) ? 'text-emerald-400/80' : 'text-white/80'}`}>
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
                    <div className="relative flex items-center justify-center pt-24 pb-4 px-4 w-full h-full max-h-screen">
                        <div className="relative rounded-[48px] p-3 bg-[#1C1C1C] border border-white/[0.08] shadow-[0_30px_100px_rgba(0,0,0,0.8)] h-full aspect-[9/19.5] flex-shrink-0 flex items-center justify-center max-h-[920px]">
                            <div className="relative w-full h-full rounded-[38px] overflow-hidden bg-black pointer-events-auto">
                                {contentNode}
                            </div>
                            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[100px] h-[26px] bg-black rounded-full pointer-events-none z-50 flex items-center justify-center border border-white/[0.04]">
                                <div className="w-2.5 h-2.5 rounded-full bg-blue-900/30 ml-auto mr-3 flex items-center justify-center">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#1A1A1A]" />
                                </div>
                            </div>
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
            {/* Floating Glassmorphism Toolbar 
                  Always Top -> 16px to stay out of the way.
                  Auto-hides (opacity) on mouse idle; re-appears on hover.
            */}
            <div
                className="absolute left-1/2 -translate-x-1/2 top-4 z-50 flex items-center gap-2 px-3 py-2 rounded-2xl bg-[#0a0a0ade] border border-white/[0.08] backdrop-blur-2xl shadow-2xl shadow-black/40 transition-all duration-500 opacity-100 pointer-events-auto [[data-ui-hidden='true']_&]:opacity-0 [[data-ui-hidden='true']_&]:pointer-events-none hover:!opacity-100 hover:!pointer-events-auto"
            >
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
                    <button onClick={() => setZoomMode(zoomMode === 'fit' ? 'original' : 'fit')} title="Toggle Scale" className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all border ${zoomMode === 'original' ? 'bg-blue-500/20 border-blue-500/30 text-blue-400' : 'bg-white/5 border-white/5 text-white/95 hover:text-white/80 hover:bg-white/10'}`}>
                        <Search size={13} />
                    </button>
                    <button onClick={() => { if (!document.fullscreenElement) { containerRef.current?.requestFullscreen(); setIsFullScreen(true); } else { document.exitFullscreen(); setIsFullScreen(false); } }} title="Fullscreen" className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/5 border border-white/5 text-white/95 hover:text-white/80 hover:bg-white/10 transition-all">
                        <Maximize size={13} />
                    </button>
                </div>

                <div className="w-px h-5 bg-white/[0.06] mx-1" />

                {/* Action buttons */}
                <div className="flex items-center gap-0.5">
                    {isMobileDevice ? (
                        [
                            { icon: ChevronLeft, action: 1, title: 'Back (Esc)', color: '' },
                            { icon: Home, action: 2, title: 'Home (Alt+H)', color: 'hover:text-blue-400 hover:bg-blue-500/10' },
                            { icon: Layers, action: 3, title: 'Recents (Alt+R)', color: '' },
                            { icon: BellDot, action: 4, title: 'Notifications (Alt+N)', color: 'hover:text-yellow-400 hover:bg-yellow-500/10' },
                            { icon: Sun, action: 'wakeup', title: 'Wake Screen', color: 'hover:text-yellow-400 hover:bg-yellow-500/10' },
                            { icon: Lock, action: 'lock', title: 'Lock Screen', color: 'hover:text-blue-400 hover:bg-blue-500/10' }
                        ].map(({ icon: Icon, action, title, color }) => (
                            <button key={action} onClick={() => {
                                if (typeof action === 'number') {
                                    onControlEvent({ type: 'globalAction', action });
                                } else {
                                    onControlEvent({ type: 'action', action });
                                }
                            }} title={title}
                                className={`w-8 h-8 rounded-xl flex items-center justify-center bg-white/5 border border-white/5 text-white/95 hover:text-white/80 hover:bg-white/10 transition-all ${color}`}>
                                <Icon size={13} />
                            </button>
                        ))
                    ) : (
                        [
                            { icon: Activity, action: 'task_manager', title: 'Task Manager', color: '' },
                            { icon: Globe, action: 'browser', title: 'Browser', color: '' },
                            { icon: Folder, action: 'explorer', title: 'Explorer', color: '' },
                            { icon: Sun, action: 'wakeup', title: 'Wake Screen', color: 'hover:text-yellow-400 hover:bg-yellow-500/10' },
                            { icon: Lock, action: 'lock', title: 'Lock Screen', color: 'hover:text-blue-400 hover:bg-blue-500/10' },
                            { icon: Power, action: 'shutdown', title: 'Shutdown', color: 'hover:text-red-400 hover:bg-red-500/10' },
                        ].map(({ icon: Icon, action, title, color }) => (
                            <button key={action} onClick={() => onControlEvent({ type: 'action', action })} title={title}
                                className={`w-8 h-8 rounded-xl flex items-center justify-center bg-white/5 border border-white/5 text-white/95 hover:text-white/80 hover:bg-white/10 transition-all ${color}`}>
                                <Icon size={13} />
                            </button>
                        ))
                    )}
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
                            <span className="text-[9px] font-bold text-white/95 uppercase tracking-wider max-w-[80px] truncate">{transferProgress.name}</span>
                            <div className="w-20 h-1 bg-white/10 rounded-full overflow-hidden cursor-none">
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
    const { user, accessToken, temp2faToken, login: storeLogin, verify2fa: storeVerify2fa, setTemp2faToken, register: storeRegister, requestVerification: storeRequestVerification, logout: storeLogout, checkAuth, setAuth } = useAuthStore();
    const isAuthenticated = !!accessToken;
    const [totpCode, setTotpCode] = useState('');
    const [twoFaError, setTwoFaError] = useState<string | null>(null);
    const [isVerifying2fa, setIsVerifying2fa] = useState(false);

    type ViewType = 'home' | 'dashboard' | 'devices' | 'settings' | 'host' | 'billing' | 'documentation' | 'profile' | 'support' | 'members' | 'organizations' | 'analytics' | 'connect' | 'org-detail';
    const [currentView, _setCurrentView] = useState<ViewType>('home');
    const [history, setHistory] = useState<ViewType[]>(['home']);
    const [historyIndex, setHistoryIndex] = useState(0);

    const setCurrentView = (view: ViewType | ((prev: ViewType) => ViewType)) => {
        if (typeof view === 'function') {
            view = view(currentView);
        }
        if (view === currentView) return;
        
        if (view as any === 'Notifications') {
            setShowNotifications(true);
            return;
        }
        
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(view);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
        _setCurrentView(view);
    };

    const handleBack = () => {
        if (historyIndex > 0) {
            setHistoryIndex(historyIndex - 1);
            _setCurrentView(history[historyIndex - 1]);
        }
    };

    const handleForward = () => {
        if (historyIndex < history.length - 1) {
            setHistoryIndex(historyIndex + 1);
            _setCurrentView(history[historyIndex + 1]);
        }
    };

    const [orgDetailId, setOrgDetailId] = useState<string | null>(null);
    const [authMode, setAuthMode] = useState<'login' | 'signup' | 'connect' | 'forgot' | 'reset'>('login');
    const [resetEmail, setResetEmail] = useState('');
    const [resetCode, setResetCode] = useState('');
    const [resetNewPassword, setResetNewPassword] = useState('');
    const [resetMsg, setResetMsg] = useState('');
    const [showNotifications, setShowNotifications] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [signupName, setSignupName] = useState('');
    const [showLoginPassword, setShowLoginPassword] = useState(false);
    const [verificationCode, setVerificationCode] = useState('');
    const [isAwaitingVerification, setIsAwaitingVerification] = useState(false);
    const [authError, setAuthError] = useState<string | null>(null);
    const [sessionCode, setSessionCode] = useState('');
    const [accessPassword, setAccessPassword] = useState('');
    const [showManualPassword, setShowManualPassword] = useState(false);
    // Initialize as viewer window early if URL points to it
    const isViewer = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('view') === 'viewer';
    const [isViewerWindow, setIsViewerWindow] = useState(isViewer);
    const [remoteCursor, setRemoteCursor] = useState<{ x: number, y: number, visible: boolean } | null>(null);
    const [onboardingToken, setOnboardingToken] = useState<string | null>(null);
    const [showDiagnostics, setShowDiagnostics] = useState(false);

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
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
    const [windowDeviceType, setWindowDeviceType] = useState('');
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
    const [isAutoHostEnabled, setIsAutoHostEnabled] = useState(() => {
        const stored = localStorage.getItem('is_auto_host_enabled');
        if (stored === null) {
            localStorage.setItem('is_auto_host_enabled', 'true');
            return true;
        }
        return stored === 'true';
    });
    const [showHostPassword, setShowHostPassword] = useState(false);
    const [showSetPasswordModal, setShowSetPasswordModal] = useState(false);
    const [setupPassword, setSetupPassword] = useState('');
    const [setupPasswordConfirm, setSetupPasswordConfirm] = useState('');
    const [setupPasswordError, setSetupPasswordError] = useState('');
    const [isLocalHostRegistered, setIsLocalHostRegistered] = useState(false);

    const [serverIP, setServerIP] = useState('remote365.ai'); // Production Domain
    const [localAuthKey, setLocalAuthKey] = useState('');
    const [localIP, setLocalIP] = useState('127.0.0.1');
    const [showSettings, setShowSettings] = useState(false);
    const [isPackaged, setIsPackaged] = useState(false);
    const [analyticsSummary, setAnalyticsSummary] = useState<any>(null);

    useEffect(() => {
        if ((window as any).electronAPI?.isPackaged) {
            (window as any).electronAPI.isPackaged().then(setIsPackaged);
        }

        const cleanups: (() => void)[] = [];

        // Listen for Google OAuth callback tokens from main process
        if ((window as any).electronAPI?.onAuthDeepLinkSuccess) {
            const cleanup = (window as any).electronAPI.onAuthDeepLinkSuccess(async (data: { accessToken: string, refreshToken: string }) => {
                console.log('[Auth] Received tokens via deep link, finalizing login...');
                try {
                    await setAuth({ id: 'loading', email: '', name: '', plan: 'FREE', role: 'USER', organizationId: null, avatar: null }, data.accessToken, data.refreshToken);
                    await checkAuth();
                    setShowSplash(true);
                    setCurrentView('dashboard');
                    setTimeout(() => setShowSplash(false), 2000);
                } catch (err) {
                    console.error('[Auth] Failed to sync user after deep link:', err);
                }
            });
            if (cleanup) cleanups.push(cleanup);
        }

        if ((window as any).electronAPI?.onTemp2faToken) {
            const cleanup = (window as any).electronAPI.onTemp2faToken((token: string) => {
                console.log('[Auth] Received 2FA temp token via deep link');
                setTemp2faToken(token);
            });
            if (cleanup) cleanups.push(cleanup);
        }

        return () => {
            cleanups.forEach(c => c());
        };
    }, []);


    const [viewerStatus, setViewerStatus] = useState<'idle' | 'connecting' | 'error' | 'connected' | 'streaming' | 'connection_lost'>('idle');
    const [viewerError, setViewerError] = useState('');
    const videoPlayerRef = useRef<any>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const candidatesBuffer = useRef<RTCIceCandidateInit[]>([]);
    const controlChannelRef = useRef<RTCDataChannel | null>(null);
    const volumeIntervalRef = useRef<any>(null);
    const reassemblyMap = useRef<Map<bigint, any>>(new Map());
    const monitorWsRef = useRef<WebSocket | null>(null);

    // Throttled mouse movement
    const lastMouseMoveRef = useRef<number>(0);
    const lastBufferWarningRef = useRef<number>(0);
    const MOUSE_THROTTLE_MS = 33; // Optimized: 33ms (~30fps) significantly reduces DataChannel congestion

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
                    if (channel.bufferedAmount > 32768) { // Optimized: 32KB threshold (more sensitive)
                        if (event.type === 'mousemove') return; // Drop travel

                        // Extreme congestion: Drop almost everything except clicks/keys
                        if (channel.bufferedAmount > 524288 && event.type !== 'mousedown' && event.type !== 'keydown') {
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
        setAuth({} as any, '', '');
        setCurrentView('home');
    };
    const lastClipboardRef = useRef<string>('');


    // --- New Device Management State ---
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [devices, setDevices] = useState<any[]>([]);
    const [selectedDevice, setSelectedDevice] = useState<any | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [showUserDropdown, setShowUserDropdown] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const userDropdownRef = useRef<HTMLDivElement>(null);

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
    const [showActionPassword, setShowActionPassword] = useState(false);
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
        const handleGlobalClick = (e: MouseEvent) => {
            if (contextMenuId) setContextMenuId(null);
            if (showUserDropdown && userDropdownRef.current && !userDropdownRef.current.contains(e.target as Node)) {
                setShowUserDropdown(false);
            }
        };
        window.addEventListener('click', handleGlobalClick);
        return () => window.removeEventListener('click', handleGlobalClick);
    }, [contextMenuId, showUserDropdown]);

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
    const hasAutoStartedHost = useRef(false);
    const manuallyStoppedHost = useRef(false);
    useEffect(() => {
        if (viewerConnectedRef.current) return; // Guard for React Strict Mode double-fire
        const params = new URLSearchParams(window.location.search);
        if (params.get('view') === 'viewer') {
            viewerConnectedRef.current = true;
            const sid = params.get('sessionId') || '';
            const sip = params.get('serverIP') || '';
            const tok = params.get('token') || '';
            const dname = params.get('deviceName') || '';
            const dtype = params.get('deviceType') || '';

            setSessionCode(sid);
            setServerIP(sip);
            setAuth({ id: 'viewer', email: 'node.viewer@connect-x.io', name: 'Viewer', plan: 'FREE', role: 'VIEWER', organizationId: null, avatar: null }, tok, '', false);
            if (isElectron) localStorage.setItem('viewer_token', tok);
            setWindowDeviceName(dname);
            setWindowDeviceType(dtype);

            console.log(`[Window] Launched in Viewer Mode for Node: ${sid}`);
            console.log(`[Window] Joining with Persistent ID: ${viewerClientId}`);

            setViewerStatus('connecting');
            if (isElectron) {
                (window as any).electronAPI.connectToHost(sid, sip, tok, viewerClientId).then(() => {
                    // We wait for the 'joined' signaling message before setting connected status
                    console.log('[Viewer] Signaling link established. Waiting for session join confirmation...');
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
        // Request notification permission on first load
        if (Notification.permission === 'default') Notification.requestPermission();

        const removeHostStatusListener = (window as any).electronAPI.onHostStatus((status: string) => {
            console.log(`[Renderer] Host Status: ${status}`);
            if (status.startsWith('Registered:')) {
                const sid = status.split('Registered: ')[1];
                setHostSessionId(sid);
                setHostStatus('status');
            } else if (status.startsWith('WebRTC:')) {
                setHostStatus('status');
                // Viewer just connected
                if (localStorage.getItem('pref_notify_session') !== 'false') {
                    fireNotification('Session Started', 'A viewer has connected to your device.');
                }
                playUISound('connect');
            } else if (status === 'error' || status === 'disconnected') {
                setHostStatus('idle');
                // Unexpected disconnect
                if (localStorage.getItem('pref_notify_disconnect') !== 'false') {
                    fireNotification('Session Ended', 'The remote session was disconnected.');
                }
                playUISound('disconnect');
            }
        });

        // Auto-host on mount logic moved to reactive effect

        return () => removeHostStatusListener();
    }, [isElectron]);

    // Reactive Auto-Host: Waits until device is initialized (hostAccessKey)
    useEffect(() => {
        if (isElectron && !hasAutoStartedHost.current && isAutoHostEnabled && hostAccessKey && devicePassword) {
            hasAutoStartedHost.current = true;
            console.log('[Auto-Host] Initialization complete. Starting host automatically...');
            setTimeout(() => {
                handleStartHosting();
            }, 500); // Tiny buffer for state stability
        }
    }, [isElectron, isAutoHostEnabled, hostAccessKey, devicePassword]);

    const pollDevices = async () => {
        if (!isAuthenticated) return;
        try {
            const endpoint = user?.role === 'SUPER_ADMIN' ? '/api/devices/all' : '/api/devices/mine';
            const { data } = await api.get(endpoint);
            setDevices(data);
            setGlobalError('');

            // Auto-sync local host status if we find ourselves in the list as online
            // BUT: Don't override if we just manually clicked 'Stop' and the server is lagging.
            const self = data.find((d: any) => d.access_key === hostAccessKey);
            if (self && self.is_online && !manuallyStoppedHost.current) {
                setHostStatus('status');
                setHostSessionId(self.access_key);
            }
        } catch (e: any) {
            if ((e.response?.status === 401 || e.response?.status === 403) && !isViewerWindow) {
                // Token expired, role changed, or refresh failed — log out to reset state
                handleLogout();
            }
        }
    };

    useEffect(() => {
        if (user?.role === 'SUPER_ADMIN') {
            api.get('/api/analytics/summary').then(res => {
                setAnalyticsSummary(res.data);
            }).catch(e => {
                console.error('[Analytics] Failed to fetch background summary:', e);
            });
        }
    }, [user?.role, currentView]);

    useEffect(() => {
        if (!isAuthenticated || (!accessToken && !isViewerWindow)) return;

        let monitor: WebSocket | null = null;
        let reconnectTimeout: any = null;
        let retryCount = 0;

        const connect = () => {
            const wsUrl = `ws://${serverIP}/api/signal`;
            monitor = new WebSocket(wsUrl);
            monitorWsRef.current = monitor;

            monitor.onopen = () => {
                console.log('[Monitor] Presence WebSocket connected.');
                retryCount = 0; // Reset on success
                pollDevices(); // Immediate sync on connect

                if (devices.length > 0) {
                    const keys = devices.map((d: any) => String(d.access_key || '').toLowerCase().replace(/\s/g, ''));
                    monitor?.send(JSON.stringify({ type: 'subscribe-presence', accessKeys: keys }));
                }

                // Subscribe to Org Updates for real-time team management
                if (user?.organizationId) {
                    monitor?.send(JSON.stringify({ type: 'subscribe-org', organizationId: user.organizationId }));
                }
            };

            monitor.onmessage = (e) => {
                try {
                    const data = JSON.parse(e.data);
                    if (data.type === 'presence-update') {
                        const incomingId = String(data.sessionId || '').toLowerCase().replace(/\s/g, '');
                        setDevices(prev => {
                            const deviceMatch = prev.find(d => String(d.access_key || '').toLowerCase().replace(/\s/g, '') === incomingId);
                            if (deviceMatch && deviceMatch.is_online !== (data.status === 'online')) {
                                addNotification(`${deviceMatch.device_name} is now ${data.status}`, 'host');
                            }
                            return prev.map(d => {
                                const localId = String(d.access_key || '').toLowerCase().replace(/\s/g, '');
                                return localId === incomingId ? { ...d, is_online: data.status === 'online' } : d;
                            });
                        });
                    } else if (data.type === 'global-stats') {
                        setActiveSessionCount(data.activeSessions || 0);
                    } else if (data.type === 'team-update') {
                        console.log('[Monitor] Real-time team update received:', data.payload);
                        // Dispatch a custom event to notify SnowMembers or other components
                        window.dispatchEvent(new CustomEvent('team-refresh'));
                    }
                } catch (err) {
                    console.error('[Monitor] Message parse error:', err);
                }
            };

            monitor.onclose = () => {
                console.log('[Monitor] Presence WebSocket closed. Retrying...');
                monitorWsRef.current = null;
                // Exponential backoff: 2s, 4s, 8s... max 30s
                const delay = Math.min(Math.pow(2, retryCount) * 1000, 30000);
                reconnectTimeout = setTimeout(() => {
                    retryCount++;
                    connect();
                }, delay);
            };

            monitor.onerror = (err) => {
                console.error('[Monitor] Presence WebSocket error:', err);
                monitor?.close();
            };
        };

        connect();

        const handleFocus = () => pollDevices();
        window.addEventListener('focus', handleFocus);

        return () => {
            if (reconnectTimeout) clearTimeout(reconnectTimeout);
            if (monitor) monitor.close();
            monitorWsRef.current = null;
            window.removeEventListener('focus', handleFocus);
        };
    }, [isAuthenticated, accessToken, serverIP, isViewerWindow]);

    // Reactive subscription update: Whenever 'devices' list changes, refresh the monitor's watch list
    useEffect(() => {
        const monitor = monitorWsRef.current;
        if (monitor && monitor.readyState === WebSocket.OPEN && devices.length > 0) {
            const keys = devices.map((d: any) => String(d.access_key || '').toLowerCase().replace(/\s/g, ''));
            monitor.send(JSON.stringify({
                type: 'subscribe-presence',
                accessKeys: keys
            }));
        }
    }, [devices.length]); // Only re-subscribe if device list count changes (optimization)

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
    const [pendingViewerRequest, setPendingViewerRequest] = useState<{ viewerId: string; countdown: number } | null>(null);
    const [viewerStep, setViewerStep] = useState<1 | 2>(1);
    const [targetDeviceName, setTargetDeviceName] = useState<string | null>(null);
    const [lockoutSeconds, setLockoutSeconds] = useState(0);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [hostStats, setHostStats] = useState<{ bandwidth: string, activeUsers: number, cpu: string, memory: string }>({
        bandwidth: '0.00',
        activeUsers: 0,
        cpu: '0.0',
        memory: '0.0'
    });
    const [telemetryHistory, setTelemetryHistory] = useState<{ cpu: number, memory: number, time: string }[]>([]);
    const [lastPingTime, setLastPingTime] = useState<number>(Date.now());

    useEffect(() => {
        if (!isElectron) return;
        const unsub = (window as any).electronAPI.onHostStats((stats: any) => {
            setHostStats(stats);
            setTelemetryHistory(prev => {
                const now = new Date();
                const timeStr = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
                const newSample = {
                    cpu: parseFloat(stats.cpu),
                    memory: parseFloat(stats.memory),
                    time: timeStr
                };
                const combined = [...prev, newSample];
                return combined.slice(-30); // Keep last 30 samples for the chart
            });
        });
        return () => unsub();
    }, [isElectron]);

    const [currentPlan, setCurrentPlan] = useState<any>(null);

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

    // --- Viewer access-request dialog ---
    useEffect(() => {
        if (!isElectron || isViewerWindow) return;
        const eAPI = (window as any).electronAPI;
        const unsubReq = eAPI.onViewerRequest?.((data: { viewerId: string }) => {
            // AUTO-APPROVE: If host is not authenticated (Guest Mode), automatically approve.
            // This is essential for unattended access via Access Key/PIN.
            if (!isAuthenticated) {
                console.log(`[Host] Guest Mode: Auto-approving connection request from ${data.viewerId}`);
                eAPI.approveViewer(data.viewerId);
                return;
            }

            setPendingViewerRequest({ viewerId: data.viewerId, countdown: 30 });
            playUISound('connect');
        });
        const unsubCancel = eAPI.onViewerRequestCancelled?.((data: { viewerId: string }) => {
            setPendingViewerRequest(prev => prev?.viewerId === data.viewerId ? null : prev);
        });
        return () => { unsubReq?.(); unsubCancel?.(); };
    }, [isElectron, isViewerWindow, isAuthenticated]);

    useEffect(() => {
        if (!pendingViewerRequest) return;
        if (pendingViewerRequest.countdown <= 0) {
            (window as any).electronAPI?.denyViewer(pendingViewerRequest.viewerId);
            setPendingViewerRequest(null);
            return;
        }
        const t = setTimeout(() => {
            setPendingViewerRequest(prev => prev ? { ...prev, countdown: prev.countdown - 1 } : null);
        }, 1000);
        return () => clearTimeout(t);
    }, [pendingViewerRequest]);

    const fetchBillingInfo = async () => {
        try {
            const { data } = await api.get('/api/billing/current');
            setCurrentPlan(data);
        } catch (err: any) {
            console.error('Failed to fetch billing info', err);
        }
    };

    const loadDeviceInfo = async () => {
        try {
            const creds = isElectron ? await (window as any).electronAPI.getToken() : { token: accessToken };
            if (!creds?.token) return;

            let localKey = isElectron ? await (window as any).electronAPI.getDeterministicKey() : null;
            let deviceUuid = '';

            // 1. Fetch what the server thinks are our devices
            const devicesEndpoint = user?.role === 'SUPER_ADMIN' ? '/api/devices/all' : '/api/devices/mine';
            const { data: fetchedDevices } = await api.get(devicesEndpoint);
            setDevices(fetchedDevices);

            // 2. Check if our local identity is still valid in the DB
            let existingInDb = null;
            if (localKey && Array.isArray(fetchedDevices)) {
                existingInDb = fetchedDevices.find((d: any) => d.access_key === localKey);
            }

            if (!localKey || !existingInDb) {
                // We have no key, or our key was deleted from the server.
                // BUT: If the API call failed (fetchedDevices is not an array), don't unregister!
                if (Array.isArray(fetchedDevices)) {
                    console.log(`[Identity] Current machine is not registered as a node.`);
                    setIsLocalHostRegistered(false);
                    setDeviceId('');
                    setHostAccessKey('');
                } else {
                    console.warn(`[Identity] Skipping registration check due to invalid API response.`);
                }
            } else {
                deviceUuid = existingInDb.id;
                console.log(`[Identity] Verified existing identity: ${localKey}`);
                setIsLocalHostRegistered(true);
            }

            if (localKey && existingInDb) {
                setDeviceId(deviceUuid);
                setHostAccessKey(localKey);
                setHostSessionId(localKey); // Update the visual registration code
            }
        } catch (e: any) {
            console.error('[Identity] Load failed:', e);
        }
    };

    const handleRegisterLocalDevice = async () => {
        try {
            console.log(`[Identity] User-initiated registration started...`);
            const machineName = (isElectron && (window as any).electronAPI.getMachineName)
                ? await (window as any).electronAPI.getMachineName()
                : 'Remote 365 Web User';

            let localKey = isElectron ? await (window as any).electronAPI.getDeterministicKey() : null;

            const { data: newDevice } = await api.post('/api/devices/register', {
                name: machineName,
                accessKey: localKey || undefined
            });

            setDeviceId(newDevice.id);
            setHostAccessKey(newDevice.access_key);
            setHostSessionId(newDevice.access_key);
            setIsLocalHostRegistered(true);

            addNotification('Device initialized successfully.', 'system');
            pollDevices();
        } catch (e: any) {
            console.error('[Identity] Registration failed:', e);
            showError('Registration Failed', e.message || 'Could not initialize device identity.');
        }
    };

    useEffect(() => {
        if (isAuthenticated) loadDeviceInfo();
    }, [isAuthenticated, serverIP]);

    // Fetch billing data when billing view is opened
    useEffect(() => {
        if (currentView === 'billing' && isAuthenticated) {
            fetchBillingInfo();
        }
    }, [currentView, isAuthenticated]);

    // --- Persistent Hosting Auto-Start ---
    useEffect(() => {
        // If all required identity info is loaded and auto-host is enabled, start hosting.
        // hostStatus "" or "idle" means it hasn't started yet.
        // BYPASS: SUPER_ADMIN and DEPARTMENT_MANAGER must always host manually as per request.
        const isBypassRole = user?.role === 'SUPER_ADMIN' || user?.role === 'DEPARTMENT_MANAGER' || user?.role === 'PLATFORM_OWNER';

        if (isAuthenticated && !isBypassRole && hostAccessKey && deviceId && devicePassword && isAutoHostEnabled && !hasAutoStartedHost.current && !manuallyStoppedHost.current && (hostStatus === 'idle' || hostStatus === '')) {
            console.log('[Auto-Host] Identity ready, initiating automatic start...');
            hasAutoStartedHost.current = true;
            handleStartHosting();
        }
    }, [isAuthenticated, user?.role, hostAccessKey, deviceId, devicePassword, isAutoHostEnabled]);

    // --- Guest Auto-Host: start hosting once self-register completes, no login needed ---
    useEffect(() => {
        if (isAuthenticated) return; // authenticated path handled above
        if (!hostAccessKey || !devicePassword) return;
        if (hasAutoStartedHost.current || manuallyStoppedHost.current) return;
        if (hostStatus !== 'idle' && hostStatus !== '') return;
        console.log('[Auto-Host] Guest identity ready, starting host automatically...');
        hasAutoStartedHost.current = true;
        handleStartHosting();
    }, [isAuthenticated, hostAccessKey, devicePassword, hostStatus]);

    useEffect(() => {
        if (!isElectron || !(window as any).electronAPI?.getDeterministicKey) return;
        (async () => {
            const k = await (window as any).electronAPI.getDeterministicKey();
            if (!k) return;
            setLocalAuthKey(k);

            // Register this machine in the DB without requiring a login so that
            // viewers can look it up via access key even before the host signs in.
            try {
                const machineName = (window as any).electronAPI.getMachineName
                    ? await (window as any).electronAPI.getMachineName()
                    : 'Unknown Machine';

                const storedPwd = localStorage.getItem('device_password') || '';
                const { data } = await api.post('/api/devices/self-register', {
                    accessKey: k,
                    name: machineName,
                    password: storedPwd || undefined,
                });

                setHostAccessKey(data.access_key);
                setDeviceId(data.id);
                setIsLocalHostRegistered(true);

                // If the server auto-generated a password, persist it locally
                if (data.auto_password) {
                    setDevicePassword(data.auto_password);
                    localStorage.setItem('device_password', data.auto_password);
                }
            } catch (e: any) {
                console.warn('[Self-Register] Could not register device:', e.message);
            }
        })();
    }, []);

    useEffect(() => {
        checkAuth().then(() => {
            // If the user is already authenticated (restored from stored token),
            // redirect them to the dashboard instead of showing the guest home screen.
            const state = useAuthStore.getState();
            if (state.accessToken && state.user) {
                setCurrentView('dashboard');
            }
        }).finally(() => setLoading(false));

        if (!isElectron) return;

        // Listen for Google OAuth deep link success
        const removeAuthSuccess = (window as any).electronAPI.onAuthDeepLinkSuccess?.(async (tokens: any) => {
            console.log('[Auth] Deep link success received in renderer');
            // Store tokens first so the API interceptor can use them
            await setAuth({ id: 'loading', email: '', name: '', plan: 'FREE', role: 'USER', organizationId: null, avatar: null }, tokens.accessToken, tokens.refreshToken);
            // Then fetch real user data from /me
            checkAuth();
        });

        // Listen for Onboarding deep link
        const removeOnboarding = (window as any).electronAPI.onOnboardingToken?.((token: string) => {
            console.log('[Auth] Onboarding token received in renderer:', token);
            setOnboardingToken(token);
        });

        // Listen for 2FA token
        const removeTemp2fa = (window as any).electronAPI.onTemp2faToken?.((token: string) => {
            setTemp2faToken(token);
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
            if (isElectron) {
                (window as any).electronAPI.log(`[Renderer] Received signaling FROM MAIN: ${data.type}`);
            }
            if (data.type === 'joined') {
                if (data.success) {
                    console.log('[Viewer] Successfully joined session. Ready for stream.');
                    setViewerStatus('connected');
                } else {
                    // Host denied the connection or timed out
                    setViewerStatus('error');
                    setViewerError(data.error || 'Connection was denied by the host.');
                }
                return;
            }
            if (data.type === 'offer') {
                if (isElectron) (window as any).electronAPI.log('[Renderer] Handling OFFER from host...');
                const pc = new RTCPeerConnection({
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        {
                            urls: 'turn:159.65.84.190:3478',
                            username: 'admin',
                            credential: 'B07qfTNwSC2yZvcs'
                        }
                    ]
                });

                pcRef.current = pc;

                pc.onicegatheringstatechange = () => {
                    if (isElectron) (window as any).electronAPI.log(`[Renderer] ICE Gathering State: ${pc.iceGatheringState}`);
                };

                pc.onconnectionstatechange = () => {
                    if (isElectron) (window as any).electronAPI.log(`[Renderer] Connection State: ${pc.connectionState}`);
                    if (pc.connectionState === 'connected') {
                        setViewerStatus('connected');
                        clearTimeout(connectionTimeout);
                    } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                        if (isElectron) (window as any).electronAPI.log('[Renderer] WebRTC connection dropped or failed.');
                        setViewerStatus('connection_lost');
                        clearTimeout(connectionTimeout);
                        if (localStorage.getItem('pref_notify_disconnect') !== 'false') {
                            fireNotification('Connection Lost', 'Your remote session was unexpectedly disconnected.');
                        }
                        playUISound('disconnect');
                    } else if (pc.connectionState === 'closed') {
                        clearTimeout(connectionTimeout);
                    }
                };

                const connectionTimeout = setTimeout(() => {
                    if (pc.connectionState !== 'connected' && pc.connectionState !== 'closed') {
                        if (isElectron) (window as any).electronAPI.log(`[Renderer] WebRTC Connection timeout (Viewer). Status: ${pc.connectionState}`, 'warn');
                        setViewerStatus('connection_lost');
                        pc.close();
                    }
                }, 30000); // 30s timeout for ICE/handshake to be safer

                pc.ontrack = (event) => {
                    if (isElectron) (window as any).electronAPI.log('[Renderer] Standard Video Track received!');
                    setRemoteStream(event.streams[0]);
                    if (viewerStatus !== 'streaming') setViewerStatus('streaming');
                };

                pc.onicecandidate = (event) => {
                    if (event.candidate) {
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
                                if (data.type === 'cursor') {
                                    setRemoteCursor({ x: data.x, y: data.y, visible: data.visible });
                                } else if (data.type === 'clipboard' && data.text) {
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
                removeAuthSuccess?.();
                removeOnboarding?.();
                removeTemp2fa?.();
                removeHostListener();
                removeSignalingListener();
                if (removeSignalingDisconnected) removeSignalingDisconnected();
                pcRef.current?.close();
            }
        };
    }, [sessionCode, isElectron]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthError(null);
        setLoading(true);
        try {
            const result = await storeLogin(email, password);
            if (result?.twoFactorRequired) {
                // Store handles setting temp2faToken
                return;
            }
            setShowSplash(true);
            setCurrentView('dashboard');
            setTimeout(() => setShowSplash(false), 2000);
            localStorage.setItem('remote_link_server_ip', serverIP);
        } catch (err: any) {
            setAuthError(err.response?.data?.error || `Could not sign in. Check your credentials and server status.`);
        } finally {
            setLoading(false);
        }
    };

    const handleVerify2faLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (totpCode.length !== 6) return;
        setTwoFaError(null);
        setIsVerifying2fa(true);
        try {
            await storeVerify2fa(totpCode);
            setShowSplash(true);
            setCurrentView('dashboard');
            setTimeout(() => setShowSplash(false), 2000);
        } catch (err: any) {
            setTwoFaError(err.response?.data?.error || 'Invalid 2FA code');
        } finally {
            setIsVerifying2fa(false);
        }
    };

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthError(null);
        if (!signupName.trim()) { setAuthError('Display name is required.'); return; }
        setLoading(true);

        if (!isAwaitingVerification) {
            try {
                await storeRequestVerification(email);
                setIsAwaitingVerification(true);
            } catch (err: any) {
                setAuthError(err.response?.data?.error || 'Could not send verification code.');
            } finally {
                setLoading(false);
            }
        } else {
            if (!verificationCode || verificationCode.length !== 6) {
                setAuthError('Please enter a valid 6-digit verification code.');
                setLoading(false);
                return;
            }
            try {
                await storeRegister(signupName.trim(), email, password, verificationCode);
                setShowSplash(true);
                setCurrentView('dashboard');
                setTimeout(() => setShowSplash(false), 2000);
                localStorage.setItem('remote_link_server_ip', serverIP);
                setIsAwaitingVerification(false);
                setVerificationCode('');
            } catch (err: any) {
                setAuthError(err.response?.data?.error || 'Could not create account. Please try again.');
            } finally {
                setLoading(false);
            }
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
        manuallyStoppedHost.current = false;
        setHostStatus('connecting');
        setHostError('');
        try {
            if (!hostAccessKey) {
                throw new Error('Device not yet initialized. Please wait a moment.');
            }

            if (!devicePassword) {
                setShowSetPasswordModal(true);
                setHostStatus('idle');
                return;
            }

            // Sync password to auth service only when logged in (guest devices
            // already have the password set via /self-register).
            if (isAuthenticated && deviceId) {
                localStorage.setItem('device_password', devicePassword);
                await api.post('/api/devices/set-password', { deviceId, password: devicePassword });
            }

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
            manuallyStoppedHost.current = true;
        } catch (e: any) {
            console.error('[Host] Stop failed:', e);
        }
    };

    const handleFindDevice = async () => {
        if (!sessionCode) return;
        setViewerStatus('connecting');
        setViewerError('');
        setAccessPassword('');
        setLockoutSeconds(0);
        setTargetDeviceName(null);
        try {
            const cleanKey = sessionCode.replace(/\s/g, '');
            let lookupData: any = null;
            const attempts = [
                { method: 'post', url: '/api/devices/connect/lookup', body: { accessKey: cleanKey } },
                { method: 'get', url: `/api/devices/status?key=${cleanKey}` },
                // Extra compatibility for deployments where API prefixing differs
                { method: 'post', url: '/devices/connect/lookup', body: { accessKey: cleanKey } },
                { method: 'get', url: `/devices/status?key=${cleanKey}` }
            ] as const;

            let lastErr: any = null;
            for (const attempt of attempts) {
                try {
                    const response = attempt.method === 'post'
                        ? await api.post(attempt.url, attempt.body)
                        : await api.get(attempt.url);
                    lookupData = response.data;
                    break;
                } catch (err: any) {
                    lastErr = err;
                    const status = err?.response?.status;
                    // Only fail fast on definitive server errors (not 404, not CORS/network with no response).
                    if (status && status !== 404) {
                        throw err;
                    }
                }
            }

            if (!lookupData && lastErr) {
                throw lastErr;
            }

            if (!lookupData?.exists) throw new Error('No machine found with that access key. Check and try again.');
            if (!lookupData?.online) throw new Error('That machine is offline. Ask the owner to open Remote 365 and check their connection.');

            setTargetDeviceName(lookupData?.name || null);
            setViewerStep(2);
            setViewerStatus('idle');
        } catch (e: any) {
            setViewerStatus('error');
            setViewerError(e.response?.data?.error || e.message || 'Failed to find device.');
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

            // 2. Open a dedicated viewer window — this registers the session in
            //    viewerWindows so the main process can forward WebRTC signaling.
            if (isElectron) {
                await (window as any).electronAPI.openViewerWindow(
                    sessionCode.replace(/\s/g, ''),
                    serverIP,
                    authData.token,
                    targetDeviceName || sessionCode,
                    'desktop'
                );
                // Reset state — the session lives in the viewer window now.
                setViewerStatus('idle');
                setViewerStep(1);
                setSessionCode('');
                setAccessPassword('');
                setTargetDeviceName(null);
                setShowAuthModal(false);
            } else {
                showError('Browser Limitation', 'Remote viewer connections require the native desktop application.');
                setViewerStatus('error');
            }
        } catch (e: any) {
            setViewerStatus('error');
            if (e.response?.status === 429) {
                const retryAfter = Number(e.response?.data?.retryAfter || 0);
                setLockoutSeconds(retryAfter > 0 ? retryAfter : 300);
            }
            setViewerError(e.response?.data?.error || e.message || 'Connection failed.');
        }
    };

    useEffect(() => {
        if (lockoutSeconds <= 0) return;
        const timer = window.setInterval(() => {
            setLockoutSeconds((prev) => (prev > 1 ? prev - 1 : 0));
        }, 1000);
        return () => window.clearInterval(timer);
    }, [lockoutSeconds]);

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
            <div className="h-screen bg-white flex flex-col relative overflow-hidden cursor-none">
                {viewerStatus === 'connection_lost' && (
                    <div className="absolute inset-0 z-[100] bg-white/95 backdrop-blur-2xl flex flex-col items-center justify-center animate-in fade-in duration-700">
                        <div className="w-24 h-24 bg-red-50 rounded-[32px] flex items-center justify-center mb-8 border border-red-100 shadow-2xl">
                            <MonitorOff className="text-red-500 w-10 h-10" />
                        </div>
                        <h2 className="text-4xl font-black text-[#1C1C1C] mb-4 uppercase tracking-tighter">Connection Fault</h2>
                        <p className="text-[10px] text-[#1C1C1C] mb-12 tracking-[0.2em] font-black uppercase">The remote node has severed the secure link</p>
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
                        deviceType={isViewerWindow ? (windowDeviceType || 'desktop') : selectedDevice?.device_type}
                        deviceName={isViewerWindow ? windowDeviceName : (selectedDevice?.device_name || 'Remote Node')}
                        remoteCursor={remoteCursor}
                        showDiagnostics={showDiagnostics}
                        setShowDiagnostics={setShowDiagnostics}
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


    if (onboardingToken) {
        return <SnowOnboard token={onboardingToken} onComplete={() => setOnboardingToken(null)} />;
    }

    if (!isAuthenticated && showAuthModal) {
        if (temp2faToken) {
            return (
                <div className="h-screen w-full flex items-center justify-center bg-white font-inter select-none">
                    <div className="w-full max-w-sm p-8 animate-in fade-in zoom-in-95 duration-500">
                        <div className="flex items-center gap-3 mb-10 group cursor-default">
                            <div className="w-14 h-14 rounded-2xl bg-[#1C1C1C] flex items-center justify-center shadow-xl shadow-black/10 transition-transform duration-300 overflow-hidden border border-white/5">
                                <img src={logo} alt="Connect-X" className="w-10 h-10 object-contain" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xl font-bold text-[#1C1C1C] tracking-tighter leading-none">Connect-X</span>
                                <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#1C1C1C] mt-1">Verification Required</span>
                            </div>
                        </div>

                        <h1 className="text-3xl font-extrabold text-[#1C1C1C] tracking-tight mb-2">Two-Factor Auth</h1>
                        <p className="text-sm font-medium text-[#1C1C1C] mb-8 leading-relaxed">
                            Open your authenticator app and enter the 6-digit verification code.
                        </p>

                        <form onSubmit={handleVerify2faLogin} className="space-y-6">
                            <div className="space-y-1.5">
                                <input
                                    autoFocus
                                    type="text"
                                    maxLength={6}
                                    placeholder="000 000"
                                    className="w-full bg-[#F8F9FA] border border-[rgba(28,28,28,0.15)] text-[#1C1C1C] rounded-[24px] px-4 py-5  
 text-3xl font-mono font-bold tracking-[0.2em] focus:bg-white focus:border-[rgba(28,28,28,0.2)] focus:ring-4 focus:ring-black/5 outline-none transition-all placeholder:text-[#000000]"
                                    value={totpCode}
                                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                />
                            </div>

                            {twoFaError && (
                                <div className="flex items-start gap-2.5 px-4 py-3 bg-red-50 border border-red-100 rounded-2xl animate-in fade-in duration-200">
                                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full mt-1.5 flex-shrink-0" />
                                    <p className="text-xs font-semibold text-red-600 leading-relaxed">{twoFaError}</p>
                                </div>
                            )}

                            <button type="submit" disabled={isVerifying2fa || totpCode.length !== 6} className="w-full py-4 bg-[#1C1C1C] text-white rounded-2xl font-bold text-sm shadow-xl shadow-black/10 hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                                {isVerifying2fa ? <RefreshCw size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                                VERIFY & CONTINUE
                            </button>

                            <button
                                type="button"
                                onClick={() => setTemp2faToken(null)}
                                className="w-full text-xs font-bold text-[#1C1C1C] hover:text-[#1C1C1C] uppercase tracking-widest transition-colors"
                            >
                                Back to Sign In
                            </button>
                        </form>
                    </div>
                </div>
            );
        }
         return (
            <div className="h-screen w-full flex items-center justify-center bg-[#F5F7F9] font-inter select-none overflow-hidden relative">
                <SnowSplashScreen isReady={!loading} />
                
                {/* Simplified Auth Card */}
                <div className="w-full max-w-[440px] bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-[rgba(0,0,0,0.05)] p-10 animate-in fade-in zoom-in-95 duration-500 relative z-10">
                    <button
                        type="button"
                        onClick={() => {
                            setShowAuthModal(false);
                            setAuthMode('login');
                            setAuthError(null);
                        }}
                        className="mb-8 flex items-center gap-2 text-[13px] font-medium text-slate-400 hover:text-slate-600 transition-all group"
                    >
                        <ArrowLeft size={16} />
                        <span>Back</span>
                    </button>

                    <h1 className="text-2xl font-semibold text-slate-800 mb-2">Remote 365</h1>
                    <p className="text-[13px] text-slate-400 mb-8">Access remote devices securely.</p>

                    {authMode === 'connect' ? (
                        /* --- GUEST CONNECT FLOW (Two-Step Implementation) --- */
                        <div className="animate-in fade-in duration-300">
                            {viewerStep === 1 ? (
                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <input
                                            autoFocus
                                            type="text"
                                            placeholder="Device Access Key"
                                            className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-4 py-3 text-sm focus:border-blue-500 outline-none transition-all placeholder:text-slate-300"
                                            value={sessionCode}
                                            onChange={e => setSessionCode(formatCode(e.target.value))}
                                            onKeyDown={e => { if (e.key === 'Enter') handleFindDevice(); }}
                                            maxLength={11}
                                        />
                                    </div>
                                    {viewerError && <p className="text-[11px] text-red-500 font-medium">{viewerError}</p>}
                                    <button
                                        type="button"
                                        onClick={handleFindDevice}
                                        disabled={viewerStatus === 'connecting' || !sessionCode}
                                        className="w-full py-3 bg-[#EBF1FA] text-[#3B82F6] rounded-lg font-bold text-sm hover:bg-blue-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {viewerStatus === 'connecting' ? <RefreshCw size={16} className="animate-spin" /> : null}
                                        Continue
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                                    <div className="space-y-1.5">
                                        <input
                                            autoFocus
                                            type="password"
                                            placeholder="Device Password"
                                            className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-4 py-3 text-sm focus:border-blue-500 outline-none transition-all placeholder:text-slate-300"
                                            value={accessPassword}
                                            onChange={e => setAccessPassword(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') handleConnectToHost(); }}
                                        />
                                    </div>
                                    {viewerError && <p className="text-[11px] text-red-500 font-medium">{viewerError}</p>}
                                    <button
                                        type="button"
                                        onClick={handleConnectToHost}
                                        disabled={viewerStatus === 'connecting' || !accessPassword}
                                        className="w-full py-3 bg-[#EBF1FA] text-[#3B82F6] rounded-lg font-bold text-sm hover:bg-blue-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {viewerStatus === 'connecting' ? <RefreshCw size={16} className="animate-spin" /> : <Zap size={16} />}
                                        Connect
                                    </button>
                                    <button onClick={() => setViewerStep(1)} className="w-full text-[11px] font-bold text-slate-400 hover:text-slate-600 transition-colors">
                                        ← Change Access Key
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* --- LOGIN / SIGNUP FLOW (Card Style) --- */
                        <div className="animate-in fade-in duration-300">
                            <form onSubmit={authMode === 'login' ? handleLogin : handleSignup} className="space-y-4">
                                {authMode === 'signup' && (
                                    <input
                                        type="text" required
                                        value={signupName}
                                        onChange={e => setSignupName(e.target.value)}
                                        placeholder="Full Name"
                                        className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-4 py-3 text-sm focus:border-blue-500 outline-none transition-all placeholder:text-slate-300"
                                    />
                                )}
                                <input
                                    type="email" required
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="Email"
                                    className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-4 py-3 text-sm focus:border-blue-500 outline-none transition-all placeholder:text-slate-300"
                                />
                                {(!isAwaitingVerification || authMode === 'login') && (
                                    <input
                                        type="password" required
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        placeholder="Password"
                                        className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-4 py-3 text-sm focus:border-blue-500 outline-none transition-all placeholder:text-slate-300"
                                    />
                                )}

                                {authError && <p className="text-[11px] text-red-500 font-medium">{authError}</p>}

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-3 bg-[#EBF1FA] text-[#3B82F6] rounded-lg font-bold text-sm hover:bg-blue-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {loading && <RefreshCw size={16} className="animate-spin" />}
                                    Continue
                                </button>
                            </form>

                            <div className="relative flex items-center justify-center my-8">
                                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100" /></div>
                                <span className="relative z-10 bg-white px-3 text-[11px] text-slate-300 uppercase tracking-widest font-medium">Or</span>
                            </div>

                            {/* Social Logins - Google Only */}
                            <div className="flex justify-center mb-8">
                                <button 
                                    onClick={handleGoogleLogin}
                                    className="w-full flex items-center justify-center gap-3 py-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-all font-semibold text-slate-600 text-sm"
                                >
                                    <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                                    Sign in with Google
                                </button>
                            </div>

                            <p className="text-[10px] text-slate-400 text-center leading-relaxed mb-8">
                                By clicking "Continue", you acknowledge that your data may be processed in accordance with our terms.
                            </p>

                            <div className="text-center text-[13px]">
                                <span className="text-slate-400">New to Remote 365? </span>
                                <button 
                                    onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                                    className="text-blue-600 font-semibold hover:underline"
                                >
                                    {authMode === 'login' ? 'Create an account' : 'Sign in'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer links matching reference */}
                <div className="absolute bottom-8 w-full flex justify-center gap-6 text-[11px] text-slate-400 font-medium">
                    <button className="hover:text-slate-600">Imprint</button>
                    <button className="hover:text-slate-600">Privacy Policy</button>
                    <button className="hover:text-slate-600">Copyright</button>
                </div>
            </div>
        );
    }


    return (
        <div className="h-screen w-full bg-[#00193F] text-[#1C1C1C] flex overflow-hidden font-inter selection:bg-blue-500/20 select-none">
            <UpdateBanner />
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
                        deviceType={windowDeviceType || (windowDeviceName.includes('iPhone') || windowDeviceName.includes('Android') ? 'mobile' : 'desktop')}
                        deviceName={windowDeviceName}
                        controlChannelRef={controlChannelRef}
                        remoteCursor={remoteCursor}
                        showDiagnostics={showDiagnostics}
                        setShowDiagnostics={setShowDiagnostics}
                    />
                </div>
            )}

            {/* ── Viewer Access Request Dialog ── */}
            {pendingViewerRequest && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-sm bg-white rounded-[28px] border border-[rgba(28,28,28,0.08)] shadow-2xl p-8 flex flex-col items-center gap-6 animate-in zoom-in-95 duration-200">
                        <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center">
                            <Monitor className="text-blue-600 w-8 h-8" />
                                  <div className="text-center">
                            <h2 className="text-xl font-black text-[#1C1C1C] tracking-tight mb-2">{t('new_connection_request', user?.language)}</h2>
                            <p className="text-sm font-medium text-[#000000] leading-relaxed">
                                {t('someone_wants_access', user?.language)}
                            </p>
                        </div>
                        <div className="w-full flex flex-col items-center gap-1">
                            <div className="w-full bg-[#F8F9FA] rounded-2xl h-2 overflow-hidden cursor-none">
                                <div
                                    className="h-full bg-blue-500 transition-all duration-1000 ease-linear"
                                    style={{ width: `${(pendingViewerRequest.countdown / 30) * 100}%` }}
                                />
                            </div>
                            <p className="text-[10px] font-bold text-[#1C1C1C] uppercase tracking-widest">
                                {t('auto_denying', user?.language).replace('{seconds}', String(pendingViewerRequest.countdown))}
                            </p>
                        </div>
                        <div className="flex gap-3 w-full">
                            <button
                                onClick={() => {
                                    (window as any).electronAPI?.denyViewer(pendingViewerRequest.viewerId);
                                    setPendingViewerRequest(null);
                                }}
                                className="flex-1 py-3.5 rounded-2xl border border-[rgba(28,28,28,0.1)] text-[11px] font-bold uppercase tracking-widest text-[#000000] hover:bg-[rgba(28,28,28,0.04)] transition-colors"
                            >
                                {t('deny_btn', user?.language)}
                            </button>
                            <button
                                onClick={() => {
                                    (window as any).electronAPI?.approveViewer(pendingViewerRequest.viewerId);
                                    setPendingViewerRequest(null);
                                }}
                                className="flex-1 py-3.5 bg-[#1C1C1C] text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:opacity-90 active:scale-[0.98] transition-all"
                            >
                                {t('allow_btn', user?.language)}
                            </button>
                        </div>
              </div>
                    </div>
                </div>
            )}

            {globalError && (
                <div className="fixed top-0 left-0 right-0 bg-red-500 text-white  
 py-3 text-xs font-bold z-[50] flex justify-between px-6 items-center shadow-lg">
                    <span>{globalError}</span>
                    <button onClick={() => setGlobalError('')} className="bg-white/20 p-1 rounded-md hover:bg-white/30 transition-colors"><X className="w-4 h-4" /></button>
                </div>
            )}

            {/* --- PREMIUM UI SIDEBAR NAV --- */}
            {isAuthenticated && (
                <SnowPremiumSidebar
                    currentView={currentView}
                    setCurrentView={(v: any) => { setCurrentView(v); setIsSidebarOpen(false); }}
                    handleLogout={handleLogout}
                    user={user}
                    isCollapsed={isSidebarCollapsed}
                    onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                    showNotifications={showNotifications}
                    setShowNotifications={setShowNotifications}
                />
            )}

            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/20 backdrop-blur-sm z-20 md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 relative bg-[#F4F7F9] rounded-l-[24px] shadow-2xl shadow-black/10 ${isAuthenticated ? (isSidebarCollapsed ? 'md:ml-[80px]' : 'md:ml-64') : ''}`}>
                <main className="flex-1 flex flex-col overflow-hidden relative bg-[#F4F7F9]">
                    {/* Workspace Header */}
                    {(isAuthenticated || ((currentView as any) !== 'home' && (currentView as any) !== 'settings')) && (
                        <>
                            <header className="h-[56px] flex items-center justify-between px-6 flex-shrink-0 z-10 w-full bg-white border-b border-[rgba(0,0,0,0.06)] font-sans">
                                <div className="flex items-center gap-12">
                                <div className="flex items-center gap-6">
                                    <h1 className="text-base font-bold text-[#1C1C1C] tracking-tight min-w-[60px]">
                                        {selectedDevice ? t('terminal_title', user?.language) :
                                            (currentView === 'home' || currentView === 'dashboard') ? t('home_title', user?.language) :
                                                currentView === 'host' ? t('host_title', user?.language) :
                                                    currentView === 'devices' ? t('devices_title', user?.language) :
                                                        currentView === 'settings' ? t('settings_title', user?.language) :
                                                            currentView === 'billing' ? t('billing_title', user?.language) :
                                                                currentView === 'profile' ? t('profile_title_nav', user?.language) :
                                                                    currentView === 'support' ? t('support_title_nav', user?.language) :
                                                                        currentView === 'documentation' ? t('docs_title_nav', user?.language) : currentView}
                                    </h1>
                                    
                                    <div className="flex items-center gap-4 text-[#757575]">
                                        <button 
                                            onClick={handleBack}
                                            disabled={historyIndex === 0}
                                            className={`transition-colors ${historyIndex > 0 ? 'hover:text-[#1C1C1C]' : 'opacity-30 cursor-not-allowed'}`}
                                        >
                                            <ChevronLeft size={18} />
                                        </button>
                                        <button 
                                            onClick={handleForward}
                                            disabled={historyIndex === history.length - 1}
                                            className={`transition-colors ${historyIndex < history.length - 1 ? 'hover:text-[#1C1C1C]' : 'opacity-30 cursor-not-allowed'}`}
                                        >
                                            <ChevronRight size={18} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 max-w-xl mx-8">
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-4 flex items-center text-[#757575]">
                                        <Search size={16} />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder={t('search_and_connect', user?.language)}
                                        className="w-full h-9 pl-11 pr-20 bg-white border border-[#D1D1D1] rounded-lg text-sm outline-none focus:border-blue-500 transition-all placeholder:text-[#757575]"
                                    />
                                    <div className="absolute inset-y-0 right-3 flex items-center">
                                        <span className="text-[10px] font-medium text-[#757575] bg-[#F4F7F9] px-1.5 py-0.5 rounded border border-[#D1D1D1]">Ctrl + K</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-5 text-[#757575]">
                                <button className="hover:text-[#1C1C1C] transition-colors" title={t('documentation_tooltip', user?.language)} onClick={() => setCurrentView('documentation')}><Book size={18} /></button>
                                <button className="hover:text-[#1C1C1C] transition-colors" title={t('settings_tooltip', user?.language)} onClick={() => setCurrentView('settings')}><Settings size={18} /></button>
                                <button 
                                    className={`hover:text-[#1C1C1C] transition-colors relative ${showNotifications ? 'text-[#1C1C1C]' : ''}`} 
                                    title={t('notifications_tooltip', user?.language)}
                                    onClick={() => setShowNotifications(!showNotifications)}
                                >
                                    <Bell size={18} />
                                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_4px_rgba(239,68,68,0.5)]" />
                                </button>

                                
                                <div className="h-8 w-px bg-[rgba(0,0,0,0.06)] mx-1" />
                                
                                <div className="relative" ref={userDropdownRef}>
                                    <button 
                                        onClick={() => setShowUserDropdown(!showUserDropdown)}
                                        className="relative group cursor-pointer"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shadow-sm overflow-hidden">
                                            {user?.avatar ? (
                                                <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                                            ) : (() => {
                                                const name = user?.name || user?.email || '';
                                                const parts = name.trim().split(/\s+/);
                                                if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
                                                return name.slice(0, 2).toUpperCase();
                                            })()}
                                        </div>
                                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#71DD8C] rounded-full border-2 border-white" />
                                    </button>

                                    {showUserDropdown && (
                                        <div className="absolute top-full right-0 mt-3 w-64 bg-white rounded-xl border border-[rgba(0,0,0,0.08)] shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-[100] font-sans">
                                            {/* Profile Header */}
                                            <div className="p-4 flex items-start gap-3">
                                                <div className="relative">
                                                    <div className="w-10 h-10 rounded-full bg-[#E91E63] flex items-center justify-center text-white text-sm font-bold shadow-sm">
                                                        {(() => {
                                                            const name = user?.name || user?.email || '';
                                                            const parts = name.trim().split(/\s+/);
                                                            if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
                                                            return name.slice(0, 2).toUpperCase();
                                                        })()}
                                                    </div>
                                                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-[#71DD8C] rounded-full border-2 border-white flex items-center justify-center">
                                                        <Check size={7} className="text-white" />
                                                    </div>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-semibold text-[#1C1C1C] leading-tight">{user?.name || 'User'}</span>
                                                    <span className="text-[11px] font-bold text-blue-600 mt-0.5 uppercase tracking-wide">{user?.plan || 'TRIAL'}</span>
                                                    <div className="flex items-center gap-1 mt-1 cursor-pointer hover:bg-gray-50 px-1.5 py-0.5 -ml-1.5 rounded transition-colors">
                                                        <span className="text-xs text-[#757575]">{t('online_status', user?.language)}</span>
                                                        <ChevronDown size={12} className="text-[#757575]" />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="h-px bg-[rgba(0,0,0,0.06)]" />
                                            
                                            {/* Navigation Section 1 */}
                                            <div className="py-1">
                                                <button 
                                                    onClick={() => { setCurrentView('settings'); setShowUserDropdown(false); }}
                                                    className="w-full flex items-center justify-between px-4 py-2 text-[13px] text-[#1C1C1C] hover:bg-[rgba(28,28,28,0.04)] transition-colors"
                                                >
                                                    <span>{t('edit_profile', user?.language)}</span>
                                                </button>
                                                <button 
                                                    className="w-full flex items-center justify-between px-4 py-2 text-[13px] text-[#1C1C1C] hover:bg-[rgba(28,28,28,0.04)] transition-colors"
                                                >
                                                    <span>{t('management_console', user?.language)}</span>
                                                    <ExternalLink size={12} className="text-[#757575]" />
                                                </button>
                                                <button 
                                                    className="w-full flex items-center justify-between px-4 py-2 text-[13px] text-[#1C1C1C] hover:bg-[rgba(28,28,28,0.04)] transition-colors"
                                                >
                                                    <span>{t('open_device_dock', user?.language)}</span>
                                                </button>
                                            </div>

                                            <div className="h-px bg-[rgba(0,0,0,0.06)]" />

                                            {/* Navigation Section 2 */}
                                            <div className="py-1">
                                                <button 
                                                    className="w-full flex items-center justify-between px-4 py-2 text-[13px] text-[#1C1C1C] hover:bg-[rgba(28,28,28,0.04)] transition-colors"
                                                >
                                                    <span>{t('upgrade_plan', user?.language)}</span>
                                                    <ExternalLink size={12} className="text-[#757575]" />
                                                </button>
                                                <button 
                                                    className="w-full flex items-center justify-between px-4 py-2 text-[13px] text-[#1C1C1C] hover:bg-[rgba(28,28,28,0.04)] transition-colors"
                                                >
                                                    <span>{t('customer_portal', user?.language)}</span>
                                                    <ExternalLink size={12} className="text-[#757575]" />
                                                </button>
                                                <button 
                                                    className="w-full flex items-center justify-between px-4 py-2 text-[13px] text-[#1C1C1C] hover:bg-[rgba(28,28,28,0.04)] transition-colors"
                                                >
                                                    <span>{t('help_label', user?.language)}</span>
                                                    <ChevronRight size={12} className="text-[#757575]" />
                                                </button>
                                            </div>

                                            <div className="h-px bg-[rgba(0,0,0,0.06)]" />
                                            
                                            {/* Sign Out Section */}
                                            <div className="py-1">
                                                <button 
                                                    onClick={() => { handleLogout(); setShowUserDropdown(false); }}
                                                    className="w-full flex items-center px-4 py-2 text-[13px] text-[#1C1C1C] hover:bg-[rgba(28,28,28,0.04)] transition-colors"
                                                >
                                                    {t('sign_out', user?.language)}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            </header>
                            
                            {/* License Banner */}
                            <div className="h-8 w-full flex items-center justify-center bg-[#EEF2FC] flex-shrink-0 font-sans border-b border-[rgba(0,0,0,0.03)]">
                                <span className="text-[11px] text-[#4A4A4A]">
                                    {t('free_license_banner', user?.language)} <button className="text-blue-600 hover:underline ml-1">{t('upgrade_plan', user?.language)}</button>
                                </span>
                            </div>
                        </>
                    )}

                    <div className={`flex-1 ${currentView === 'home' ? 'overflow-hidden' : 'overflow-y-auto custom-scrollbar'}`}>
                        {(!isAuthenticated || currentView === 'home') ? (
                            <div className={`w-full h-full overflow-hidden animate-in fade-in duration-700`}>
                                <SnowHome
                                    localAuthKey={localAuthKey}
                                    hostStatus={hostStatus}
                                    devicePassword={devicePassword}
                                    isAutoHostEnabled={isAutoHostEnabled}
                                    onCopyAccessKey={copyAccessKey}
                                    onToggleAutoHost={() => {
                                        const nextValue = !isAutoHostEnabled;
                                        setIsAutoHostEnabled(nextValue);
                                        localStorage.setItem('is_auto_host_enabled', String(nextValue));
                                    }}
                                    onOpenSetPassword={() => setActionModal({ type: 'password', device: null })}
                                    onStartHosting={handleStartHosting}
                                    onStopHosting={handleStopHosting}
                                    isElectron={isElectron}
                                    isAuthenticated={isAuthenticated}
                                    connectStep={viewerStep}
                                    sessionCode={sessionCode}
                                    accessPassword={accessPassword}
                                    connectError={viewerError || null}
                                    connectStatus={viewerStatus}
                                    targetDeviceName={targetDeviceName}
                                    lockoutSeconds={lockoutSeconds}
                                    onSessionCodeChange={setSessionCode}
                                    onAccessPasswordChange={setAccessPassword}
                                    onFindDevice={handleFindDevice}
                                    onConnectToHost={handleConnectToHost}
                                    onBackToStep1={() => { setViewerStep(1); setViewerError(''); setViewerStatus('idle'); setAccessPassword(''); setLockoutSeconds(0); }}
                                    onSignIn={() => { setShowAuthModal(true); setAuthMode('login'); }}
                                    onSignUp={() => { setShowAuthModal(true); setAuthMode('signup'); }}
                                    onOpenSettings={() => setCurrentView('settings')}
                                    formatCode={formatCode}
                                    user={user}
                                    isRegistered={isLocalHostRegistered}
                                />
                            </div>
                        ) : (currentView === 'dashboard' && !selectedDevice) ? (
                            <div className="w-full flex flex-col animate-in fade-in duration-700">
                                <SnowPremiumDashboard
                                    user={user}
                                    localAuthKey={localAuthKey}
                                    devicePassword={devicePassword}
                                    onNavigate={setCurrentView}
                                    onConnect={() => setCurrentView('connect')}
                                    onOpenSetPassword={() => setActionModal({ type: 'password', device: null })}
                                    formatCode={formatCode}
                                />
                            </div>
                        ) : (currentView === 'settings' && !selectedDevice) ? (
                            <div className="w-full flex flex-col flex-1 animate-in fade-in duration-700 h-full overflow-hidden">
                                <SnowPremiumSettings 
                                    user={user}
                                    logout={() => {
                                        storeLogout();
                                    }}
                                />
                            </div>
                        ) : selectedDevice ? (
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
                                <div className="flex items-center gap-3 text-[#1C1C1C] text-[11px] font-bold mb-10 tracking-widest uppercase">
                                    <span className="bg-[rgba(28,28,28,0.05)] px-2 py-1 rounded-lg font-mono text-[#1C1C1C]">#{selectedDevice.access_key}</span>
                                    <div className="w-1.5 h-1.5 rounded-full bg-[rgba(28,28,28,0.1)]" />
                                    <span>Secure Link Ready</span>
                                </div>

                                <div className="flex gap-4 w-full max-w-sm">
                                    <button
                                        onClick={() => setSelectedDevice(null)}
                                        className="flex-1 py-3.5 rounded-2xl font-bold text-[11px] uppercase tracking-widest text-[#1C1C1C] hover:text-[#1C1C1C] bg-white border border-[rgba(28,28,28,0.15)] hover:border-[rgba(28,28,28,0.2)] transition shadow-sm"
                                    >
                                        Go Back
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (user?.role === 'VIEWER') {
                                                showError('Access Denied', 'Your role is View-Only. You do not have permission to connect to devices.');
                                                return;
                                            }
                                            handleDeviceClick(selectedDevice);
                                        }}
                                        disabled={viewerStatus === 'connecting' || user?.role === 'VIEWER'}
                                        className={`flex-1 py-3.5 rounded-2xl font-bold text-[11px] uppercase tracking-widest text-white shadow-lg shadow-black/10 flex items-center justify-center gap-2 transition active:scale-[0.98] ${user?.role === 'VIEWER' ? 'bg-[rgba(28,28,28,0.1)] cursor-not-allowed' : 'bg-[#1C1C1C]'}`}
                                    >
                                        {viewerStatus === 'connecting' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <>Establish Link <Zap size={14} /></>}
                                    </button>
                                </div>
                            </div>
                        ) : currentView === 'connect' ? (
                            /* --- QUICK CONNECT VIEW (AUTHENTICATED) --- */
                            <div className="flex-1 flex flex-col items-center justify-center p-8 min-h-[80vh]">
                                <div className="w-full max-w-sm animate-in fade-in zoom-in-95 duration-500">
                                    <div className="flex items-center gap-3 mb-10 group cursor-default justify-center">
                                        <div className="w-14 h-14 rounded-2xl bg-[#1C1C1C] flex items-center justify-center shadow-xl shadow-black/10 transition-transform duration-300 overflow-hidden border border-white/5">
                                            <img src={logo} alt="Connect-X" className="w-10 h-10 object-contain" />
                                        </div>
                                        <div className="flex flex-col text-left">
                                            <span className="text-xl font-bold text-[#1C1C1C] tracking-tighter leading-none">Connect-X</span>
                                            <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#1C1C1C] mt-1">Direct Link</span>
                                        </div>
                                    </div>

                                    <div className=" 
 mb-8">
                                        <h1 className="text-3xl font-extrabold text-[#1C1C1C] tracking-tight mb-2">Quick Connect</h1>
                                        <p className="text-sm font-medium text-[#1C1C1C] leading-relaxed">
                                            Enter the device access key and password to connect directly to a remote node.
                                        </p>
                                    </div>

                                    {viewerStep === 1 ? (
                                        <div className="space-y-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-bold text-[#1C1C1C] uppercase tracking-wider block ml-1">Device Access Key</label>
                                                <div className="relative group">
                                                    <div className="absolute inset-y-0 left-4 flex items-center text-[#1C1C1C] group-focus-within:text-[#1C1C1C] transition-colors">
                                                        <Monitor size={16} />
                                                    </div>
                                                    <input
                                                        autoFocus
                                                        type="text"
                                                        placeholder="000 000 000"
                                                        className="w-full bg-[#F8F9FA] border border-[rgba(28,28,28,0.15)] text-[#1C1C1C] rounded-[18px] pl-12 pr-4 py-3.5 text-sm font-mono font-bold tracking-[0.2em]  
 focus:bg-white focus:border-[rgba(28,28,28,0.2)] focus:ring-4 focus:ring-black/5 outline-none transition-all placeholder:text-[#1C1C1C]"
                                                        value={sessionCode}
                                                        onChange={e => setSessionCode(formatCode(e.target.value))}
                                                        onKeyDown={e => { if (e.key === 'Enter') handleFindDevice(); }}
                                                        maxLength={11}
                                                    />
                                                </div>
                                            </div>

                                            {viewerError && (
                                                <div className="flex items-start gap-2.5 px-4 py-3 bg-red-50 border border-red-100 rounded-2xl animate-in fade-in duration-200">
                                                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full mt-1.5 flex-shrink-0" />
                                                    <p className="text-xs font-semibold text-red-600 leading-relaxed">{viewerError}</p>
                                                </div>
                                            )}

                                            <button
                                                type="button"
                                                onClick={handleFindDevice}
                                                disabled={viewerStatus === 'connecting' || !sessionCode}
                                                className="w-full py-4 bg-[#1C1C1C] text-white rounded-2xl font-bold text-sm shadow-xl shadow-black/10 hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
                                            >
                                                {viewerStatus === 'connecting' ? <RefreshCw size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                                                FIND DEVICE
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                            <div className="flex items-center gap-3 p-4 bg-[#F8F9FA] rounded-2xl border border-[rgba(28,28,28,0.04)] mb-2">
                                                <div className="w-8 h-8 bg-[#1C1C1C] rounded-xl flex items-center justify-center flex-shrink-0">
                                                    <Monitor size={14} className="text-white" />
                                                </div>
                                                <div className="flex-1 min-w-0 text-left">
                                                    <p className="text-[10px] font-bold text-[#1C1C1C] uppercase tracking-widest">Target Device</p>
                                                    <p className="text-sm font-bold text-[#1C1C1C] font-mono">{formatCode(sessionCode)}</p>
                                                </div>
                                                <div className="w-2.5 h-2.5 bg-[#71DD8C] rounded-full animate-pulse" />
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-bold text-[#1C1C1C] uppercase tracking-wider block ml-1">Device Password</label>
                                                <div className="relative group">
                                                    <div className="absolute inset-y-0 left-4 flex items-center text-[#1C1C1C] group-focus-within:text-[#1C1C1C] transition-colors">
                                                        <Lock size={16} />
                                                    </div>
                                                    <input
                                                        autoFocus
                                                        type={showManualPassword ? 'text' : 'password'}
                                                        placeholder="••••••••"
                                                        className="w-full bg-[#F8F9FA] border border-[rgba(28,28,28,0.15)] text-[#1C1C1C] rounded-[18px] pl-12 pr-12 py-3.5 text-sm font-medium focus:bg-white focus:border-[rgba(28,28,28,0.2)] focus:ring-4 focus:ring-black/5 outline-none transition-all placeholder:text-[#1C1C1C]"
                                                        value={accessPassword}
                                                        onChange={e => setAccessPassword(e.target.value)}
                                                        onKeyDown={e => { if (e.key === 'Enter') handleConnectToHost(); }}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowManualPassword(!showManualPassword)}
                                                        className="absolute inset-y-0 right-4 flex items-center text-[#1C1C1C] hover:text-[#1C1C1C] transition-colors"
                                                    >
                                                        {showManualPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                                    </button>
                                                </div>
                                            </div>

                                            {viewerError && (
                                                <div className="flex items-start gap-2.5 px-4 py-3 bg-red-50 border border-red-100 rounded-2xl animate-in fade-in duration-200">
                                                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full mt-1.5 flex-shrink-0" />
                                                    <p className="text-xs font-semibold text-red-600 leading-relaxed">{viewerError}</p>
                                                </div>
                                            )}

                                            <button
                                                type="button"
                                                onClick={handleConnectToHost}
                                                disabled={viewerStatus === 'connecting' || !accessPassword}
                                                className="w-full py-4 bg-[#1C1C1C] text-white rounded-2xl font-bold text-sm shadow-xl shadow-black/10 hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
                                            >
                                                {viewerStatus === 'connecting' ? <RefreshCw size={16} className="animate-spin" /> : <Zap size={16} />}
                                                ESTABLISH LINK
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => { setViewerStep(1); setViewerError(''); setViewerStatus('idle'); setAccessPassword(''); }}
                                                className="w-full text-xs font-bold text-[#1C1C1C] hover:text-[#1C1C1C] uppercase tracking-widest transition-colors py-2"
                                            >
                                                ← Change Device
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (currentView as any) === 'sessions' ? (
                            /* --- ACTIVE SESSIONS VIEW --- */
                            <div className="w-full pt-8 animate-in fade-in duration-700">
                                <div className="bg-white rounded-[32px] border border-[rgba(28,28,28,0.15)] p-8 shadow-sm">
                                    <div className="flex items-center gap-4 mb-8">
                                        <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center">
                                            <Activity className="text-blue-600" size={24} />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold text-[#1C1C1C]">Active Remote Sessions</h2>
                                            <p className="text-sm text-[#1C1C1C]">Real-time connections to your fleet</p>
                                        </div>
                                    </div>

                                    {activeSessionCount === 0 ? (
                                        <div className="py-20 flex flex-col items-center justify-center  
">
                                            <div className="w-20 h-20 bg-[#F8F9FA] rounded-[32px] flex items-center justify-center mb-6">
                                                <Radio className="text-[#000000] w-10 h-10" />
                                            </div>
                                            <h3 className="text-lg font-bold text-[#1C1C1C] mb-2">No Active Streams</h3>
                                            <p className="text-sm text-[#1C1C1C] max-w-xs">You don't have any active remote control sessions at the moment.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {/* We mock the session list here as we don't have a granular list in state yet */}
                                            <div className="p-6 rounded-2xl bg-[#F8F9FA] border border-[rgba(28,28,28,0.02)] flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
                                                        <Monitor className="text-blue-500" size={20} />
                                                    </div>
                                                    <div>
                                                        <span className="text-sm font-bold text-[#1C1C1C]">Encrypted P2P Link</span>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                                            <span className="text-[10px] font-bold text-[#1C1C1C] uppercase">Active Now</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <button onClick={() => setCurrentView('dashboard')} className="snow-btn-secondary !py-2 !px-6 !text-[10px]">Back to Overview</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : currentView === 'host' ? (
                            /* --- HOST THIS DEVICE VIEW --- */
                            <div className="w-full pt-4 animate-in fade-in duration-700">
                                <SnowHost
                                    status={hostStatus}
                                    accessKey={hostAccessKey}
                                    isAutoHost={isAutoHostEnabled}
                                    setIsAutoHost={(val: boolean) => {
                                        setIsAutoHostEnabled(val);
                                        localStorage.setItem('is_auto_host_enabled', String(val));
                                    }}
                                    handleStartHosting={handleStartHosting}
                                    handleStopHosting={handleStopHosting}
                                    copyAccessKey={copyAccessKey}
                                    openPasswordModal={() => setActionModal({ type: 'password', device: null })}
                                    bandwidth={hostStats.bandwidth}
                                    activeUsers={hostStats.activeUsers}
                                    isRegistered={isLocalHostRegistered}
                                    onRegister={handleRegisterLocalDevice}
                                />
                            </div>
                        ) : currentView === 'billing' ? (
                            /* --- BILLING VIEW --- */
                            <div className="w-full pt-4 animate-in fade-in duration-700">
                                <SnowBilling user={user} />
                            </div>
                        ) : currentView === 'documentation' ? (
                            /* --- SNOW UI DOCUMENTATION VIEW --- */
                            <div className="w-full h-full animate-in fade-in duration-700">
                                <SnowDocumentation onNavigateToSupport={() => setCurrentView('support')} />
                            </div>
                        ) : currentView === 'profile' ? (
                            /* --- PROFILE ALIASED TO SETTINGS --- */
                            <div className="w-full h-full pt-8 animate-in fade-in duration-700 px-8">
                                <SnowSettings
                                    serverIP={serverIP}
                                    isAutoHostEnabled={isAutoHostEnabled}
                                    setIsAutoHostEnabled={(val) => {
                                        setIsAutoHostEnabled(val);
                                        localStorage.setItem('is_auto_host_enabled', String(val));
                                        if (val && hostStatus !== 'status') {
                                            handleStartHosting();
                                        } else if (!val && hostStatus === 'status') {
                                            handleStopHosting();
                                        }
                                    }}
                                    onRenameDevice={() => setActionModal({ type: 'rename', device: null })}
                                    logout={handleLogout}
                                    onClose={() => setCurrentView('dashboard')}
                                />
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
                                    user={user}
                                    searchQuery={searchQuery}
                                    setSearchQuery={setSearchQuery}
                                    setSelectedDevice={setSelectedDevice}
                                    handleDeviceClick={handleDeviceClick}
                                    setActionModal={setActionModal}
                                    setShowAddModal={setShowAddModal}
                                    handleBulkDelete={handleBulkDelete}
                                />
                            </div>
                        ) : (currentView as string) === 'members' ? (
                            <div className="w-full h-full pt-8 animate-in fade-in duration-700">
                                <SnowMembers />
                            </div>
                        ) : (currentView as string) === 'organizations' ? (
                            <div className="w-full h-full pt-8 animate-in fade-in duration-700">
                                <SnowOrgs
                                    setCurrentView={setCurrentView}
                                    setSelectedDevice={setSelectedDevice}
                                    setSearchQuery={setSearchQuery}
                                />
                            </div>
                        ) : (currentView as string) === 'analytics' ? (
                            <div className="w-full h-full pt-8 animate-in fade-in duration-700">
                                <SnowAnalytics
                                    onSelectOrg={(orgId) => {
                                        setOrgDetailId(orgId);
                                        setCurrentView('org-detail');
                                    }}
                                    onPayoutClick={() => setCurrentView('billing')}
                                />
                            </div>
                        ) : (currentView as string) === 'org-detail' ? (
                            <div className="w-full h-full pt-8 animate-in fade-in duration-700 px-8 overflow-y-auto custom-scrollbar">
                                <SnowOrgDetail
                                    orgId={orgDetailId!}
                                    onBack={() => setCurrentView('analytics')}
                                />
                            </div>
                        ) : null}
                    </div>
                </main>

                <SnowNotificationPanel 
                    isOpen={showNotifications} 
                    onClose={() => setShowNotifications(false)} 
                />
            </div>

            {/* MODALS LAYER - Removed old settings modal in favor of full-page SnowPremiumSettings */}


            {/* Set Password Before Hosting Modal */}
            {showSetPasswordModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-[#1C1C1C]/20 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="w-full max-w-sm bg-white p-8 rounded-[28px] shadow-2xl border border-[rgba(28,28,28,0.15)] animate-in zoom-in-95 duration-300">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-orange-50 rounded-2xl flex items-center justify-center"><Shield size={18} className="text-orange-500" /></div>
                                <div>
                                    <h3 className="text-sm font-bold text-[#1C1C1C]">Set Access Password</h3>
                                    <p className="text-[10px] text-[#1C1C1C]">Required before this device can host</p>
                                </div>
                            </div>
                            <button onClick={() => { setShowSetPasswordModal(false); setSetupPassword(''); setSetupPasswordConfirm(''); setSetupPasswordError(''); }} className="p-2 text-[#1C1C1C] hover:text-[#1C1C1C] rounded-xl hover:bg-[#F9F9FA] transition-colors"><X className="w-4 h-4" /></button>
                        </div>
                        <p className="text-xs text-[#000000] mb-5 leading-relaxed">Viewers will need this password to connect to your device. Choose something secure.</p>
                        <div className="space-y-3 mb-5">
                            <input
                                type="password"
                                placeholder="Create password"
                                value={setupPassword}
                                onChange={e => { setSetupPassword(e.target.value); setSetupPasswordError(''); }}
                                className="w-full px-4 py-3 bg-[#F9F9FA] rounded-2xl border border-[rgba(28,28,28,0.15)] text-sm text-[#1C1C1C] font-mono outline-none"
                                autoFocus
                            />
                            <input
                                type="password"
                                placeholder="Confirm password"
                                value={setupPasswordConfirm}
                                onChange={e => { setSetupPasswordConfirm(e.target.value); setSetupPasswordError(''); }}
                                className="w-full px-4 py-3 bg-[#F9F9FA] rounded-2xl border border-[rgba(28,28,28,0.15)] text-sm text-[#1C1C1C] font-mono outline-none"
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
                            className="w-full py-3.5 bg-[#1C1C1C] text-white rounded-2xl text-sm font-bold disabled:opacity-100 hover:opacity-90 transition-all"
                        >
                            Set Password & Start Hosting
                        </button>
                    </div>
                </div>
            )}

            {/* Password Prompt Modal */}
            {showPasswordPrompt && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-[#1C1C1C]/20 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="w-full max-w-md bg-white p-8 rounded-[24px] shadow-2xl border border-[rgba(28,28,28,0.15)] animate-in zoom-in-95 duration-300">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-xl font-bold text-[#1C1C1C] tracking-tight uppercase">Authentication Required</h3>
                            <button onClick={() => setShowPasswordPrompt(null)} className="p-2 text-[#1C1C1C] hover:text-[#1C1C1C] hover:bg-[#F8F9FA] rounded-xl transition-colors"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="relative mb-8">
                            <input
                                type={showPromptPassword ? "text" : "password"}
                                placeholder="Network Hardware Key"
                                value={promptPassword}
                                onChange={e => setPromptPassword(e.target.value)}
                                className="purity-input font-mono  
 text-2xl tracking-[0.2em] pr-12"
                                autoFocus
                            />
                            <button onClick={() => setShowPromptPassword(!showPromptPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#1C1C1C] hover:text-[#1C1C1C] transition-colors">
                                {showPromptPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                        <label className="flex items-center gap-3 cursor-pointer mb-8 p-4 rounded-2xl bg-[#F8F9FA] border border-[rgba(28,28,28,0.04)] hover:border-[rgba(28,28,28,0.1)] transition-all">
                            <input type="checkbox" checked={promptRemember} onChange={e => setPromptRemember(e.target.checked)} className="w-4 h-4 rounded border-[rgba(28,28,28,0.2)] text-[#1C1C1C] focus:ring-[#1C1C1C]" />
                            <span className="text-xs font-bold text-[#1C1C1C] uppercase tracking-widest">Remember this machine</span>
                        </label>
                        <button onClick={submitPasswordPrompt} disabled={!promptPassword || viewerStatus === 'connecting'} className="snow-btn w-full">ESTABLISH SECURE LINK</button>
                    </div>
                </div>
            )}

            {/* Add Device Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-[#1C1C1C]/20 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="w-full max-w-md bg-white p-8 rounded-[24px] shadow-2xl border border-[rgba(28,28,28,0.15)] animate-in zoom-in-95 duration-300">
                        <div className="flex justify-between items-center mb-8">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-[#F8F9FA] rounded-[18px] flex items-center justify-center text-[#1C1C1C] shadow-sm border border-[rgba(28,28,28,0.04)]">
                                    <Plus className="w-6 h-6" />
                                </div>
                                <h3 className="text-lg font-bold text-[#1C1C1C] tracking-tight uppercase">Import Node</h3>
                            </div>
                            <button onClick={() => setShowAddModal(false)} className="p-2 text-[#1C1C1C] hover:text-[#1C1C1C] hover:bg-[#F8F9FA] rounded-xl transition-colors"><X className="w-5 h-5" /></button>
                        </div>

                        <div className="space-y-6 mb-10">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-[#1C1C1C] uppercase tracking-[0.2em] ml-1">Network ID</label>
                                <input type="text" placeholder="000 000 000" value={addKey} onChange={e => setAddKey(formatCode(e.target.value))} className="purity-input font-mono  
 tracking-[0.2em]" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-[#1C1C1C] uppercase tracking-[0.2em] ml-1">Security Token</label>
                                <div className="relative">
                                    <input type={showAddPassword ? "text" : "password"} placeholder="••••••••" value={addPassword} onChange={e => setAddPassword(e.target.value)} className="purity-input font-mono  
 pr-12" />
                                    <button onClick={() => setShowAddPassword(!showAddPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#1C1C1C] hover:text-[#1C1C1C] transition-colors">
                                        {showAddPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                        </div>
                        <button onClick={handleAddDevice} disabled={!addKey || !addPassword} className="snow-btn w-full disabled:opacity-50 tracking-widest">ADD TO MESH NETWORK</button>
                    </div>
                </div>
            )}
               {actionModal && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-[#1C1C1C]/20 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="w-full max-w-sm bg-white p-10 rounded-[32px] shadow-2xl border border-[rgba(28,28,28,0.1)] animate-in zoom-in-95 duration-300">
                        <div className="mb-8 text-center">
                            <div className="w-16 h-16 bg-[#F8F9FA] rounded-[24px] flex items-center justify-center mx-auto mb-6 border border-[rgba(28,28,28,0.06)]">
                                {actionModal.type === 'rename' ? <Edit2 size={24} className="text-[#1C1C1C]" /> :
                                 actionModal.type === 'password' ? <KeyRound size={24} className="text-[#1C1C1C]" /> :
                                 <Trash2 size={24} className="text-red-500" />}
                            </div>
                            <h3 className="text-xl font-bold text-[#1C1C1C] mb-2 tracking-tight uppercase">
                                {actionModal.type === 'rename' ? 'Modify Identity' :
                                    actionModal.type === 'password' ? 'Hardware Key' :
                                        actionModal.type === 'remove' ? 'Sever Connection' : ''}
                            </h3>
                            <p className="text-[10px] font-bold text-[rgba(28,28,28,0.4)] leading-relaxed uppercase tracking-[0.2em] max-w-[240px] mx-auto">
                                {actionModal.type === 'rename' ? 'Set a persistent nickname for this machine.' :
                                    actionModal.type === 'password' ? 'Update the hardware access credentials.' :
                                        actionModal.type === 'remove' ? `Unlink ${actionModal.device.device_name} from your account?` : ''}
                            </p>
                        </div>

                        {(actionModal.type === 'rename' || actionModal.type === 'password') && (
                            <div className="space-y-4 mb-8">
                                <div className="relative">
                                    <input
                                        autoFocus
                                        type={actionModal.type === 'password' ? (showActionPassword ? 'text' : 'password') : 'text'}
                                        placeholder={actionModal.type === 'password' ? 'Secure Crypt Key' : 'e.g. Workstation Alpha'}
                                        className="w-full bg-[#F8F9FA] border border-[rgba(28,28,28,0.1)] text-[#1C1C1C] rounded-2xl px-6 py-4 text-sm font-bold focus:bg-white focus:border-[#1C1C1C] outline-none transition-all placeholder:text-[rgba(28,28,28,0.3)] tracking-widest"
                                        value={actionValue}
                                        onChange={e => setActionValue(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                if (actionModal.type === 'rename') handleRename(actionModal.device);
                                                if (actionModal.type === 'password') handleSetPassword(actionModal.device);
                                            }
                                        }}
                                    />
                                    {actionModal.type === 'password' && (
                                        <button 
                                            onClick={() => setShowActionPassword(!showActionPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-[rgba(28,28,28,0.3)] hover:text-[#1C1C1C] transition-colors"
                                        >
                                            {showActionPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="flex gap-4">
                            <button
                                onClick={() => { setActionModal(null); setShowActionPassword(false); }}
                                className="flex-1 py-4 rounded-2xl border border-[rgba(28,28,28,0.1)] text-[10px] font-bold uppercase tracking-widest hover:bg-[rgba(28,28,28,0.02)] transition-all text-[rgba(28,28,28,0.6)]"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    if (actionModal.type === 'rename') handleRename(actionModal.device);
                                    if (actionModal.type === 'remove') handleRemove(actionModal.device);
                                    if (actionModal.type === 'password') handleSetPassword(actionModal.device);
                                    setShowActionPassword(false);
                                }}
                                className={`flex-1 py-4 ${actionModal.type === 'remove' ? 'bg-red-600' : 'bg-[#1C1C1C]'} text-white rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all shadow-xl shadow-black/5`}
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* File Received Modal */}
            {fileReceivedModal && (
                <div className="fixed inset-0 z-[300] bg-[#1C1C1C]/20 backdrop-blur-md flex items-center justify-center p-6 animate-in zoom-in duration-300">
                    <div className="bg-white border border-[rgba(28,28,28,0.15)] shadow-2xl rounded-[32px] p-10 w-[500px] max-w-full flex flex-col items-center  
 relative">
                        <div className={`w-20 h-20 rounded-[24px] flex items-center justify-center mb-8 shadow-sm border ${fileReceivedModal.isRemote ? 'bg-blue-50 text-blue-500 border-blue-100' : 'bg-emerald-50 text-emerald-500 border-emerald-100'}`}>
                            <DownloadCloud className="w-10 h-10" />
                        </div>
                        <h3 className="text-2xl font-black text-[#1C1C1C] mb-1 uppercase tracking-tighter">
                            {fileReceivedModal.isRemote ? 'Payload Deployed' : 'Payload Received'}
                        </h3>
                        <p className="text-[10px] font-bold text-[#1C1C1C] mb-8 uppercase tracking-[0.2em]">
                            Successfully stored in {fileReceivedModal.isRemote ? 'Host' : 'Viewer'} storage
                        </p>

                        <div className="w-full bg-[#F8F9FA] rounded-2xl p-5 border border-[rgba(28,28,28,0.04)] mb-10 text-left overflow-hidden cursor-none">
                            <div className="flex flex-col gap-1.5">
                                <span className="text-[8px] font-black text-[#1C1C1C] uppercase tracking-widest">Absolute Destination Path</span>
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
                    <div className="w-full max-w-md bg-white p-10 rounded-[32px] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)] border border-[rgba(28,28,28,0.15)] animate-in zoom-in-95 duration-300  
">
                        <div className="w-20 h-20 bg-red-50 rounded-[28px] flex items-center justify-center text-red-500 mx-auto mb-8 border border-red-100">
                            <ShieldOff className="w-10 h-10" />
                        </div>
                        <h3 className="text-2xl font-black text-[#1C1C1C] mb-3 tracking-tighter uppercase">{errorModal.title}</h3>
                        <p className="text-xs font-bold text-[#1C1C1C] leading-relaxed uppercase tracking-[0.1em] mb-10">
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
