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
        this.onVideoEnded = this.onVideoEnded.bind(this);
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
        this.videoSources = [];
        this.videoIndex = 0;
        this.currentMultiplier = 1;
        this.csvOptions = ['files'];
        this.selectedCsv = 'files';
        this.watchStatus = 'stopped';
        this.isCapturing = false;
        this.$rateIndicator = document.querySelector('#playback-rate-indicator');
        this.$rateBars = this.$rateIndicator
            ? Array.from(this.$rateIndicator.querySelectorAll('.playback-rate-bar'))
            : [];

        this.dom.start.addEventListener('pointerup', this.onStart, this.signal);
        this.dom.pause.addEventListener('pointerup', this.onPause, this.signal);
        this.dom.back.addEventListener('pointerup', this.onBack, this.signal);
        this.dom.lap.addEventListener('pointerup', this.onLap, this.signal);
        this.dom.stop.addEventListener('pointerup', this.onStop, this.signal);
        this.dom.snapshot?.addEventListener('pointerup', this.onSnapshot.bind(this), this.signal);
        this.dom.record?.addEventListener('pointerup', this.onRecord.bind(this), this.signal);
        // this.dom.workout.addEventListener('pointerup', this.onWorkoutStart);
        this.dom.save.addEventListener(`pointerup`, this.onSave, this.signal);

        this.renderInit(this.dom);

        xf.sub(`db:watchStatus`, this.onWatchStatus.bind(this), this.signal);
        xf.sub(`db:workoutStatus`, this.onWorkoutStatus.bind(this), this.signal);
        xf.sub(`db:cadence`, this.onCadence.bind(this), this.signal);
        xf.sub(`db:power1s`, this.onPower1s.bind(this), this.signal);
        xf.sub(`db:heartRate`, this.onHeartRate.bind(this), this.signal);

        const heroVideo = document.querySelector('#home-hero-video');
        const videoEl = heroVideo?.querySelector('video');
        if (heroVideo && videoEl) {
            videoEl.addEventListener('ended', this.onVideoEnded.bind(this), this.signal);
        }

        this.$csvSelector = document.querySelector('#video-csv-selector');
        this.renderCsvSelector();
        this.loadCsvOptions();
        this.updatePlaybackIndicator(this.getPlaybackRate());
    }
    disconnectedCallback() {
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
        if (this.isCapturing) return;
        if (!navigator.mediaDevices?.getDisplayMedia || !window.MediaRecorder) {
            console.warn('Screen capture not supported in this browser.');
            return;
        }

        this.isCapturing = true;
        let stream;
        try {
            stream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    frameRate: 30,
                    displaySurface: 'browser',
                    preferCurrentTab: true,
                    selfBrowserSurface: 'include',
                },
                audio: false,
            });

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            await this.sleep(2000);
            await this.captureSnapshotFromStream(stream, timestamp);
        } catch (err) {
            console.warn('Screen capture canceled or failed.', err);
        } finally {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
            this.isCapturing = false;
        }
    }
    async onRecord(e) {
        if (this.isCapturing) return;
        if (!navigator.mediaDevices?.getDisplayMedia || !window.MediaRecorder) {
            console.warn('Screen capture not supported in this browser.');
            return;
        }

        this.isCapturing = true;
        let stream;
        try {
            stream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    frameRate: 30,
                    displaySurface: 'browser',
                    preferCurrentTab: true,
                    selfBrowserSurface: 'include',
                },
                audio: false,
            });

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            await this.captureVideoFromStream(stream, timestamp, 10000);
        } catch (err) {
            console.warn('Screen capture canceled or failed.', err);
        } finally {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
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
    }
    onWorkoutStatus(status) {
        if(status === 'started') { this.renderWorkoutStarted(this.dom); }
        if(status === 'done')    {  }
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
    onCadence(cadence) {
        this.cadence = cadence;
        this.updatePlaybackRate();
    }
    onPower1s(power) {
        this.power1s = power;
        this.updatePlaybackRate();
    }
    onHeartRate(heartRate) {
        this.heartRate = heartRate;
        this.updatePlaybackRate();
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
        this.$csvSelector.innerHTML = `
            <h4>Virtual AI Routes</h4>
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
                    this.loadVideoManifest(this.selectedCsv);
                }
            }, this.signal);
        });
    }
    async loadCsvOptions() {
        const nextOptions = [];
        try {
            // Prefer a simple text manifest listing CSV files (one per line).
            const resTxt = await fetch('/videos/routes.txt');
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
                const res = await fetch('/videos/csv-index.json');
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
        if(this.selectedCsv) {
            await this.loadVideoManifest(this.selectedCsv);
        }
    }
    async loadVideoManifest(csvName = 'files') {
        try {
            const res = await fetch(`/videos/${csvName}.csv`);
            if(res.ok) {
                const text = await res.text();
                const entries = text
                    .split(/\r?\n/)
                    .map(line => line.trim())
                    .filter(line => line && !line.startsWith('#'))
                    .map(line => line.split(',').map(x => x.trim()))
                    .map(([file, multiplier]) => ({
                        src: `/videos/${file}`,
                        multiplier: isNaN(parseFloat(multiplier)) ? 1 : parseFloat(multiplier),
                    }))
                    .filter(entry => entry.src && entry.src.endsWith('.mp4'));
                if(entries.length > 0) {
                    this.videoSources = entries;
                    this.videoIndex = 0;
                    this.currentMultiplier = this.videoSources[0]?.multiplier ?? 1;
                    const heroVideo = document.querySelector('#home-hero-video');
                    const videoEl = heroVideo?.querySelector('video');
                    if (heroVideo && videoEl) {
                        this.ensureVideoSource(videoEl);
                        if (this.watchStatus === 'started') {
                            this.startVideoPlayback();
                        }
                    }
                }
            }
        } catch(e) {
            console.error('Error loading video manifest', e);
        }
    }
    onVideoEnded() {
        const heroVideo = document.querySelector('#home-hero-video');
        const videoEl = heroVideo?.querySelector('video');
        if (heroVideo && videoEl && this.videoSources.length > 0) {
            this.videoIndex = (this.videoIndex + 1) % this.videoSources.length;
            this.ensureVideoSource(videoEl);
            videoEl.currentTime = 0;
            const rate = this.getPlaybackRate();
            videoEl.playbackRate = rate;
            this.updatePlaybackIndicator(rate);
            videoEl.play();
        }
    }
    ensureVideoSource(videoEl) {
        const entry = this.videoSources[this.videoIndex];
        if (!entry) return;
        this.currentMultiplier = entry.multiplier ?? 1;
        if (videoEl.getAttribute('src') !== entry.src) {
            videoEl.setAttribute('src', entry.src);
            videoEl.load();
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
        const heroVideo = document.querySelector('#home-hero-video');
        const videoEl = heroVideo?.querySelector('video');
        const rate = this.getPlaybackRate();
        if (heroVideo && videoEl) {
            videoEl.playbackRate = rate;
        }
        this.updatePlaybackIndicator(rate);
    }

    startVideoPlayback() {
        const heroVideo = document.querySelector('#home-hero-video');
        const videoEl = heroVideo?.querySelector('video');
        if (heroVideo && videoEl && this.videoSources.length > 0) {
            heroVideo.classList.add('active');
            this.ensureVideoSource(videoEl);
            videoEl.currentTime = 0;
            const rate = this.getPlaybackRate();
            videoEl.playbackRate = rate;
            this.updatePlaybackIndicator(rate);
            const playPromise = videoEl.play();
            if (playPromise && typeof playPromise.catch === 'function') {
                playPromise.catch(() => {});
            }
        }
    }

    pauseVideoPlayback() {
        const heroVideo = document.querySelector('#home-hero-video');
        const videoEl = heroVideo?.querySelector('video');
        if (heroVideo && videoEl) {
            videoEl.pause();
        }
    }

    stopVideoPlayback() {
        const heroVideo = document.querySelector('#home-hero-video');
        const videoEl = heroVideo?.querySelector('video');
        if (heroVideo && videoEl) {
            videoEl.pause();
            videoEl.currentTime = 0;
            heroVideo.classList.remove('active');
        }
    }

    updatePlaybackIndicator(rate) {
        if (!this.$rateIndicator || this.$rateBars.length === 0) return;
        const minRate = 0.3;
        const maxRate = 5;
        const normalized = (rate - minRate) / (maxRate - minRate);
        const clamped = Math.max(0, Math.min(1, normalized));
        const containerHeight = this.$rateIndicator.clientHeight || 120;
        const baseHeight = containerHeight * 0.2;
        const range = containerHeight - baseHeight;
        const scales = [1, 0.85, 0.7, 0.55];

        this.$rateBars.forEach((bar, index) => {
            const scale = scales[index % scales.length];
            const height = baseHeight + (range * clamped * scale);
            bar.style.height = `${height}px`;
        });
    }

    async captureSnapshotFromStream(stream, timestamp) {
        const track = stream.getVideoTracks()[0];
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx || !track) return;

        if ('ImageCapture' in window) {
            const imageCapture = new ImageCapture(track);
            const bitmap = await imageCapture.grabFrame();
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            ctx.drawImage(bitmap, 0, 0);
        } else {
            const video = document.createElement('video');
            video.srcObject = stream;
            video.muted = true;
            await video.play();
            await new Promise(requestAnimationFrame);
            canvas.width = video.videoWidth || 1280;
            canvas.height = video.videoHeight || 720;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            video.pause();
        }

        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        if (blob) {
            this.downloadBlob(blob, `auuki-snapshot-${timestamp}.png`);
        }
    }

    async captureVideoFromStream(stream, timestamp, durationMs) {
        const chunks = [];
        let recorder;
        try {
            recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
        } catch (err) {
            recorder = new MediaRecorder(stream);
        }

        const stopped = new Promise(resolve => {
            recorder.addEventListener('stop', resolve, { once: true });
        });

        recorder.addEventListener('dataavailable', event => {
            if (event.data && event.data.size > 0) {
                chunks.push(event.data);
            }
        });

        recorder.start();
        setTimeout(() => recorder.stop(), durationMs);
        await stopped;

        const blob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' });
        if (blob.size > 0) {
            this.downloadBlob(blob, `auuki-clip-${timestamp}.webm`);
        }
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
