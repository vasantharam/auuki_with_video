import { xf, exists, equals } from './functions.js';
import { models } from './models/models.js';
import { Sound } from './sound.js';
import { idb } from './storage/idb.js';
import { fileHandler } from './file.js';
import { uuid } from './storage/uuid.js';
import { ControlMode, } from './ble/enums.js';
import { TimerStatus, } from './activity/enums.js';

// import { trainerMock } from './simulation-scripts.js';

let db = {
    // Data Screen
    power: models.power.default,
    heartRate: models.heartRate.default,
    rrInterval: [],
    cadence: models.cadence.default,
    speed: models.speed.default,
    sources: models.sources.default,
    smo2: models.smo2.default,
    thb: models.thb.default,
    coreBodyTemperature: 0,
    skinTemperature: 0,
    position_lat: 0,
    position_long: 0,

    speedVirtual: models.virtualState.speed,
    altitude: models.virtualState.altitude,
    distance: models.virtualState.distance,
    ascent: models.virtualState.ascent,

    power1s: models.power1s.default,
    power3s: models.power3s.default,
    powerInZone: models.powerInZone.default,

    powerLap: models.powerLap.default,
    heartRateLap: models.heartRateLap.default,
    cadenceLap: models.cadenceLap.default,
    kcal: models.kcal.default,
    powerAvg: models.powerAvg.default,
    cadenceAvg: models.cadenceAvg.default,
    heartRateAvg: models.heartRateAvg.default,

    powerLapCount: models.powerLap.count,
    heartRateLapCount: models.heartRateLap.count,
    cadenceLapCount: models.cadenceLap.count,
    powerAvgCount: models.powerAvg.count,
    cadenceAvgCount: models.cadenceAvg.count,
    heartRateAvgCount: models.heartRateAvg.count,

    heartRateMax: 0,

    // Targets
    powerTarget: models.powerTarget.default,
    resistanceTarget: models.resistanceTarget.default,
    slopeTarget: models.slopeTarget.default,
    cadenceTarget: models.cadenceTarget.default,

    mode: models.mode.default,
    page: models.page.default,
    lock: false,

    // Profile
    ftp: models.ftp.default,
    weight: models.weight.default,
    theme: models.theme.default,
    measurement: models.measurement.default,
    volume: models.volume.default,

    // UI options
    powerSmoothing: 0,
    dataTileSwitch: models.dataTileSwitch.default,
    auth: ':login',

    // Workouts
    workouts: [],
    workout: models.workout.default,

    // Activities
    activity: models.activity.default,

    // Recording
    records: [],
    lap: [],
    laps: [],
    events: [],
    lapStartTime: false,

    // Watch
    elapsed: 0,
    lapTime: 0,
    stepTime: 0,
    intervalIndex: 0,
    stepIndex: 0,
    intervalDuration: 0,
    stepDuration: 0,
    watchStatus: TimerStatus.stopped,
    workoutStatus: TimerStatus.stopped,

    // Course
    courseIndex: 0,

    // Request ANT+ Device
    antSearchList: [],
    antDeviceId: {},

    // Services
    services: {strava: false, intervals: false, trainingPeaks: false},
};



xf.create(db);

// Data Screen
xf.reg(models.heartRate.prop, (heartRate, db) => {
    db.heartRate = heartRate;
    db.heartRateLap = models.heartRateLap.setState(heartRate);
    db.heartRateAvg = models.heartRateAvg.setState(heartRate);
    db.heartRateLapCount = models.heartRateLap.count;
    db.heartRateAvgCount = models.heartRateAvg.count;

    if(heartRate > db.heartRateMax) {
        db.heartRateMax = heartRate;
    }
});

xf.reg('rrInterval', (rrInterval, db) => {
    db.rrInterval = rrInterval;
});

xf.reg(models.power.prop, (power, db) => {
    db.power = power;
});

xf.reg(models.cadence.prop, (cadence, db) => {
    db.cadence = cadence;
    db.cadenceLap = models.cadenceLap.setState(cadence);
    db.cadenceAvg = models.cadenceAvg.setState(cadence);
    db.cadenceLapCount = models.cadenceLap.count;
    db.cadenceAvgCount = models.cadenceAvg.count;
});

xf.reg(models.speed.prop, (speed, db) => {
    db.speed = speed;
});

xf.reg(models.smo2.prop, (smo2, db) => {
    db.smo2 = smo2;
});

