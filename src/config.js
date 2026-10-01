// ─────────────────────────────────────────────────────────────────────────────
//  THE GALLERY OF US: edit this file to make the gallery yours ♥
//
//  • Put your photos in  /public/photos  and reference them as 'photos/name.jpg'
//    Any image format works: jpg, png, webp, avif, gif (animated ones move),
//    bmp, svg, tiff and iPhone heic/heif
//  • Videos work the same way: put them in /public/videos and use 'videos/name.mp4'
//    (.mp4 or .webm). On the wall they play silently on a loop while you're in
//    that room; click one to watch it big, with sound. Keep them short and
//    around 720p so the site stays fast.
//  • Any missing photo or video shows a placeholder that tells you which filename it wants
//  • Each room has three walls: left, right and back (back = the wall you face
//    when you walk in). Side walls fit 1–3 items, the back wall fits 1–2
//    (either side of the doorway)
//  • After the last room you step out into the garden (see `garden` at the bottom)
//  • Item options:
//      src      path to the image or video
//      caption  title painted under the frame
//      date     small line under the caption
//      story    longer text shown when someone clicks the photo
//      size     'small' | 'medium' (default) | 'large'
//      frame    override the room's frame: 'gold' | 'black' | 'white' | 'walnut'
//    or a text panel instead of a photo:  { type: 'text', title, text }
//  • Room options: title, subtitle, wall (paint colour), frame (default frame),
//    music (what plays softly while you're in that room):
//      'prelude'       Bach: Prelude in C
//      'elise'         Beethoven: Für Elise
//      'greensleeves'  Greensleeves
//      'gymnopedie'    Satie: Gymnopédie No. 1
//      'canon'         Pachelbel: Canon in D
//    or your own song: 'music/our-song.mp3' (put the file in /public/music),
//    or 'none' for silence
// ─────────────────────────────────────────────────────────────────────────────

