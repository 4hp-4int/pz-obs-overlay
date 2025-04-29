// TalkingHeadManager.js
// Handles microphone input analysis and sprite animation for the talking head overlay

class TalkingHeadManager {
    constructor() {
        this.talkingHeadElement = document.getElementById('talking-head');
        this.audioContext = null;
        this.analyzer = null;
        this.microphone = null;
        this.dataArray = null;
        this.isInitialized = false;
        this.isSpeaking = false;
        this.lastFrameSwitch = 0;
        this.lastSilence = Date.now();
        this.frameInterval = 120; // ms between frame changes
        this.talkingThreshold = 15; // adjust based on testing
        this.silenceThreshold = 5; // adjust based on testing
        this.currentFrame = 1; // start with closed mouth

        // Sprite sheet configuration
        this.frames = {
            closed: 1,
            smallOpen: 2,
            wideOpen: 3,
            smirk: 4
        };

        // The sprite sheet is displayed at 514x514 via CSS (scaled from 1024x1024)
        // Each frame is 257x257 in the scaled view (slightly adjusted to prevent pixel seams)
        this.framePositions = {
            1: { x: 0, y: 0 },     // top-left (closed)
            2: { x: 257, y: 0 },   // top-right (small open)
            3: { x: 0, y: 257 },   // bottom-left (wide open)
            4: { x: 257, y: 257 }  // bottom-right (smirk)
        };
    }

    // Initialize microphone access and audio processing
    async initialize() {
        try {
            // Request microphone access
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // Set up audio context and analyzer
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyzer = this.audioContext.createAnalyser();
            this.microphone = this.audioContext.createMediaStreamSource(stream);

            // Connect microphone to analyzer
            this.microphone.connect(this.analyzer);

            // Configure analyzer
            this.analyzer.fftSize = 256;
            const bufferLength = this.analyzer.frequencyBinCount;
            this.dataArray = new Uint8Array(bufferLength);

            // Start animation loop
            this.isInitialized = true;
            this.animate();

            console.log('TalkingHeadManager initialized successfully');
        } catch (error) {
            console.error('Failed to initialize TalkingHeadManager:', error);
        }
    }

    // Set the sprite frame
    setFrame(frameNumber) {
        if (frameNumber === this.currentFrame) return;

        this.currentFrame = frameNumber;
        const position = this.framePositions[frameNumber];

        if (position && this.talkingHeadElement) {
            // Apply slight offset correction to prevent pixel seams
            this.talkingHeadElement.style.backgroundPosition = `-${position.x}px -${position.y}px`;
        }
    }

    // Calculate the average volume level from analyzer data
    getVolumeLevel() {
        if (!this.isInitialized) return 0;

        this.analyzer.getByteFrequencyData(this.dataArray);

        // Calculate average volume
        let sum = 0;
        for (let i = 0; i < this.dataArray.length; i++) {
            sum += this.dataArray[i];
        }

        return sum / this.dataArray.length;
    }

    // Update talking head animation based on volume
    updateTalkingHead(volume) {
        const now = Date.now();

        if (volume > this.talkingThreshold) {
            this.isSpeaking = true;
            this.lastSilence = now;

            // Change frames at regular intervals while talking
            if (now - this.lastFrameSwitch > this.frameInterval) {
                const random = Math.random();

                // Higher volume = more chance of wide open mouth
                if (volume > this.talkingThreshold * 2) {
                    if (random < 0.3) {
                        this.setFrame(this.frames.closed);
                    } else if (random < 0.6) {
                        this.setFrame(this.frames.smallOpen);
                    } else {
                        this.setFrame(this.frames.wideOpen);
                    }
                } else {
                    // Regular talking
                    if (random < 0.4) {
                        this.setFrame(this.frames.closed);
                    } else if (random < 0.9) {
                        this.setFrame(this.frames.smallOpen);
                    } else {
                        this.setFrame(this.frames.wideOpen);
                    }
                }

                this.lastFrameSwitch = now;
            }
        } else {
            // Handle silence
            if (this.isSpeaking) {
                this.setFrame(this.frames.closed);
                this.isSpeaking = false;
            }

            // Occasionally show smirk during long silences (>10 seconds)
            const silenceDuration = now - this.lastSilence;
            if (silenceDuration > 10000 && now - this.lastFrameSwitch > 2000) {
                // 5% chance to smirk during long silences
                if (Math.random() < 0.05) {
                    this.setFrame(this.frames.smirk);
                    this.lastFrameSwitch = now;

                    // Return to closed mouth after a short time
                    setTimeout(() => {
                        this.setFrame(this.frames.closed);
                    }, 1000);
                }
            }
        }
    }

    // Animation loop
    animate() {
        if (!this.isInitialized) return;

        const volume = this.getVolumeLevel();
        this.updateTalkingHead(volume);

        // Continue animation loop
        requestAnimationFrame(this.animate.bind(this));
    }
} 