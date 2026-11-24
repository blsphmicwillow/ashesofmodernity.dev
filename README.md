# ashesofmodernity.dev

My personal site — hand-written HTML and CSS with no framework and no build step, served straight from this branch by GitHub Pages at **[ashesofmodernity.dev](https://ashesofmodernity.dev)**.

## Pages

| File | Page |
| --- | --- |
| `index.html` | Landing page |
| `introduction.html` | Who I am |
| `passions.html` | What I care about |
| `projects.html` | Things I've built |
| `contacts.html` | How to reach me |
| `gift.html` | A small extra page |

`index.html` and its siblings share the same shell: a fixed animated background, a monospace type setting and the same navigation, so one page can be copied as the starting point for the next.

## Layout

```
index.html            landing page
introduction.html     about
passions.html         interests
projects.html         project list
contacts.html         contact details
gift.html             extra page
assets/               stylesheets, images and page assets
CNAME                 apex domain record for GitHub Pages
.nojekyll             serve files as-is, no Jekyll processing
.well-known/          site-level verification files
background.mp3        ambient audio
hover.mp3             interface sound
favicon.ico/.png      icons
archicon.png          icon used in the page shell
whitenoise.png        background texture
```

## Run locally

There is nothing to install; GitHub Pages serves the files statically, so any static server reproduces it:

```shell
python3 -m http.server 8000
```

Then open <http://localhost:8000>. Opening the `.html` files directly from disk mostly works too, but the audio assets and `.well-known/` are only served correctly over HTTP.

## Deploy

Push to `main`. GitHub Pages publishes the repository root, and `CNAME` keeps the site on the apex domain. Every page is plain HTML, so a change is live as soon as the Pages build finishes — check the **Actions** tab for the deploy run.
