# For you, Amna 🌹

An interactive digital gift: a gift box that opens into a dense, spinning flower
tunnel, which finally opens out into a friendship letter with a polaroid album
and a signature box.

Live at **https://bood68155-tech.github.io/Amna-/**

---

## The flow

1. **The gift** — a glass card reading *For you, Amna* around a wrapped box.
   Tapping it shakes the box, lifts the lid, fires a beam of light and flies the
   card at the camera.
2. **The flower tunnel** — a nine-second flight through three concentric helical
   shells carrying ~720 blossoms. The camera rolls faster and faster, the shells
   expand outward, and the light at the end of the tunnel blows out into a warm
   white bloom. *Amna* blooms softly in the middle of the flight.
3. **The letter** — the tunnel dissolves into a warmly lit letter: a heartfelt
   note, a polaroid album of six memories, and a signature box. Buttons replay
   the garden or copy the link.

There is also a gentle music-box soundtrack (a I–vi–IV–V pad with a drifting
melody), synthesised live with the Web Audio API. It starts when the box is
opened and can be muted from the button in the top-right.

---

## How it is built

Plain HTML, CSS and JavaScript — no build step, no framework, no dependencies,
no image files. Everything you see is generated at runtime:

| File | What it does |
| --- | --- |
| `index.html` | The three screens and the letter copy |
| `css/style.css` | All styling, the gift-box animation and the screen transitions |
| `js/config.js` | **Personalisation** — name, signature, captions, timings |
| `js/flowers.js` | Procedural flower garden: 18 flowers described as layered SVG petals, rasterised into canvas sprites (a crisp one and a pre-blurred one per flower, for depth of field) |
| `js/photos.js` | Builds the polaroid artwork, or loads your real photos |
| `js/audio.js` | The synthesised music box |
| `js/tunnel.js` | The tunnel engine: projection, depth sorting, the petal field |
| `js/app.js` | The flow between the three screens |

### Why the flowers are drawn, not photographed

Every blossom is a small SVG — layered petals with radial gradients, each layer
rotated around the centre — which is rasterised once into an offscreen canvas
and then stamped hundreds of times a frame. That keeps the whole gift to a few
tens of kilobytes, means it works offline, and lets the tunnel carry 600+ blooms
per frame at 60fps without a single network request.

The camera's forward travel and roll are **precomputed integrals over the
timeline**, not accumulated per frame, so the animation always lands on its
finale on schedule no matter how slow the visitor's machine is.

---

## Make it yours

Almost everything you would want to change lives in **`js/config.js`**:

```js
window.GIFT = {
  recipient: 'Amna',            // the name on the box and the letter
  from: 'Your Friend',          // the signature
  captions: [ ... ],            // the caption under each polaroid
  tunnelDuration: 9000,         // how long the flower flight lasts (ms)
  music: true,                  // the soundtrack
  skipTunnel: false,            // jump straight to the letter
  photoDir: null                // see below
};
```

### Adding real photos

The polaroids currently show generated artwork. To use real photographs:

1. Drop six images into `assets/photos/`, named `1.jpg` … `6.jpg`
   (`.jpeg`, `.png` and `.webp` work too — it tries each in turn).
2. In `js/config.js`, set `photoDir: 'assets/photos'`.

That is the whole change. Any name that is missing falls back to the generated
artwork automatically, so you can start with one photo and add the rest later.

### Rewriting the letter

The note lives directly in `index.html`, inside `<div class="letter__body">`.
Edit the paragraphs there.

---

## Running it locally

Any static file server works:

```bash
python -m http.server 8765
# then open http://127.0.0.1:8765/
```

Opening `index.html` directly from disk also works, except that the
*Copy this link* button falls back to a legacy copy path because the
clipboard API needs a secure context.

---

## Deployment

The site is served by **GitHub Pages** straight from the `main` branch, at the
repository root. There is no build step — push to `main` and Pages republishes.

To redeploy after a change:

```bash
git add -A
git commit -m "Update the gift"
git push
```
