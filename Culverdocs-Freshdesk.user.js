// ==UserScript==
// @name         Culverdocs-Freshdesk
// @namespace    http://culverdocs.co.uk/
// @version      2.17
// @description  QoL improvements for displaying tickets with clearer priority and ESC indicators. Auto-adapts to Freshdesk's light and dark themes. Paste keeps all formatting except colour, font family and font size. Tags can be toggled on and off. Editor toolbar is extended with the Froala commands Freshdesk loads but never exposes.
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
    const STORAGE_KEY = 'fd_card_style_mode';
    const TAGS_KEY    = 'fd_show_tags';
    const STYLE_MODES = ['gradient', 'fill', 'none'];
    const STATUSES    = ['Open', 'Pending', 'On Hold', 'Resolved', 'Closed'];
    const label       = mode => mode[0].toUpperCase() + mode.slice(1);

    // Stored value is the mode name; a legacy numeric value migrates by index.
    const stored = localStorage.getItem(STORAGE_KEY);
    let styleMode = STYLE_MODES[stored] || (STYLE_MODES.includes(stored) ? stored : 'none');

    // Tag visibility is one class on <html>, so CSS covers every card at once and
    // cards rendered later need no follow-up work. Hidden is the default.
    let showTags = localStorage.getItem(TAGS_KEY) === 'true';
    function applyTagState() {
        document.documentElement.classList.toggle('fd-tags', showTags);
    }

    // ============================
    // CSS injection
    // ============================
    // All theming runs through CSS custom properties, so the JS only ever writes
    // data-* attributes onto cards and lets CSS decide what they look like.
    const css = `
:root {
    --fd-status-open:        #ffe4e1;
    --fd-status-pending:     #fff6cc;
    --fd-status-on-hold:     #e8f4fc;
    --fd-status-resolved:    #ddfddf;
    --fd-status-closed:      #e6e8ea;
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

/* Status hues sit on a near-black card so they read as accents, not panels. */
html.fd-dark {
    --fd-status-open:        #4a2a2a;
    --fd-status-pending:     #4a3f1a;
    --fd-status-on-hold:     #1e3a52;
    --fd-status-resolved:    #1e4030;
    --fd-status-closed:      #383838;
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
.col-md-9 { width: auto; }
.left-nav-mfe-wrapper, .left-nav-mfe { width: 240px !important; }
.ember-light-table table { border-collapse: separate; }
.hidden-overdue-badge, .avatar-image { display: none !important; }
.avatar-icon.avatar-icon--rounded .avatar-block { margin-left: 9px; }
.current__item--active td:first-child::before { width: 0; }
.__module-tickets__assign-to .element-flex > div:first-child { display: none; }
.app-content-area, body { min-width: 958px; }

/* Re-balance Freshdesk's hard-coded column widths */
[style*="width: 400px"] { width: 120px !important; }
[style*="width: 120px"] { width: 200px !important; }
[style*="width: 12vw"]  { width: 80px !important; }

/* Escalation indicators, driven by data-esc written by the script */
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

/* data-status picks the colour, data-style-mode decides how it is applied. */
.tickets__list[data-status="Open"]     { --fd-status-bg: var(--fd-status-open); }
.tickets__list[data-status="Pending"]  { --fd-status-bg: var(--fd-status-pending); }
.tickets__list[data-status="On Hold"]  { --fd-status-bg: var(--fd-status-on-hold); }
.tickets__list[data-status="Resolved"] { --fd-status-bg: var(--fd-status-resolved); }
.tickets__list[data-status="Closed"]   { --fd-status-bg: var(--fd-status-closed); }

.tickets__list[data-style-mode="gradient"] {
    background: linear-gradient(90deg, var(--fd-status-bg, var(--fd-card-bg)) 0, var(--fd-gradient-fade) 800px) !important;
}
.tickets__list[data-style-mode="fill"] {
    background: var(--fd-status-bg, var(--fd-card-bg)) !important;
}
.tickets__list[data-style-mode="none"] {
    background: var(--fd-card-bg) !important;
}

/* Card content layout */
.__module-tickets__tickets-list__tickets-table__ticket-item .list-content { padding-left: 0 !important; }
.tickets__list .list-content { padding-top: 0; padding-bottom: 0; }
.tickets__list .list-content--main { padding-right: 0; background: transparent !important; }
.list-content--info { background: transparent !important; }
.list-content-wrap { padding: 16px; }
.list-check-wrap { position: relative; }
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

/* Freshdesk's own dark-mode CSS misses these, so force them through variables. */
.wordbreak-fix {
    color: var(--fd-text-title) !important;
    font-size: 18px;
    font-weight: 600;
}
.ticket-info,
.ticket-info .user,
.ticket-info [data-test-id="user-name"] { color: var(--fd-text-info) !important; }
.ticket-info { padding-top: 6px; font-size: 14px; }

/* New-ticket left border, drawn as an overlay so the card radius is kept */
.ticket-due-soon-border,
.ticket-due-today-border,
.ticket-priority-border,
.ticket-new-border { border-left: none !important; }
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

/* Freshdesk's tag rows go, since escalation is redrawn as an emoji prefix.
   fd-tags on <html> puts them back, toggled from the top nav. */
html:not(.fd-tags) .tickets__list .ticket-tag-wrap,
html:not(.fd-tags) .tickets__list .status-tag-wrap,
html:not(.fd-tags) .ticket-tag-toprow,
html:not(.fd-tags) .ticket-tag-toprow > .tag,
html:not(.fd-tags) .ticket-tag-toprow > span[class^="tag--"],
html:not(.fd-tags) .ticket-tag-toprow > .ticket-ribbon { display: none !important; }

/* Filter controls */
.list-filter-wrap .list-filter__item,
.list-filter-wrap .list-filter__priority,
.list-filter-wrap .list-filter__status { width: 170px; }
.list-filter-wrap .list-filter__icon-assignto,
.list-filter-wrap .list-filter__icon-status { top: -2px; }
.list-filter-wrap .list-filter__item--icon-overlay { background: transparent; }
.list-filter-wrap .list-filter__priority .list-filter__item--icon-overlay { top: 1px; }

/* Strip Freshdesk's hover backgrounds so the card colour shows through */
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

/* Dark mode: customer email clients inline black text and white signature
   tables, both unreadable on a dark card. Scoped to conversation content. */
html.fd-dark .ticket-details__conversation__content,
html.fd-dark .ticket-details__conversation__content *,
html.fd-dark .ticket-note-typography,
html.fd-dark .ticket-note-typography * { color: var(--fd-text-info) !important; }
html.fd-dark .ticket-details__conversation__content a,
html.fd-dark .ticket-note-typography a { color: #6ea8ff !important; }

/* Bright inline backgrounds are tagged by normalizeEmailBackgrounds; the
   background-image reset neutralises any gradient that came with them. */
html.fd-dark .fd-bg-darkened {
    background-color: var(--fd-card-bg) !important;
    background-image: none !important;
}

/* Froala's code-block background is a stylesheet rule, so the JS normaliser
   can't see it and it has to be fixed here to match the conversation. */
html.fd-dark .fr-element pre,
html.fd-dark .fr-view pre { background-color: var(--fd-card-bg) !important; }

/* Pasted content loses its typeface, so restore monospace where it means something. */
.fr-element pre, .fr-element code, .fr-element kbd, .fr-element samp, .fr-element tt,
.fr-view pre, .fr-view code, .fr-view kbd, .fr-view samp, .fr-view tt {
    font-family: ui-monospace, "Cascadia Mono", "Segoe UI Mono", Consolas, "Liberation Mono", Menlo, monospace;
}

/* Borderless pasted tables would read as a run of words, so give them a hairline. */
.fr-element table:not([style*="border"]) td,
.fr-element table:not([style*="border"]) th,
.fr-view table:not([style*="border"]) td,
.fr-view table:not([style*="border"]) th {
    border: 1px solid currentColor;
    padding: 4px 8px;
    vertical-align: top;
}

/* Insurance for the pinned group, in case Froala's own float rule is absent. */
.fr-toolbar .fr-btn-grp.fr-float-right { float: right; }

@media (max-width: 1120px) {
    .tickets__list .list-content--info,
    .fd-style-dropdown-btn { display: none; }
}
`;

    // Injected into both the document and the top-nav shadow root. Custom
    // properties inherit through the shadow boundary, so theming needs no wiring.
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
    // Freshdesk's dark-mode mechanism changes between releases, so measure the
    // computed background rather than guessing class names. Computed colours are
    // always rgb()/rgba(), so scraping the numbers is enough. Null means
    // transparent or unreadable.
    function luminance(color) {
        const parts = String(color).match(/[\d.]+/g);
        if (!parts) return null;
        const [r, g, b, a = 1] = parts.map(Number);
        return a < 0.5 ? null : (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    }

    let isDark = false;
    function syncTheme() {
        const lum = luminance(getComputedStyle(document.body).backgroundColor)
                 ?? luminance(getComputedStyle(document.documentElement).backgroundColor);
        const next = lum != null && lum < 0.5;
        if (next === isDark) return;
        isDark = next;
        document.documentElement.classList.toggle('fd-dark', isDark);
        // Catch email content already on the page rather than waiting for a mutation.
        if (isDark) normalizeEmailBackgrounds();
    }

    // ============================
    // Email body normalisation (dark mode only)
    // ============================
    // Emails inline near-white backgrounds that glare against the dark card, in
    // arbitrary shades that an attribute selector can't match. Anything brighter
    // than ~85% luminance gets tagged for the CSS rule above. :not() stops
    // reprocessing and prevents an observer feedback loop.
    const EMAIL_BG_SELECTOR = ['.ticket-details__conversation__content', '.ticket-note-typography']
        .map(root => `${root} [style*="background"]:not(.fd-bg-darkened)`).join(',');

    function normalizeEmailBackgrounds() {
        if (!isDark) return;
        document.querySelectorAll(EMAIL_BG_SELECTOR).forEach(el => {
            if (luminance(getComputedStyle(el).backgroundColor) > 0.85) el.classList.add('fd-bg-darkened');
        });
    }

    // ============================
    // Card data
    // ============================
    // The status control is the only authoritative source: the card body carries
    // SLA phrases like "Resolved on time" that describe the outcome, not the state.
    // Hovering swaps the plain label for a power-select trigger, so read whichever
    // of the two is currently rendered.
    function detectStatus(card) {
        const text = card.querySelector('.list-filter__status')?.textContent.trim();
        return text ? STATUSES.find(status => text.startsWith(status)) : null;
    }

    function isUrgent(text, tagsLower) {
        const lower = text.toLowerCase();
        if (tagsLower.includes('new')) return true;

        // A bare "overdue" isn't enough, since the hidden overdue badge carries the word.
        if (/overdue.*?(?:\d+|an?)\s*(?:day|hour|minute|d|h|m)/.test(lower)) return true;

        const due = lower.match(/due.*?in.*?(\d+|an?)\s*(day|hour|minute|d|h|m)/);
        if (due) {
            const value = due[1].startsWith('a') ? 1 : parseInt(due[1], 10);
            const unit  = due[2][0];
            if (unit === 'm' || (unit === 'h' && value <= 4) || (unit === 'd' && value === 1)) return true;
        }

        // Recent customer replies only: the window must name minutes or hours and nothing longer.
        const replied = lower.match(/customer responded[\s\S]*?ago/);
        return !!replied
            && /\b(?:mins?|minutes?|hrs?|hours?)\b/.test(replied[0])
            && !/\b(?:days?|weeks?|months?|years?)\b/.test(replied[0]);
    }

    function applyEscState(card, tags) {
        const info = card.querySelector('.ticket-info');
        if (!info) return;
        const esc = (tags.includes('L1-ESC') ? 'L1' : '') + (tags.includes('L2-ESC') ? 'L2' : '');
        if (esc) info.setAttribute('data-esc', esc);
        else info.removeAttribute('data-esc');
    }

    function applyCardStyles() {
        document
            .querySelectorAll('.tickets__list.__module-tickets__tickets-list__tickets-table__ticket-item')
            .forEach(card => {
                const main = card.querySelector('[data-test-ticket-content]');
                if (!main) return;

                main.classList.remove(
                    'ticket-priority-border',
                    'ticket-due-soon-border',
                    'ticket-due-today-border',
                    'ticket-new-border'
                );

                // JS only announces the state; CSS does all the styling.
                // Keep the last known status if the control is mid-render, so the
                // card doesn't flash back to its default colour.
                const status = detectStatus(card) || card.getAttribute('data-status');
                if (status) card.setAttribute('data-status', status);
                card.setAttribute('data-style-mode', styleMode);

                const tags = [...main.querySelectorAll('span.tag,span[class^="tag--"],.list-item')]
                    .map(el => el.textContent.trim());

                main.classList.toggle(
                    'ticket-new-border',
                    status === 'Open' && isUrgent(main.textContent, tags.join(' ').toLowerCase())
                );
                applyEscState(card, tags);
            });
    }

    // ============================
    // Paste sanitisation
    // ============================
    // Pasted content keeps bold, italics, underline, links, lists, tables, line
    // breaks and paragraphs, and nothing else. Headings become plain paragraphs;
    // colour, font family, font size and anything else that resizes or restyles
    // text is dropped. Elements, attributes and inline properties are all
    // allow-listed, so a format we haven't thought of can't slip through. Only the
    // clipboard runs through here, so the toolbar's own font controls are unaffected.
    //
    // Executable and interactive nodes are removed with their contents so their
    // guts can't surface as text, and URLs are protocol checked. The handler sits
    // on window in capture, the only place that beats Froala's own paste handler,
    // and execCommand is still the insertion path that keeps native undo.
    const LINK_PROTOCOLS  = /^(?:https?:|mailto:|tel:|#)/i;
    const IMAGE_PROTOCOLS = /^(?:https?:|cid:|data:image\/)/i;

    const DROP_SELECTOR = 'script,style,link,meta,title,base,noscript,iframe,frame,frameset,'
        + 'object,embed,applet,form,input,button,select,textarea,option';

    // Any other tag is unwrapped: the element goes, its text stays. Table
    // internals are listed because dropping them would collapse the table.
    const KEEP_ELEMENTS = new Set([
        'p', 'div', 'br', 'span', 'b', 'strong', 'i', 'em', 'u', 'a',
        'ul', 'ol', 'li', 'pre', 'code', 'img',
        'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption'
    ]);
    const KEEP_ATTRIBUTES = new Set(['href', 'src', 'alt', 'title', 'colspan', 'rowspan', 'start', 'style']);

    // border-collapse and friends are needed for tables; the lookahead keeps border
    // colours and border-image out. Everything unlisted goes, custom properties
    // included, since var() can smuggle a colour in.
    const KEEP_STYLE = /^(?:font-weight|font-style|text-align|vertical-align|list-style-type|text-decoration(?:-line|-style|-thickness)?|border(?!.*(?:color|image))[\w-]*)$/;

    // Shorthands that can carry a colour. The matching colour longhand is appended
    // as currentcolor, which wins over the shorthand, so the border survives and
    // its colour follows the theme.
    const COLOUR_SHORTHANDS = new Set([
        'border', 'border-top', 'border-right', 'border-bottom', 'border-left',
        'border-block', 'border-block-start', 'border-block-end',
        'border-inline', 'border-inline-start', 'border-inline-end',
        'text-decoration'
    ]);

    // Pull weight and italic out of a `font` shorthand before it is discarded.
    function preserveFontTraits(style, value) {
        const raw = String(value).toLowerCase();
        if (/\b(?:italic|oblique)\b/.test(raw)) style.setProperty('font-style', 'italic');
        if (/\bbold(?:er)?\b/.test(raw)) return style.setProperty('font-weight', 'bold');
        const weight = raw.match(/(?:^|\s)([1-9]00)(?:\s|\/|$)/);
        if (weight && parseInt(weight[1], 10) >= 600) style.setProperty('font-weight', 'bold');
    }

    // Reading through element.style means the browser has already expanded and
    // normalised shorthands, so no hand-rolled CSS parser is needed.
    function stripPastedStyle(el) {
        if (!el.hasAttribute('style')) return;
        const style = el.style;

        Array.from(style).forEach(name => {
            const prop = name.toLowerCase();
            if (prop === 'font') preserveFontTraits(style, style.getPropertyValue(name));
            if (!KEEP_STYLE.test(prop)) style.removeProperty(name);
            else if (COLOUR_SHORTHANDS.has(prop)) {
                style.setProperty(prop + '-color', 'currentcolor', style.getPropertyPriority(name));
            }
        });

        if (!style.length) el.removeAttribute('style');
    }

    function sanitizeElement(el) {
        // Snapshot first: removing while iterating a live NamedNodeMap skips entries.
        [...el.attributes].forEach(attr => {
            const name = attr.name.toLowerCase();
            if (!KEEP_ATTRIBUTES.has(name)) return el.removeAttribute(attr.name);
            const protocols = name === 'href' ? LINK_PROTOCOLS : name === 'src' ? IMAGE_PROTOCOLS : null;
            if (protocols && !protocols.test((attr.value || '').trim())) el.removeAttribute(attr.name);
        });
        stripPastedStyle(el);
    }

    // Headings, <big>, <small> and <font> carry their size in the tag name, so
    // nothing but unwrapping removes it. Headings keep their paragraph break;
    // the rest are unwrapped innermost first, so nesting collapses in one pass.
    function pruneElements(body) {
        body.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(heading => {
            const paragraph = body.ownerDocument.createElement('p');
            paragraph.append(...heading.childNodes);
            heading.replaceWith(paragraph);
        });
        [...body.querySelectorAll('*')].reverse().forEach(el => {
            if (!KEEP_ELEMENTS.has(el.localName)) el.replaceWith(...el.childNodes);
        });
    }

    function sanitizeClipboardHtml(html) {
        // DOMParser neither loads images nor runs scripts, so this is a safe tree.
        const body = new DOMParser().parseFromString(html, 'text/html').body;
        if (!body) return '';

        body.querySelectorAll(DROP_SELECTOR).forEach(el => el.remove());

        // Word and Outlook wrap blocks in conditional comments; drop the lot.
        const walker = body.ownerDocument.createTreeWalker(body, NodeFilter.SHOW_COMMENT);
        const comments = [];
        while (walker.nextNode()) comments.push(walker.currentNode);
        comments.forEach(node => node.remove());

        pruneElements(body);
        body.querySelectorAll('*').forEach(sanitizeElement);

        return body.innerHTML.trim();
    }

    function handleEditorPaste(event) {
        const target = event.target;
        if (!(target instanceof Element) || !target.closest('.fr-element[contenteditable="true"]')) return;

        const clipboard = event.clipboardData || window.clipboardData;
        if (!clipboard) return;

        const html = clipboard.getData('text/html');
        const text = clipboard.getData('text/plain');
        if (!html && !text) return; // image or other non-text content, let Froala have it

        event.preventDefault();
        event.stopImmediatePropagation();

        const clean = html && sanitizeClipboardHtml(html);
        if (clean) document.execCommand('insertHTML', false, clean);
        else document.execCommand('insertText', false, text);
    }

    // ============================
    // Editor toolbar
    // ============================
    // Freshdesk loads far more Froala plugins than it exposes buttons for, so the
    // additions are built from Froala's own registry rather than reimplemented:
    // icon, tooltip, shortcut, dropdown, popup and disabled state all arrive with
    // the markup. Keys are the data-cmd of an existing button; the listed commands
    // are inserted directly after it.
    const TOOLBAR_ADDITIONS = {
        underline:   ['strikeThrough', 'subscript', 'superscript'],
        h2:          ['fontFamily', 'fontSize'],
        formatUL:    ['quote'],
        insertImage: ['insertVideo'],
        insertTable: ['insertHR', 'specialCharacters']
    };

    // Floated right, so it stays last however wide the rest of the toolbar gets.
    const TOOLBAR_TRAILING = ['html'];

    // Froala's stock icons carry class fr-svg on a 24 viewBox, Freshdesk's carry
    // app-icon on a 16 one. A viewBox scales to whatever the class sizes the box at,
    // so swapping the class is all it takes for the two sets to match.
    function buildButtons(inst, commands) {
        return inst.button.buildList(commands).replace(/\bfr-svg\b/g, 'app-icon app-icon--small');
    }

    // The overflow panel's padding is baked in at init from its button's position,
    // so adding buttons to the left of that button leaves the two detached.
    function alignMorePanels(toolbar) {
        if (!toolbar.offsetParent) return;
        const left = toolbar.getBoundingClientRect().left;
        toolbar.querySelectorAll('.fr-more-toolbar[data-name]').forEach(panel => {
            const button = document.getElementById(panel.dataset.name);
            if (button) panel.style.paddingLeft = (button.getBoundingClientRect().left - left) + 'px';
        });
    }

    // buildList returns each button together with its dropdown menu as a sibling,
    // so the whole string goes in as one insertion and the two stay adjacent.
    function extendToolbar(inst, toolbar) {
        Object.entries(TOOLBAR_ADDITIONS).forEach(([cmd, commands]) => {
            const anchor = toolbar.querySelector(`.fr-btn-grp [data-cmd="${cmd}"]`);
            if (anchor) anchor.insertAdjacentHTML('afterend', buildButtons(inst, commands));
        });

        const group = document.createElement('div');
        group.className = 'fr-btn-grp fr-float-right';
        group.innerHTML = buildButtons(inst, TOOLBAR_TRAILING);
        toolbar.appendChild(group);
    }

    // Reply, note and forward each get their own editor and their own instance
    // number, so the guard lives on the toolbar element rather than on any id.
    // Commands are delegated from the toolbar, so injected buttons wire themselves.
    function setupEditorToolbars() {
        const instances = window.FroalaEditor?.INSTANCES;
        if (!instances) return;

        instances.forEach(inst => {
            const toolbar = inst.$tb?.[0] || inst.$tb?.get?.(0)
                || document.getElementById('bold-' + inst.id)?.closest('.fr-toolbar');
            if (!toolbar) return;
            if (!toolbar.dataset.fdExtended) {
                toolbar.dataset.fdExtended = '1';
                extendToolbar(inst, toolbar);
            }
            alignMorePanels(toolbar);
        });
    }

    // ============================
    // Top-nav controls
    // ============================
    function setupDropdown() {
        // The top nav lives in a shadow root, so document lookups won't find the button.
        const root = document.querySelector('ticket-top-nav')?.shadowRoot;
        if (!root || root.getElementById('style-select-btn')) return;
        const target = root.querySelector('[data-testid="right-section"]');
        if (!target) return;

        const shadowStyle = document.createElement('style');
        shadowStyle.textContent = dropdownCss;
        root.appendChild(shadowStyle);

        const wrapper = document.createElement('div');
        wrapper.className = 'fd-style-dropdown';

        const button = document.createElement('button');
        button.id = 'style-select-btn';
        button.type = 'button';
        button.className = 'fd-style-dropdown-btn';
        button.textContent = 'Style: ' + label(styleMode);

        const menu = document.createElement('div');
        menu.className = 'fd-style-dropdown-content';

        STYLE_MODES.forEach(mode => {
            const link = document.createElement('a');
            link.href = '#';
            link.textContent = label(mode);
            link.onclick = event => {
                event.preventDefault();
                event.stopPropagation();
                styleMode = mode;
                localStorage.setItem(STORAGE_KEY, mode);
                button.textContent = 'Style: ' + label(mode);
                menu.classList.remove('show-dropdown');
                applyCardStyles();
            };
            menu.appendChild(link);
        });

        button.onclick = event => {
            event.stopPropagation();
            menu.classList.toggle('show-dropdown');
        };
        // Shadow-root clicks retarget to the host, so any document click is an outside click.
        document.addEventListener('click', () => menu.classList.remove('show-dropdown'));

        wrapper.append(button, menu);
        target.appendChild(wrapper);

        // Reuses the dropdown wrapper for its spacing and the narrow-window hide
        // rule; there is no menu here, the button flips the class directly.
        const tagsWrapper = document.createElement('div');
        tagsWrapper.className = 'fd-style-dropdown';

        const tagsButton = document.createElement('button');
        tagsButton.id = 'tags-toggle-btn';
        tagsButton.type = 'button';
        tagsButton.className = 'fd-style-dropdown-btn';
        tagsButton.textContent = 'Tags: ' + (showTags ? 'On' : 'Off');
        tagsButton.onclick = event => {
            event.stopPropagation();
            showTags = !showTags;
            localStorage.setItem(TAGS_KEY, showTags);
            applyTagState();
            tagsButton.textContent = 'Tags: ' + (showTags ? 'On' : 'Off');
        };

        tagsWrapper.appendChild(tagsButton);
        target.appendChild(tagsWrapper);
    }

    // ============================
    // Observers and initialisation
    // ============================
    // Debounced so an Ember re-render's flurry of mutations collapses into one pass.
    let debounceTimer = null;
    new MutationObserver(() => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(refresh, 150);
    }).observe(document.body, { childList: true, subtree: true });

    // Theme toggles can happen with no DOM changes at all, hence the second observer.
    const themeObserver = new MutationObserver(syncTheme);
    const themeOptions = { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] };
    themeObserver.observe(document.documentElement, themeOptions);
    themeObserver.observe(document.body, themeOptions);
    window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', syncTheme);

    // Toolbar work goes last: it leans on a third-party registry, so a change there
    // can't take the card styling down with it.
    function refresh() {
        syncTheme();
        applyTagState();
        applyCardStyles();
        setupDropdown();
        normalizeEmailBackgrounds();
        setupEditorToolbars();
    }

    window.addEventListener('paste', handleEditorPaste, true);
    refresh();
})();
