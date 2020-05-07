let audioContext;
let unlocked = false;
let isPlaying = false;      // Are we currently playing?
let startTime;              // The start time of the entire sequence.
let currentNote;        // What note is currently last scheduled?
let tempo;          // tempo (in beats per minute)
let lookahead = 25.0;       // How frequently to call scheduling function (ms)
let scheduleAheadTime = 0.1;    // How far ahead to schedule audio (sec)
                            // This is calculated from lookahead, and overlaps 
                            // with next interval (in case the timer is late)
let nextNoteTime = 0.0;     // when the next note is due.
let notesInQueue = [];      // the notes that have been put into the web audio,
                            // and may or may not have played yet. {note, time}
let timerWorker;     // The Web Worker used to fire timer messages
let meter = 4;
let masterVolume = 0.1;

function nextNote() {
    const secondsPerBeat = 60.0 / tempo;

    nextNoteTime += secondsPerBeat; 
    currentNote = (currentNote + 1) % meter;
}

function scheduleNote( beatNumber, time ) {
    // push the note on the queue, even if we're not playing.
    notesInQueue.push( { note: beatNumber, time: time } );
   
    if (beatNumber % meter === 0)    // beat 0 == high pitch -> A
        playPulse(880);
    else                        // other notes = low pitch -> E
        playPulse(659.2551); 
}

function playPulse(hz) {
    const pulseTime = 0.06;      // length of "beep" (in seconds)
    const osc = audioContext.createOscillator();
    osc.type = 'square';
    osc.frequency.value = hz;
    const amp = audioContext.createGain();
    amp.gain.setValueAtTime(0, audioContext.currentTime);
    amp.gain.linearRampToValueAtTime(masterVolume, audioContext.currentTime + .005);
    amp.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + pulseTime);

    osc.connect(amp).connect(audioContext.destination);
    osc.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + pulseTime);
}

function scheduler() {
    // while there are notes that will need to play before the next interval, 
    // schedule them and advance the pointer.
    while (nextNoteTime < audioContext.currentTime + scheduleAheadTime ) {
        scheduleNote( currentNote, nextNoteTime );
        nextNote();
    }
}

function togglePlay() {
    if (!unlocked) {
      // play silent buffer to unlock the audio
      let buffer = audioContext.createBuffer(1, 1, 22050);
      let node = audioContext.createBufferSource();
      node.buffer = buffer;
      node.start(0);
      unlocked = true;
    }

    isPlaying = !isPlaying;

    if (isPlaying) { // start playing
        currentNote = 0;
        nextNoteTime = audioContext.currentTime;
        timerWorker.postMessage("start");
    } else {
        timerWorker.postMessage("stop");
    }
}


function init(){
    tempo = document.getElementById('tempo').value;
    audioContext = new AudioContext();

    timerWorker = new Worker("js/metronomeworker.js");

    timerWorker.onmessage = function(e) {
        if (e.data == "tick") {
            scheduler();
        }
    };
    timerWorker.postMessage({"interval":lookahead});

    //UI stuff
    document.getElementById('tempo').addEventListener("change", event => {
        tempo = event.target.value; 
        document.getElementById('showTempo').innerText=tempo;
    });
    document.getElementById("play").addEventListener("click", event => {
        togglePlay();
        event.target.innerText = isPlaying ? "stop" : "play";
    });
    document.getElementById("timeSig").addEventListener("change", event => {
        meter = parseInt(event.target.value, 10);
    })
}

window.addEventListener("load", init );
