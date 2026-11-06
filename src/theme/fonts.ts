// Self-hosted fonts, latin subset. The default Fontsource entry also references about
// 118 Japanese chunks per weight (~3 MB), which Vite would copy into dist/ [TAN-12].
// The only Japanese glyphs, 探査 on Home, come from two chunks in fonts-ja.css [TAN-17].
import './fonts-ja.css'
import '@fontsource/zen-maru-gothic/latin-700.css'
import '@fontsource/zen-maru-gothic/latin-900.css'
import '@fontsource/zen-kaku-gothic-new/latin-400.css'
import '@fontsource/zen-kaku-gothic-new/latin-500.css'
import '@fontsource/zen-kaku-gothic-new/latin-700.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
