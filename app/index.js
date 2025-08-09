import document from "document";
import { vibration } from "haptics";
import fs from "fs";
import { me as appbit } from "appbit";
import { Accelerometer } from "accelerometer";

// keep the app from being killed, as long as it is in the foreground
appbit.appTimeoutEnabled = false;

// set the variables
let layer_motion_text = document.getElementById("layer_motion_text");
let layer_pause = document.getElementById("layer_pause");
let layer_play_stop = document.getElementById("layer_play_stop");
let layer_settings = document.getElementById("layer_settings");

let motion_text = document.getElementById("motion_text");
let motion_text_small = document.getElementById("motion_text_small");
let button_play_big = document.getElementById("button_play_big");
let button_play_small = document.getElementById("button_play_small");
let button_pause = document.getElementById("button_pause");
let button_stop = document.getElementById("button_stop");
let button_add_1 = document.getElementById("button_add_1");
let button_add_10 = document.getElementById("button_add_10");
let button_add_100 = document.getElementById("button_add_100");
let button_subtract_1 = document.getElementById("button_subtract_1");
let button_subtract_10 = document.getElementById("button_subtract_10");
let button_subtract_100 = document.getElementById("button_subtract_100");

let paused = false;
let started = false;
let vibrated = false;
let just_started = false;

let motion_between_readings = 0;
let prevMotionRemaining = 0; // track previous motionRemaining for threshold detection
let vibrationInterval = 50;

if (Accelerometer) {
    console.log("This device has an Accelerometer!");
    const accelerometer = new Accelerometer({ frequency: 1 });
    accelerometer.addEventListener("reading", onTick);
 } else {
    console.log("This device does NOT have an Accelerometer!");
    me.exit();
 }

let accelerometer_previous = { x: 0, y: 0, z: 0 };

// Initial motion count and configuration
let motionTarget = 0;
let motionRemaining = 0;
const CONFIG_FILE = "configuration.json";

function loadConfiguration() {
    if (fs.existsSync(CONFIG_FILE)) {
        try {
            const config = JSON.parse(fs.readFileSync(CONFIG_FILE, "ascii"));
            motionTarget = (typeof config.motionTarget === "number" && !isNaN(config.motionTarget)) ? config.motionTarget : 200;
            motionRemaining = (typeof config.motionRemaining === "number" && !isNaN(config.motionRemaining)) ? config.motionRemaining : 0;
        } catch (e) {
            console.log("Error reading configuration, using defaults");
            motionTarget = 200;
            motionRemaining = 0;
        }
    } else {
        motionTarget = 200;
        motionRemaining = 0;
    }
    if (motionRemaining > 0 && motionRemaining < motionTarget) motionTarget = motionRemaining;
}

loadConfiguration();

function reset_variables() {
    motionRemaining = Number(motionTarget);
    vibrated = false;
}

function calculateDistance(x1, y1, z1, x2, y2, z2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dz = z2 - z1;
    
    // Euclidean distance formula
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    return distance;
}

// display the main screen
function showScreen1() {
    layer_motion_text.style.visibility = "visible";
    layer_pause.style.visibility = "visible";
    layer_play_stop.style.visibility = "hidden";
    layer_settings.style.visibility = "hidden";
}

// display the paused screen
function showScreen2() {
    layer_motion_text.style.visibility = "visible";
    layer_pause.style.visibility = "hidden";
    layer_play_stop.style.visibility = "visible";
    layer_settings.style.visibility = "hidden";
}

// display the settings screen
function showScreen3() {
    update_motion_text_small();
    layer_motion_text.style.visibility = "hidden";
    layer_pause.style.visibility = "hidden";
    layer_play_stop.style.visibility = "hidden";
    layer_settings.style.visibility = "visible";
}

// Function to update the display
function update_motion_text() {
    motion_text.text = `${motionRemaining.toFixed(1)}`;
}

function update_motion_text_small() {
    motion_text_small.text = `${motionTarget.toFixed(1)}`;
}

