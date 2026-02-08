export class AudioHandler {
    private audioCtx: AudioContext | null = null;
    private nextStartTime: number = 0;
    private activeSources: AudioBufferSourceNode[] = [];
    private processor: ScriptProcessorNode | null = null;
    private stream: MediaStream | null = null;

    getAudioContext(): AudioContext {
        if (!this.audioCtx || this.audioCtx.state === 'closed') {
            const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
            const ctx = new AudioContextClass();
            this.audioCtx = ctx;
            console.log("🔊 AudioContext created, state:", ctx.state, "sampleRate:", ctx.sampleRate);

            ctx.onstatechange = () => {
                console.log("🔊 AudioContext state changed to:", ctx.state);
            };
        }
        return this.audioCtx!;
    }

    async playChunk(base64Data: string) {
        try {
            const ctx = this.getAudioContext();
            if (ctx.state === 'suspended') {
                await ctx.resume();
            }

            // Decode base64 properly
            const pcmBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
            const pcm16 = new Int16Array(pcmBytes.buffer);

            const buffer = ctx.createBuffer(1, pcm16.length, 24000); // Gemini output is 24kHz
            const channelData = buffer.getChannelData(0);

            // Normalize Int16 to Float32 (-1 to 1)
            for (let i = 0; i < pcm16.length; i++) {
                channelData[i] = pcm16[i] / 32768.0;
            }

            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(ctx.destination);

            this.activeSources.push(source);
            source.onended = () => {
                const index = this.activeSources.indexOf(source);
                if (index > -1) {
                    this.activeSources.splice(index, 1);
                }
            };

            // FIX: Remove artificial delay, schedule immediately if behind
            if (this.nextStartTime < ctx.currentTime) {
                this.nextStartTime = ctx.currentTime;
            }
            source.start(this.nextStartTime);
            this.nextStartTime += buffer.duration;
        } catch (error) {
            console.error("Audio playback error:", error);
        }
    }

    stopAllPlayback() {
        this.activeSources.forEach(source => {
            try {
                source.stop();
                source.disconnect();
            } catch (e) { }
        });
        this.activeSources = [];
        this.nextStartTime = 0;
    }

    async startMic(onAudioData: (base64: string) => void) {
        this.stopMic(); // Ensure clean start

        try {
            const ctx = this.getAudioContext();
            if (ctx.state === 'suspended') {
                await ctx.resume();
            }

            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    // FIX: Try to request 16kHz if browser supports it
                    sampleRate: { ideal: 16000 }
                }
            });

            const source = ctx.createMediaStreamSource(this.stream);

            // Buffer size for low latency
            const bufferSize = 2048;
            this.processor = ctx.createScriptProcessor(bufferSize, 1, 1);

            this.processor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                const pcm16 = new Int16Array(inputData.length);

                // Convert Float32 to Int16 PCM
                for (let i = 0; i < inputData.length; i++) {
                    const s = Math.max(-1, Math.min(1, inputData[i]));
                    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                }

                // FIX: Proper base64 encoding without spread operator
                const base64 = this.uint8ArrayToBase64(new Uint8Array(pcm16.buffer));
                onAudioData(base64);
            };

            source.connect(this.processor);
            this.processor.connect(ctx.destination);
            console.log("🎤 Mic connected - Buffer:", bufferSize, "Context Rate:", ctx.sampleRate);
        } catch (error) {
            console.error("Microphone error:", error);
            throw error;
        }
    }

    // FIX: Helper method for safe base64 encoding (handles large arrays)
    private uint8ArrayToBase64(bytes: Uint8Array): string {
        let binary = '';
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    stopMic() {
        if (this.processor) {
            this.processor.disconnect();
            this.processor.onaudioprocess = null;
            this.processor = null;
        }
        if (this.stream) {
            this.stream.getTracks().forEach(t => t.stop());
            this.stream = null;
        }
    }

    async close() {
        this.stopAllPlayback();
        this.stopMic();
        if (this.audioCtx && this.audioCtx.state !== 'closed') {
            await this.audioCtx.close();
            this.audioCtx = null;
        }
    }
}