xf.reg(models.thb.prop, (thb, db) => {
    db.thb = thb;
});

xf.reg(`coreBodyTemperature`, (coreBodyTemperature, db) => {
    db.coreBodyTemperature = coreBodyTemperature;
});

xf.reg(`skinTemperature`, (skinTemperature, db) => {
    db.skinTemperature = skinTemperature;
});

xf.reg(models.sources.prop, (sources, db) => {
    db.sources = models.sources.set(db.sources, sources);
    models.sources.backup(db.sources);
    console.log(db.sources);
});

xf.reg('power1s', (power, db) => {
    db.power1s = power;

    db.powerLap = models.powerLap.setState(power);
    db.powerAvg = models.powerAvg.setState(power);
    db.kcal = models.kcal.setState(power);

    db.powerLapCount = models.powerLap.count;
    db.powerAvgCount = models.powerAvg.count;
});

xf.reg('power3s', (power, db) => {
    db.power3s = power;
});

xf.reg('powerInZone', (powerInZone, db) => {
    db.powerInZone = powerInZone;
});

xf.reg('speedVirtual', (speedVirtual, db) => {
    db.speedVirtual = speedVirtual;
});

xf.reg('altitude', (altitude, db) => {
    db.altitude = altitude;
});

xf.reg('ascent', (ascent, db) => {
    db.ascent = ascent;
});

xf.reg('distance', (distance, db) => {
    if(equals(db.watchStatus, 'started')) {
        db.distance = distance;
    };
});

// Pages
xf.reg('ui:page-set', (page, db) => {
    db.page = models.page.set(page);
});

// Modes
xf.reg('ui:mode-set', (mode, db) => {
    if(db.lock) return;

    db.mode = models.mode.set(mode);

    if(equals(mode, ControlMode.erg)) {
        xf.dispatch(`ui:power-target-set`, db.powerTarget);
    }
    if(equals(mode, ControlMode.resistance)) {
        xf.dispatch(`ui:resistance-target-set`, db.resistanceTarget);
    }
    if(equals(mode, ControlMode.sim)) {
        xf.dispatch(`ui:slope-target-set`, db.slopeTarget);
    }
});

xf.reg('ui:lock-set', (_, db) => {
    db.lock = !db.lock;
});

xf.reg('ui:lock-toggle', (_, db) => {
    db.lock = !db.lock;
});


// UI options
xf.reg('ui:data-tile-switch-set', (index, db) => {
    db.dataTileSwitch = index;
    models.dataTileSwitch.backup(db.dataTileSwitch);
});

// Targets
xf.reg('ui:power-target-set', (powerTarget, db) => {
    db.powerTarget = models.powerTarget.set(powerTarget);
});
xf.reg('ui:power-target-inc', (_, db) => {
    db.powerTarget = models.powerTarget.inc(db.powerTarget);
});
xf.reg(`ui:power-target-dec`, (_, db) => {
    db.powerTarget = models.powerTarget.dec(db.powerTarget);
});
xf.reg('ui:cadence-target-set', (cadenceTarget, db) => {
    db.cadenceTarget = models.cadenceTarget.set(cadenceTarget);
});

xf.reg('ui:resistance-target-set', (resistanceTarget, db) => {
    db.resistanceTarget = models.resistanceTarget.set(resistanceTarget);
});
xf.reg('ui:resistance-target-inc', (_, db) => {
    db.resistanceTarget = models.resistanceTarget.inc(db.resistanceTarget);
});
xf.reg(`ui:resistance-target-dec`, (_, db) => {
    db.resistanceTarget = models.resistanceTarget.dec(db.resistanceTarget);
});

xf.reg('ui:slope-target-set', (slopeTarget, db) => {
    db.slopeTarget = models.slopeTarget.set(slopeTarget);
});
xf.reg('ui:slope-target-inc', (_, db) => {
    db.slopeTarget = models.slopeTarget.inc(db.slopeTarget);
});
xf.reg(`ui:slope-target-dec`, (_, db) => {
    db.slopeTarget = models.slopeTarget.dec(db.slopeTarget);
});

// Profile
xf.reg('ui:ftp-set', (ftp, db) => {
    db.ftp = models.ftp.set(ftp);
    models.ftp.backup(db.ftp);
});
xf.reg('ui:weight-set', (weight, db) => {
    db.weight = models.weight.set(weight);
    models.weight.backup(db.weight);
});
xf.reg('ui:theme-switch', (_, db) => {
    db.theme = models.theme.switch(db.theme);
    models.theme.backup(db.theme);
});
xf.reg('ui:measurement-switch', (_, db) => {
    db.measurement = models.measurement.switch(db.measurement);
    models.measurement.backup(db.measurement);
});