export default {
  title: 'The Gallery of Us',
  couple: 'You & Me', // e.g. 'Rayhan & Maya'
  initials: 'Y & M', // shown in the monogram on the building
  since: 'Est. 2019',
  tagline: 'A little gallery of our favourite memories',
  facadeText: 'THE GALLERY OF US', // carved above the columns

  // Optional: one song for the whole visit instead of each room's own music.
  // Put an mp3 in /public/music and set e.g. 'music/our-song.mp3'
  music: '',

  outro: {
    eyebrow: 'The end, for now',
    title: 'To be continued…',
    text: 'Every day with you adds another frame to these walls.',
  },

  rooms: [
    {
      title: 'Welcome',
      subtitle: 'Come in, look around, stay a while.',
      wall: '#efe6da',
      frame: 'gold',
      music: 'prelude',
      left: [
        {
          src: 'photos/photo_21.jpg',
          caption: 'The two of us',
          date: 'Always',
          size: 'large',
          story: 'Our favourite picture of us, so it gets the best wall in the house.',
        },
      ],
      right: [
        {
          type: 'text',
          title: 'Our story',
          text: 'Every picture on these walls is a moment we decided to keep. Walk slowly. Each room holds a different chapter of us.',
        },
      ],
      back: [
        { src: 'photos/photo_02.jpg', caption: 'Home', date: 'Wherever you are' },
        { src: 'photos/photo_24.jpg', caption: 'Our favourite place', date: '' },
      ],
    },
    {
      title: 'How We Met',
      subtitle: 'The day everything quietly changed.',
      wall: '#ecd7cd',
      frame: 'gold',
      music: 'elise',
      left: [
        { src: 'photos/photo_04.jpg', caption: 'The first hello', date: '' },
        { src: 'photos/photo_05.jpg', caption: 'Special moments', date: '' },
      ],
      right: [
        { src: 'photos/photo_06.jpg', caption: 'First smile', date: '' },
        { src: 'photos/photo_07.jpg', caption: 'Unforgettable', date: '' },
      ],
      back: [
        { src: 'photos/photo_08.jpg', caption: 'Together', date: '' },
        { src: 'photos/photo_09.jpg', caption: 'Pure happiness', date: '' },
      ],
    },
    {
      title: 'Adventures',
      subtitle: 'All the places we got lost together.',
      wall: '#d9ddcc',
      frame: 'walnut',
      music: 'greensleeves',
      left: [
        { src: 'photos/photo_10.jpg', caption: 'Exploring together', date: '' },
        { src: 'photos/photo_11.jpg', caption: 'Every new path', date: '' },
      ],
      right: [
        { src: 'photos/photo_12.jpg', caption: 'Beautiful days', date: '' },
        { src: 'photos/photo_13.jpg', caption: 'Wanderlust', date: '' },
      ],
      back: [
        { src: 'photos/photo_14.jpg', caption: 'Golden hours', date: '' },
        { src: 'photos/photo_15.jpg', caption: 'New memories', date: '' },
      ],
    },
    {
      title: 'Little Moments',
      subtitle: 'The ordinary days we love the most.',
      wall: '#d7dee5',
      frame: 'white',
      music: 'gymnopedie',
      left: [
        { src: 'photos/photo_16.jpg', caption: 'Quiet mornings', date: '' },
        { src: 'photos/photo_17.jpg', caption: 'Laughter', date: '' },
      ],
      right: [
        { src: 'photos/photo_18.jpg', caption: 'Sweet days', date: '' },
        { src: 'photos/photo_19.jpg', caption: 'Simple joys', date: '' },
      ],
      back: [
        { src: 'photos/photo_20.jpg', caption: 'Warmth', date: '' },
      ],
    },
    {
      title: 'Forever',
      subtitle: 'Where the story keeps going.',
      wall: '#5e2c33',
      frame: 'gold',
      music: 'canon',
      left: [{ src: 'photos/photo_01.jpg', caption: 'Promise', date: '' }],
      right: [{ src: 'photos/photo_22.jpg', caption: 'Always', date: '' }],
      back: [
        { src: 'photos/photo_23.jpg', caption: 'Our journey', date: '' },
      ],
    },
  ],

  // After the last room: a library, its four walls lined with your books. Each
  // shelf is filled with copies of one of them; take any copy down, open it and
  // read (the words write themselves onto the page as you turn to it).
  // `text` is the whole book: it flows onto as many pages as it needs, and a
  // blank line starts a new paragraph. `color` is the leather of the binding.
  // Six books is lovely; any number works. Remove this block for no library.
  library: {
    title: 'The Library',
    subtitle: 'Every chapter of us, bound in paper.',
    wall: '#3d2c23',
    music: 'none',
    books: [
      {
        title: 'How It Began',
        color: '#7a2e35',
        text: `I still remember the exact moment. Not the date, not the weather, but the moment: the way you laughed at something that wasn't even that funny, and how the whole room seemed to lean toward the sound.

I didn't know then that I was standing at the beginning of everything. You never do. The biggest stories start quietly, in ordinary places, on days that don't know they're going to matter.

We talked for hours that felt like minutes. I walked home the long way, just to keep the evening going a little longer, and I caught myself smiling at nothing at all.

Somewhere on that walk I knew. Not everything, not yet, but enough: that I wanted to hear that laugh again. And again. For as long as you'd let me.

(Write your own story here, in config.js. This is your book.)`,
      },
      {
        title: 'Letters to You',
        color: '#2e4a3a',
        text: `My love,

There are things I say to you every day, and things I only ever say to you in my head, on the drive home or in the quiet before sleep. This book is for those.

Thank you for the ordinary mornings. For coffee made the way I like it without asking. For the way you reach for my hand in a crowd, as if it's the most natural thing in the world, because it is.

Thank you for staying on the hard days, the ones when I wasn't easy to love. You loved me anyway, and that taught me more than any poem ever could.

If I could give you one thing, it would be the chance to see yourself through my eyes, just once. You would never doubt yourself again.

Always yours.`,
      },
      {
        title: 'Everything I Love About You',
        color: '#1f2d4a',
        text: `The way you say my name when you're half asleep.

How you hum when you cook, always the same three songs, never quite in tune.

Your hands, and how they always know where to find mine.

The way you get quiet when something moves you, and how I can always tell.

How you are kind to strangers, to waiters, to dogs in the street, to me.

Your laugh, especially the one you try to hide.

The little line between your eyebrows when you're thinking.

That you still look at me like the first time.

That every list I try to write about you runs out of pages long before I run out of reasons.`,
      },
      {
        title: 'Our Promises',
        color: '#6b4526',
        text: `I promise to keep choosing you, on the easy days and on the hard ones, over and over, for as long as we both shall live.

I promise to listen, even when I think I already know what you're going to say.

I promise to make you laugh when the world is heavy, and to hold you when laughing isn't enough.

I promise to grow with you, and never to grow away from you.

I promise to keep a little of our first year alive in every year that follows: the curiosity, the wonder, the late-night talks.

And I promise that whatever comes, you will never have to face it alone.`,
      },
      {
        title: 'Our Adventures',
        color: '#80572f',
        text: `We have a habit, you and I, of getting a little bit lost.

The wrong train that turned into the best day of the trip. The shortcut that added an hour and gave us that sunset. The café we only found because it was raining and we ran for the nearest door.

I used to think adventures needed plane tickets. Now I know they only need you beside me and a map we're not really following.

Here's to every road we haven't taken yet, and to taking them all together.`,
      },
      {
        title: 'Chapters Still Unwritten',
        color: '#c9b48a',
        text: `This book is mostly empty, and that is the most beautiful thing about it.

These pages are for the places we haven't seen yet, the home we haven't built yet, the mornings we haven't woken up to yet.

For the adventures that will go wrong in the best way. For the quiet Sundays. For the years that will turn our hair grey and our hearts even softer.

We don't know what the next chapter holds. We only know who will be in it.

To be continued, every single day.`,
      },
    ],
  },

  // Through the last door: a flower garden at sunrise that you walk around.
  // Remove this whole block if you want the tour to end in the last room.
  garden: {
    title: 'Our Garden',
    subtitle: 'Where the story keeps growing.',
    photo: {
      src: 'photos/photo_03.jpg',
      caption: 'Us, always',
      date: 'Today & every day after',
      story: 'The best is yet to come.',
    },
  },

  // Out through the gate at the bottom of the garden: a beach at golden hour,
  // where a boy draws a heart in the sand and writes `text` inside it.
  // Letters, numbers, & and + work (e.g. 'Rayhan + Maya'); long names are drawn smaller.
  // Remove this block to end the tour in the garden.
  beach: {
    title: 'By the Sea',
    subtitle: 'Some things are worth writing down.',
    text: 'Me & You',
  },
};
