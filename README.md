# The Gallery of Us

A scroll-driven 3D walk through a little art gallery of your memories.
You start outside the house at night, between trees strung with fairy lights,
scroll, the doors swing open, and you walk room by room past your photos and
videos hanging on the walls. Through the glass doors of the last room you step
out into a flower garden, circle the fountain (scroll, or drag to look around
yourself) and end at a flower arch with your favourite photo.

In the garden, time passes: it's day when you walk out, then the sun sets, night
falls, the moon rises, fireflies come out and the trees light up, and later morning
comes round again.

After the last room comes a library, its four walls lined with your own books,
a shelf of each, set out the way a real library is dressed (runs of spines, a
copy standing face-out, a stack, a vase, a little framed photo of yours) and lit
warmly from behind. The walk takes you up close to the shelves, near enough to
read the spines. Take any copy down and it comes into your hands, opens, and the
words write themselves onto each page as you turn to it (with the sound of the
paper); put it back when you're done. Then its glass doors open onto the garden.

Behind the flower arch a garden gate swings open onto a boardwalk over the dunes,
down to the sea at golden hour. On the beach a boy draws a big heart in the sand
with a stick, kneels and writes your names inside it (you watch up close), then
stands and waves as the camera rises into a drone's-eye view of the heart, the
footprints and the waves washing in. It all follows your scroll: stop and he
waits, scroll back and the sand smooths over again. Set the words with
`beach.text` in `src/config.js`.

Sound, all made in the browser with no audio files (the Sound button top-right turns it off):
- **Each room has its own music**, a world-famous romantic piece on a soft piano:
  Bach's Prelude in C, Beethoven's Für Elise, Greensleeves, Satie's Gymnopédie No. 1
  and Pachelbel's Canon in D. The music crossfades as you walk through the curtains,
  and no outdoor sound reaches the rooms.
- **Outside**: crickets, a faint breeze and now and then an owl at the front door; in
  the garden, birdsong by day (robins, blackbirds, tits, finches, a distant wood pigeon),
  crickets and the owl at night, and the fountain. It's a real 3D sound source, so it
  gets louder as you walk up to it and moves between your ears as you circle it.
- **By the sea**: waves breaking and washing up the sand, and gulls over the water.

Built with [three.js](https://threejs.org) (3D), [Lenis](https://lenis.darkroom.engineering)
(smooth scrolling) and [Vite](https://vitejs.dev) (dev server & build).

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

## Make it yours

1. **Add your photos** to `public/photos/`. Any image format works: JPG, PNG, WEBP,
   AVIF, GIF (animated GIFs move on the wall), BMP, SVG, TIFF and iPhone HEIC/HEIF.
   The format is detected from the file itself, so the extension doesn't matter, and big
   phone photos are fine (they're resized automatically).
   **Videos** go in `public/videos/` (`.mp4` or `.webm`) and are used exactly like photos,
   e.g. `{ src: 'videos/our-day.mp4', caption: 'Our day' }`. They play silently on a loop
   while you're in their room; click one to watch it big with sound. Short clips around
   720p keep the site fast.
2. **Edit `src/config.js`**: your names, initials, the text on the building,
   the rooms, and which photo hangs where. Every option is explained at the top of the file.
   - Each room has a `left`, `right` and `back` wall.
   - Side walls hold 1–3 items; the back wall holds 1–2 (either side of the doorway).
   - `garden.photo` is the photo on the easel under the flower arch at the very end
     (`photos/garden.jpg` by default). Delete the `garden` block to end the tour in the last room.
   - Add a `story` to a photo and it appears when someone clicks it.
   - Add or remove rooms freely; the building grows to fit.
3. **Your books**: write them in `library.books` in `src/config.js`: a title, a leather
   colour, and the text (as long as you like; it flows onto as many pages as it needs).
4. **Music**: each room's `music` picks its piece (`'prelude'`, `'elise'`, `'greensleeves'`,
   `'gymnopedie'`, `'canon'`), or your own song: drop an mp3 in `public/music/` and set
   `music: 'music/your-song.mp3'` on that room (`'none'` for silence). Set the top-level
   `music` instead to play one song through the whole visit.

Any photo that can't be found shows a placeholder painting with the filename it
expects, so you can see at a glance what's still missing.

## Publish it

```bash
npm run build
```

This creates a `dist/` folder, a fully static site. Upload that folder to any
static host: Netlify Drop (drag & drop), Vercel, GitHub Pages, Cloudflare Pages.

## How it works

| File | What it does |
| --- | --- |
| `src/config.js` | All your content: names, rooms, photos, captions |
| `src/exterior.js` | The house front, portico, doors, garden, lamps & night sky |
| `src/interior.js` | Rooms, arches, frames, picture lights, sculptures, floating dust |
| `src/library.js` | The library: shelves of your books, and the book in your hands that writes itself as you read |
| `src/garden.js` | The back of the house, glass doors, the flower garden, fireflies & the day/night cycle |
| `src/fountain.js` | The two-tier fountain: falling water, droplets, ripples and foam |
| `src/beach.js` | The dunes, the sea and its waves, the heart & words in the sand, and the boy's story |
| `src/boy.js` | The boy on the beach: one skinned body on a skeleton, arms and legs placed with IK |
| `src/sandFont.js` | The hand-drawn letters he writes in the sand |
| `src/nature.js` | Flowers (roses, tulips, daisies, lavender), grass, shrubs & trees (with fairy lights) |
| `src/butterflies.js` | The butterflies, and the one on the rose that flies off when you click it |
| `src/ambience.js` | Plays the sounds in 3D and the music in each room |
| `src/soundSynth.js` | Renders every sound (water, wind, crickets, birds, owl, piano) in a background worker |
| `src/pieces.js` | The music, written out note by note |
| `src/tour.js` | The camera route: scroll position → camera position & direction |
| `src/portal.js` | From inside the house, draws only the part of the garden you can see through the glass doors |
| `src/textures.js` | Every texture (stone, wood, plaster, text, placeholders) drawn in code |
| `src/ui.js` | Loader, titles, room chapters, navigation dots, photo lightbox |
| `src/main.js` | Renderer, lighting, bloom, scroll & the per-frame loop |

## Credits

Trees (and the bark & leaf photos used for trees, shrubs and hedges) come from
[ez-tree](https://github.com/dgreenheck/ez-tree) by Daniel Greenheck, MIT licensed.
A trimmed copy lives in `src/vendor/ez-tree` together with its `LICENSE`.

The music is by Bach, Beethoven, Satie and Pachelbel, plus the traditional
Greensleeves, all long in the public domain. It's written out as notes and played
on a piano synthesised in the browser.

The camera route adapts to the screen: on wide screens it takes in a whole wall at
once, and on phones it strolls past each photo one by one. If a device's GPU struggles,
the site quietly lowers its quality to keep scrolling smooth.