xf.reg('ui:volume-mute', (_, db) => {
    db.volume = models.volume.mute();
    models.volume.backup(db.volume);
});
xf.reg('ui:volume-down', (_, db) => {
    db.volume = models.volume.dec(db.volume);
    models.volume.backup(db.volume);
});
xf.reg(`ui:volume-up`, (_, db) => {
    db.volume = models.volume.inc(db.volume);
    models.volume.backup(db.volume);
});

// Workouts
xf.reg('workout', (workout, db) => {
    db.workout = models.workout.set(workout);
});
xf.reg('ui:workout:select', (id, db) => {
    db.workout = models.workouts.get(db.workouts, id);
});
xf.reg('ui:planned:select', (id, db) => {
    db.workout = models.planned.get(id);
});
xf.reg('ui:workout:remove', (id, db) => {
    db.workouts = models.workouts.remove(db.workouts, id);
});
xf.reg('ui:workout:upload', async function(files, db) {
    for(let file of Object.values(files)) {
        const { result, name } = await models.workout.readFromFile(file);
        const workout = models.workout.parse(result, name);
        models.workouts.add(db.workouts, workout);
        xf.dispatch('db:workouts', db);
    }

});
xf.reg('watch:stopped', async (_, db) => {
    try {
        const record = await models.activity.createFromCurrent(db);
        xf.dispatch('activity:save:success');

        if(models.api.strava.hasLocalClientCredentials() && record?.id) {
            xf.dispatch('ui:modal:error:open', 'Uploading to Strava...');
            const result = await models.activity.upload('strava', record.id);
            if(result === ':success') {
                xf.dispatch('ui:modal:error:open', 'Strava upload complete.');
            } else if(result === ':not-connected') {
                xf.dispatch('ui:modal:error:open', 'Strava app is configured, but not connected yet. Press Strava Connect first.');
            } else if(result === ':not-configured') {
                xf.dispatch('ui:modal:error:open', 'Strava upload skipped. Save your Client ID and Client Secret first.');
            } else {
                xf.dispatch('ui:modal:error:open', 'Strava upload failed.');
            }
        }
    } catch (err) {
        console.error(`Error on activity save: `, err);
        xf.dispatch('activity:save:fail');
    }

});
xf.reg('activity:save:success', (e, db) => {
    models.session.reset(db);
});
xf.sub('ui:activity:upload:by:id', (id) => {
    models.activity.upload(id);
});
// download the current activity as a .fit file
xf.reg('ui:activity:save', (_, db) => {
    xf.dispatch(`ui:page-set`, 'workouts');
});

xf.reg('course:index', (index, db) => {
    db.courseIndex = index;
});

xf.reg('course:position', (position, db) => {
    db.position_lat = position.position_lat;
    db.position_long = position.position_long;
});

// Wake Lock
xf.reg('lock:beforeunload', (e, db) => {
    // backup session
    models.session.backup(db);
});
xf.reg('lock:release', (e, db) => {
    // backup session
    models.session.backup(db);
});

// Request ANT+ Device
xf.reg('ui:ant:request:selected', (x, db) => {
    db.antDeviceId = db.antSearchList.filter(d => {
        return d.deviceNumber === parseInt(x);
    })[0];
});
function includesDevice(devices, id) {
    return devices.filter(d => d.deviceNumber === id.deviceNumber).length > 0;
}
xf.reg(`ant:search:device-found`, (x, db) => {
    if(includesDevice(db.antSearchList, x)) return;
    db.antSearchList.push(x);
    db.antSearchList = db.antSearchList;
});
xf.reg(`ant:search:stopped`, (x, db) => {
    db.antSearchList = [];
});

xf.reg('auth', (x, db) => {
    // TODO: remove?
});

xf.reg('services', (x, db) => {
    db.services = Object.assign(db.services, x);
});


