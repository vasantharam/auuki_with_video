import { xf } from '../functions.js';
import { OAuthService, stateParam } from './enums.js';
import { LocalStorageItem } from '../storage/local-storage.js';
import config from './config.js';

function Strava() {
    const serviceName = OAuthService.strava;
    let lastActivityId = null;
    let strava_client_id = config.get().STRAVA_CLIENT_ID;
    let strava_client_secret = config.get().STRAVA_CLIENT_SECRET;

    const accessTokenStorage = LocalStorageItem({
        key: 'auuki.strava.access_token',
        fallback: '',
    });
    const refreshTokenStorage = LocalStorageItem({
        key: 'auuki.strava.refresh_token',
        fallback: '',
    });
    const expiresAtStorage = LocalStorageItem({
        key: 'auuki.strava.expires_at',
        fallback: '0',
        parse: (value) => parseInt(value, 10) || 0,
        encode: (value) => `${value}`,
    });

    const update = function() {
        strava_client_id = config.get().STRAVA_CLIENT_ID;
        strava_client_secret = config.get().STRAVA_CLIENT_SECRET;
    };

    function hasLocalClientCredentials() {
        return !!(`${strava_client_id}`.trim() && `${strava_client_secret}`.trim());
    }

    function hasTokens() {
        return !!(accessTokenStorage.get() && refreshTokenStorage.get());
    }

    function setTokens(tokens = {}) {
        accessTokenStorage.set(tokens.access_token ?? '');
        refreshTokenStorage.set(tokens.refresh_token ?? '');
        expiresAtStorage.set(tokens.expires_at ?? 0);
    }

    function clearTokens() {
        accessTokenStorage.remove();
        refreshTokenStorage.remove();
        expiresAtStorage.remove();
    }

    function clearParams() {
        window.history.pushState({}, document.title, window.location.pathname);
    }

    async function connect() {
        update();
        if(!hasLocalClientCredentials()) {
            xf.dispatch('services', {strava: false});
            return;
        }

        const scope = 'activity:write';
        const state = stateParam.encode(serviceName);

        const url =
            'https://www.strava.com/oauth/authorize' +
            '?' +
            new URLSearchParams({
                client_id: strava_client_id,
                redirect_uri: config.get().PWA_URI,
                response_type: 'code',
                approval_prompt: 'auto',
                state,
                scope,
            }).toString();

        window.location.replace(url);
    }

    async function disconnect() {
        clearTokens();
        xf.dispatch('services', {strava: false});
    }

    async function exchangeToken(body) {
        const response = await fetch('https://www.strava.com/oauth/token', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(body),
        });

        if(!response.ok) {
            const text = await response.text();
            throw new Error(`Strava token exchange failed: ${response.status} ${text}`);
        }

        const result = await response.json();
        setTokens(result);
        xf.dispatch('services', {strava: true});
        return result.access_token;
    }

    async function paramsHandler(args = {}) {
        update();
        const code = args.code ?? '';

        if(!hasLocalClientCredentials() || !code) {
            xf.dispatch('services', {strava: false});
            return;
        }

        try {
            await exchangeToken({
                client_id: strava_client_id,
                client_secret: strava_client_secret,
                code,
                grant_type: 'authorization_code',
            });
            clearParams();
        } catch (e) {
            console.log(`:strava :oauth :code :error `, e);
            xf.dispatch('services', {strava: false});
            xf.dispatch('ui:modal:error:open', 'Strava connection failed. Check the saved Client ID, Client Secret, and callback URL.');
        }
    }

    async function getAccessToken() {
        update();

        if(!hasLocalClientCredentials()) {
            return '';
        }

        const accessToken = accessTokenStorage.get();
        const refreshToken = refreshTokenStorage.get();
        const expiresAt = expiresAtStorage.get();
        const now = Math.floor(Date.now() / 1000);

        if(accessToken && expiresAt > (now + 120)) {
            return accessToken;
        }
        if(!refreshToken) {
            return '';
        }

        try {
            return await exchangeToken({
                client_id: strava_client_id,
                client_secret: strava_client_secret,
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
            });
        } catch (e) {
            console.log(`:strava :refresh :error`, e);
            clearTokens();
            xf.dispatch('services', {strava: false});
            return '';
        }
    }

    async function restore() {
        update();
        if(!hasLocalClientCredentials() || !hasTokens()) {
            xf.dispatch('services', {strava: false});
            return false;
        }

        const token = await getAccessToken();
        const connected = !!token;
        xf.dispatch('services', {strava: connected});
        return connected;
    }

    async function fetchUpload(uploadId, accessToken) {
        const response = await fetch(`https://www.strava.com/api/v3/uploads/${uploadId}`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        if(!response.ok) {
            const text = await response.text();
            throw new Error(`Strava upload poll failed: ${response.status} ${text}`);
        }

        return response.json();
    }

    async function uploadWorkout(record) {
        update();
        if(!hasLocalClientCredentials()) {
            return ':not-configured';
        }

        const accessToken = await getAccessToken();
        if(!accessToken) {
            return ':not-connected';
        }

        const formData = new FormData();
        formData.append('name', record.summary?.name ?? 'Powered by Auuki workout');
        formData.append('data_type', 'fit');
        formData.append('external_id', `auuki-${record.id}.fit`);
        formData.append('file', record.blob, `auuki-${record.id}.fit`);

        try {
            const response = await fetch('https://www.strava.com/api/v3/uploads', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
                body: formData,
            });

            if(!response.ok) {
                const text = await response.text();
                console.log(`:strava :upload :fail`, text);
                return ':fail';
            }

            const upload = await response.json();
            const uploadId = upload.id;

            for(let attempt = 0; attempt < 20; attempt += 1) {
                const status = await fetchUpload(uploadId, accessToken);
                if(status.error) {
                    console.log(`:strava :upload :error`, status.error);
                    return ':fail';
                }
                if(status.activity_id) {
                    lastActivityId = status.activity_id;
                    return ':success';
                }
                await new Promise((resolve) => window.setTimeout(resolve, 1500));
            }

            return ':fail';
        } catch(e) {
            console.log(`:strava :upload :error `, e);
            return ':fail';
        }
    }

    function getLastActivityId() {
        const id = lastActivityId;
        lastActivityId = null;
        return id;
    }

    async function blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result); // data:image/jpeg;base64,...
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    async function toJpegBlob(blob) {
        if(blob.type === 'image/jpeg') return blob;
        return new Promise(resolve => {
            const img = new Image();
            const url = URL.createObjectURL(blob);
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                canvas.getContext('2d').drawImage(img, 0, 0);
                canvas.toBlob(resolve, 'image/jpeg', 0.88);
                URL.revokeObjectURL(url);
            };
            img.src = url;
        });
    }

    async function uploadPhoto(activityId, blob) {
        const accessToken = await getAccessToken();
        if(!accessToken) { console.log(`:strava :photo :no-token`); return false; }

        const jpegBlob = await toJpegBlob(blob);
        if(!jpegBlob) return false;

        // Strava's createPhoto endpoint expects JSON with a map of size -> data-URI.
        // Try the JSON/base64 approach first (used by most third-party apps),
        // then fall back to multipart if Strava rejects it.
        const dataUri = await blobToBase64(jpegBlob);

        try {
            const response = await fetch(`https://www.strava.com/api/v3/activities/${activityId}/photos`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    urls: { '600': dataUri },
                    caption: 'Powered by Auuki',
                }),
            });

            const text = await response.text();
            console.log(`:strava :photo :response ${response.status}`, text);

            if(response.ok) return true;

            // Fallback: try multipart form upload
            console.log(`:strava :photo :trying multipart fallback`);
            const formData = new FormData();
            formData.append('file', jpegBlob, 'auuki-ride.jpg');
            formData.append('caption', 'Powered by Auuki');

            const r2 = await fetch(`https://www.strava.com/api/v3/activities/${activityId}/photos`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${accessToken}` },
                body: formData,
            });

            const text2 = await r2.text();
            console.log(`:strava :photo :multipart :response ${r2.status}`, text2);
            return r2.ok;

        } catch(e) {
            console.log(`:strava :photo :upload :error`, e);
            return false;
        }
    }

    return Object.freeze({
        connect,
        disconnect,
        paramsHandler,
        uploadWorkout,
        getLastActivityId,
        uploadPhoto,
        update,
        restore,
        hasLocalClientCredentials,
    });
}

const strava = Strava();

export default strava;
