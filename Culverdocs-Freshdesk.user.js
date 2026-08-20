// ==UserScript==
// @name         Culverdocs-Freshdesk
// @namespace    http://culverdocs.co.uk/
// @version      2.12
// @description  QoL improvements for displaying tickets with clearer priority and ESC indicators. Auto-adapts to Freshdesk's light and dark themes. Paste keeps all formatting except colour and font family.
// @author       Lawrence Murrell
// @match        https://culverdocs.freshdesk.com/a/tickets*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=culverdocs.co.uk
// @grant        none
// @updateURL    https://raw.githubusercontent.com/Quoeiza/templates/main/Culverdocs-Freshdesk.user.js
// @downloadURL  https://raw.githubusercontent.com/Quoeiza/templates/main/Culverdocs-Freshdesk.user.js
// ==/UserScript==

(function () {
    'use strict';

    // ============================
    // Configuration and state
    // ============================
    const STORAGE_KEY  = 'fd_card_style_mode';
    const STYLE_MODES  = ['gradient', 'fill', 'none'];   // CSS-friendly identifiers
    const STYLE_LABELS = ['Gradient', 'Fill', 'None'];   // Human labels for the dropdown
    const STATUSES     = ['Open', 'Pending', 'On Hold', 'Resolved', 'Closed'];

    let styleMode = parseInt(localStorage.getItem(STORAGE_KEY), 10);
    if (![0, 1, 2].includes(styleMode)) {
        styleMode = 2;
        localStorage.setItem(STORAGE_KEY, '2');
    }

    // ============================
    // CSS injection
    // ============================
    // All theming runs through CSS custom properties. Switching between light
    // and dark mode swaps a single block of variables, so the JS stays
    // theme-agnostic. It only writes data-* attributes onto cards and lets
    // CSS handle the rest. CSS variables inherit through Shadow DOM, so the
    // dropdown button inside <ticket-top-nav> follows the active theme too.
    const css = `
:root {
    --fd-status-open:        #ffe4e1;
    --fd-status-pending:     #fff6cc;
    --fd-status-on-hold:     #e8f4fc;
    --fd-status-resolved:    #ddfddf;
    --fd-status-closed:      #ddfddf;
    --fd-gradient-fade:      #fff;
    --fd-card-bg:            #fff;
    --fd-card-shadow:        2px 4px 6px 0 #cfd7df;
    --fd-text-title:         #19334c;
    --fd-text-info:          #6f7c87;
    --fd-text-ticket-id:     #778393;
    --fd-priority-border:    #f22;
    --fd-btn-bg:             #f8f9fa;
    --fd-btn-bg-hover:       #e9ecef;
    --fd-btn-border:         #d7dbe3;
    --fd-btn-text:           #375e6b;
    --fd-menu-bg:            #fff;
    --fd-menu-text:          #000;
    --fd-menu-hover:         #f0f0f0;
    --fd-menu-shadow:        0 8px 16px 0 rgba(0,0,0,.2);
}

html.fd-dark {
    /* Status hues sit on a near-black card so they read as accents,
       not panels. Buttons/menus step up a notch in lightness to keep
       hierarchy without reintroducing the navy tint. */
    --fd-status-open:        #4a2a2a;
    --fd-status-pending:     #4a3f1a;
    --fd-status-on-hold:     #1e3a52;
    --fd-status-resolved:    #1e4030;
    --fd-status-closed:      #1e4030;
    --fd-gradient-fade:      #1a1a1a;
    --fd-card-bg:            #1a1a1a;
    --fd-card-shadow:        2px 4px 6px 0 rgba(0,0,0,.5);
    --fd-text-title:         #e8edf3;
    --fd-text-info:          #b4bcc6;
    --fd-text-ticket-id:     #98a3b0;
    --fd-priority-border:    #ff5a5a;
    --fd-btn-bg:             #262626;
    --fd-btn-bg-hover:       #333333;
    --fd-btn-border:         #3a3a3a;
    --fd-btn-text:           #d0d0d0;
    --fd-menu-bg:            #262626;
    --fd-menu-text:          #e8edf3;
    --fd-menu-hover:         #333333;
    --fd-menu-shadow:        0 8px 16px 0 rgba(0,0,0,.6);
}

/* Layout overrides for the ticket list page */
.col-md-12 { padding-left: 0; padding-right: 0; }
.left-nav-mfe-wrapper, .left-nav-mfe { width: 240px !important; }
.ember-light-table table { border-collapse: separate; }
.hidden-overdue-badge { display: none !important; }
.avatar-icon.avatar-icon--rounded .avatar-block { margin-left: 9px; }
.avatar-image { display: none !important; }

/* Escalation indicator emoji prefixes, set via data-esc by the script */
.ticket-info[data-esc]::before {
    display: inline-block;
    margin-right: 4px;
    font-size: 13px;
    vertical-align: text-top;
    white-space: nowrap;
}
.ticket-info[data-esc="L1"]::before   { content: "⚠️"; }
.ticket-info[data-esc="L2"]::before   { content: "🚨"; }
.ticket-info[data-esc="L1L2"]::before { content: "⚠️🚨"; }

.current__item--active td:first-child::before { width: 0; }
.__module-tickets__assign-to .element-flex > div:first-child { display: none; }

/* Re-balance Freshdesk's hard-coded column widths */
[style*="width: 400px"] { width: 120px !important; }
[style*="width: 120px"] { width: 200px !important; }
[style*="width: 12vw"]  { width: 80px !important; }

/* Card chrome */
.tickets__list {
    min-height: 76px;
    display: table;
    width: 99.9%;
    box-sizing: border-box;
    position: relative;
    margin-bottom: 11px !important;
    background: var(--fd-card-bg);
    border-radius: 8px !important;
    overflow: hidden;
    box-shadow: var(--fd-card-shadow);
}

/* Status-driven card backgrounds. The card gets data-status from the script,
   then CSS picks the matching pastel and feeds it into the chosen style mode.
   This isolates "what's the colour for this status" from "how is the colour
   applied", so switching themes only touches the colour, not the layout. */
.tickets__list[data-status="Open"]    { --fd-status-bg: var(--fd-status-open); }
.tickets__list[data-status="Pending"] { --fd-status-bg: var(--fd-status-pending); }
.tickets__list[data-status="On Hold"] { --fd-status-bg: var(--fd-status-on-hold); }
.tickets__list[data-status="Resolved"]{ --fd-status-bg: var(--fd-status-resolved); }
.tickets__list[data-status="Closed"]  { --fd-status-bg: var(--fd-status-closed); }

.tickets__list[data-style-mode="gradient"] {
    background: linear-gradient(90deg, var(--fd-status-bg) 0, var(--fd-gradient-fade) 800px) !important;
}
.tickets__list[data-style-mode="fill"] {
    background: var(--fd-status-bg) !important;
}
.tickets__list[data-style-mode="none"] {
    background: var(--fd-card-bg) !important;
}

/* Card content layout */
.__module-tickets__tickets-list__tickets-table__ticket-item .list-content {
    padding-left: 0 !important;
}
.tickets__list .list-content--main { padding-right: 0; background: transparent !important; }
.tickets__list .list-content { padding-top: 0; padding-bottom: 0; }
.tickets__list .ticket-title-row {
    display: flex;
    align-items: center !important;
    margin: 0;
    gap: 0;
    width: 100%;
}
.tickets__list .ticket-title-row .muted[data-test-ticket-id] {
    margin-left: auto !important;
    font-size: 15px;
    font-weight: 500;
    color: var(--fd-text-ticket-id);
    min-width: 52px;
    text-align: right;
}

/* Text colours forced through variables so they invert with the theme.
   Freshdesk's own dark-mode CSS doesn't reach these elements consistently,
   so we override them outright. */
.wordbreak-fix {
    color: var(--fd-text-title) !important;
    font-size: 18px;
    font-weight: 600;
}
.ticket-info,
.ticket-info .user,
.ticket-info [data-test-id="user-name"] {
    color: var(--fd-text-info) !important;
}
.ticket-info { padding-top: 6px; font-size: 14px; }

/* Priority/new-ticket left border */
.ticket-due-soon-border,
.ticket-due-today-border,
.ticket-priority-border,
.ticket-new-border { border-left: none !important; }
.ticket-priority-border::before,
.ticket-new-border::before {
    content: "";
    position: absolute;
    top: 0; bottom: 0; left: 0;
    width: 6px;
    background: var(--fd-priority-border);
    border-top-left-radius: inherit;
    border-bottom-left-radius: inherit;
    z-index: 1;
}

/* Hide Freshdesk's own tag row, since we redraw escalation as an emoji prefix */
.ticket-tag-toprow,
.ticket-tag-toprow > .tag,
.ticket-tag-toprow > span[class^="tag--"],
.ticket-tag-toprow > .ticket-ribbon { display: none !important; }

.list-check-wrap { position: relative; }
.list-filter-wrap .list-filter__item,
.list-filter-wrap .list-filter__priority,
.list-filter-wrap .list-filter__status { width: 170px; }
.list-filter-wrap .list-filter__icon-assignto,
.list-filter-wrap .list-filter__icon-status { top: -2px; }
.list-filter-wrap .list-filter__item--icon-overlay { background: transparent; }
.list-filter-wrap .list-filter__priority .list-filter__item--icon-overlay { top: 1px; }

/* Strip Freshdesk's hover backgrounds on the filter controls so the
   card colour shows through cleanly */
.list-filter__item, .list-filter__item:hover, .list-filter__item:focus, .list-filter__item:active,
.list-filter__priority, .list-filter__priority:hover, .list-filter__priority:focus, .list-filter__priority:active,
.list-filter__status, .list-filter__status:hover, .list-filter__status:focus, .list-filter__status:active,
.assignto-filter-wrap, .assignto-filter-wrap:hover, .assignto-filter-wrap:focus, .assignto-filter-wrap:active,
.ticket-list-dropselect, .ticket-list-dropselect:hover, .ticket-list-dropselect:focus, .ticket-list-dropselect:active,
.ember-power-select-trigger, .ember-power-select-trigger:hover, .ember-power-select-trigger:focus, .ember-power-select-trigger:active,
.ember-basic-dropdown-trigger, .ember-basic-dropdown-trigger:hover, .ember-basic-dropdown-trigger:focus, .ember-basic-dropdown-trigger:active {
    background: transparent !important;
    background-color: transparent !important;
}

.list-content-wrap { padding: 16px; }
.list-content--info { background: transparent !important; }
.app-content-area, body { min-width: 958px; }
.col-md-9 { width: auto; }

/* ----- Dark-mode email content normalisation -----
   Customers' email clients (Outlook/M365 in particular) inline
   color: rgb(0, 0, 0) and color: black on every paragraph, plus
   white backgrounds on signature tables. Both become unreadable
   against the dark card. Scope is limited to the conversation
   content so we don't touch composer, sidebar, or chrome. */
html.fd-dark .ticket-details__conversation__content,
html.fd-dark .ticket-details__conversation__content *,
html.fd-dark .ticket-note-typography,
html.fd-dark .ticket-note-typography * {
    color: var(--fd-text-info) !important;
}
html.fd-dark .ticket-details__conversation__content a,
html.fd-dark .ticket-note-typography a {
    color: #6ea8ff !important; /* visible link blue against black */
}
/* Light backgrounds inlined by email clients (signature tables in
   particular) get marked with .fd-bg-darkened by normalizeEmailBackgrounds.
   The class is added to anything brighter than ~85% luminance, which
   covers pure white through about #d8d8d8. background-image is also
   stripped to neutralise any light gradient that came along with the
   shorthand. */
html.fd-dark .fd-bg-darkened {
    background-color: var(--fd-card-bg) !important;
    background-image: none !important;
}

/* Froala reply/note editor: <pre> code blocks inherit Freshdesk's
   --editor-code-block-bg, which resolves to a light blue. That isn't
   an inline style so the JS normaliser can't see it, so fix it via CSS
   and keep the editor and the rendered conversation in step. */
html.fd-dark .fr-element pre,
html.fd-dark .fr-view pre {
    background-color: var(--fd-card-bg) !important;
}

/* Pasted content arrives with colour and font family stripped, so it
   inherits the editor's own typeface and text colour. Code blocks are
   the one case where the typeface carries meaning, so restore monospace
   from our own rule rather than from whatever the source specified. */
.fr-element pre, .fr-element code, .fr-element kbd, .fr-element samp, .fr-element tt,
.fr-view pre, .fr-view code, .fr-view kbd, .fr-view samp, .fr-view tt {
    font-family: ui-monospace, "Cascadia Mono", "Segoe UI Mono", Consolas, "Liberation Mono", Menlo, monospace;
}

/* Tables that carried no border description of their own would otherwise
   paste in as an unreadable run of words, so give them a hairline in
   currentColor, which follows whichever theme is active. */
.fr-element table:not([style*="border"]) td,
.fr-element table:not([style*="border"]) th,
.fr-view table:not([style*="border"]) td,
.fr-view table:not([style*="border"]) th {
    border: 1px solid currentColor;
    padding: 4px 8px;
    vertical-align: top;
}

@media (max-width: 1120px) {
    .tickets__list .list-content--info,
    .fd-style-dropdown-btn { display: none; }
}
`;

    // Same CSS used in both the main document and the shadow root containing
    // the top nav. CSS variables inherit through the shadow boundary, so the
    // theme just flows in without any extra wiring.
    const dropdownCss = `
.fd-style-dropdown {
    position: relative;
    display: inline-block;
    vertical-align: middle;
    margin-right: 10px;
}
.fd-style-dropdown-btn {
    font-size: 13px;
    font-weight: 500;
    background: var(--fd-btn-bg, #f8f9fa);
    border: 1px solid var(--fd-btn-border, #d7dbe3);
    color: var(--fd-btn-text, #375e6b);
    padding: 2px 14px;
    height: 30px;
    cursor: pointer;
    outline: 0;
    min-width: auto;
    text-align: left;
    border-radius: 4px;
    transition: background .18s, color .18s, border-color .18s;
}
.fd-style-dropdown-btn:hover { background: var(--fd-btn-bg-hover, #e9ecef); }
#ticket-top-nav, .root-app,
[data-testid="top-navigation-container"],
[data-testid="right-section"] { overflow: visible !important; }
.fd-style-dropdown-content {
    display: none;
    position: fixed;
    background: var(--fd-menu-bg, #fff);
    min-width: 160px;
    box-shadow: var(--fd-menu-shadow, 0 8px 16px 0 rgba(0,0,0,.2));
    z-index: 99999;
    overflow: hidden;
    border-radius: 4px;
    border: 1px solid var(--fd-btn-border, #d7dbe3);
}
.fd-style-dropdown-content a {
    color: var(--fd-menu-text, #000);
    padding: 8px 16px;
    text-decoration: none;
    display: block;
    font-size: 13px;
}
.fd-style-dropdown-content a:hover { background: var(--fd-menu-hover, #f0f0f0); }
.show-dropdown { display: block !important; }
`;

    const styleElement = document.createElement('style');
    styleElement.id = 'fd-userstyle';
    styleElement.textContent = css + dropdownCss;
    document.head.appendChild(styleElement);

    // ============================
    // Theme detection
    // ============================
    // Rather than guess Freshdesk's class names or data attributes (which
    // change between releases), measure the computed background colour of
    // the body. If the page is dark, our overlay should be dark too. This
    // adapts to whatever mechanism Freshdesk uses, including future ones.
    function parseColorToRgba(colorStr) {
        if (!colorStr) return null;
        const str = String(colorStr).trim();

        // rgb(r,g,b) and rgba(r,g,b,a), tolerant of whitespace and decimals
        const rgbMatch = str.match(
            /rgba?\s*\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*(\d+(?:\.\d+)?))?\s*\)/i
        );
        if (rgbMatch) {
            return {
                r: parseFloat(rgbMatch[1]),
                g: parseFloat(rgbMatch[2]),
                b: parseFloat(rgbMatch[3]),
                a: rgbMatch[4] !== undefined ? parseFloat(rgbMatch[4]) : 1
            };
        }

        // #rgb and #rrggbb hex
        if (str.charAt(0) === '#') {
            const hex = str.slice(1);
            if (hex.length === 3) {
                return {
                    r: parseInt(hex[0] + hex[0], 16),
                    g: parseInt(hex[1] + hex[1], 16),
                    b: parseInt(hex[2] + hex[2], 16),
                    a: 1
                };
            }
            if (hex.length === 6) {
                return {
                    r: parseInt(hex.slice(0, 2), 16),
                    g: parseInt(hex.slice(2, 4), 16),
                    b: parseInt(hex.slice(4, 6), 16),
                    a: 1
                };
            }
            return null;
        }

        // Named colours that turn up in email signatures
        const lower = str.toLowerCase();
        if (lower === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
        if (lower === 'white')       return { r: 255, g: 255, b: 255, a: 1 };
        if (lower === 'black')       return { r: 0, g: 0, b: 0, a: 1 };

        return null;
    }

    function luminance(rgba) {
        return (0.2126 * rgba.r + 0.7152 * rgba.g + 0.0722 * rgba.b) / 255;
    }

    function detectDarkMode() {
        const measure = el => {
            const rgba = parseColorToRgba(getComputedStyle(el).backgroundColor);
            if (!rgba || rgba.a === 0) return null;
            return luminance(rgba);
        };
        const lum = measure(document.body) ?? measure(document.documentElement);
        return lum != null && lum < 0.5;
    }

    let isDark = false;
    function syncTheme() {
        const next = detectDarkMode();
        if (next !== isDark) {
            isDark = next;
            document.documentElement.classList.toggle('fd-dark', isDark);
            // Flipping into dark mode: normalise any email content already
            // on the page so customer-authored white backgrounds get caught
            // without waiting for the next mutation.
            if (isDark) normalizeEmailBackgrounds();
        }
    }

    // ============================
    // Utility functions
    // ============================
    function extractDueInfo(text) {
        const lower = text.toLowerCase();
        const parseValue = val => (val === 'a' || val === 'an' ? 1 : parseInt(val, 10));

        const overdueMatch = lower.match(/overdue.*?(\d+|a|an)\s*(day|hour|minute|d|h|m)/i);
        if (overdueMatch) {
            return { type: 'overdue', value: parseValue(overdueMatch[1]), unit: overdueMatch[2] };
        }
        const dueMatch = lower.match(/due.*?in.*?(\d+|a|an)\s*(day|hour|minute|d|h|m)/i);
        return dueMatch ? { type: 'due', value: parseValue(dueMatch[1]), unit: dueMatch[2] } : null;
    }

    function applyEscState(rootElement, tags) {
        const infoElement = rootElement.querySelector('.ticket-info');
        if (!infoElement) return;
        const hasL1 = tags.includes('L1-ESC');
        const hasL2 = tags.includes('L2-ESC');
        if (hasL1 && hasL2)   infoElement.setAttribute('data-esc', 'L1L2');
        else if (hasL1)       infoElement.setAttribute('data-esc', 'L1');
        else if (hasL2)       infoElement.setAttribute('data-esc', 'L2');
        else                  infoElement.removeAttribute('data-esc');
    }

    function isUrgent(fullText, dueInfo, tagsText) {
        if (dueInfo) {
            if (dueInfo.type === 'overdue') return true;
            if (dueInfo.type === 'due') {
                const unitShort = (dueInfo.unit || '')[0];
                if (unitShort === 'm') return true;
                if (unitShort === 'h' && dueInfo.value <= 4) return true;
                if (unitShort === 'd' && dueInfo.value === 1) return true;
            }
        }
        if (tagsText.indexOf('new') > -1) return true;

        if (fullText) {
            const match = fullText.toLowerCase().match(/customer responded[\s\S]*?ago/);
            if (match) {
                const windowText  = match[0];
                const recentShort = /\b(minute|min|minutes|mins|hour|hr|hours)\b/.test(windowText);
                const recentLong  = /\b(day|days|week|weeks|month|months|year|years)\b/.test(windowText);
                if (recentShort && !recentLong) return true;
            }
        }
        return false;
    }

    function detectStatus(ticketText) {
        // Whichever status keyword appears latest in the card text wins.
        // The status label is rendered after the ticket title, so scanning
        // by lastIndexOf prevents titles like "Form Not Opening" from
        // falsely matching 'Open'.
        return STATUSES.reduce(
            (best, status) => {
                const idx = ticketText.lastIndexOf(status);
                return idx > best.idx ? { status, idx } : best;
            },
            { status: 'Open', idx: -1 }
        ).status;
    }

    function hideTagElements(rootElement) {
        rootElement
            .querySelectorAll('.ticket-tag-wrap,.status-tag-wrap,.ticket-tag-toprow')
            .forEach(el => { el.style.display = 'none'; });
    }

    // ============================
    // Email body normalisation (dark mode only)
    // ============================
    // Customer emails frequently inline near-white backgrounds: pure white
    // from Outlook signature tables, off-whites like #fafafa or #f5f5f5 from
    // email-client themes. Against the dark card these become bright
    // rectangles. The CSS approach can't catch arbitrary shades (attribute
    // selectors are exact substring matches), so we walk the email content,
    // compute luminance for each inline background, and tag the bright ones
    // with .fd-bg-darkened. The CSS rule then swaps them to near-black.
    //
    // Threshold (0.85) is chosen to catch white through ~#d8d8d8 without
    // clobbering anything a customer might use as a deliberate light accent.
    const EMAIL_CONTENT_SELECTOR =
        '.ticket-details__conversation__content, .ticket-note-typography';

    function normalizeEmailBackgrounds() {
        if (!isDark) return;
        document.querySelectorAll(EMAIL_CONTENT_SELECTOR).forEach(container => {
            // :not(.fd-bg-darkened) ensures we never reprocess an element
            // we've already tagged, which both saves work and prevents the
            // class-add from causing an observer feedback loop.
            container
                .querySelectorAll('[style*="background"]:not(.fd-bg-darkened)')
                .forEach(el => {
                    // getComputedStyle resolves both `background-color: X`
                    // and `background:` shorthand to one normalised value,
                    // so we don't need to parse the raw style string.
                    const rgba = parseColorToRgba(getComputedStyle(el).backgroundColor);
                    if (!rgba || rgba.a < 0.5) return; // transparent or unreadable
                    if (luminance(rgba) > 0.85) {
                        el.classList.add('fd-bg-darkened');
                    }
                });
        });
    }

    // ============================
    // Paste sanitisation: colour and font family only
    // ============================
    // Earlier versions used an element allow-list, which cost far more
    // formatting than the problem warranted. The model is now inverted.
    // Structure and formatting are preserved as pasted (tables, code blocks,
    // lists, headings, bold, italics, underline, strikethrough, links,
    // images, alignment, sizes), and the sanitiser removes exactly two
    // things.
    //
    // Colour, in every form it can arrive:
    //   1. Inline colour longhands: color, background-color, border-*-color,
    //      outline-color, caret-color, and anything else ending in -color.
    //   2. Colour carried inside a shorthand (border, outline, column-rule,
    //      text-decoration). The shorthand is kept and only its colour token
    //      is dropped, so borders and underlines survive and fall back to
    //      currentColor.
    //   3. Backgrounds outright, gradients and background images included,
    //      because a gradient is colour by another name.
    //   4. Shadows, filters and blend modes, which can recolour or erase text.
    //   5. Custom properties, which can smuggle a colour in through var().
    //   6. Presentational colour attributes: bgcolor, <font color>, text,
    //      link, vlink, alink, bordercolor, and the SVG fill/stroke family.
    //
    // Font family, in the three forms it can arrive:
    //   1. The font-family longhand.
    //   2. The `font` shorthand. Browsers normally expand it into longhands
    //      when the style attribute is parsed, but where the shorthand name
    //      survives iteration we drop it and re-apply only its weight and
    //      italic tokens, so bold written as `font: bold 12px Arial` is not
    //      lost along with the typeface.
    //   3. The legacy <font face="..."> attribute.
    //
    // Both passes also drop class and id, because a pasted class can match a
    // Freshdesk or Froala rule and reintroduce what was just removed. The
    // source stylesheet never travels with the clipboard in any case.
    //
    // Script, style and other executable or interactive elements are dropped
    // with their contents rather than unwrapped, so their guts can never be
    // emitted as literal text. URLs are protocol-checked before being kept.
    //
    // Why window/capture: Froala registers its own paste handler on the editor
    // element before this userscript runs, so theirs fires first at any element
    // below window. Window is the top of the capture cascade and always fires
    // first; combined with stopImmediatePropagation, Froala never sees it.
    //
    // execCommand is still the most reliable insertion path because it
    // participates in the contenteditable native undo stack.
    const ALLOWED_LINK_PROTOCOLS  = /^(?:https?:|mailto:|tel:|#)/i;
    const ALLOWED_IMAGE_PROTOCOLS = /^(?:https?:|cid:|data:image\/)/i;

    // Removed along with their contents: executable, interactive, metadata.
    const PASTE_DROP_SELECTOR = [
        'script', 'style', 'link', 'meta', 'title', 'base', 'noscript',
        'iframe', 'frame', 'frameset', 'object', 'embed', 'applet',
        'form', 'input', 'button', 'select', 'textarea', 'option'
    ].join(',');

    // Presentational attributes whose only job is colour or typeface.
    const COLOUR_ATTRIBUTES = new Set([
        'bgcolor', 'color', 'bordercolor', 'bordercolorlight', 'bordercolordark',
        'text', 'link', 'vlink', 'alink',
        'fill', 'stroke', 'stop-color', 'flood-color', 'lighting-color'
    ]);
    const FONT_ATTRIBUTES = new Set(['face']);

    // Attributes that point at a resource and need a protocol check.
    const URL_ATTRIBUTES = new Set([
        'href', 'src', 'srcset', 'background', 'xlink:href', 'action', 'formaction', 'data'
    ]);

    // Inline properties removed outright.
    const COLOUR_PROPERTIES = new Set([
        'color', '-webkit-text-fill-color', '-webkit-text-stroke',
        '-webkit-text-stroke-color', 'text-emphasis', 'text-emphasis-color',
        'background', 'background-color', 'background-image', 'background-blend-mode',
        'box-shadow', 'text-shadow', 'filter', 'backdrop-filter', 'mix-blend-mode',
        'accent-color', 'scrollbar-color', 'caret-color',
        'fill', 'stroke', 'stop-color', 'flood-color', 'lighting-color'
    ]);
    const FONT_FAMILY_PROPERTIES = new Set([
        'font-family', 'src', '-webkit-font-smoothing', '-moz-osx-font-smoothing'
    ]);

    // Shorthands kept, but with any colour token taken out of the value.
    const COLOUR_SHORTHANDS = new Set([
        'border', 'border-top', 'border-right', 'border-bottom', 'border-left',
        'border-block', 'border-block-start', 'border-block-end',
        'border-inline', 'border-inline-start', 'border-inline-end',
        'outline', 'column-rule', 'text-decoration'
    ]);

    const CSS_NAMED_COLOURS = (
        'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond ' +
        'blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue ' +
        'cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey ' +
        'darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon ' +
        'darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet ' +
        'deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen ' +
        'fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew ' +
        'hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon ' +
        'lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey ' +
        'lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey ' +
        'lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine ' +
        'mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen ' +
        'mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite ' +
        'navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen ' +
        'paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple ' +
        'rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell ' +
        'sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan ' +
        'teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen ' +
        'transparent currentcolor'
    ).split(' ');

    // Colour functions, gradients included, matched with one level of nesting
    // so an rgb() inside a gradient stop list is consumed with it.
    const COLOUR_FUNCTION_RE = new RegExp(
        '\\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix|' +
        '(?:repeating-)?(?:linear|radial|conic)-gradient)' +
        '\\s*\\([^()]*(?:\\([^()]*\\)[^()]*)*\\)',
        'gi'
    );
    const HEX_COLOUR_RE   = /#[0-9a-f]{3,8}\b/gi;
    const NAMED_COLOUR_RE = new RegExp('\\b(?:' + CSS_NAMED_COLOURS.join('|') + ')\\b', 'gi');

    // Only ever applied to the shorthands listed above, so keyword values such
    // as "solid" survive and unrelated properties are never touched.
    function stripColourTokens(value) {
        return String(value)
            .replace(COLOUR_FUNCTION_RE, ' ')
            .replace(HEX_COLOUR_RE, ' ')
            .replace(NAMED_COLOUR_RE, ' ')
            .replace(/\s{2,}/g, ' ')
            .trim();
    }

    // Pull weight and italic back out of a `font` shorthand before it is
    // discarded. Size and line-height go with the typeface, since a size
    // lifted from a source document is meaningless without its font.
    function preserveFontShorthandTraits(style, value) {
        const raw = String(value).toLowerCase();
        if (/\b(?:italic|oblique)\b/.test(raw)) style.setProperty('font-style', 'italic');
        if (/\bbold(?:er)?\b/.test(raw)) {
            style.setProperty('font-weight', 'bold');
            return;
        }
        const weight = raw.match(/(?:^|\s)([1-9]00)(?:\s|\/|$)/);
        if (weight && parseInt(weight[1], 10) >= 600) style.setProperty('font-weight', 'bold');
    }

    // Reading through element.style rather than the raw attribute string means
    // the browser has already expanded shorthands into longhands and normalised
    // the values, so `background: #fff url(x) no-repeat` needs no hand-rolled
    // parser. The shorthand branches are a safety net for engines that keep a
    // shorthand name during iteration.
    function stripPastedStyle(el) {
        if (!el.hasAttribute('style')) return;

        const style = el.style;
        const names = [];
        for (let i = 0; i < style.length; i++) names.push(style.item(i));

        names.forEach(name => {
            const lower = String(name).toLowerCase();

            if (lower.indexOf('--') === 0) {           // var() can hide a colour
                style.removeProperty(name);
                return;
            }
            if (lower === 'font') {                    // typeface shorthand
                preserveFontShorthandTraits(style, style.getPropertyValue(name));
                style.removeProperty(name);
                return;
            }
            if (FONT_FAMILY_PROPERTIES.has(lower)) {
                style.removeProperty(name);
                return;
            }
            if (COLOUR_PROPERTIES.has(lower) || /(?:^|-)color$/.test(lower)) {
                style.removeProperty(name);
                return;
            }
            if (COLOUR_SHORTHANDS.has(lower)) {
                const priority = style.getPropertyPriority(name);
                const cleaned  = stripColourTokens(style.getPropertyValue(name));
                style.removeProperty(name);
                if (cleaned) style.setProperty(name, cleaned, priority);
            }
        });

        if (!style.length) el.removeAttribute('style');
    }

    function sanitizePastedElement(el) {
        // Snapshot the attribute list: removing while iterating a live
        // NamedNodeMap skips entries.
        [...el.attributes].forEach(attr => {
            const name  = attr.name.toLowerCase();
            const value = (attr.value || '').trim();

            if (name.indexOf('on') === 0) {            // inline event handlers
                el.removeAttribute(attr.name);
                return;
            }
            if (name === 'class' || name === 'id') {   // could match a host rule
                el.removeAttribute(attr.name);
                return;
            }
            if (COLOUR_ATTRIBUTES.has(name) || FONT_ATTRIBUTES.has(name)) {
                el.removeAttribute(attr.name);
                return;
            }
            if (URL_ATTRIBUTES.has(name)) {
                if (name === 'background' || name === 'action' || name === 'formaction' || name === 'data') {
                    el.removeAttribute(attr.name);     // background image or form target
                    return;
                }
                const ok = (name === 'src' || name === 'srcset')
                    ? ALLOWED_IMAGE_PROTOCOLS.test(value)
                    : ALLOWED_LINK_PROTOCOLS.test(value);
                if (!ok) el.removeAttribute(attr.name);
                return;
            }
        });

        stripPastedStyle(el);
    }

    function sanitizeClipboardHtml(html) {
        // DOMParser doesn't load images or run scripts, so this is a safe way
        // to turn the clipboard string into a walkable tree.
        const doc  = new DOMParser().parseFromString(html, 'text/html');
        const body = doc.body;
        if (!body) return '';

        // Drop executable and interactive nodes with everything inside them.
        body.querySelectorAll(PASTE_DROP_SELECTOR).forEach(el => el.remove());

        // Word and Outlook wrap large blocks in conditional comments. Remove
        // comment nodes so none of that leaks back out as markup.
        const walker   = doc.createTreeWalker(body, NodeFilter.SHOW_COMMENT, null);
        const comments = [];
        while (walker.nextNode()) comments.push(walker.currentNode);
        comments.forEach(node => node.parentNode && node.parentNode.removeChild(node));

        body.querySelectorAll('*').forEach(sanitizePastedElement);

        return body.innerHTML.trim();
    }

    function handleEditorPaste(event) {
        const target = event.target;
        if (!(target instanceof Element)) return;
        if (!target.closest('.fr-element[contenteditable="true"]')) return;

        const clipboardData = event.clipboardData || window.clipboardData;
        if (!clipboardData) return;

        const html = clipboardData.getData('text/html');
        const text = clipboardData.getData('text/plain');
        if (!html && !text) return; // image or non-text content, let Froala handle it

        event.preventDefault();
        event.stopImmediatePropagation();

        if (html) {
            const clean = sanitizeClipboardHtml(html);
            if (clean) {
                document.execCommand('insertHTML', false, clean);
                return;
            }
        }
        // No HTML, or it sanitised down to nothing: fall back to plain text.
        document.execCommand('insertText', false, text);
    }

    let pasteHandlerRegistered = false;
    function registerEditorPasteHandler() {
        if (pasteHandlerRegistered) return;
        pasteHandlerRegistered = true;
        window.addEventListener('paste', handleEditorPaste, true);
    }

    // ============================
    // Card styling
    // ============================
    function applyCardStyles() {
        const currentMode = STYLE_MODES[styleMode];

        document
            .querySelectorAll('.__module-tickets__tickets-list__tickets-table__ticket-item')
            .forEach(cardElement => {
                const mainContent = cardElement.querySelector('[data-test-ticket-content]');
                if (!mainContent) return;

                mainContent.classList.remove(
                    'ticket-priority-border',
                    'ticket-due-soon-border',
                    'ticket-due-today-border',
                    'ticket-new-border'
                );

                const ticketText    = mainContent.textContent;
                const ticketStatus  = detectStatus(ticketText);
                const listContainer = cardElement.closest('.tickets__list');

                if (listContainer) {
                    // CSS handles all the actual styling. JS just announces
                    // what status this card has and which mode is active.
                    listContainer.setAttribute('data-status', ticketStatus);
                    listContainer.setAttribute('data-style-mode', currentMode);
                    // Clear inline backgrounds left behind by earlier script versions
                    if (listContainer.style.background) listContainer.style.background = '';
                }

                const dueInfo   = extractDueInfo(ticketText);
                const tagNodes  = [...mainContent.querySelectorAll('span.tag,span[class^="tag--"],.list-item')];
                const tags      = tagNodes.map(el => el.textContent.trim());
                const tagsLower = tags.join(' ').toLowerCase();
                const urgent    = isUrgent(ticketText, dueInfo, tagsLower);

                mainContent.classList.toggle(
                    'ticket-new-border',
                    ticketStatus === 'Open' && urgent
                );

                hideTagElements(mainContent);
                applyEscState(cardElement, tags);
            });
    }

    // ============================
    // Dropdown setup
    // ============================
    function setupDropdowns() {
        // The top-nav button lives inside a Shadow DOM, so document.getElementById
        // won't find it. We check the shadow root directly to avoid duplicates.
        const shadowHost = document.querySelector('ticket-top-nav');
        const shadowRoot = shadowHost && shadowHost.shadowRoot;
        if (shadowRoot && shadowRoot.getElementById('style-select-btn')) return;
        if (!shadowRoot && document.getElementById('style-select-btn')) return; // legacy fallback

        const targetContainer =
            (shadowRoot && shadowRoot.querySelector('[data-testid="right-section"]')) ||
            document.querySelector('.page-actions__right .pull-right');

        if (!targetContainer) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'fd-style-dropdown';

        const button = document.createElement('button');
        button.id = 'style-select-btn';
        button.type = 'button';
        button.textContent = 'Style: ' + STYLE_LABELS[styleMode];
        button.className = 'fd-style-dropdown-btn';

        const menu = document.createElement('div');
        menu.className = 'fd-style-dropdown-content';

        STYLE_LABELS.forEach((name, index) => {
            const link = document.createElement('a');
            link.href = '#';
            link.textContent = name;
            link.dataset.index = String(index);
            link.onclick = event => {
                event.preventDefault();
                event.stopPropagation();
                styleMode = index;
                localStorage.setItem(STORAGE_KEY, String(styleMode));
                button.textContent = 'Style: ' + STYLE_LABELS[styleMode];
                menu.classList.remove('show-dropdown');
                applyCardStyles();
            };
            menu.appendChild(link);
        });

        button.onclick = event => {
            event.stopPropagation();
            document
                .querySelectorAll('.fd-style-dropdown-content')
                .forEach(dropdown => {
                    if (dropdown !== menu) dropdown.classList.remove('show-dropdown');
                });
            menu.classList.toggle('show-dropdown');
        };

        // Mirror the dropdown CSS into the shadow root. CSS custom properties
        // inherit through the shadow boundary, so theme switching works
        // automatically with no extra wiring.
        if (shadowRoot && !shadowRoot.getElementById('fd-style-dropdown-css')) {
            const shadowStyle = document.createElement('style');
            shadowStyle.id = 'fd-style-dropdown-css';
            shadowStyle.textContent = dropdownCss;
            shadowRoot.appendChild(shadowStyle);
        }

        wrapper.appendChild(button);
        wrapper.appendChild(menu);
        targetContainer.appendChild(wrapper);

        document.addEventListener('click', event => {
            if (!event.target.closest('.fd-style-dropdown')) {
                document
                    .querySelectorAll('.fd-style-dropdown-content')
                    .forEach(dropdown => dropdown.classList.remove('show-dropdown'));
            }
        });
    }

    // ============================
    // Observers and initialisation
    // ============================
    // Main observer: re-applies card styling and dropdown injection whenever
    // the Ember app re-renders the ticket list. Debounced so rapid mutations
    // collapse into one pass.
    let debounceTimer = null;
    const mainObserver = new MutationObserver(() => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            syncTheme();
            applyCardStyles();
            setupDropdowns();
            normalizeEmailBackgrounds();
        }, 150);
    });
    mainObserver.observe(document.body, { childList: true, subtree: true });

    // Theme observer: catches theme toggles that happen without DOM changes
    // (Freshdesk switching the class/style on <html> or <body>).
    const themeObserver = new MutationObserver(syncTheme);
    themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class', 'data-theme', 'style']
    });
    themeObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ['class', 'data-theme', 'style']
    });

    // Also follow OS-level dark-mode changes if Freshdesk relies on
    // prefers-color-scheme for any of its surfaces.
    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncTheme);
    }

    syncTheme();
    applyCardStyles();
    setupDropdowns();
    registerEditorPasteHandler();
})();
