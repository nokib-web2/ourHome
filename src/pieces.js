// Music for the rooms: world-famous romantic pieces, all long out of copyright,
// written out note by note and played on the little piano in soundSynth.js.
//
// Each piece is { title, bpm, length (beats), events: [beat, midi, beats, velocity] }.
// In config.js a room picks one with  music: 'canon'  (or plays your own file:
// music: 'music/our-song.mp3', or nothing: music: 'none').

// the sampled piano: a note every `step` semitones from `base` to `top`
export const PIANO = { base: 36, step: 3, top: 96 };

const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function midi(name) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  return 12 * (Number(m[3]) + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
const notes = (s) => s.trim().split(/\s+/);

function score() {
  const events = [];
  return {
    events,
    // play one note, or several at once ('C4 E4 G4')
    at(t, names, beats, vel) {
      for (const n of notes(names)) events.push([t, midi(n), beats, vel]);
    },
    // a rolled chord, bottom to top, the way a pianist spreads a big chord
    roll(t, names, beats, vel, gap = 0.06) {
      notes(names).forEach((n, i) => events.push([t + i * gap, midi(n), beats - i * gap, vel]));
    },
  };
}

// J. S. Bach, Prelude in C major (BWV 846): the same five-note figure, bar after bar
function prelude() {
  const bars = [
    'C4 E4 G4 C5 E5', 'C4 D4 A4 D5 F5', 'B3 D4 G4 D5 F5', 'C4 E4 G4 C5 E5',
    'C4 E4 A4 E5 A5', 'C4 D4 F#4 A4 D5', 'B3 D4 G4 D5 G5', 'B3 C4 E4 G4 C5',
    'A3 C4 E4 G4 C5', 'D3 A3 D4 F#4 C5', 'G3 B3 D4 G4 B4', 'G3 Bb3 E4 G4 C#5',
    'F3 A3 D4 A4 D5', 'F3 Ab3 D4 F4 B4', 'E3 G3 C4 G4 C5', 'E3 F3 A3 C4 F4',
    'D3 F3 A3 C4 F4', 'G2 D3 G3 B3 F4', 'C3 E3 G3 C4 E4',
  ];
  const s = score();
  let t = 0;
  for (const bar of bars) {
    const [a, b, c, d, e] = notes(bar);
    for (let h = t; h < t + 4; h += 2) {
      // the pedal lets every note ring to the end of the half bar
      s.at(h, a, 2.1, 0.42);
      s.at(h + 0.25, b, 1.85, 0.36);
      [c, d, e, c, d, e].forEach((n, i) => s.at(h + 0.5 + i * 0.25, n, 1.6 - i * 0.25, i % 3 === 2 ? 0.4 : 0.33));
    }
    t += 4;
  }
  s.roll(t, 'C2 C3 G3 C4 E4 G4 C5', 6, 0.38, 0.12);
  return { title: 'Prelude in C, J. S. Bach', bpm: 64, length: t + 8, events: s.events };
}

// Beethoven, Für Elise (in sixteenths)
function elise() {
  const s = score();
  let t = 0;
  const rh = (list, from = 0, vel = 0.46) => notes(list).forEach((n, i) => s.at(t + from + i, n, 1.5, vel));
  const lh = (list) => notes(list).forEach((n, i) => s.at(t + i, n, 6 - i, 0.28));
  const bar = (fn) => {
    fn();
    t += 6;
  };
  const turn = () => bar(() => rh('E5 D#5 E5 B4 D5 C5'));
  const theme = (ending) => {
    turn();
    bar(() => (lh('A2 E3 A3'), s.at(t, 'A4', 3, 0.46), rh('C4 E4 A4', 3)));
    bar(() => (lh('E2 E3 G#3'), s.at(t, 'B4', 3, 0.46), rh('E4 G#4 B4', 3)));
    bar(() => (lh('A2 E3 A3'), s.at(t, 'C5', 3, 0.48), rh('E4 E5 D#5', 3)));
    turn();
    bar(() => (lh('A2 E3 A3'), s.at(t, 'A4', 3, 0.46), rh('C4 E4 A4', 3)));
    bar(() => (lh('E2 E3 G#3'), s.at(t, 'B4', 3, 0.46), rh('E4 C5 B4', 3)));
    bar(() => (lh('A2 E3 A3'), s.at(t, 'A4', ending === 'end' ? 6 : 3, 0.44), ending && ending !== 'end' && rh(ending, 6 - notes(ending).length)));
  };
  rh('E5 D#5', 0);
  t += 2;
  theme('E5 D#5');
  theme('B4 C5 D5');
  // the brighter middle phrase
  bar(() => (lh('C3 G3 C4'), s.at(t, 'E5', 3, 0.5), rh('G4 F5 E5', 3)));
  bar(() => (lh('G2 G3 B3'), s.at(t, 'D5', 3, 0.48), rh('F4 E5 D5', 3)));
  bar(() => (lh('A2 E3 A3'), s.at(t, 'C5', 3, 0.46), rh('E4 D5 C5', 3)));
  bar(() => (lh('E2 E3 G#3'), s.at(t, 'B4', 3, 0.44), rh('E4 E5 D#5', 3)));
  theme('end');
  return { title: 'Für Elise, Ludwig van Beethoven', bpm: 370, length: t + 10, events: s.events };
}

// Greensleeves (in eighths, 6/8): the old English love song
function greensleeves() {
  const verse = [
    ['C5', 2, 'D5', 1, 'E5', 1.5, 'F5', 0.5, 'E5', 1],
    ['D5', 2, 'B4', 1, 'G4', 1.5, 'A4', 0.5, 'B4', 1],
    ['C5', 2, 'A4', 1, 'A4', 1.5, 'G#4', 0.5, 'A4', 1],
    ['B4', 2, 'G#4', 1, 'E4', 2, 'A4', 1],
    ['C5', 2, 'D5', 1, 'E5', 1.5, 'F5', 0.5, 'E5', 1],
    ['D5', 2, 'B4', 1, 'G4', 1.5, 'A4', 0.5, 'B4', 1],
    ['C5', 1.5, 'B4', 0.5, 'A4', 1, 'G#4', 1.5, 'F#4', 0.5, 'G#4', 1],
    ['A4', 6],
    ['G5', 3, 'G5', 1.5, 'F#5', 0.5, 'E5', 1],
    ['D5', 2, 'B4', 1, 'G4', 1.5, 'A4', 0.5, 'B4', 1],
    ['C5', 2, 'A4', 1, 'A4', 1.5, 'G#4', 0.5, 'A4', 1],
    ['B4', 2, 'G#4', 1, 'E4', 3],
    ['G5', 3, 'G5', 1.5, 'F#5', 0.5, 'E5', 1],
    ['D5', 2, 'B4', 1, 'G4', 1.5, 'A4', 0.5, 'B4', 1],
    ['C5', 1.5, 'B4', 0.5, 'A4', 1, 'G#4', 1.5, 'F#4', 0.5, 'G#4', 1],
    ['A4', 5],
  ];
  // two chords a bar, played as a harp-like broken chord
  const chords = 'Am Am G G Am Am E E Am Am G G Am E Am Am C C G G Am Am E E C C G G Am E Am Am';
  const shape = { Am: 'A2 E3 C4', G: 'G2 D3 B3', E: 'E2 B2 G#3', C: 'C3 G3 E4' };
  const s = score();
  s.at(0, 'A4', 1.2, 0.44); // pick-up
  let t = 1;
  verse.forEach((bar, b) => {
    let x = t;
    for (let i = 0; i < bar.length; i += 2) {
      s.at(x, bar[i], bar[i + 1] * 1.1, 0.46);
      x += bar[i + 1];
    }
    for (let h = 0; h < 2; h++) {
      const chord = notes(chords)[b * 2 + h];
      notes(shape[chord]).forEach((n, i) => s.at(t + h * 3 + i, n, 3.4 - i, 0.26));
    }
    t += 6;
  });
  // the last bar is a beat short, so the pick-up of the next time round falls in time
  return { title: 'Greensleeves, traditional', bpm: 150, length: t - 1, events: s.events };
}

// Erik Satie, Gymnopédie No. 1 (in quarter notes, 3/4, slow and tender)
function gymnopedie() {
  const s = score();
  const melody = {
    4: [[1, 'F#5', 1], [2, 'A5', 1]],
    5: [[0, 'G5', 1], [1, 'F#5', 1], [2, 'C#5', 1]],
    6: [[0, 'B4', 1], [1, 'C#5', 1], [2, 'D5', 1]],
    7: [[0, 'A4', 3]],
    8: [[0, 'F#4', 11]],
    12: [[1, 'F#5', 1], [2, 'A5', 1]],
    13: [[0, 'G5', 1], [1, 'F#5', 1], [2, 'C#5', 1]],
    14: [[0, 'B4', 1], [1, 'C#5', 1], [2, 'D5', 1]],
    15: [[0, 'A4', 3]],
    16: [[0, 'C#5', 3]],
    17: [[0, 'F#5', 3]],
    18: [[0, 'E5', 6]],
  };
  for (let bar = 0; bar < 20; bar++) {
    const t = bar * 3;
    const g = bar % 2 === 0;
    s.at(t, g ? 'G2' : 'D2', 3.2, 0.32);
    s.at(t + 1, g ? 'B3 D4 F#4' : 'A3 C#4 F#4', 2.2, 0.2);
    for (const [b, n, d] of melody[bar] || []) s.at(t + b, n, d * 1.05, 0.4);
  }
  return { title: 'Gymnopédie No. 1, Erik Satie', bpm: 68, length: 60, events: s.events };
}

// Johann Pachelbel, Canon in D: the eight-chord ground with the melodies
// everyone knows growing over it (one beat per chord)
function canon() {
  const ground = [
    ['D3', 4], ['A2', 4], ['B2', 3], ['F#2', 3], ['G2', 4], ['D2', 4], ['G2', 4], ['A2', 4],
  ]; // bass note + the kind of third above it (4 = major, 3 = minor)
  const lines = [
    null,
    'F#5 E5 D5 C#5 B4 A4 B4 C#5',
    'D5 C#5 B4 A4 G4 F#4 G4 E4',
    'D5 F#5 A5 G5 F#5 D5 F#5 E5 D5 B4 D5 A5 G5 B5 A5 G5',
    'D5 C#5 D5 D4 C#4 A4 E4 F#4 D4 D5 C#5 B4 C#5 F#5 A5 B5 G5 F#5 E5 G5 F#5 E5 D5 C#5 B4 A4 G4 F#4 E4 G4 F#4 E4',
    ['F#5 E5 D5 C#5 B4 A4 B4 C#5', 'D5 C#5 B4 A4 G4 F#4 G4 E4'],
    'F#6 E6 D6 C#6 B5 A5 B5 C#6',
  ];
  const s = score();
  let t = 0;
  for (const line of lines) {
    // left hand: the bass, then a broken chord rising from it
    ground.forEach(([bass, third], k) => {
      const b = midi(bass);
      [b, b + 7, b + 12, b + 12 + third].forEach((m, i) => s.events.push([t + k + i * 0.25, m, 1.1 - i * 0.25 + 0.2, i ? 0.24 : 0.3]));
    });
    for (const l of line ? [].concat(line) : []) {
      const ns = notes(l);
      const step = 8 / ns.length;
      const vel = ns.length > 16 ? 0.36 : ns.length > 8 ? 0.4 : 0.45;
      ns.forEach((n, i) => s.at(t + i * step, n, step * 1.15, vel));
    }
    t += 8;
  }
  s.roll(t, 'D2 A2 D3 F#3 A3 D4 F#4 A4 D5', 5, 0.36, 0.1);
  return { title: 'Canon in D, Johann Pachelbel', bpm: 56, length: t + 6, events: s.events };
}

const inOrder = (piece) => (piece.events.sort((a, b) => a[0] - b[0]), piece);
export const PIECES = {
  prelude: inOrder(prelude()),
  elise: inOrder(elise()),
  greensleeves: inOrder(greensleeves()),
  gymnopedie: inOrder(gymnopedie()),
  canon: inOrder(canon()),
};
// what plays in each room when config.js doesn't say (rooms after the fifth cycle round)
export const ROOM_MUSIC = ['prelude', 'elise', 'greensleeves', 'gymnopedie', 'canon'];