//
xf.reg('app:start', async function(_, db) {

    db.ftp = models.ftp.set(models.ftp.restore());
    db.weight = models.weight.set(models.weight.restore());
    db.theme = models.theme.set(models.theme.restore());
    db.measurement = models.measurement.set(models.measurement.restore());
    db.volume = models.volume.set(models.volume.restore());
    db.dataTileSwitch = models.dataTileSwitch.set(models.dataTileSwitch.restore()),

    db.sources = models.sources.set(models.sources.restore());

    // IndexedDB Schema Version 3
    await idb.start('store', 3, ['session', 'workouts', 'activity']);
    db.workouts = await models.workouts.restore();
    db.activity = await models.activity.restore();
    db.workout = models.workout.restore(db);
    models.planned.restore();

    await models.session.restore(db);
    xf.dispatch('workout:restore');
    xf.dispatch('activity:restore');

    models.kcal.restore(db);
    models.powerLap.restore(db);
    models.powerAvg.restore(db);
    models.cadenceLap.restore(db);
    models.cadenceAvg.restore(db);
    models.heartRateLap.restore(db);
    models.heartRateAvg.restore(db);

    const sound = Sound({volume: db.volume});
    sound.start();

    await models.api.start();

    // --- Startup UI ---
    // Priority: Strava reconnect > device pairing.
    // "Start Here" (BLE) only shows when the user is on the home page.

    const $startHere = document.getElementById('dialog--start-here');

    // Track BLE connection state so the dialog knows when to show/hide.
    let controllableConnected = false;
    let hrmConnected = false;

    const onControllableConnected    = () => { controllableConnected = true;  if ($startHere?.open) $startHere.close(); };
    const onControllableDisconnected = () => { controllableConnected = false; };
    const onHrmConnected             = () => { hrmConnected = true;  if ($startHere?.open) $startHere.close(); };
    const onHrmDisconnected          = () => { hrmConnected = false; };

    xf.sub('ble:controllable:connected',       onControllableConnected);
    xf.sub('ble:controllable:disconnected',    onControllableDisconnected);
    xf.sub('ble:heartRateMonitor:connected',   onHrmConnected);
    xf.sub('ble:heartRateMonitor:disconnected',onHrmDisconnected);

    if ($startHere) {
        document.getElementById('start-here-dismiss')
            ?.addEventListener('click', () => $startHere.close());

        // Close the dialog as soon as the user taps a device switch so the
        // app's modal is gone before Chrome opens the native BLE picker.
        // Stacking showModal() + requestDevice() crashes Chrome.
        const closeForBle = () => { if ($startHere.open) $startHere.close(); };
        xf.sub('ui:ble:controllable:switch',    closeForBle);
        xf.sub('ui:ble:heartRateMonitor:switch', closeForBle);

        // Prevent Escape from closing the dialog (it fires cancel which closes
        // it, then the BLE picker also captures Escape and the state diverges).
        $startHere.addEventListener('cancel', (e) => e.preventDefault());

        // Re-show whenever the user returns to the home page with no devices.
        xf.sub('db:page', (page) => {
            if (page === 'home' && !controllableConnected && !hrmConnected) {
                if (!$startHere.open) $startHere.showModal();
            }
        });
    }

    // If Strava has saved credentials but couldn't auto-connect, go to Settings
    // and animate the Strava section. Skip the BLE dialog for now — user sees
    // it when they navigate back to Home.
    if (!db.services.strava && models.api.strava.hasLocalClientCredentials()) {
        xf.dispatch('ui:page-set', 'settings');
        setTimeout(() => {
            const $stravaSection = document.getElementById('strava-section');
            $stravaSection?.scrollIntoView({behavior: 'smooth', block: 'start'});
            $stravaSection?.classList.add('strava-attention');
        }, 400);
    } else if ($startHere && !controllableConnected && !hrmConnected) {
        // Strava is fine (or unconfigured): open home page, show BLE dialog now.
        $startHere.showModal();
    }

    // TRAINER MOCK
    // trainerMock.init();
});

function start () {
    console.log('start db');
    xf.dispatch('db:start');

    // UI test
    // setInterval(function() {
    //     xf.dispatch('watch:elapsed', 1);
    //     xf.dispatch('power', 180);
    //     xf.dispatch('cadence', 80);
    //     xf.dispatch('heartRate', 140 + (Math.random() * 10));
    //     xf.dispatch('smo2', 71.17); // + (Math.random() * 10));
    //     xf.dispatch('thb', 11.14); // + (Math.random() / 2));
    //     xf.dispatch('coreBodyTemperature', 38.12);
    //     xf.dispatch('skinTemperature', 38.47);
    // }, 1000);
    // end UI test
}

start();

export { db };
