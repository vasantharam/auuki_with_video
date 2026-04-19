
import { LocalStorageItem } from '../storage/local-storage.js';

class Config {
    #defaultStravaClientId = '162530';
    #defaultIntervalsClientId = 0;
    #defaultTrainingPeaksClientId = 0;

    constructor() {
        this.stravaClientIdStorage = LocalStorageItem({
            key: 'auuki.strava.client_id',
            fallback: '',
        });
        this.stravaClientSecretStorage = LocalStorageItem({
            key: 'auuki.strava.client_secret',
            fallback: '',
        });
        const localStravaClientId = this.stravaClientIdStorage.restore();
        const localStravaClientSecret = this.stravaClientSecretStorage.restore();

        // Derive the app's base URL dynamically so Strava OAuth redirect_uri
        // works on any host (localhost, GitHub Pages subpath, custom domain).
        // Keep the trailing slash so GitHub Pages serves index.html correctly
        // when Strava appends ?state=...&code=... to the redirect URI.
        const pwaUri = window.location.origin +
            window.location.pathname.replace(/index\.html$/, '');

        this.env = {
            PWA_URI: pwaUri,
            API_URI: pwaUri,
            STRAVA_CLIENT_ID: localStravaClientId || this.#defaultStravaClientId,
            STRAVA_CLIENT_SECRET: localStravaClientSecret || '',
            INTERVALS_CLIENT_ID: this.#defaultIntervalsClientId,
            TRAINING_PEAKS_CLIENT_ID: this.#defaultTrainingPeaksClientId,
        };
    }
    setServices(args = {}) {
        if(!this.stravaClientIdStorage.get()) {
            this.env.STRAVA_CLIENT_ID = args.strava ?? this.#defaultStravaClientId;
        }
        this.env.INTERVALS_CLIENT_ID = args.intervals ?? this.#defaultIntervalsClientId;
        this.env.TRAINING_PEAKS_CLIENT_ID = args.trainingPeaks ?? this.#defaultTrainingPeaksClientId;
    }
    setStravaCredentials(args = {}) {
        const clientId = `${args.clientId ?? ''}`.trim();
        const clientSecret = `${args.clientSecret ?? ''}`.trim();

        this.stravaClientIdStorage.set(clientId);
        this.stravaClientSecretStorage.set(clientSecret);

        this.env.STRAVA_CLIENT_ID = clientId || this.#defaultStravaClientId;
        this.env.STRAVA_CLIENT_SECRET = clientSecret;
    }
    clearStravaCredentials() {
        this.stravaClientIdStorage.remove();
        this.stravaClientSecretStorage.remove();
        this.env.STRAVA_CLIENT_ID = this.#defaultStravaClientId;
        this.env.STRAVA_CLIENT_SECRET = '';
    }
    getStravaCredentials() {
        return {
            clientId: this.stravaClientIdStorage.get(),
            clientSecret: this.stravaClientSecretStorage.get(),
        };
    }
    get() {
        return this.env;
    }
}

const config = new Config();

export default config;
