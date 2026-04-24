import { xf } from '../functions.js';

class Watch extends HTMLElement {
    constructor() {
        super();

        // Bind handlers so `this` inside callbacks points to the custom element
        this.onStart = this.onStart.bind(this);
        this.onPause = this.onPause.bind(this);
        this.onBack = this.onBack.bind(this);
        this.onLap = this.onLap.bind(this);
        this.onStop = this.onStop.bind(this);
        this.onSave = this.onSave.bind(this);
        this.onWorkoutStart = this.onWorkoutStart.bind(this);
        this.onWatchStatus = this.onWatchStatus.bind(this);
        this.onWorkoutStatus = this.onWorkoutStatus.bind(this);
        this.onCadence = this.onCadence.bind(this);
        this.onPower1s = this.onPower1s.bind(this);
        this.onHeartRate = this.onHeartRate.bind(this);
        this.onElapsed = this.onElapsed.bind(this);
        this.onLapTime = this.onLapTime.bind(this);
        this.onIntervalDuration = this.onIntervalDuration.bind(this);
        this.onIntervalIndex = this.onIntervalIndex.bind(this);
        this.onWorkout = this.onWorkout.bind(this);
        this.onVideoEnded = this.onVideoEnded.bind(this);
        this.updateOverlayClearance = this.updateOverlayClearance.bind(this);
        this.updateResponsiveLayout = this.updateResponsiveLayout.bind(this);
        this.onYoutubePlayerReady = this.onYoutubePlayerReady.bind(this);
        this.onYoutubePlayerStateChange = this.onYoutubePlayerStateChange.bind(this);
        this.onVideoLoadedMetadata = this.onVideoLoadedMetadata.bind(this);
        this.onVideoTimeUpdate = this.onVideoTimeUpdate.bind(this);
        this.onRouteVideoLoadStart = this.onRouteVideoLoadStart.bind(this);
        this.onRouteVideoProgress = this.onRouteVideoProgress.bind(this);
        this.onRouteVideoCanPlay = this.onRouteVideoCanPlay.bind(this);
        this.onRouteVideoWaiting = this.onRouteVideoWaiting.bind(this);
        this.onRouteVideoError = this.onRouteVideoError.bind(this);
        this.onRouteExpandToggle = this.onRouteExpandToggle.bind(this);
    }
    connectedCallback() {
        const self = this;
        this.abortController = new AbortController();
        this.signal = { signal: self.abortController.signal };

        this.dom = {
            start:   document.querySelector('#watch-start'),
            pause:   document.querySelector('#watch-pause'),
            back:    document.querySelector('#watch-back'),
            lap:     document.querySelector('#watch-lap'),
            stop:    document.querySelector('#watch-stop'),
            snapshot: document.querySelector('#watch-snapshot'),
            record: document.querySelector('#watch-record'),
            save:    document.querySelector('#activity-save'),
            // workout: document.querySelector('#start-workout'),
        };

        this.cadence = 0;
        this.power1s = 0;
        this.heartRate = 0;
        this.elapsed = 0;
        this.lapTime = 0;
        this.intervalDuration = 0;
        this.intervalIndex = 0;
        this.workoutIntervals = [];
        this.workoutStatus = 'stopped';
        this.powerHistory = [];
        this.heartHistory = [];
        this.maxHistoryPoints = 120;
        this.videoSources = [];
        this.videoIndex = 0;
        this.routeVideoSrc = null;
        this.routeSegmentEnds = [];
        this.combinedRouteManifest = null;
        this.routeVideoLoadToken = 0;
        this.routeVideoLoading = false;
        this.routeLap = 1;
        this.currentMultiplier = 1;
        this.routeSingleColumnBreakpoint = 1100;
        this.layoutBaselineWidth = 1200;
        this.layoutBaselineHeight = 1400;
        this.currentRouteAspectRatio = null;
        this.isRouteExpanded = false;
        this.workoutPlanSegmentsMarkup = null;
        this.$workoutPlanMarker = null;
        this.prefetchLinks = [];
        this.csvOptions = ['files'];
        this.selectedCsv = 'files';
        this.watchStatus = 'stopped';
        this.volume = 100;
        this.isCapturing = false;
        this.$rateIndicator = document.querySelector('#playback-rate-indicator');
        this.$rateBars = this.$rateIndicator
            ? Array.from(this.$rateIndicator.querySelectorAll('.playback-rate-bar'))
            : [];
        this.$rateValue = document.querySelector('#playback-rate-value');
        this.$youtubeFeedPlayer = document.querySelector('#youtube-feed-player');
        this.$youtubeFeed = document.querySelector('#youtube-feed');
        this.$youtubeFeedHeader = document.querySelector('.youtube-feed-header');
        this.$youtubeFeedLabel = document.querySelector('#youtube-feed-label');
        this.$heroRouteLabel = document.querySelector('#home-hero-route-label');
        this.$routeExpandToggle = document.querySelector('#route-expand-toggle');
        this.$motivationPanel = document.querySelector('#video-motivation-panel');
        this.$motivationText = document.querySelector('#video-motivation-text');
        this.$routeLapLabel = document.querySelector('#video-route-lap-label');
        this.$intervalLabel = document.querySelector('#video-interval-label');
        this.$workoutPlan = document.querySelector('#video-workout-plan');
        this.$powerGraph = document.querySelector('#video-power-graph polyline');
        this.$heartGraph = document.querySelector('#video-heart-graph polyline');
        this.$videoOverlay = document.querySelector('.video-performance-overlay');
        this.$routeProgress = document.querySelector('#video-route-progress');
        this.$routeProgressLabel = document.querySelector('#video-route-progress-label');
        this.$routeProgressCount = document.querySelector('#video-route-progress-count');
        this.$routeProgressTrack = document.querySelector('#video-route-progress-track');
        this.$routeProgressFill = document.querySelector('#video-route-progress-fill');
        this.$routeProgressMarker = document.querySelector('#video-route-progress-marker');
        this.$videoTarget = document.querySelector('.targets--cont.video-target');
        this.$videoStage = document.querySelector('.video-stage');
        this.$routeVideoLoading = document.querySelector('#route-video-loading');
        this.$routeVideoLoadingText = document.querySelector('#route-video-loading-text');
        this.$routeVideoLoadingMeta = document.querySelector('#route-video-loading-meta');
        this.$routeVideoLoadingBar = document.querySelector('#route-video-loading-bar');
        this.youtubePlayer = null;
        this.youtubePlayerReady = false;
        this.pendingYoutubeFeed = null;
        this.isAdvancingYoutubeFeed = false;
        this.youtubeFeedHistoryKey = 'auuki.youtube-feed-history-v2';
        this.motivationLines = [
            'Steady watts, quiet shoulders, clean rhythm.',
            'Small gears, big patience, tidy cadence.',
            'This interval has opinions. The pedals get the final vote.',
            'Smooth power beats panic power every time.',
            'Breathe in, spin out, keep the plot moving.',
            'Legs may file complaints; cadence keeps the meeting short.',
            'No fireworks needed. Just one clean minute after another.',
            'If the room feels tiny, the engine still gets bigger.',
            'A calm tempo makes hard work look suspiciously professional.',
            'The road on screen can wander. The power line stays neat.'
        ];
        this.youtubeChannels = [
            {
                label: 'Adventure Every Day',
                videos: ['zhLO7BwoQl4', 'cX2dPW9y9Wg', 'ErDhr1fEzpM', 'jFwDlR31QfQ', '-tP6SdjATvM', 'KWCxtcYpm6s', 'U1DRvPO-pmY', 'JDIhYM_i-vU']
            },
            {
                label: 'Abao Ambience',
                videos: ['8dMe11ruUuc', 'ymO9UQwntyo', 'Zs-6aOmX9DQ', 'BD6PZD_OueA', 'zSxrzaJKmJQ', '68_rDk_6BIQ', 'ylj8qLwiFHA', 'hziRbOd3Qh0']
            },
            {
                label: 'SAFA Brian',
                videos: ['fclPb1PTWuQ', 'Sj2rYpMW158', 'c70_akAetbA', 'mUhMNDkwTs0', 'bpy6jWtvnqU', 'XLsQii1whc8', 'AUtFuhgXn3A', '1wxBKvxAlM0']
            },
        ];

        this.dom.start.addEventListener('pointerup', this.onStart, this.signal);
        this.dom.pause.addEventListener('pointerup', this.onPause, this.signal);
        this.dom.back.addEventListener('pointerup', this.onBack, this.signal);
        this.dom.lap.addEventListener('pointerup', this.onLap, this.signal);
        this.dom.stop.addEventListener('pointerup', this.onStop, this.signal);
        this.dom.snapshot?.addEventListener('pointerup', this.onSnapshot.bind(this), this.signal);
        this.dom.record?.addEventListener('pointerup', this.onRecord.bind(this), this.signal);
        // this.dom.workout.addEventListener('pointerup', this.onWorkoutStart);
        this.dom.save.addEventListener(`pointerup`, this.onSave, this.signal);
        this.$routeExpandToggle?.addEventListener('pointerup', this.onRouteExpandToggle, this.signal);

        this.renderInit(this.dom);
        this.setupYoutubeFeed();

        xf.sub(`db:watchStatus`, this.onWatchStatus.bind(this), this.signal);
        xf.sub(`db:workoutStatus`, this.onWorkoutStatus.bind(this), this.signal);
        xf.sub(`db:cadence`, this.onCadence.bind(this), this.signal);
        xf.sub(`db:power1s`, this.onPower1s.bind(this), this.signal);
        xf.sub(`db:heartRate`, this.onHeartRate.bind(this), this.signal);
        xf.sub(`db:elapsed`, this.onElapsed, this.signal);
        xf.sub(`db:lapTime`, this.onLapTime, this.signal);
        xf.sub(`db:intervalDuration`, this.onIntervalDuration, this.signal);
        xf.sub(`db:intervalIndex`, this.onIntervalIndex, this.signal);
        xf.sub(`db:workout`, this.onWorkout, this.signal);
        xf.sub(`db:volume`, this.onVolume.bind(this), this.signal);

        const heroVideo = document.querySelector('#home-hero-video');
        this.$heroVideo = heroVideo;
        this.$fixedBottom = document.querySelector('.fixed-bottom');
        const videoEl = heroVideo?.querySelector('video');
        this.$routeVideoEl = videoEl ?? null;
        if (heroVideo && videoEl) {
            videoEl.dataset.videoSrc = '';
            videoEl.preload = 'auto';
            videoEl.addEventListener('ended', this.onVideoEnded, this.signal);
            videoEl.addEventListener('loadstart', this.onRouteVideoLoadStart, this.signal);
            videoEl.addEventListener('progress', this.onRouteVideoProgress, this.signal);
            videoEl.addEventListener('canplay', this.onRouteVideoCanPlay, this.signal);
            videoEl.addEventListener('playing', this.onRouteVideoCanPlay, this.signal);
            videoEl.addEventListener('waiting', this.onRouteVideoWaiting, this.signal);
            videoEl.addEventListener('stalled', this.onRouteVideoWaiting, this.signal);
            videoEl.addEventListener('error', this.onRouteVideoError, this.signal);
            videoEl.addEventListener('loadedmetadata', this.onVideoLoadedMetadata, this.signal);
            videoEl.addEventListener('timeupdate', this.onVideoTimeUpdate, this.signal);
        }
        if (typeof ResizeObserver !== 'undefined') {
            this.overlayResizeObserver = new ResizeObserver(() => {
                this.updateResponsiveLayout();
                this.updateOverlayClearance();
                this.updateMotivationPanel();
            });
            this.$heroVideo && this.overlayResizeObserver.observe(this.$heroVideo);
            this.$fixedBottom && this.overlayResizeObserver.observe(this.$fixedBottom);
            this.$videoStage && this.overlayResizeObserver.observe(this.$videoStage);
        }
        window.addEventListener('resize', () => {
            this.updateResponsiveLayout();
            this.updateOverlayClearance();
            this.updateMotivationPanel();
        }, this.signal);

        this.$csvSelector = document.querySelector('#video-csv-selector');
        this.renderCsvSelector();
        this.loadCsvOptions();
        this.updatePlaybackIndicator(this.getPlaybackRate());
        this.syncRouteLabels();
        this.updateRouteProgress();
        this.syncRouteExpandedState();
        this.updateResponsiveLayout();
        this.updateOverlayClearance();
        this.updateMotivationPanel();
        this.setRouteVideoLoadingState(false);
    }
    disconnectedCallback() {
        this.youtubePlayer?.destroy?.();
        this.youtubePlayer = null;
        this.overlayResizeObserver?.disconnect();
        this.abortController.abort();
    }
    onStart(e) {
        xf.dispatch('ui:watchStart');
        xf.dispatch('ui:workoutStart');
    }
    onPause(e) {
        xf.dispatch('ui:watchPause');
    }
    onBack(e)  { xf.dispatch('ui:watchBack'); }
    onLap(e)   { xf.dispatch('ui:watchLap'); }
    onStop(e)  {
        xf.dispatch('ui:watchStop');
    }
    onSave(e)  { xf.dispatch('ui:activity:save'); }
    async onSnapshot(e) {
        if(this.isCapturing) return;
        this.isCapturing = true;
        try {
            const blob = await this.captureSnapshot();
            if(blob) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                this.downloadBlob(blob, `auuki-snapshot-${timestamp}.png`);
            }
        } catch(err) {
            console.warn('Snapshot failed.', err);
        } finally {
            this.isCapturing = false;
        }
    }
    async onRecord(e) {
        if(this.isCapturing) return;
        this.isCapturing = true;
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            await this.captureVideoFromCanvas(timestamp, 10000);
        } catch(err) {
            console.warn('Video capture failed.', err);
        } finally {
            this.isCapturing = false;
        }
    }
    onWorkoutStart(e) { xf.dispatch('ui:workoutStart'); }
    onWatchStatus(status) {
        this.watchStatus = status;
        if(status === 'started') {
            this.renderStarted(this.dom);
            this.startVideoPlayback();
        }
        if(status === 'paused')  {
            this.renderPaused(this.dom);
            this.pauseVideoPlayback();
        }
        if(status === 'stopped') {
            this.renderStopped(this.dom);
            this.stopVideoPlayback();
        }
        this.syncYoutubeFeedPlayback();
    }
    onWorkoutStatus(status) {
        this.workoutStatus = status;
        if(status === 'started') { this.renderWorkoutStarted(this.dom); }
        if(status === 'done')    {  }
        this.renderOverlayGraph();
    }
    renderInit(dom) {
        dom.pause.style.display = 'none';
        dom.stop.style.display  = 'none';
        dom.save.style.display  = 'none';
        dom.lap.style.display   = 'none';
        dom.back.style.display  = 'none';
    };
    renderStarted(dom) {
        dom.start.style.display  = 'none';
        dom.save.style.display   = 'none';
        dom.pause.style.display  = 'inline-block';
        dom.lap.style.display    = 'inline-block';
        dom.back.style.display   = 'inline-block';
        dom.stop.style.display   = 'none';
        // dom.stop.style.display  = 'inline-block';
    };
    renderPaused(dom) {
        dom.pause.style.display    = 'none';
        // dom.back.style.display = 'none';
        dom.lap.style.display      = 'none';
        dom.start.style.display    = 'inline-block';
        dom.stop.style.display     = 'inline-block';
    };
    renderStopped(dom) {
        dom.pause.style.display  = 'none';
        dom.lap.style.display    = 'none';
        dom.back.style.display   = 'none';
        dom.stop.style.display   = 'none';
        dom.save.style.display   = 'inline-block';
        // dom.workout.style.display = 'inline-block';
        dom.start.style.display  = 'inline-block';
    };
    renderWorkoutStarted(dom) {
        // dom.workout.style.display = 'none';
    };
    onVideoLoadedMetadata(event) {
        if(event.currentTarget === this.$routeVideoEl) {
            this.syncRouteAspectRatioFromVideo(event.currentTarget);
            this.updateRouteVideoLoadingProgress(event.currentTarget);
            this.updateResponsiveLayout();
        }
    }
    onRouteVideoLoadStart(event) {
        if(event.currentTarget !== this.$routeVideoEl) return;
        this.setRouteVideoLoadingState(true, {
            text: 'Loading...',
            meta: 'Preparing route video',
            progress: null,
        });
    }
    onRouteVideoProgress(event) {
        if(event.currentTarget !== this.$routeVideoEl) return;
        this.updateRouteVideoLoadingProgress(event.currentTarget);
    }
    onRouteVideoCanPlay(event) {
        if(event.currentTarget !== this.$routeVideoEl) return;
        this.setRouteVideoLoadingState(false);
    }
    onRouteVideoWaiting(event) {
        if(event.currentTarget !== this.$routeVideoEl || !this.$routeVideoEl?.dataset.videoSrc) return;
        const progress = this.getRouteVideoBufferedProgress(event.currentTarget);
        this.setRouteVideoLoadingState(true, {
            text: 'Loading...',
            meta: progress === null ? 'Buffering route video' : `Buffering ${this.formatRouteVideoProgress(progress)}`,
            progress,
        });
    }
    onRouteVideoError(event) {
        if(event.currentTarget !== this.$routeVideoEl) return;
        this.setRouteVideoLoadingState(true, {
            text: 'Loading...',
            meta: 'Route video load delayed',
            progress: null,
        });
    }
    onVideoTimeUpdate(event) {
        if(!this.routeVideoSrc || this.routeSegmentEnds.length === 0) return;
        const currentTime = event.currentTarget.currentTime ?? 0;
        let nextIndex = this.routeSegmentEnds.findIndex(endTime => currentTime < endTime);
        if(nextIndex < 0) {
            nextIndex = Math.max(0, this.routeSegmentEnds.length - 1);
        }
        if(nextIndex !== this.videoIndex) {
            this.videoIndex = nextIndex;
            this.currentMultiplier = this.videoSources[nextIndex]?.multiplier ?? 1;
            this.updateRouteProgress();
            this.renderOverlayGraph();
            this.updatePlaybackRate();
        }
    }
    applyPlaybackState(videoEl, { shouldPlay = false, resetTime = false } = {}) {
        if(!videoEl) return;
        if(resetTime) {
            videoEl.currentTime = 0;
        }
        const rate = this.getPlaybackRate();
        videoEl.playbackRate = rate;
        this.updatePlaybackIndicator(rate);
        if(shouldPlay) {
            const playPromise = videoEl.play();
            if(playPromise && typeof playPromise.catch === 'function') {
                playPromise.catch(() => {});
            }
            return;
        }
        videoEl.pause();
    }
    getRouteVideoBufferedProgress(videoEl) {
        if(!videoEl?.buffered?.length) return null;
        const duration = videoEl.duration;
        if(!Number.isFinite(duration) || duration <= 0) return null;
        try {
            const bufferedEnd = videoEl.buffered.end(videoEl.buffered.length - 1);
            const progress = bufferedEnd / duration;
            if(!Number.isFinite(progress)) return null;
            return Math.max(0, Math.min(1, progress));
        } catch(err) {
            return null;
        }
    }
    formatRouteVideoProgress(progress) {
        const percentage = Math.max(0, Math.min(100, Math.round(progress * 100)));
        return `${percentage}%`;
    }
    updateRouteVideoLoadingProgress(videoEl = this.$routeVideoEl) {
        if(!videoEl?.dataset.videoSrc) return;
        const progress = this.getRouteVideoBufferedProgress(videoEl);
        if(videoEl.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            this.setRouteVideoLoadingState(false);
            return;
        }
        this.setRouteVideoLoadingState(true, {
            text: 'Loading...',
            meta: progress === null ? 'Preparing route video' : `Loading ${this.formatRouteVideoProgress(progress)}`,
            progress,
        });
    }
    setRouteVideoLoadingState(isLoading, { text = 'Loading...', meta = 'Preparing route video', progress = null } = {}) {
        if(!this.$routeVideoLoading) return;
        this.routeVideoLoading = isLoading;
        this.$routeVideoLoading.classList.toggle('active', isLoading);
        const determinate = typeof progress === 'number' && Number.isFinite(progress);
        this.$routeVideoLoading.classList.toggle('indeterminate', isLoading && !determinate);
        this.$routeVideoLoading.setAttribute('aria-hidden', isLoading ? 'false' : 'true');
        if(this.$routeVideoLoadingText) {
            this.$routeVideoLoadingText.textContent = text;
        }
        if(this.$routeVideoLoadingMeta) {
            this.$routeVideoLoadingMeta.textContent = meta;
        }
        if(this.$routeVideoLoadingBar) {
            const width = determinate ? `${Math.max(4, Math.round(progress * 100))}%` : '18%';
            this.$routeVideoLoadingBar.style.setProperty('--route-video-progress', width);
        }
    }
    waitForVideoReady(videoEl, expectedSrc, timeoutMs = 12000) {
        if(!videoEl || !expectedSrc || videoEl.dataset.videoSrc !== expectedSrc) {
            return Promise.resolve(false);
        }
        if(videoEl.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            return Promise.resolve(true);
        }

        return new Promise((resolve) => {
            let settled = false;
            const cleanup = () => {
                videoEl.removeEventListener('loadeddata', onReady);
                videoEl.removeEventListener('canplay', onReady);
                videoEl.removeEventListener('error', onError);
                window.clearTimeout(timeoutId);
            };
            const finish = (value) => {
                if(settled) return;
                settled = true;
                cleanup();
                resolve(value);
            };
            const onReady = () => finish(videoEl.dataset.videoSrc === expectedSrc);
            const onError = () => finish(false);
            const timeoutId = window.setTimeout(() => finish(false), timeoutMs);

            videoEl.addEventListener('loadeddata', onReady, { ...this.signal, once: true });
            videoEl.addEventListener('canplay', onReady, { ...this.signal, once: true });
            videoEl.addEventListener('error', onError, { ...this.signal, once: true });
        });
    }
    async prepareVideoPreview(videoEl) {
        const expectedSrc = videoEl?.dataset.videoSrc;
        if(!videoEl || !expectedSrc) return;
        const loadToken = this.routeVideoLoadToken;
        this.setRouteVideoLoadingState(true, {
            text: 'Loading...',
            meta: 'Preparing route video',
            progress: this.getRouteVideoBufferedProgress(videoEl),
        });
        videoEl.load();

        let ready = await this.waitForVideoReady(videoEl, expectedSrc, 4000);
        if(!ready && this.watchStatus !== 'started' && loadToken === this.routeVideoLoadToken) {
            try {
                const playPromise = videoEl.play();
                if(playPromise && typeof playPromise.catch === 'function') {
                    playPromise.catch(() => {});
                }
            } catch(err) {
                // Ignore autoplay timing failures; the loadeddata fallback still applies.
            }
            ready = await this.waitForVideoReady(videoEl, expectedSrc, 12000);
        }

        if(loadToken !== this.routeVideoLoadToken || videoEl.dataset.videoSrc !== expectedSrc || this.watchStatus === 'started') {
            return;
        }
        videoEl.pause();
        if(ready) {
            try {
                videoEl.currentTime = 0;
            } catch(err) {
                // Ignore seek failures before metadata is fully available.
            }
        }
        this.setRouteVideoLoadingState(!ready, {
            text: 'Loading...',
            meta: ready ? 'Route video ready' : 'Preparing route video',
            progress: ready ? 1 : this.getRouteVideoBufferedProgress(videoEl),
        });
    }
    async startRouteVideo(videoEl, resetTime = true) {
        if(!videoEl) return;
        const expectedSrc = videoEl.dataset.videoSrc;
        if(!expectedSrc) return;
        const loadToken = this.routeVideoLoadToken;
        this.setRouteVideoLoadingState(true, {
            text: 'Loading...',
            meta: 'Preparing route video',
            progress: this.getRouteVideoBufferedProgress(videoEl),
        });
        videoEl.load();
        const ready = await this.waitForVideoReady(videoEl, expectedSrc);
        if(loadToken !== this.routeVideoLoadToken || videoEl.dataset.videoSrc !== expectedSrc || this.watchStatus !== 'started') {
            return;
        }
        this.setRouteVideoLoadingState(!ready, {
            text: 'Loading...',
            meta: ready ? 'Route video ready' : 'Preparing route video',
            progress: ready ? 1 : this.getRouteVideoBufferedProgress(videoEl),
        });
        this.applyPlaybackState(videoEl, { shouldPlay: true, resetTime });
    }
    setupYoutubeFeed() {
        if(!this.$youtubeFeedPlayer) return;
        const { channel, videoId } = this.pickYoutubeFeed();
        const startSeconds = this.getRandomYoutubeStartSeconds();
        this.pendingYoutubeFeed = { channel, videoId, startSeconds };
        if(this.$youtubeFeedLabel) {
            this.$youtubeFeedLabel.textContent = channel.label;
        }
        this.ensureYoutubePlayer();
    }
    pickYoutubeFeed() {
        const recent = this.getYoutubeFeedHistory();
        const maxRecent = Math.min(10, this.youtubeChannels.length * 4);
        let choice = null;

        for(let attempt = 0; attempt < 20 && !choice; attempt++) {
            const channel = this.youtubeChannels[Math.floor(Math.random() * this.youtubeChannels.length)];
            const videoId = channel.videos[Math.floor(Math.random() * channel.videos.length)];
            const key = `${channel.label}:${videoId}`;
            if(!recent.includes(key)) {
                choice = { channel, videoId, key };
            }
        }

        if(!choice) {
            const channel = this.youtubeChannels[Math.floor(Math.random() * this.youtubeChannels.length)];
            const videoId = channel.videos[Math.floor(Math.random() * channel.videos.length)];
            choice = { channel, videoId, key: `${channel.label}:${videoId}` };
        }

        const nextRecent = [...recent, choice.key].slice(-maxRecent);
        this.setYoutubeFeedHistory(nextRecent);
        return {
            channel: choice.channel,
            videoId: choice.videoId,
            seed: `${Date.now()}-${Math.floor(Math.random() * 100000)}`
        };
    }
    getRandomYoutubeStartSeconds() {
        return Math.floor(Math.random() * 900);
    }
    getYoutubeFeedHistory() {
        try {
            const raw = window.localStorage.getItem(this.youtubeFeedHistoryKey);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch(err) {
            return [];
        }
    }
    setYoutubeFeedHistory(history) {
        try {
            window.localStorage.setItem(this.youtubeFeedHistoryKey, JSON.stringify(history));
        } catch(err) {
            // Ignore storage failures and fall back to in-memory randomness.
        }
    }
    ensureYoutubePlayer() {
        if(!this.$youtubeFeedPlayer) return;
        if(this.youtubePlayerReady && this.youtubePlayer) {
            this.loadPendingYoutubeFeed();
            return;
        }

        this.loadYoutubeIframeApi().then((YT) => {
            if(this.youtubePlayer || !this.$youtubeFeedPlayer?.isConnected) return;
            const initialFeed = this.pendingYoutubeFeed ?? {
                channel: this.youtubeChannels[0],
                videoId: this.youtubeChannels[0]?.videos?.[0],
                startSeconds: 0,
            };
            this.youtubePlayer = new YT.Player(this.$youtubeFeedPlayer, {
                host: 'https://www.youtube.com',
                videoId: initialFeed.videoId,
                playerVars: {
                    autoplay: this.watchStatus === 'started' ? 1 : 0,
                    controls: 1,
                    playsinline: 1,
                    rel: 0,
                    modestbranding: 1,
                    enablejsapi: 1,
                    origin: window.location.origin,
                    start: initialFeed.startSeconds,
                },
                events: {
                    onReady: this.onYoutubePlayerReady,
                    onStateChange: this.onYoutubePlayerStateChange,
                },
            });
        }).catch((err) => {
            console.warn('YouTube player API unavailable, falling back to iframe src.', err);
            this.loadPendingYoutubeFeedFallback();
        });
    }
    loadYoutubeIframeApi() {
        if(window.YT?.Player) {
            return Promise.resolve(window.YT);
        }
        if(Watch.youtubeApiPromise) {
            return Watch.youtubeApiPromise;
        }
        Watch.youtubeApiPromise = new Promise((resolve, reject) => {
            const existing = document.querySelector('script[data-youtube-iframe-api]');
            const timeoutId = window.setTimeout(() => {
                reject(new Error('Timed out waiting for YouTube iframe API'));
            }, 15000);
            const previousReady = window.onYouTubeIframeAPIReady;
            window.onYouTubeIframeAPIReady = () => {
                window.clearTimeout(timeoutId);
                previousReady?.();
                resolve(window.YT);
            };
            if(existing) {
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://www.youtube.com/iframe_api';
            script.async = true;
            script.dataset.youtubeIframeApi = 'true';
            script.onerror = () => {
                window.clearTimeout(timeoutId);
                reject(new Error('Failed to load YouTube iframe API'));
            };
            document.head.appendChild(script);
        });
        return Watch.youtubeApiPromise;
    }
    onVolume(volume) {
        this.volume = volume;
        if(!this.youtubePlayer || !this.youtubePlayerReady) return;
        if(volume <= 0) {
            this.youtubePlayer.mute?.();
        } else {
            this.youtubePlayer.unMute?.();
            this.youtubePlayer.setVolume?.(volume);
        }
    }
    onYoutubePlayerReady(event) {
        this.youtubePlayerReady = true;
        if(this.volume <= 0) {
            event.target.mute();
        } else {
            event.target.unMute();
            event.target.setVolume(this.volume);
        }
        this.loadPendingYoutubeFeed();
        this.syncYoutubeFeedPlayback();
    }
    onYoutubePlayerStateChange(event) {
        if(event?.data !== window.YT?.PlayerState?.ENDED || this.isAdvancingYoutubeFeed) {
            return;
        }
        this.isAdvancingYoutubeFeed = true;
        this.setupYoutubeFeed();
        window.setTimeout(() => {
            this.isAdvancingYoutubeFeed = false;
        }, 300);
    }
    loadPendingYoutubeFeed() {
        if(!this.youtubePlayerReady || !this.youtubePlayer || !this.pendingYoutubeFeed) return;
        const { channel, videoId, startSeconds } = this.pendingYoutubeFeed;
        if(this.$youtubeFeedLabel) {
            this.$youtubeFeedLabel.textContent = channel.label;
        }
        if(this.watchStatus === 'started') {
            this.youtubePlayer.loadVideoById({
                videoId,
                startSeconds,
            });
        } else {
            this.youtubePlayer.cueVideoById({
                videoId,
                startSeconds,
            });
        }
        this.pendingYoutubeFeed = null;
    }
    loadPendingYoutubeFeedFallback() {
        if(!this.$youtubeFeedPlayer || !this.pendingYoutubeFeed) return;
        const { channel, videoId, startSeconds } = this.pendingYoutubeFeed;
        this.$youtubeFeedPlayer.innerHTML = `
            <iframe
                class="youtube-feed-player-frame"
                title="Scenic YouTube feed"
                src="https://www.youtube-nocookie.com/embed/${videoId}?autoplay=${this.watchStatus === 'started' ? 1 : 0}&mute=0&controls=1&playsinline=1&rel=0&modestbranding=1&enablejsapi=1&start=${startSeconds}&origin=${encodeURIComponent(window.location.origin)}&cacheBust=${Date.now()}"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerpolicy="strict-origin-when-cross-origin"
                allowfullscreen>
            </iframe>
        `;
        if(this.$youtubeFeedLabel) {
            this.$youtubeFeedLabel.textContent = channel.label;
        }
        this.pendingYoutubeFeed = null;
    }
    postYoutubeIframeCommand(func) {
        const iframe = this.$youtubeFeedPlayer?.querySelector('iframe');
        if(!iframe?.contentWindow) return;
        iframe.contentWindow.postMessage(JSON.stringify({
            event: 'command',
            func,
            args: [],
        }), 'https://www.youtube-nocookie.com');
    }
    playYoutubeFeed() {
        if(this.youtubePlayerReady && this.youtubePlayer) {
            this.youtubePlayer.playVideo?.();
            return;
        }
        this.postYoutubeIframeCommand('playVideo');
    }
    pauseYoutubeFeed() {
        if(this.youtubePlayerReady && this.youtubePlayer) {
            this.youtubePlayer.pauseVideo?.();
            return;
        }
        this.postYoutubeIframeCommand('pauseVideo');
    }
    syncYoutubeFeedPlayback() {
        if(this.watchStatus === 'started') {
            this.playYoutubeFeed();
            return;
        }
        this.pauseYoutubeFeed();
    }
    onRouteExpandToggle(event) {
        event?.preventDefault?.();
        this.isRouteExpanded = !this.isRouteExpanded;
        this.syncRouteExpandedState();
        this.updateResponsiveLayout();
        this.updateOverlayClearance();
        this.updateMotivationPanel();
    }
    syncRouteExpandedState() {
        this.$videoTarget?.classList.toggle('route-expanded', this.isRouteExpanded);
        if(!this.$routeExpandToggle) return;
        this.$routeExpandToggle.setAttribute('aria-pressed', this.isRouteExpanded ? 'true' : 'false');
        this.$routeExpandToggle.setAttribute(
            'aria-label',
            this.isRouteExpanded ? 'Compact AI route video' : 'Expand AI route video',
        );
        this.$routeExpandToggle.textContent = this.isRouteExpanded ? 'Compact' : 'Expand';
    }
    clearManagedVideoLayout() {
        this.$videoStage.style.removeProperty('display');
        this.$videoStage.style.removeProperty('gap');
        this.$videoStage.style.removeProperty('align-items');
        this.$videoStage.style.removeProperty('justify-content');
        this.$videoStage.style.removeProperty('grid-template-columns');
        this.$youtubeFeed.style.removeProperty('width');
        this.$youtubeFeed.style.removeProperty('min-width');
        this.$youtubeFeed.style.removeProperty('max-width');
        this.$youtubeFeed.style.removeProperty('flex');
        this.$youtubeFeed.style.removeProperty('height');
        this.$youtubeFeedPlayer?.style.removeProperty('height');
        this.$heroVideo.style.removeProperty('width');
        this.$heroVideo.style.removeProperty('max-width');
        this.$heroVideo.style.removeProperty('min-width');
        this.$heroVideo.style.removeProperty('flex');
    }
    isLayoutBaselineLocked() {
        return window.innerWidth < this.layoutBaselineWidth || window.innerHeight < this.layoutBaselineHeight;
    }
    updateResponsiveLayout() {
        if(!this.$videoStage || !this.$youtubeFeed || !this.$heroVideo) return;

        if(this.isRouteExpanded) {
            this.clearManagedVideoLayout();
            return;
        }

        const baselineLocked = this.isLayoutBaselineLocked();
        const stageWidth = baselineLocked
            ? this.layoutBaselineWidth - 32
            : this.$videoStage.clientWidth;
        const heroVideoEl = this.$heroVideo?.querySelector('video');
        const gap = 13; // 0.8rem at the app's base font sizing
        const layoutWidth = baselineLocked
            ? this.layoutBaselineWidth
            : window.innerWidth;
        const scenicShare = layoutWidth >= 2100 ? 0.54 : layoutWidth >= 1500 ? 0.5 : 0.47;
        const minMainWidth = 360;
        const minScenicWidth = 520;
        const sourceMaxWidth = heroVideoEl?.videoWidth > 0
            ? Math.max(minMainWidth, heroVideoEl.videoWidth)
            : Infinity;
        const scenicWidth = Math.min(sourceMaxWidth, Math.max(
            minScenicWidth,
            Math.min(stageWidth * scenicShare, stageWidth - minMainWidth - gap)
        ));
        const mainWidth = Math.min(
            sourceMaxWidth,
            Math.max(minMainWidth, stageWidth - scenicWidth - gap)
        );

        this.$videoStage.style.setProperty('display', 'flex', 'important');
        this.$videoStage.style.setProperty('gap', `${gap}px`, 'important');
        this.$videoStage.style.setProperty('align-items', 'stretch', 'important');
        this.$videoStage.style.setProperty('justify-content', 'center', 'important');
        this.$videoStage.style.setProperty('grid-template-columns', `${mainWidth}px ${scenicWidth}px`, 'important');
        this.$youtubeFeed.style.setProperty('width', `${scenicWidth}px`, 'important');
        this.$youtubeFeed.style.setProperty('min-width', `${scenicWidth}px`, 'important');
        this.$youtubeFeed.style.setProperty('max-width', `${scenicWidth}px`, 'important');
        this.$youtubeFeed.style.setProperty('flex', `0 0 ${scenicWidth}px`, 'important');
        this.$heroVideo.style.setProperty('width', `${mainWidth}px`, 'important');
        this.$heroVideo.style.setProperty('max-width', `${mainWidth}px`, 'important');
        this.$heroVideo.style.setProperty('min-width', `${mainWidth}px`, 'important');
        this.$heroVideo.style.setProperty('flex', `0 0 ${mainWidth}px`, 'important');

        const heroMedia = this.$heroVideo?.querySelector('.home-hero-media');
        const mediaHeight = heroMedia?.getBoundingClientRect().height ?? 0;
        if(mediaHeight > 0) {
            const feedHeight = Math.max(320, Math.round(mediaHeight));
            this.$youtubeFeed.style.height = `${feedHeight}px`;
            this.$youtubeFeedPlayer?.style.removeProperty('height');
        }
    }
    updateOverlayClearance() {
        if(!this.$heroVideo || !this.$fixedBottom || !this.$videoOverlay) return;

        this.$heroVideo.classList.remove('hud-detached');
        this.$heroVideo.style.setProperty('--home-overlay-detached-height', '0px');
        this.$heroVideo.style.setProperty('--home-overlay-dynamic-clearance', '0px');
    }
    onElapsed(elapsed) {
        this.elapsed = elapsed;
        this.renderOverlayGraph();
        this.updateMotivationPanel();
    }
    onLapTime(lapTime) {
        this.lapTime = lapTime;
        this.renderOverlayGraph();
    }
    onIntervalDuration(intervalDuration) {
        this.intervalDuration = intervalDuration;
        this.renderOverlayGraph();
    }
    onIntervalIndex(intervalIndex) {
        this.intervalIndex = intervalIndex;
        this.renderOverlayGraph();
    }
    onWorkout(workout) {
        this.workoutIntervals = workout?.intervals ?? [];
        this.renderOverlayGraph();
    }
    renderOverlayGraph() {
        const currentInterval = this.workoutIntervals[this.intervalIndex] ?? null;
        const intervalName = currentInterval?.name ?? currentInterval?.type ?? `Interval ${this.intervalIndex + 1}`;

        if(this.$routeLapLabel) {
            this.$routeLapLabel.textContent = `Lap ${this.routeLap}`;
        }
        if(this.$intervalLabel) {
            this.$intervalLabel.textContent = intervalName;
        }
        if(this.$workoutPlan) {
            this.updateWorkoutPlan();
        }
        if(this.$powerGraph) {
            this.$powerGraph.setAttribute('points', this.toSparklinePoints(this.powerHistory, 500));
        }
        if(this.$heartGraph) {
            this.$heartGraph.setAttribute('points', this.toSparklinePoints(this.heartHistory, 190));
        }
    }
    getCurrentMotivationLine() {
        const lines = this.motivationLines ?? [];
        if(lines.length === 0) return '';
        const bucket = Math.floor((this.elapsed ?? 0) / 45);
        const routeOffset = this.csvOptions.indexOf(this.selectedCsv);
        const index = Math.abs(bucket + (routeOffset >= 0 ? routeOffset : 0)) % lines.length;
        return lines[index];
    }
    updateMotivationPanel() {
        if(!this.$motivationPanel || !this.$motivationText || !this.$videoOverlay) return;

        const overlayRect = this.$videoOverlay.getBoundingClientRect();
        const top = Math.round(overlayRect.bottom + 12);
        const width = 720;
        const maxHeight = Math.max(120, Math.round(window.innerHeight - overlayRect.bottom - 20));

        this.$motivationText.textContent = this.getCurrentMotivationLine();
        this.$motivationPanel.hidden = false;
        this.$motivationPanel.style.top = `${top}px`;
        this.$motivationPanel.style.width = `${width}px`;
        this.$motivationPanel.style.maxHeight = `${maxHeight}px`;
    }
    onCadence(cadence) {
        this.cadence = cadence;
        this.updatePlaybackRate();
    }
    onPower1s(power) {
        this.power1s = power;
        this.pushHistory(this.powerHistory, power);
        this.updatePlaybackRate();
        this.renderOverlayGraph();
    }
    onHeartRate(heartRate) {
        this.heartRate = heartRate;
        this.pushHistory(this.heartHistory, heartRate);
        this.updatePlaybackRate();
        this.renderOverlayGraph();
    }
    pushHistory(history, value) {
        history.push(value ?? 0);
        if(history.length > this.maxHistoryPoints) {
            history.shift();
        }
    }
    toSparklinePoints(history, maxValue) {
        if(history.length === 0) return '';
        const count = Math.max(history.length - 1, 1);
        return history.map((value, index) => {
            const x = (index / count) * 100;
            const clamped = Math.max(0, Math.min(maxValue, value ?? 0));
            const y = 24 - ((clamped / maxValue) * 24);
            return `${x.toFixed(2)},${y.toFixed(2)}`;
        }).join(' ');
    }
    getWorkoutTotalDuration() {
        const totalDuration = this.workoutIntervals.reduce((sum, interval) => {
            return sum + Math.max(interval?.duration ?? 0, 0);
        }, 0);

        return totalDuration;
    }
    getElapsedBeforeCurrentInterval() {
        let elapsedBeforeCurrent = 0;
        const currentIndex = Math.max(0, Math.min(this.intervalIndex ?? 0, this.workoutIntervals.length));

        for(let i = 0; i < currentIndex; i += 1) {
            elapsedBeforeCurrent += Math.max(this.workoutIntervals[i]?.duration ?? 0, 0);
        }

        return elapsedBeforeCurrent;
    }
    getCurrentIntervalDuration() {
        const currentInterval = this.workoutIntervals[this.intervalIndex] ?? null;
        const trackedDuration = Number(this.intervalDuration);
        const fallbackDuration = Number(currentInterval?.duration);

        if(Number.isFinite(trackedDuration) && trackedDuration > 0) return trackedDuration;
        if(Number.isFinite(fallbackDuration) && fallbackDuration > 0) return fallbackDuration;
        return 0;
    }
    getWorkoutProgressPercentage() {
        if(this.workoutIntervals.length === 0) return 0;

        const totalDuration = this.getWorkoutTotalDuration();
        if(totalDuration <= 0) return 0;
        if(this.workoutStatus === 'done') return 100;
        if(this.workoutStatus !== 'started') return 0;

        const elapsedBeforeCurrent = this.getElapsedBeforeCurrentInterval();
        const currentIntervalDuration = this.getCurrentIntervalDuration();
        const lapTime = Number(this.lapTime);
        const remainingInInterval = Number.isFinite(lapTime)
            ? Math.max(0, Math.min(currentIntervalDuration, lapTime))
            : currentIntervalDuration;
        const elapsedInInterval = currentIntervalDuration > 0
            ? currentIntervalDuration - remainingInInterval
            : 0;
        const absoluteElapsed = elapsedBeforeCurrent + elapsedInInterval;

        return Math.max(0, Math.min(100, (absoluteElapsed / totalDuration) * 100));
    }
    renderWorkoutPlanSegments() {
        if(this.workoutIntervals.length === 0) return '';

        const totalDuration = this.getWorkoutTotalDuration();
        if(totalDuration <= 0) return '';

        const zoneColorForTarget = (target) => {
            if(target < 0.55) return 'var(--zone-gray)';
            if(target < 0.75) return 'var(--zone-blue)';
            if(target < 0.9) return 'var(--zone-teal)';
            if(target < 1.05) return 'var(--zone-green)';
            if(target < 1.2) return 'var(--zone-yellow)';
            if(target < 1.5) return 'var(--zone-orange)';
            return 'var(--zone-red)';
        };

        const segments = this.workoutIntervals.map((interval) => {
            const duration = Math.max(interval?.duration ?? 0, 0);
            const width = (duration / totalDuration) * 100;
            const target = Math.max(interval?.power ?? 0, interval?.steps?.[0]?.power ?? 0, 0);
            const height = 24 + Math.min(target, 1.5) / 1.5 * 76;
            const color = zoneColorForTarget(target);
            return `<div class="video-overlay-plan-segment" style="width:${width}%;height:${height.toFixed(1)}%;background:${color};"></div>`;
        }).join('');

        return segments;
    }
    updateWorkoutPlan() {
        if(!this.$workoutPlan) return;

        const segments = this.renderWorkoutPlanSegments();
        if(this.workoutPlanSegmentsMarkup !== segments || !this.$workoutPlanMarker?.isConnected) {
            this.workoutPlanSegmentsMarkup = segments;
            this.$workoutPlan.innerHTML = `${segments}<div class="video-overlay-plan-marker"></div>`;
            this.$workoutPlanMarker = this.$workoutPlan.querySelector('.video-overlay-plan-marker');
        }

        if(this.$workoutPlanMarker) {
            this.$workoutPlanMarker.style.left = `${this.getWorkoutProgressPercentage()}%`;
        }
    }
    renderWorkoutPlan() {
        return `${this.renderWorkoutPlanSegments()}<div class="video-overlay-plan-marker" style="left:${this.getWorkoutProgressPercentage()}%;"></div>`;
    }
    renderCsvSelector() {
        if(!this.$csvSelector) return;
        const options = this.csvOptions ?? [];
        const selected = this.selectedCsv;
        const list = options.map((name, idx) => {
            const label = name.replace(/\.csv$/i, '');
            const id = `csv-opt-${idx}`;
            return `
                <label class="video-csv-option" for="${id}">
                    <input type="radio" id="${id}" name="video-csv" value="${name}" ${name === selected ? 'checked' : ''}>
                    <span>${label}</span>
                </label>
            `;
        }).join('');
        const currentRoute = this.formatRouteName(selected || 'Route') || 'Route';
        this.syncRouteLabels(currentRoute);
        if(this.$motivationText) {
            this.$motivationText.textContent = this.getCurrentMotivationLine();
        }
        this.$csvSelector.innerHTML = `
            <button class="video-csv-selector-trigger" type="button" aria-label="Show AI routes">
                <span class="video-csv-selector-trigger-icon" aria-hidden="true">Routes</span>
            </button>
            <div class="video-csv-selector-header">
                <h4>AI Routes</h4>
                <span class="video-csv-selector-current">${currentRoute}</span>
            </div>
            <div class="video-csv-list">
                ${list || '<div>No playlists found</div>'}
            </div>
        `;
        this.$csvSelector.querySelectorAll('input[name="video-csv"]').forEach(input => {
            input.addEventListener('change', (e) => {
                const value = e.target.value;
                if(value !== this.selectedCsv) {
                    this.selectedCsv = value;
                    this.videoIndex = 0;
                    this.routeLap = 1;
                    this.syncRouteLabels();
                    this.updateRouteProgress();
                    this.renderOverlayGraph();
                    this.loadVideoManifest(this.selectedCsv);
                    this.updateMotivationPanel();
                }
            }, this.signal);
        });
        this.updateMotivationPanel();
    }
    formatRouteName(name = '') {
        return `${name}`
            .replace(/\.csv$/i, '')
            .replace(/[_-]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
    syncRouteLabels(routeName = this.formatRouteName(this.selectedCsv || 'Route') || 'Route') {
        if(this.$heroRouteLabel) {
            this.$heroRouteLabel.textContent = routeName;
        }
        const currentLabel = this.$csvSelector?.querySelector('.video-csv-selector-current');
        if(currentLabel) {
            currentLabel.textContent = routeName;
        }
        if(this.$routeProgressLabel) {
            this.$routeProgressLabel.textContent = routeName;
        }
    }
    setHeroAspectRatio(width, height) {
        const safeWidth = Number(width);
        const safeHeight = Number(height);
        if(!Number.isFinite(safeWidth) || !Number.isFinite(safeHeight) || safeWidth <= 0 || safeHeight <= 0) {
            this.currentRouteAspectRatio = null;
            this.$heroVideo?.style.removeProperty('aspect-ratio');
            return;
        }
        this.currentRouteAspectRatio = safeWidth / safeHeight;
        this.$heroVideo?.style.setProperty('aspect-ratio', `${safeWidth} / ${safeHeight}`);
    }
    syncRouteAspectRatioFromVideo(videoEl = this.$routeVideoEl) {
        const width = videoEl?.videoWidth;
        const height = videoEl?.videoHeight;
        if(width > 0 && height > 0) {
            this.setHeroAspectRatio(width, height);
        }
    }
    resolveVideoAsset(path = '') {
        if(!path) return '';
        return new URL(`videos/${path}`, document.baseURI).toString();
    }
    updateRouteProgress() {
        if(!this.$routeProgress) return;

        const total = this.videoSources.length;
        const currentIndex = total > 0 ? this.videoIndex % total : 0;
        const progress = total > 0 ? currentIndex / total : 0;

        this.syncRouteLabels();
        if(this.$routeProgressCount) {
            this.$routeProgressCount.textContent = total > 0 ? `${currentIndex + 1} / ${total}` : '0 / 0';
        }
        if(this.$routeProgressFill) {
            this.$routeProgressFill.style.strokeDasharray = `${progress * 100} 100`;
        }
        if(this.$routeProgressTrack && this.$routeProgressMarker) {
            const totalLength = this.$routeProgressTrack.getTotalLength();
            const point = this.$routeProgressTrack.getPointAtLength(totalLength * progress);
            this.$routeProgressMarker.setAttribute('cx', `${point.x}`);
            this.$routeProgressMarker.setAttribute('cy', `${point.y}`);
        }
    }
    async loadCsvOptions() {
        const nextOptions = [];
        try {
            // Prefer a simple text manifest listing CSV files (one per line).
            const resTxt = await fetch(this.resolveVideoAsset('routes.txt'));
            if(resTxt.ok) {
                const text = await resTxt.text();
                text.split(/\r?\n/)
                    .map(line => line.trim())
                    .filter(line => line && !line.startsWith('#'))
                    .forEach(line => {
                        const base = line.replace(/\.csv$/i, '');
                        if(base) nextOptions.push(base);
                    });
            }
        } catch(e) {
            console.warn('routes.txt not available, falling back', e);
        }
        if(nextOptions.length === 0) {
            try {
                const res = await fetch(this.resolveVideoAsset('csv-index.json'));
                if(res.ok) {
                    const list = await res.json();
                    if(Array.isArray(list) && list.length > 0) {
                        list.forEach(name => {
                            const base = `${name}`.replace(/\.csv$/i, '');
                            if(base) nextOptions.push(base);
                        });
                    }
                }
            } catch(e) {
                console.warn('csv-index.json not available, using defaults', e);
            }
        }
        if(nextOptions.length > 0) {
            this.csvOptions = nextOptions;
            if(!nextOptions.includes(this.selectedCsv)) {
                this.selectedCsv = nextOptions[0];
            }
        }
        this.renderCsvSelector();
        this.updateRouteProgress();
        if(this.selectedCsv) {
            await this.loadVideoManifest(this.selectedCsv);
        }
    }
    async loadVideoManifest(csvName = 'files') {
        try {
            const combinedEntry = await this.loadCombinedRouteEntry(csvName);
            if(combinedEntry) {
                this.videoSources = (combinedEntry.segments ?? []).map(segment => ({
                    ...segment,
                    src: this.resolveVideoAsset(segment.src),
                }));
                this.routeVideoSrc = combinedEntry.src ? this.resolveVideoAsset(combinedEntry.src) : null;
                this.setHeroAspectRatio(combinedEntry.width, combinedEntry.height);
                this.routeSegmentEnds = [];
                let elapsed = 0;
                this.videoSources.forEach(segment => {
                    elapsed += Math.max(segment.duration ?? 0, 0);
                    this.routeSegmentEnds.push(elapsed);
                });
                this.videoIndex = 0;
                this.routeLap = 1;
                this.currentMultiplier = this.videoSources[0]?.multiplier ?? 1;
                this.prefetchLinks.forEach(l => l.remove());
                this.prefetchLinks = [];
                this.updateRouteProgress();
                this.renderOverlayGraph();
                const heroVideo = document.querySelector('#home-hero-video');
                const videoEl = this.$routeVideoEl;
                if(heroVideo && videoEl) {
                    this.ensureVideoSource(videoEl);
                    heroVideo.classList.add('active');
                    if(this.watchStatus === 'started') {
                        this.startVideoPlayback();
                    } else {
                        this.prepareVideoPreview(videoEl);
                    }
                }
                return;
            }

            const res = await fetch(this.resolveVideoAsset(`${csvName}.csv`));
            if(res.ok) {
                const text = await res.text();
                const entries = text
                    .split(/\r?\n/)
                    .map(line => line.trim())
                    .filter(line => line && !line.startsWith('#'))
                    .map(line => line.split(',').map(x => x.trim()))
                    .map(([file, multiplier]) => ({
                        src: this.resolveVideoAsset(file),
                        multiplier: isNaN(parseFloat(multiplier)) ? 1 : parseFloat(multiplier),
                    }))
                    .filter(entry => entry.src && entry.src.endsWith('.mp4'));
                if(entries.length > 0) {
                    this.routeVideoSrc = null;
                    this.routeSegmentEnds = [];
                    this.videoSources = entries;
                    this.setHeroAspectRatio(null, null);
                    this.videoIndex = 0;
                    this.routeLap = 1;
                    this.currentMultiplier = this.videoSources[0]?.multiplier ?? 1;
                    this.prefetchNextVideos();
                    this.updateRouteProgress();
                    this.renderOverlayGraph();
                    const heroVideo = document.querySelector('#home-hero-video');
                    const videoEl = this.$routeVideoEl;
                    if (heroVideo && videoEl) {
                        this.ensureVideoSource(videoEl);
                        heroVideo.classList.add('active');
                        if (this.watchStatus === 'started') {
                            this.startVideoPlayback();
                        } else {
                            this.prepareVideoPreview(videoEl);
                        }
                    }
                }
            }
        } catch(e) {
            console.error('Error loading video manifest', e);
        }
    }
    async loadCombinedRouteEntry(csvName) {
        if(this.combinedRouteManifest === undefined) {
            return null;
        }
        if(this.combinedRouteManifest === null) {
            try {
                const res = await fetch(this.resolveVideoAsset('combined-manifest.json'));
                this.combinedRouteManifest = res.ok ? await res.json() : undefined;
            } catch(e) {
                console.warn('combined-manifest.json not available, using segmented routes', e);
                this.combinedRouteManifest = undefined;
            }
        }
        return this.combinedRouteManifest?.[csvName] ?? null;
    }
    prefetchNextVideos(count = 4) {
        this.prefetchLinks.forEach(l => l.remove());
        this.prefetchLinks = [];
        const total = this.videoSources.length;
        if (total === 0) return;
        for (let i = 1; i <= count; i++) {
            const src = this.videoSources[(this.videoIndex + i) % total]?.src;
            if (!src) continue;
            const link = document.createElement('link');
            link.rel = 'prefetch';
            link.as = 'video';
            link.href = src;
            document.head.appendChild(link);
            this.prefetchLinks.push(link);
        }
    }
    onVideoEnded() {
        const videoEl = this.$routeVideoEl;
        if (videoEl && this.videoSources.length > 0) {
            if(this.routeVideoSrc) {
                this.routeLap += 1;
                this.videoIndex = 0;
                this.currentMultiplier = this.videoSources[0]?.multiplier ?? 1;
                this.updateRouteProgress();
                this.renderOverlayGraph();
                videoEl.currentTime = 0;
                if(this.watchStatus === 'started') {
                    const playPromise = videoEl.play();
                    if(playPromise && typeof playPromise.catch === 'function') {
                        playPromise.catch(() => {});
                    }
                }
                return;
            }
            const nextIndex = (this.videoIndex + 1) % this.videoSources.length;
            if(nextIndex === 0) {
                this.routeLap += 1;
            }
            this.videoIndex = nextIndex;
            this.prefetchNextVideos();
            this.updateRouteProgress();
            this.renderOverlayGraph();
            this.ensureVideoSource(videoEl);
            this.applyPlaybackState(videoEl, { shouldPlay: this.watchStatus === 'started', resetTime: true });
        }
    }
    ensureVideoSource(videoEl) {
        const entry = this.videoSources[this.videoIndex];
        const src = this.routeVideoSrc ?? entry?.src;
        if (!src) return;
        this.currentMultiplier = entry?.multiplier ?? 1;
        if (videoEl.dataset.videoSrc !== src) {
            this.routeVideoLoadToken += 1;
            videoEl.dataset.videoSrc = src;
            videoEl.setAttribute('src', src);
            this.setRouteVideoLoadingState(true, {
                text: 'Loading...',
                meta: 'Preparing route video',
                progress: null,
            });
        }
    }
    getPlaybackRate() {
        const Pthr = 195;
        const HRrest = 50;
        const HRmax = 173;
        const wp = 0.5;
        const wh = 0.4;
        const wc = 0.2;

        const pNorm = this.power1s / Pthr;
        const hNorm = (this.heartRate - HRrest) / (HRmax - HRrest);
        const cNorm = this.cadence / 50;

        const effort = (wp * pNorm) + (wh * hNorm) + (wc * cNorm);
        const rate = effort * (this.currentMultiplier ?? 1);
        const clamped = Math.max(0.3, Math.min(5, rate));
        return clamped;
    }
    updatePlaybackRate() {
        const rate = this.getPlaybackRate();
        if(this.$routeVideoEl) {
            this.$routeVideoEl.playbackRate = rate;
        }
        this.updatePlaybackIndicator(rate);
    }

    scaleRpeForIndicator(rpe) {
        const squared = rpe * rpe;
        const visualRpe = 1 + ((squared - 1) / 35) * 9;
        return Math.min(10, visualRpe);
    }

    startVideoPlayback() {
        const heroVideo = document.querySelector('#home-hero-video');
        const videoEl = this.$routeVideoEl;
        if (heroVideo && videoEl && this.videoSources.length > 0) {
            this.ensureVideoSource(videoEl);
            this.startRouteVideo(videoEl, true);
        }
    }

    pauseVideoPlayback() {
        this.$routeVideoEl?.pause();
    }

    stopVideoPlayback() {
        if(this.$routeVideoEl) {
            this.$routeVideoEl.pause();
            this.$routeVideoEl.currentTime = 0;
        }
        this.setRouteVideoLoadingState(false);
    }

    updatePlaybackIndicator(rate) {
        if (!this.$rateIndicator || this.$rateBars.length === 0) return;
        const minRate = 0.3;
        const maxRate = 5;
        const normalized = (rate - minRate) / (maxRate - minRate);
        const clamped = Math.max(0, Math.min(1, normalized));
        const rawRpe = 1 + (clamped * 9);
        const visualRpe = Math.max(1, Math.min(10, this.scaleRpeForIndicator(rawRpe)));
        const visualClamped = (visualRpe - 1) / 9;
        const containerHeight = this.$rateIndicator.clientHeight || 120;
        const baseHeight = containerHeight * 0.2;
        const range = containerHeight - baseHeight;
        const scales = [1, 0.85, 0.7, 0.55];

        this.$rateBars.forEach((bar, index) => {
            const scale = scales[index % scales.length];
            const height = baseHeight + (range * visualClamped * scale);
            bar.style.height = `${height}px`;
        });

        if(this.$rateValue) {
            const rpe = Math.max(1, Math.min(10, Math.round(visualRpe)));
            this.$rateValue.textContent = `${rpe}`;
        }
    }

    async captureSnapshot() {
        const videoEl = this.$routeVideoEl;
        if(!videoEl || !videoEl.videoWidth) return null;

        const canvas = document.createElement('canvas');
        canvas.width = videoEl.videoWidth;
        canvas.height = videoEl.videoHeight;
        const ctx = canvas.getContext('2d');
        if(!ctx) return null;

        ctx.drawImage(videoEl, 0, 0);
        this.drawHudOnCanvas(ctx, canvas.width, canvas.height);

        return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    }

    async captureVideoFromCanvas(timestamp, durationMs) {
        const videoEl = this.$routeVideoEl;
        if(!videoEl || !videoEl.videoWidth) return;

        const canvas = document.createElement('canvas');
        canvas.width = videoEl.videoWidth;
        canvas.height = videoEl.videoHeight;
        const ctx = canvas.getContext('2d');
        if(!ctx) return;

        let rafId;
        const drawFrame = () => {
            ctx.drawImage(videoEl, 0, 0);
            this.drawHudOnCanvas(ctx, canvas.width, canvas.height);
            rafId = requestAnimationFrame(drawFrame);
        };
        rafId = requestAnimationFrame(drawFrame);

        const mimeType = [
            'video/mp4;codecs=avc1',   // Chrome 108+ — H.264 MP4, best compatibility
            'video/mp4',               // Chrome, broad fallback
            'video/webm;codecs=vp9',
            'video/webm;codecs=vp8',
            'video/webm',
        ].find(t => MediaRecorder.isTypeSupported(t)) ?? 'video/webm';

        const ext = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';

        const stream = canvas.captureStream(30);
        let recorder;
        try {
            recorder = new MediaRecorder(stream, { mimeType });
        } catch(err) {
            recorder = new MediaRecorder(stream);
        }

        const chunks = [];
        recorder.addEventListener('dataavailable', e => {
            if(e.data?.size > 0) chunks.push(e.data);
        });

        const stopped = new Promise(resolve => {
            recorder.addEventListener('stop', resolve, { once: true });
        });

        recorder.start();
        await this.sleep(durationMs);
        cancelAnimationFrame(rafId);
        recorder.stop();
        await stopped;

        const blob = new Blob(chunks, { type: recorder.mimeType ?? mimeType });
        if(blob.size > 0) {
            this.downloadBlob(blob, `auuki-clip-${timestamp}.${ext}`);
        }
    }

    drawHudOnCanvas(ctx, w, h) {
        const barH = Math.round(h * 0.11);
        const y = h - barH;

        ctx.fillStyle = 'rgba(0,0,0,0.58)';
        ctx.fillRect(0, y, w, barH);

        const valSize = Math.round(barH * 0.46);
        const lblSize = Math.round(barH * 0.28);
        const midY = y + barH * 0.5;

        const cols = [
            { label: 'POWER',   value: `${this.formatHudInteger(this.power1s, { suffix: 'w' })}` },
            { label: 'HR',      value: this.formatHudInteger(this.heartRate) },
            { label: 'CADENCE', value: this.formatHudInteger(this.cadence) },
            { label: 'TIME',    value: this.formatSeconds(this.elapsed ?? 0) },
        ];

        const colW = w / cols.length;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        cols.forEach((col, i) => {
            const cx = colW * i + colW / 2;
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.font = `${lblSize}px system-ui, sans-serif`;
            ctx.fillText(col.label, cx, midY - valSize * 0.42);
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${valSize}px system-ui, sans-serif`;
            ctx.fillText(col.value, cx, midY + lblSize * 0.7);
        });
    }

    formatSeconds(total) {
        const s = Math.floor(total);
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = s % 60;
        if(h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
        return `${m}:${String(sec).padStart(2,'0')}`;
    }
    formatHudInteger(value, { suffix = '' } = {}) {
        const numeric = Number(value);
        if(!Number.isFinite(numeric)) return '--';
        return `${Math.round(numeric)}${suffix}`;
    }

    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

customElements.define('watch-control', Watch);

export { Watch };
