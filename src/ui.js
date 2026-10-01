import { roman } from './interior.js';

const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const coupleHTML = (s) => esc(s).replace(/&amp;|\+/, (m) => `<em>${m}</em>`);
const pad = (n) => String(n).padStart(2, '0');

export function createUI(config) {
  const $ = (s) => document.querySelector(s);
  const body = document.body;
  const isTouch = matchMedia('(pointer: coarse)').matches;

  document.title = `${config.title} · ${config.couple}`;
  $('.brand-mono').textContent = config.initials;
  $('.brand-name').textContent = config.title;
  $('.intro-since').textContent = config.since;
  $('.intro-title').innerHTML = coupleHTML(config.couple);
  $('.intro-tagline').textContent = config.tagline;
  if ($('.loader-title')) $('.loader-title').innerHTML = coupleHTML(config.couple);
  if ($('.loader-sub')) $('.loader-sub').textContent = config.tagline;
  $('.outro-eyebrow').textContent = config.outro?.eyebrow || '';
  $('.outro-title').textContent = config.outro?.title || '';
  $('.outro-text').textContent = config.outro?.text || '';
  $('.hint').textContent = isTouch
    ? 'Swipe vertically to move · swipe sideways to look · tap a photo or video'
    : 'Drag to look · W/S or ↑/↓ to walk · scroll also works';

  const loader = $('.loader');
  const bar = $('.loader-bar span');
  const enterBtn = $('.loader-enter');
  const intro = $('.intro');
  const cue = $('.scroll-cue');
  const chapter = $('.chapter');
  const outro = $('.outro');
  const progress = $('.progress span');
  const where = $('.where');
  const hint = $('.hint');
  const nav = $('.rooms-nav');
  const bfly = $('.bfly-hint');
  bfly.querySelector('span').textContent = isTouch ? 'Tap the butterfly' : 'Click the butterfly';

  // ── sound: nature sounds (always) + music (optional), one on/off switch ──
  let audio = null;
  let onSound = null;
  const soundBtn = $('.sound');
  let soundOn = true;
  try {
    soundOn = localStorage.getItem('gallery-sound') !== 'off';
  } catch {
    /* private mode: default to on */
  }
  if (config.music) {
    audio = new Audio(config.music);
    audio.loop = true;
    audio.volume = 0.5;
  }
  soundBtn.hidden = false;
  soundBtn.classList.toggle('is-off', !soundOn);
  soundBtn.addEventListener('click', () => {
    soundOn = !soundOn;
    try {
      localStorage.setItem('gallery-sound', soundOn ? 'on' : 'off');
    } catch {
      /* ignore */
    }
    soundBtn.classList.toggle('is-off', !soundOn);
    if (audio) (soundOn ? audio.play() : Promise.resolve(audio.pause())).catch?.(() => {});
    onSound?.(soundOn);
  });
  if ($('.loader-note')) $('.loader-note').textContent = isTouch ? 'Best with sound on · swipe to walk through' : 'Best with sound on · scroll or use W/S to walk';

  let onEnter = null;
  const enter = () => {
    loader?.classList.add('is-hidden');
    body.classList.remove('is-locked');
    if (audio && soundOn) audio.play().catch(() => {});
    onEnter?.();
  };
  enterBtn?.addEventListener('click', enter);

  // ── lightbox ──
  const lb = $('.lightbox');
  const lbImg = lb.querySelector('img');
  const lbVideo = lb.querySelector('video');
  // clicking the player's controls shouldn't close the lightbox
  lbVideo.addEventListener('click', (e) => e.stopPropagation());
  let onLightbox = null;
  const closeLightbox = () => {
    if (lb.hidden) return;
    lb.classList.remove('is-open');
    if (!lbVideo.hidden) {
      lbVideo.pause();
      lbVideo.removeAttribute('src');
      lbVideo.load();
    }
    setTimeout(() => (lb.hidden = true), 450);
    onLightbox?.(false);
  };
  lb.addEventListener('click', closeLightbox);
  addEventListener('keydown', (e) => e.key === 'Escape' && closeLightbox());

  // ── per-frame state (only touch the DOM when something changed) ──
  const last = {};
  const fade = (el, key, o, dy = 0) => {
    const v = `${o.toFixed(3)}|${dy.toFixed(1)}`;
    if (last[key] === v) return;
    last[key] = v;
    el.style.opacity = o;
    el.style.transform = `translate3d(0, ${dy}px, 0)`;
    el.style.visibility = o < 0.003 ? 'hidden' : 'visible';
  };
  let chapterIndex = -1;
  let navButtons = [];
  let navActive = -1;
  let hintShown = false;
  let rooms = [];

  return {
    setProgress(p) {
      if (bar) bar.style.transform = `scaleX(${Math.min(1, p)})`;
    },

    ready(cb) {
      onEnter = cb;
      loader?.classList.add('is-ready');
      enter();
    },

    buildNav(roomList, onGo) {
      rooms = roomList;
      const labels = ['Entrance', ...roomList.map((r) => r.title)];
      nav.innerHTML = labels
        .map((l, i) => `<button type="button" data-i="${i}"><span class="label">${esc(l)}</span><span class="dot"></span></button>`)
        .join('');
      navButtons = [...nav.querySelectorAll('button')];
      navButtons.forEach((b) => b.addEventListener('click', () => onGo(+b.dataset.i)));
      $('.brand').addEventListener('click', (e) => {
        e.preventDefault();
        onGo(0);
      });
      $('.outro-replay').addEventListener('click', () => onGo(0));
    },

    onSound(cb) {
      onSound = cb;
    },
    get soundOn() {
      return soundOn;
    },

    butterflyHint(o, x = 0, y = 0) {
      if (o <= 0) {
        if (last.bfly !== 0) {
          last.bfly = 0;
          bfly.style.opacity = 0;
          bfly.style.visibility = 'hidden';
        }
        return;
      }
      last.bfly = o;
      bfly.style.visibility = 'visible';
      bfly.style.opacity = o;
      bfly.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    },

    flashHint(text, ms = 4000) {
      hint.textContent = text;
      hint.classList.add('is-visible');
      setTimeout(() => hint.classList.remove('is-visible'), ms);
    },

    onLightbox(cb) {
      onLightbox = cb;
    },

    openLightbox({ src, video = false, startAt = 0, title, date, story }) {
      lbImg.hidden = video;
      lbVideo.hidden = !video;
      if (video) {
        // big and with sound, picking up where the wall copy was
        lbVideo.muted = false;
        lbVideo.src = src;
        lbVideo.addEventListener('loadedmetadata', () => (lbVideo.currentTime = startAt || 0), { once: true });
        lbVideo.play().catch(() => {
          lbVideo.muted = true; // if the browser blocks sound, still play
          lbVideo.play().catch(() => {});
        });
      } else {
        lbImg.src = src;
      }
      lb.querySelector('.lb-date').textContent = date || '';
      lb.querySelector('.lb-title').textContent = title || '';
      lb.querySelector('.lb-story').textContent = story || '';
      lb.hidden = false;
      requestAnimationFrame(() => lb.classList.add('is-open'));
      onLightbox?.(true);
    },

    update({ introO, chapter: ch, outroO, active, progress: p, inside, dark, garden }) {
      body.classList.toggle('is-garden', !!garden);
      fade(intro, 'intro', introO, (1 - introO) * -30);
      fade(cue, 'cue', introO);
      fade(outro, 'outro', outroO, (1 - outroO) * 24);
      if (ch.i !== chapterIndex && ch.o > 0.01) {
        chapterIndex = ch.i;
        const room = rooms[ch.i];
        chapter.querySelector('.chapter-num').textContent = room.eyebrow || `Room ${roman(ch.i + 1)}`;
        chapter.querySelector('.chapter-title').textContent = room.title;
        chapter.querySelector('.chapter-sub').textContent = room.subtitle || '';
      }
      fade(chapter, 'chapter', ch.o, (1 - ch.o) * 24);

      const pv = p.toFixed(4);
      if (last.progress !== pv) {
        last.progress = pv;
        progress.style.transform = `scaleX(${p})`;
      }
      if (active !== navActive) {
        navActive = active;
        navButtons.forEach((b, i) => b.classList.toggle('is-active', i === active));
        where.innerHTML = `<b>${pad(active + 1)}</b><i></i>${pad(navButtons.length)}<span>${esc(
          active === 0 ? 'Entrance' : rooms[active - 1].title,
        )}</span>`;
        if (active === 1 && !hintShown) {
          hintShown = true;
          setTimeout(() => {
            hint.classList.add('is-visible');
            setTimeout(() => hint.classList.remove('is-visible'), 5000);
          }, 2600);
        }
      }
      body.classList.toggle('is-inside', inside > 0.5);
      body.classList.toggle('is-dark', inside > 0.5 && dark);
    },
  };
}
