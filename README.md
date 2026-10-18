# Dice

A minimalist, realistic, 3D dice rolling website.

One dice. Pure black screen. Nothing else: no text, no buttons, no menus, no sound.
Tap (or click) the dice and it tumbles, then lands showing exactly one number.

Live site: `https://mdimrankhanalpha.github.io/Dice/`

---

## Table of contents

1. [What you see](#1-what-you-see)
2. [Files](#2-files)
3. [How to use it](#3-how-to-use-it)
4. [Randomness (the most important part)](#4-randomness-the-most-important-part)
5. [How a roll works, step by step](#5-how-a-roll-works-step-by-step)
6. [The dice itself](#6-the-dice-itself)
7. [Rendering and energy efficiency](#7-rendering-and-energy-efficiency)
8. [Responsive behavior](#8-responsive-behavior)
9. [Privacy and honesty](#9-privacy-and-honesty)
10. [Deploying on GitHub Pages](#10-deploying-on-github-pages)
11. [Customizing](#11-customizing)
12. [How it was tested](#12-how-it-was-tested)
13. [Browser support and limitations](#13-browser-support-and-limitations)
14. [FAQ](#14-faq)

---

## 1. What you see

- A completely black (`#000000`) screen, edge to edge.
- One ivory-colored, solid-looking dice in the exact center, with softly rounded edges and recessed (carved-in) dark pips.
- The camera looks straight down at the dice, so when it stops, **only the top face is visible. One dice, one number, no confusion.**
- No floor, no table, no shadow, no particles, no gradients, no UI.

While rolling you will briefly see other faces as the dice tumbles. When it stops, only the number on top is shown.

## 2. Files

| File | Purpose |
| --- | --- |
| `index.html` | A single `<canvas>` and the script tag. No visible text. |
| `style.css` | Black background, centering, no scrolling, no zoom, safe-area padding. |
| `script.js` | Secure random generator, quaternion math, WebGL shader, animation, input. |
| `README.md` | This document. GitHub shows it on the repo page; the website itself never displays it. |

Total code size is about 12 KB. There are no libraries, fonts, images, videos or external requests.

## 3. How to use it

- **Mouse:** click the dice.
- **Touchscreen:** tap the dice.
- **Keyboard:** press `Enter` or `Space`.

Rules:

- Every interaction produces exactly one new, independent roll.
- Input during a roll is ignored, so rolls can never overlap or interfere with each other.
- As soon as the dice stops, you can roll again immediately.
- Tapping the empty black area outside the dice does nothing. The tap target is a circle around the dice (about 45% of the canvas side) so it is easy to hit on small phones.

There are no visible controls. For accessibility, the canvas is marked as a button with the label "Roll the dice" for screen readers, and it is keyboard focusable.

## 4. Randomness (the most important part)

Randomness integrity is the top priority of this project.

### Source

All randomness comes from the Web Crypto API: `crypto.getRandomValues()`. This is the strongest practical randomness source available in a browser. It is a cryptographically secure generator seeded from your operating system's entropy.

The code never uses `Math.random()`, timestamps, counters, alternating sequences, fixed or preselected outcomes.

### Unbiased result (rejection sampling)

A random 32-bit number has 4,294,967,296 possible values. That number is not evenly divisible by 6 (the remainder is 4), so a plain `x % 6` would make some faces very slightly more likely.

To avoid that, the code throws away any value at or above `4,294,967,292` (the largest multiple of 6 that fits) and draws again. Every remaining value maps evenly onto the faces 1 to 6.

```js
const randBelow = (m) => {
  const limit = 4294967296 - (4294967296 % m);
  let x;
  do { x = rand32(); } while (x >= limit);
  return x % m;
};
const rollDie = () => randBelow(6) + 1;
```

### What is deliberately not done

- No balancing: results are never adjusted so faces "even out" over time.
- No history: previous rolls are not stored or consulted.
- No dependence on click timing, device orientation, or any user behavior.
- No secret change of a result after it is generated.

### Honest limitation

A browser cannot guarantee true physical or quantum randomness with JavaScript alone. This site does **not** claim to be quantum-generated. It uses the Web Crypto API, which is cryptographically secure and practically unpredictable, and that is more than enough for a dice roll.

## 5. How a roll works, step by step

1. **The result is generated first.** `rollDie()` picks 1 to 6 from the secure generator.
2. **The final orientation is computed** for exactly that face: the face is rotated to point straight up, then a random spin around the vertical axis is applied. The dice always rests flat on a face, so it can never settle on an edge or a corner.
3. **A cosmetic tumble is created** from more secure random values:
   - two random rotation axes,
   - one axis with 1 or 2 extra full turns (random direction),
   - the other with 0 or 1 extra turn (random direction),
   - a random duration between about 1.25 and 1.7 seconds,
   - a small vertical hop.
4. **The animation plays** with natural ease-out deceleration, blending from the starting orientation to the final one. The tumble is purely visual and can never change the outcome.
5. **At the end, the exact target orientation is set** and drawn one last time. The animation loop stops. The dice stays perfectly still until the next interaction.

Because the outcome is decided before anything moves, the number you see is always the number the generator produced.

## 6. The dice itself

### Face layout

Opposite faces always add up to 7:

| Face | Opposite |
| --- | --- |
| 1 | 6 |
| 2 | 5 |
| 3 | 4 |

The 1, 2 and 3 faces meet at a corner in counterclockwise order, like a standard Western dice.

Pip patterns follow the traditional layouts: 1 center; 2 diagonal; 3 diagonal plus center; 4 corners; 5 corners plus center; 6 two columns of three.

### Geometry and material

- The shape is a cube with edge length 1 and edge rounding radius 0.085, so it looks like a solid, premium piece rather than a sharp box.
- Pips are real recesses: each one is a sphere carved out of the surface with a small smooth blend at the rim. They are physically part of the dice, not stickers.
- The body is warm ivory. The pips are dark, glossy charcoal.
- Lighting is a cheap, hand-written model: a key light, a soft fill light, a hemispheric ambient term, a glossy highlight, a fresnel-style edge reflection from a tiny procedural environment, and a small ambient-occlusion term inside the pips and creases.
- Edges of the dice are anti-aliased in the shader, so no extra render passes or multisampling are needed.

## 7. Rendering and energy efficiency

- **Tiny custom renderer:** a single full-screen triangle and one fragment shader. The dice is drawn by ray marching a signed distance function (rounded box minus pip spheres). This avoids any 3D engine and keeps the code very small.
- **Render only when needed:** frames are drawn only while a roll is animating, on resize, and when the page becomes visible again. When the dice is still, **nothing runs**: no animation loop, no timers, no polling.
- **`requestAnimationFrame` only during a roll**, and it stops the moment the dice lands.
- **Hidden tab:** the animation is paused when the page is hidden and resumes correctly (without jumping) when it is visible again.
- **Cost control:**
  - pixel density is capped at 2,
  - the canvas backing size is capped at 900 by 900 pixels,
  - the GPU is requested in low-power mode,
  - the ray march stops early for pixels that miss the dice and uses a bounding sphere to skip empty space.
- **No network after load:** no fonts, analytics, ads, tracking, APIs or remote resources.
- **Context loss:** if the mobile GPU resets the WebGL context, the page recovers and redraws.

## 8. Responsive behavior

- The canvas is always a perfect square sized to the smaller side of the available area, centered on screen. The dice therefore keeps exact cube proportions on every device and in both portrait and landscape.
- The layout respects safe-area insets (notches, rounded corners, gesture bars).
- Browser toolbars appearing or disappearing, rotation, and window resizing are handled through a `ResizeObserver` (with a `resize` event fallback).
- Scrolling, overscroll, horizontal overflow, text selection, long-press callouts, double-tap zoom and pinch zoom are all disabled.
- The page is fixed to the viewport, so there are no layout shifts.

## 9. Privacy and honesty

- No roll history is stored. Nothing is saved to cookies, `localStorage` or anywhere else.
- No personal information is collected.
- No result is ever sent anywhere. The site makes no network requests after the page itself loads.
- No hidden weighting, no probability adjustment, no advertising, no gambling features, no monetization.
- The animation faithfully displays the already-generated result.

## 10. Deploying on GitHub Pages

1. Create a repository, for example `Dice`.
2. Upload `index.html`, `style.css`, `script.js` (and optionally `README.md`) to the **root** of the repository.
3. Go to **Settings, then Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and `/ (root)`, then save.
5. Wait about a minute. The site will be at `https://<your-username>.github.io/<repo-name>/`.

The same three files also work unchanged on Cloudflare Pages, Netlify, or any ordinary static web host. All paths are relative.

**If you updated the files but still see the old version:** your browser cached the old script. Hard-refresh the page or clear the site data.

## 11. Customizing

All tweakable values are at the top of the shader or in the JavaScript. Edit `script.js`.

| What | Where | Notes |
| --- | --- | --- |
| Dice color | `vec3 base = mix(vec3(0.80, 0.77, 0.68), ...` | First color is the body, second is the pips (linear color values, 0 to 1). |
| Edge roundness | `const float RR` and `HB` | Keep `HB = 0.5 - RR`. |
| Pip size | `const float RP` | Pip sphere radius. Larger means bigger pips. |
| Pip depth | `const float PO` | Smaller means deeper pips. |
| Pip spacing | `const float G` | Distance of the pip grid from the face center. |
| Dice size on screen | `const float K` | Smaller `K` makes the dice larger. Keep the bounding sphere in view (about 0.22 to 0.30 is safe). |
| Roll duration | `dur = 1250 + randBelow(450)` | Milliseconds. |
| Hop height | `const HOP = 0.08` | Set to `0` for no hop. |
| Pixel cap | `Math.min(..., 900)` | Lower it for weaker devices, raise it for sharper edges on big screens. |
| Tap radius | `0.2025 * s * s` | That is `0.45 squared`. Increase for a larger tap target. |

### Going back to an angled (3-face) view

The default camera looks straight down so only one number is visible. To get a classic angled view that shows the top and two side faces, replace these three lines in the shader's `main()`:

```glsl
vec3 camPos = vec3(0.0, 2.226, 3.562);
vec3 fw = vec3(0.0, -0.53, -0.848);
vec3 up = vec3(0.0, 0.848, -0.53);
```

Note that with the angled view you will see more than one number at rest.

## 12. How it was tested

These checks were run in Node against the real `script.js` logic:

- **Fairness:** over 1,200,000 rolls, all six faces appeared at the expected frequency (chi-square 7.49, below the 11.07 threshold for 5% significance with 5 degrees of freedom).
- **Rejection path:** with a mocked generator returning a value at or above the cutoff, the code correctly discards it and redraws.
- **Orientation:** for every outcome from 1 to 6, over 2,000 random spins each (12,000 checks), the generated face was the one pointing exactly up, with zero errors.
- **Face layout:** opposite faces sum to 7, and the 1, 2, 3 corner winding is correct.
- **Geometry:** a software port of the shader's distance function was rendered as text for every face, confirming correct pip counts and patterns on the visible face.
- **Code audit:** no `Math.random()` anywhere in `script.js`.

You can do your own quick sanity check in the browser: roll many times and confirm no face is favored. Over a few hundred rolls, each number should show up roughly one sixth of the time, with normal random variation.

## 13. Browser support and limitations

- Requires WebGL 1, which all current phones, tablets and desktop browsers support. (If a device has no WebGL at all, the page stays black.)
- Uses modern JavaScript (arrow functions, `const`/`let`, template strings). Any browser from the last several years works.
- The shader uses a ray marcher, so a very old budget GPU may render the roll animation at a lower frame rate. The resolution cap and low-power GPU hint are there to help. When the dice is still, there is no load at all.
- The randomness is cryptographically secure software randomness, not physical or quantum randomness.

## 14. FAQ

**Is it really random?**
Each roll uses `crypto.getRandomValues()` with unbiased rejection sampling. Nothing else influences the result: not timing, not touch position, not previous rolls.

**Why does the dice start showing a number before I tap?**
The initial resting face is also chosen by the secure generator. It is not a "roll", just a neutral starting state.

**Can the animation change the result?**
No. The result is generated first. The animation is only a visual path to the already-chosen face and ends exactly on it.

**Why can I see more than one face while it rolls?**
That is the tumble. At rest, the camera looks straight down, so only the top face is visible.

**Why does it not roll when I tap far from the dice?**
Only taps on or close to the dice count. Tap closer to the center.

**Does it work offline?**
After the first load, nothing else is fetched, so a cached copy keeps working. The project does not include a service worker, so offline behavior depends on your browser cache.

**Does it use battery when idle?**
No. When the dice is still, there is no animation loop, timer or network activity.

**Can I change the number of sides or add a second dice?**
Not without changes. The geometry, pip patterns and orientations are built specifically for one six-sided dice.
