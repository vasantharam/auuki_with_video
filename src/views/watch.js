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

        this.dom.start.addEventListener('pointerup', this.onStart, this.signal);
        this.dom.pause.addEventListener('pointerup', this.onPause, this.signal);
        this.dom.back.addEventListener('pointerup', this.onBack, this.signal);
        this.dom.lap.addEventListener('pointerup', this.onLap, this.signal);
        this.dom.stop.addEventListener('pointerup', this.onStop, this.signal);
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
    }
    disconnectedCallback() {
        this.abortController.abort();
    }
    onStart(e) {
        xf.dispatch('ui:watchStart');
        xf.dispatch('ui:workoutStart');
        const heroVideo = document.querySelector('#home-hero-video');
        const videoEl = heroVideo?.querySelector('video');
        if (heroVideo && videoEl && this.videoSources.length > 0) {
            heroVideo.classList.add('active');
            this.ensureVideoSource(videoEl);
            videoEl.currentTime = 0;
            videoEl.playbackRate = this.getPlaybackRate();
            videoEl.play();
        }
    }
    onPause(e) {
        xf.dispatch('ui:watchPause');
        const heroVideo = document.querySelector('#home-hero-video');
        const videoEl = heroVideo?.querySelector('video');
        if (heroVideo && videoEl) {
            videoEl.pause();
        }
    }
    onBack(e)  { xf.dispatch('ui:watchBack'); }
    onLap(e)   { xf.dispatch('ui:watchLap'); }
    onStop(e)  {
        xf.dispatch('ui:watchStop');
        const heroVideo = document.querySelector('#home-hero-video');
        const videoEl = heroVideo?.querySelector('video');
        if (heroVideo && videoEl) {
            videoEl.pause();
            videoEl.currentTime = 0;
            heroVideo.classList.remove('active');
        }
    }
    onSave(e)  { xf.dispatch('ui:activity:save'); }
    onWorkoutStart(e) { xf.dispatch('ui:workoutStart'); }
    onWatchStatus(status) {
        if(status === 'started') { this.renderStarted(this.dom); }
        if(status === 'paused')  { this.renderPaused(this.dom);  }
        if(status === 'stopped') { this.renderStopped(this.dom); }
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
            videoEl.playbackRate = this.getPlaybackRate();
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
        if (heroVideo && videoEl) {
            videoEl.playbackRate = this.getPlaybackRate();
        }
    }
}

customElements.define('watch-control', Watch);

export { Watch };