// vibration function used when motion target has been reached
const vibrationRepeater = (pattern, count, interval) => {
    vibration.start(pattern)   // do one straight away
    let counter = count - 1
    let timer = setInterval(()=>{
      vibration.start(pattern)
      if (!--counter) clearInterval(timer)
    }, interval)
    vibrated = true;
  }

// Function to handle tick
function onTick() {
    if (started && !paused) {
        if (just_started) {
            accelerometer_previous.x = accelerometer.x;
            accelerometer_previous.y = accelerometer.y;
            accelerometer_previous.z = accelerometer.z;
            motion_between_readings = 0;
            just_started = false;
        }
        else {
            motion_between_readings = Math.abs(calculateDistance(accelerometer.x, accelerometer.y, accelerometer.z,
                accelerometer_previous.x, accelerometer_previous.y, accelerometer_previous.z) / 50.0);
            
            accelerometer_previous.x = accelerometer.x;
            accelerometer_previous.y = accelerometer.y;
            accelerometer_previous.z = accelerometer.z;
            
            // calculate motion remaining and store previous value
            prevMotionRemaining = motionRemaining;
            motionRemaining = motionRemaining - motion_between_readings;
        }

        // Update the display
        update_motion_text();

        // Trigger vibration if motionRemaining crosses a multiple of vibrationInterval downward
        if (started && motionRemaining > 0) {
            const prevBucket = Math.floor(prevMotionRemaining / vibrationInterval);
            const currBucket = Math.floor(motionRemaining / vibrationInterval);
            if (currBucket < prevBucket) {
                vibration.start('nudge-max');
            }
        }
    
        // Check if the motion count is zero or negative
        if (motionRemaining <= 0) {
            // Make the device vibrate
            if (vibrated == false) {
                vibrationRepeater('nudge-max', 4, 500);
            }
        }

        // console.log(`motion remaining: ${motionRemaining}. motion target: ${motionTarget}`)
        // console.log(`accelerometer readings: ${accelerometer.x},${accelerometer.y},${accelerometer.z}`);
    }
    else if (paused) {
        console.log('paused')
    }
    else if (!started) {
        console.log('not started')
    }
}

// resume countdown
button_play_big.onclick = function () {
    vibration.start('nudge-max');
    accelerometer.start();
    showScreen1();
    if (paused) {
        paused = false;
    }
}

// save settings and start countdown
button_play_small.onclick = function () {
    vibration.start('nudge-max');
    save_motion();
    started = true;
    accelerometer.start();
    just_started = true;
    reset_variables();
    update_motion_text();
    showScreen1();
}

// pause
button_pause.onclick = function () {
    vibration.start('nudge-max');
    accelerometer.stop();
    showScreen2();
    paused = true;
}

// stop
button_stop.onclick = function () {
    vibration.start('nudge-max');
    paused = false;
    started = false;
    accelerometer.stop()
    // save motionRemaining as current motionTarget value
    motionRemaining = motionTarget;
    reset_variables();
    showScreen3();
}

// change motion target through this function
function motionTargetChange(num_to_add) {
    motionTarget += num_to_add;
    if (motionTarget < 0 ) {
        motionTarget = 0
    }
    update_motion_text_small();
}

// buttons to add and subtract from motion target

button_add_1.onclick = function () {
    motionTargetChange(1);
    vibration.start('nudge');
    update_motion_text_small();
}

button_add_10.onclick = function () {
    motionTargetChange(10);
    vibration.start('nudge');
    update_motion_text_small();
}

button_add_100.onclick = function () {
    motionTargetChange(100);
    vibration.start('nudge');
    update_motion_text_small();
}

button_subtract_1.onclick = function () {
    motionTargetChange(-1);
    vibration.start('nudge');
    update_motion_text_small();
}

button_subtract_10.onclick = function () {
    motionTargetChange(-10);
    vibration.start('nudge');
    update_motion_text_small();
}

button_subtract_100.onclick = function () {
    motionTargetChange(-100);
    vibration.start('nudge');
    update_motion_text_small();
}

// save settings to file
function save_motion() {
    const config = { motionTarget,  motionRemaining};
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config), "ascii");
}

// save configuration on app exit
appbit.onunload = () => {
    save_motion()
}

// display intial data and screen
reset_variables();
onTick();
showScreen3();