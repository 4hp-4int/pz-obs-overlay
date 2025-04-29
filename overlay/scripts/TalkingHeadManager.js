// TalkingHeadManager.js
// Handles microphone input analysis and sprite animation for the talking head overlay

class TalkingHeadManager {
    constructor(options = {}) {
        // DOM element
        this.talkingHeadElement = document.getElementById('talking-head');

        // Audio processing
        this.audioContext = null;
        this.analyzer = null;
        this.microphone = null;
        this.dataArray = null;
        this.isInitialized = false;

        // Animation state
        this.isSpeaking = false;
        this.lastFrameSwitch = 0;
        this.lastSilence = Date.now();
        this.currentFrame = 1; // start with closed mouth

        // Configurable parameters with defaults
        this.config = {
            // Animation timing
            frameInterval: options.frameInterval || 120, // ms between frame changes
            idleFrameInterval: options.idleFrameInterval || 2000, // ms between idle animations
            smirkDuration: options.smirkDuration || 10000, // ms to show smirk

            // Audio thresholds
            talkingThreshold: options.talkingThreshold || 15,
            silenceThreshold: options.silenceThreshold || 5,
            highVolumeMultiplier: options.highVolumeMultiplier || 2,

            // Sustained sound detection
            sustainedSoundDuration: options.sustainedSoundDuration || 250,
            sustainedSoundVolumeTolerance: options.sustainedSoundVolumeTolerance || 0.3,
            sustainedSoundHoldTolerance: options.sustainedSoundHoldTolerance || 0.5,

            // Animation probabilities
            closedMouthProbability: options.closedMouthProbability || { normal: 0.4, loud: 0.3 },
            smallOpenProbability: options.smallOpenProbability || { normal: 0.5, loud: 0.3 },
            idleSmirkProbability: options.idleSmirkProbability || 0.05,
            idleSilenceDuration: options.idleSilenceDuration || 10000,

            // Frequency weighting - focuses on speech frequencies
            frequencyWeighting: options.frequencyWeighting || {
                lower: 2.0,    // 85-255 Hz (more weight to bass)
                middle: 3.0,   // 256-2000 Hz (most weight to speech frequencies)
                upper: 1.0     // 2001+ Hz (less weight to high frequencies)
            }
        };

        // Sustained sound tracking
        this.lastVolumeLevel = 0;
        this.sustainedSoundStartTime = 0;
        this.isSustainedSound = false;

        // Volume smoothing
        this.volumeHistory = [];
        this.volumeHistorySize = 3;

        // Sprite sheet configuration
        this.frames = {
            closed: 1,
            smallOpen: 2,
            wideOpen: 3,
            smirk: 4
        };

        // Each frame is 128x128 in the sprite sheet (updated from 64x64)
        this.framePositions = {
            1: { x: 0, y: 0 },     // top-left (closed)
            2: { x: 128, y: 0 },    // top-right (small open)
            3: { x: 0, y: 128 },    // bottom-left (wide open)
            4: { x: 128, y: 128 }    // bottom-right (smirk)
        };
    }

    /**
     * Initialize microphone access and audio processing
     */
    async initialize() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // Set up audio context and analyzer
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyzer = this.audioContext.createAnalyser();
            this.microphone = this.audioContext.createMediaStreamSource(stream);

            // Connect microphone to analyzer
            this.microphone.connect(this.analyzer);

            // Configure analyzer with more detailed FFT for better frequency analysis
            this.analyzer.fftSize = 1024; // More detailed analysis (was 256)
            this.analyzer.smoothingTimeConstant = 0.5; // Add some smoothing
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

    /**
     * Set the sprite frame
     */
    setFrame(frameNumber) {
        if (frameNumber === this.currentFrame) return;

        this.currentFrame = frameNumber;
        const position = this.framePositions[frameNumber];

        if (position && this.talkingHeadElement) {
            this.talkingHeadElement.style.backgroundPosition = `-${position.x}px -${position.y}px`;
        }
    }

    /**
     * Calculate a weighted volume level from analyzer data
     * Gives more weight to speech frequencies
     */
    getVolumeLevel() {
        if (!this.isInitialized) return 0;

        this.analyzer.getByteFrequencyData(this.dataArray);

        // Get bins for different frequency ranges
        const binCount = this.dataArray.length;
        const lowerBound = Math.floor(binCount * 0.05); // ~85Hz
        const middleBound = Math.floor(binCount * 0.25); // ~2kHz

        let lowerSum = 0, middleSum = 0, upperSum = 0;
        let lowerCount = 0, middleCount = 0, upperCount = 0;

        // Calculate weighted sums for different frequency ranges
        for (let i = 0; i < binCount; i++) {
            if (i < lowerBound) {
                lowerSum += this.dataArray[i];
                lowerCount++;
            } else if (i < middleBound) {
                middleSum += this.dataArray[i];
                middleCount++;
            } else {
                upperSum += this.dataArray[i];
                upperCount++;
            }
        }

        // Apply weights to different frequency ranges
        const { frequencyWeighting } = this.config;
        const lowerAvg = (lowerCount > 0) ? (lowerSum / lowerCount) * frequencyWeighting.lower : 0;
        const middleAvg = (middleCount > 0) ? (middleSum / middleCount) * frequencyWeighting.middle : 0;
        const upperAvg = (upperCount > 0) ? (upperSum / upperCount) * frequencyWeighting.upper : 0;

        // Weighted average across all frequency bands
        const totalCount = lowerCount + middleCount + upperCount;
        const weightedVolume = (lowerAvg * lowerCount + middleAvg * middleCount + upperAvg * upperCount) / totalCount;

        // Apply smoothing using a simple moving average
        this.volumeHistory.push(weightedVolume);
        if (this.volumeHistory.length > this.volumeHistorySize) {
            this.volumeHistory.shift();
        }

        const smoothedVolume = this.volumeHistory.reduce((a, b) => a + b, 0) / this.volumeHistory.length;

        return smoothedVolume;
    }

