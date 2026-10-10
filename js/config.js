/* ═══════════════════════════════════════════════════════════════════════
   config.js — everything you might want to personalise lives here.
   ═══════════════════════════════════════════════════════════════════════ */
window.GIFT = {

  /* Who the gift is for. Used on the box and the letter heading. */
  recipient: 'Amna',

  /* Appears in the signature box at the bottom of the letter. */
  from: 'Your Friend',

  /* Summary line for the "Copy this link" button and the share text. */
  shareText: 'A little garden of flowers, made for Amna 🌹',

  /* ── Photos ──────────────────────────────────────────────────────────
     By default the polaroids are filled with hand-drawn artwork.
     To use real photos, drop 6 images into assets/photos named
     1.jpg, 2.jpg … 6.jpg (any of .jpg/.jpeg/.png/.webp) and set:

         photoDir: 'assets/photos',

     Nothing else needs to change.                                */
  photoDir: null,

  /* Captions under each polaroid, in order (up to 6). */
  captions: [
    'my favourite human',
    'that day we laughed till we cried',
    'golden hour',
    'endless conversations',
    'always in my corner',
    'to many more'
  ],

  /* ── Animation ───────────────────────────────────────────────────────
     How long the flower tunnel flies for, in milliseconds. */
  tunnelDuration: 9000,

  /* Play the gentle music-box soundtrack (starts when the gift is opened). */
  music: true,

  /* Set true to skip the tunnel entirely and go straight to the letter. */
  skipTunnel: false
};