    /**
     * Check if the current sound is sustained
     */
    checkSustainedSound(volume) {
        const now = Date.now();
        const volumeDiff = Math.abs(volume - this.lastVolumeLevel);
        const { talkingThreshold, sustainedSoundVolumeTolerance, sustainedSoundHoldTolerance, sustainedSoundDuration } = this.config;

        // If volume is consistent and above threshold, consider it sustained
        if (volume > talkingThreshold && volumeDiff < talkingThreshold * sustainedSoundVolumeTolerance) {
            if (!this.isSustainedSound) {
                this.sustainedSoundStartTime = now;
                this.isSustainedSound = true;
            } else if (now - this.sustainedSoundStartTime > sustainedSoundDuration) {
                // It's been sustained for long enough
                this.lastVolumeLevel = volume;
                return true;
            }
        } else if (this.isSustainedSound && volumeDiff < talkingThreshold * sustainedSoundHoldTolerance) {
            // Still consider it sustained if the volume doesn't change drastically
            this.lastVolumeLevel = volume;
            return true;
        } else {
            // Reset sustained sound tracking
            this.isSustainedSound = false;
        }

        this.lastVolumeLevel = volume;
        return false;
    }

    /**
     * Select animation frame based on volume and state
     */
    selectAnimationFrame(volume, isSustained) {
        const { talkingThreshold, highVolumeMultiplier } = this.config;
        const isLoudVolume = volume > talkingThreshold * highVolumeMultiplier;

        // For sustained sounds, maintain a consistent mouth position
        if (isSustained) {
            return isLoudVolume ? this.frames.wideOpen : this.frames.smallOpen;
        }

        // For normal speech, use probabilistic mouth positions based on volume
        const random = Math.random();
        const { closedMouthProbability, smallOpenProbability } = this.config;

        if (isLoudVolume) {
            // Loud speech pattern
            if (random < closedMouthProbability.loud) {
                return this.frames.closed;
            } else if (random < closedMouthProbability.loud + smallOpenProbability.loud) {
                return this.frames.smallOpen;
            } else {
                return this.frames.wideOpen;
            }
        } else {
            // Normal speech pattern
            if (random < closedMouthProbability.normal) {
                return this.frames.closed;
            } else if (random < closedMouthProbability.normal + smallOpenProbability.normal) {
                return this.frames.smallOpen;
            } else {
                return this.frames.wideOpen;
            }
        }
    }

    /**
     * Update talking head animation based on volume
     */
    updateTalkingHead(volume) {
        const now = Date.now();
        const isSustained = this.checkSustainedSound(volume);
        const { talkingThreshold, frameInterval, idleSilenceDuration, idleFrameInterval, idleSmirkProbability, smirkDuration } = this.config;

        if (volume > talkingThreshold) {
            // Handle speaking state
            this.isSpeaking = true;
            this.lastSilence = now;

            // Change frames at regular intervals while talking
            if ((now - this.lastFrameSwitch > frameInterval) || (isSustained && this.currentFrame === this.frames.closed)) {
                const newFrame = this.selectAnimationFrame(volume, isSustained);
                this.setFrame(newFrame);
                this.lastFrameSwitch = now;
            }
        } else {
            // Handle silence state
            if (this.isSpeaking) {
                this.setFrame(this.frames.closed);
                this.isSpeaking = false;
            }

            // Occasionally show smirk during long silences
            const silenceDuration = now - this.lastSilence;
            if (silenceDuration > idleSilenceDuration && now - this.lastFrameSwitch > idleFrameInterval) {
                if (Math.random() < idleSmirkProbability) {
                    this.setFrame(this.frames.smirk);
                    this.lastFrameSwitch = now;

                    // Return to closed mouth after smirk duration
                    setTimeout(() => {
                        this.setFrame(this.frames.closed);
                    }, smirkDuration);
                }
            }
        }
    }

    /**
     * Animation loop
     */
    animate() {
        if (!this.isInitialized) return;

        const volume = this.getVolumeLevel();
        this.updateTalkingHead(volume);

        // Continue animation loop
        requestAnimationFrame(this.animate.bind(this));
    }

    /**
     * Update configuration parameters
     */
    updateConfig(newConfig = {}) {
        this.config = { ...this.config, ...newConfig };

        // Reset state when configuration changes
        this.volumeHistory = [];
        this.isSustainedSound = false;
    }
} 