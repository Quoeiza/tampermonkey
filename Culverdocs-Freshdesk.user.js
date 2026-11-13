// ==UserScript==
// @name         Culverdocs-Freshdesk
// @namespace    http://culverdocs.co.uk/
// @version      3.0
// @description  QoL improvements for the Freshdesk ticket list and editor. Status colours, urgency stripe, deadline chips, ownership and unassigned highlighting, quietened waiting tickets, status group headers, tag badges, summary counts with focus filters, density and subtle motion, all adjustable from a Customise panel. Auto-adapts to Freshdesk's light and dark themes. Pasted or dropped content can never bring colour into the editor; paste also drops font family and font size. Editor toolbar is extended with the Froala commands Freshdesk loads but never exposes.
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
    // Settings
    // ============================
    // Everything the Customise panel controls lives in one object, saved to
    // localStorage so it survives closing the browser.
    const SETTINGS_KEY = 'fd_customise';
    const STATUSES     = ['Open', 'Pending', 'On Hold', 'Resolved', 'Closed'];
    const CARD_STYLES  = { gradient: 'Gradient', fill: 'Fill', none: 'None' };
    const DENSITIES    = { comfortable: 'Comfortable', compact: 'Compact' };

    const DEFAULTS = {
        cardStyle:       'none',
        density:         'comfortable',
        groupHeaders:    true,
        showTags:        false,
        urgentStripe:    true,
        deadlineChips:   true,
        customerReplies: true,
        highlightMine:   true,
        flagUnassigned:  true,
        quietWaiting:    true,
        keyboardRing:    true,
        summary:         true,
        tagBadges:       true,
        badgeMap:        'L1-ESC = ⚠️\nL2-ESC = 🚨',
        motionHover:     true,
        motionArrivals:  true,
        motionStatus:    true,
        motionPulse:     true
    };
    const CHOICES = { cardStyle: CARD_STYLES, density: DENSITIES };

    // Saved values are only trusted when they match the default's type (or one of
    // the listed choices), so a corrupt or outdated entry falls back cleanly.
    function loadSettings() {
        let saved = {};
        try { saved = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch { saved = {}; }

        // One-off carry-over from the separate Style and Tags keys used up to 2.18;
        // a numeric style value is older still and maps by index.
        if (!localStorage.getItem(SETTINGS_KEY)) {
            const style = localStorage.getItem('fd_card_style_mode');
            const legacy = Object.keys(CARD_STYLES)[style] || style;
            if (legacy in CARD_STYLES) saved.cardStyle = legacy;
            if (localStorage.getItem('fd_show_tags') === 'true') saved.showTags = true;
        }

        const merged = { ...DEFAULTS };
        Object.keys(DEFAULTS).forEach(key => {
            const value = saved[key];
            if (CHOICES[key] ? value in CHOICES[key] : typeof value === typeof DEFAULTS[key]) merged[key] = value;
        });
        return merged;
    }

    const settings = loadSettings();

    function saveSettings() {
        try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* private mode */ }
    }

    // Lines of "tag = badge"; the last "=" splits, so a tag may contain one.
    function parseBadgeMap(text) {
        return String(text).split('\n').map(line => {
            const at = line.lastIndexOf('=');
            return at > 0 ? { tag: line.slice(0, at).trim().toLowerCase(), badge: line.slice(at + 1).trim() } : null;
        }).filter(rule => rule && rule.tag && rule.badge);
    }

    let badgeRules = [];
    const kebab = key => key.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase());

    // Feature switches are classes on <html>, so CSS covers every card at once,
    // cards rendered later need no follow-up work, and a toggle is instant.
    function applySettings() {
        const html = document.documentElement;
        Object.keys(DEFAULTS).forEach(key => {
            if (typeof DEFAULTS[key] === 'boolean') html.classList.toggle('fd-' + kebab(key), settings[key]);
        });
        html.dataset.fdCardStyle = settings.cardStyle;
        html.dataset.fdDensity = settings.density;
        if (!settings.summary) delete html.dataset.fdFocus;
        badgeRules = parseBadgeMap(settings.badgeMap);
    }

    // ============================
    // CSS injection
    // ============================
    // All theming runs through CSS custom properties, so the JS only ever writes
    // data-* attributes and <html> classes and lets CSS decide what they look like.
    // Cards are found through Freshdesk's data-test-* hooks wherever one exists:
    // their own automated tests depend on those, so they outlast class names.
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
    --fd-card-shadow-hover:  2px 7px 14px 0 #c3ccd6;
    --fd-text-title:         #19334c;
    --fd-text-info:          #6f7c87;
    --fd-text-ticket-id:     #778393;
    --fd-priority-border:    #f22;
    --fd-accent:             #2c66d1;
    --fd-accent-bg:          #e4edfc;
    --fd-accent-text:        #1f4fa8;
    --fd-warn-bg:            #fff0d4;
    --fd-warn-text:          #8a5300;
    --fd-danger-bg:          #fde3e1;
    --fd-danger-text:        #a3262a;
    --fd-btn-bg:             #f8f9fa;
    --fd-btn-bg-hover:       #e9ecef;
    --fd-btn-border:         #d7dbe3;
    --fd-btn-text:           #375e6b;
    --fd-menu-bg:            #fff;
    --fd-menu-text:          #19334c;
    --fd-menu-hover:         #f0f0f0;
    --fd-menu-shadow:        0 8px 24px 0 rgba(0,0,0,.18);
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
    --fd-card-shadow-hover:  2px 7px 16px 0 rgba(0,0,0,.7);
    --fd-text-title:         #e8edf3;
    --fd-text-info:          #b4bcc6;
    --fd-text-ticket-id:     #98a3b0;
    --fd-priority-border:    #ff5a5a;
    --fd-accent:             #6ea8ff;
    --fd-accent-bg:          #1c3150;
    --fd-accent-text:        #b3cdff;
    --fd-warn-bg:            #4a3810;
    --fd-warn-text:          #f6c76e;
    --fd-danger-bg:          #561f1f;
    --fd-danger-text:        #ffb4ae;
    --fd-btn-bg:             #262626;
    --fd-btn-bg-hover:       #333333;
    --fd-btn-border:         #3a3a3a;
    --fd-btn-text:           #d0d0d0;
    --fd-menu-bg:            #222222;
    --fd-menu-text:          #e8edf3;
    --fd-menu-hover:         #333333;
    --fd-menu-shadow:        0 8px 24px 0 rgba(0,0,0,.6);
}

/* Layout overrides for the ticket list page. The grid classes are scoped to the
   cards, since the ticket page matches this script too. */
.tickets__list .col-md-12 { padding-left: 0; padding-right: 0; }
.tickets__list .col-md-9 { width: auto; }
.left-nav-mfe-wrapper, .left-nav-mfe { width: 240px !important; }
.ember-light-table table { border-collapse: separate; }
.hidden-overdue-badge, .avatar-image { display: none !important; }
.avatar-icon.avatar-icon--rounded .avatar-block { margin-left: 9px; }
.current__item--active td:first-child::before { width: 0; }
.__module-tickets__assign-to .element-flex > div:first-child { display: none; }
.app-content-area, body { min-width: 958px; }

/* Re-balance Freshdesk's hard-coded column widths (table view). Scoped to the
   list so the attribute match can't catch anything else on the page. */
.ember-light-table [style*="width: 400px"] { width: 120px !important; }
.ember-light-table [style*="width: 120px"] { width: 200px !important; }
.ember-light-table [style*="width: 12vw"]  { width: 80px !important; }

/* Card chrome. --fd-status-bg is registered as a colour so it can be animated. */
@property --fd-status-bg { syntax: '<color>'; inherits: false; initial-value: transparent; }
.tickets__list {
    --fd-status-bg: var(--fd-card-bg);
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
    transition: opacity .2s, filter .2s, box-shadow .15s ease-out, transform .15s ease-out,
                --fd-status-bg var(--fd-status-fade, 0s) ease;
}

/* data-status picks the colour, the Status colour setting decides how it is applied. */
.tickets__list[data-status="Open"]     { --fd-status-bg: var(--fd-status-open); }
.tickets__list[data-status="Pending"]  { --fd-status-bg: var(--fd-status-pending); }
.tickets__list[data-status="On Hold"]  { --fd-status-bg: var(--fd-status-on-hold); }
.tickets__list[data-status="Resolved"] { --fd-status-bg: var(--fd-status-resolved); }
.tickets__list[data-status="Closed"]   { --fd-status-bg: var(--fd-status-closed); }

html[data-fd-card-style="gradient"] .tickets__list {
    background: linear-gradient(90deg, var(--fd-status-bg) 0, var(--fd-gradient-fade) 800px) !important;
}
html[data-fd-card-style="fill"] .tickets__list { background: var(--fd-status-bg) !important; }
html[data-fd-card-style="none"] .tickets__list { background: var(--fd-card-bg) !important; }

/* Card content layout */
.tickets__list .list-content { padding-left: 0 !important; padding-top: 0; padding-bottom: 0; }
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

/* Compact density: tighter cards so more of the list fits on screen. */
html[data-fd-density="compact"] .tickets__list { min-height: 0; margin-bottom: 6px !important; }
html[data-fd-density="compact"] .list-content-wrap { padding: 8px 12px; }
html[data-fd-density="compact"] .wordbreak-fix { font-size: 15px; }
html[data-fd-density="compact"] .ticket-info { padding-top: 2px; font-size: 13px; }
html[data-fd-density="compact"] .tickets__list .ticket-title-row .muted[data-test-ticket-id] { font-size: 13px; }

/* Freshdesk's own coloured left borders are replaced by the stripe below. */
.ticket-due-soon-border,
.ticket-due-today-border,
.ticket-priority-border,
.ticket-new-border { border-left: none !important; }

/* Urgent stripe, drawn by the card itself so its overflow keeps the radius. */
html.fd-urgent-stripe .tickets__list[data-fd-urgent]::before {
    content: "";
    position: absolute;
    top: 0; bottom: 0; left: 0;
    width: 6px;
    background: var(--fd-priority-border);
    z-index: 1;
}

/* Freshdesk's tag rows, shown or hidden by the Customise panel. */
html:not(.fd-show-tags) .tickets__list .ticket-tag-wrap,
html:not(.fd-show-tags) .tickets__list .status-tag-wrap,
html:not(.fd-show-tags) .ticket-tag-toprow,
html:not(.fd-show-tags) .ticket-tag-toprow > .tag,
html:not(.fd-show-tags) .ticket-tag-toprow > span[class^="tag--"],
html:not(.fd-show-tags) .ticket-tag-toprow > .ticket-ribbon { display: none !important; }

/* Tag badges, written by the script from the badge list in the panel. */
html.fd-tag-badges .ticket-info[data-fd-badges]::before {
    content: attr(data-fd-badges);
    display: inline-block;
    margin-right: 4px;
    font-size: 13px;
    vertical-align: text-top;
    white-space: nowrap;
}

/* Status group headers, drawn on the list cell so no node is added to the list.
   Freshdesk uses this same pseudo-element for its selected-row marker (hidden
   above), so the header pins its own layout. */
html.fd-group-headers td[data-fd-group]::before {
    content: attr(data-fd-group) !important;
    display: block !important;
    position: static !important;
    width: auto !important;
    height: auto !important;
    background: none !important;
    margin: 18px 6px 7px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: .03em;
    color: var(--fd-text-ticket-id);
}
html.fd-group-headers tr:first-child > td[data-fd-group]::before { margin-top: 2px; }

/* Deadline chips. The SLA line is plain text nodes, so it is redrawn from two
   attributes rather than restyled; no attributes means the original shows. */
html.fd-deadline-chips [data-fd-deadline] { font-size: 0 !important; }
html.fd-deadline-chips [data-fd-deadline] > svg { display: none !important; }
html.fd-deadline-chips [data-fd-deadline]::before { content: attr(data-fd-activity); font-size: 14px; }
html.fd-deadline-chips [data-fd-deadline]::after {
    content: attr(data-fd-deadline);
    display: inline-block;
    margin-left: 8px;
    padding: 0 8px;
    border: 1px solid var(--fd-btn-border);
    border-radius: 999px;
    font-size: 12px;
    font-weight: 400;
    line-height: 19px;
    vertical-align: 1px;
    color: var(--fd-text-info);
}
html.fd-deadline-chips [data-fd-tone="overdue"]::after {
    background: var(--fd-danger-bg); color: var(--fd-danger-text); border-color: transparent; font-weight: 500;
}
html.fd-deadline-chips [data-fd-tone="soon"]::after {
    background: var(--fd-warn-bg); color: var(--fd-warn-text); border-color: transparent; font-weight: 500;
}
html.fd-deadline-chips [data-fd-tone="state"]::after {
    content: "·  " attr(data-fd-deadline); border-color: transparent; padding: 0;
}
html[data-fd-density="compact"].fd-deadline-chips [data-fd-deadline]::before { font-size: 13px; }

/* Ball in our court: the customer replied last. */
html.fd-customer-replies .tickets__list[data-fd-turn="customer"] [data-test-id="sla-status-text"] {
    color: var(--fd-warn-text) !important;
    font-weight: 500;
}

/* Ownership. The assignee keeps Freshdesk's own text, shown as a pill. */
html.fd-highlight-mine .tickets__list[data-fd-mine] {
    box-shadow: var(--fd-card-shadow), inset 0 0 0 2px var(--fd-accent);
}
html.fd-highlight-mine [data-fd-kind="mine"],
html.fd-flag-unassigned [data-fd-kind="unassigned"] {
    display: inline-block;
    width: auto;
    padding: 0 8px;
    border-radius: 999px;
    font-weight: 500;
    line-height: 20px;
}
html.fd-highlight-mine [data-fd-kind="mine"] { background: var(--fd-accent-bg) !important; color: var(--fd-accent-text) !important; }
html.fd-flag-unassigned [data-fd-kind="unassigned"] { background: var(--fd-warn-bg) !important; color: var(--fd-warn-text) !important; }
html.fd-flag-unassigned .tickets__list[data-fd-unassigned] { outline: 1.5px dashed var(--fd-warn-text); outline-offset: -1.5px; }

/* Waiting on the customer, with nothing for us to do: step back until hovered. */
html.fd-quiet-waiting .tickets__list:is([data-status="Pending"], [data-status="On Hold"])[data-fd-turn="agent"]:not(:hover) {
    opacity: .62;
    filter: saturate(.55);
}

/* Focus filters from the summary counts dim everything that doesn't match. */
html[data-fd-focus="overdue"] .tickets__list:not([data-fd-sla="overdue"]),
html[data-fd-focus="reply"] .tickets__list:not([data-fd-reply]),
html[data-fd-focus="mine"] .tickets__list:not([data-fd-mine]),
html[data-fd-focus="unassigned"] .tickets__list:not([data-fd-unassigned]) {
    opacity: .25 !important;
    filter: saturate(.3) !important;
}

/* J/K selection ring, shown only once the keyboard is in use. */
html.fd-keyboard-ring.fd-kbd .current__item--active .tickets__list {
    outline: 2px solid var(--fd-accent);
    outline-offset: 2px;
}

/* Motion. Everything here is transform, opacity or colour, and all of it is off
   for anyone whose system asks for reduced motion. */
html.fd-motion-status { --fd-status-fade: .5s; }
html.fd-motion-hover .tickets__list:hover {
    transform: translateY(-1px);
    box-shadow: var(--fd-card-shadow-hover);
}
html.fd-motion-hover.fd-highlight-mine .tickets__list[data-fd-mine]:hover {
    box-shadow: var(--fd-card-shadow-hover), inset 0 0 0 2px var(--fd-accent);
}
@keyframes fd-arrive { from { opacity: .45; } to { opacity: 0; } }
html.fd-motion-arrivals .tickets__list[data-fd-arrived]::after {
    content: "";
    position: absolute;
    inset: 0;
    z-index: 2;
    pointer-events: none;
    background: var(--fd-accent);
    opacity: 0;
    animation: fd-arrive 1.8s ease-out;
}
@keyframes fd-pulse { 50% { opacity: .3; } }
html.fd-motion-pulse .tickets__list[data-fd-urgent][data-fd-sla="overdue"]::before {
    animation: fd-pulse 2.4s ease-in-out 3;
}
@media (prefers-reduced-motion: reduce) {
    .tickets__list, .tickets__list::before, .tickets__list::after {
        transition: none !important;
        animation: none !important;
    }
    .tickets__list:hover { transform: none !important; }
}

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
   tables, both unreadable on a dark card. Scoped to conversation content.
   The editor box shares .ticket-note-typography and is excluded: Freshdesk
   already corrects its colours, and an override there hides real colours from
   the agent and gets inlined into the reply by Chrome when it merges blocks. */
html.fd-dark .ticket-details__conversation__content,
html.fd-dark .ticket-details__conversation__content *,
html.fd-dark .ticket-note-typography:not(.fr-box),
html.fd-dark .ticket-note-typography:not(.fr-box) * { color: var(--fd-text-info) !important; }
html.fd-dark .ticket-details__conversation__content a,
html.fd-dark .ticket-note-typography:not(.fr-box) a { color: #6ea8ff !important; }

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
    .tickets__list .list-content--info { display: none; }
}
`;

    // Injected into the top-nav shadow root. Custom properties inherit through
    // the shadow boundary, so theming needs no wiring.
    const toolbarCss = `
#ticket-top-nav, .root-app,
[data-testid="top-navigation-container"],
[data-testid="right-section"] { overflow: visible !important; }
.fd-toolbar {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-right: 10px;
    vertical-align: middle;
}
.fd-pill {
    font: inherit;
    font-size: 12px;
    font-weight: 500;
    line-height: 22px;
    padding: 0 10px;
    border-radius: 999px;
    border: 1px solid var(--fd-btn-border, #d7dbe3);
    background: var(--fd-btn-bg, #f8f9fa);
    color: var(--fd-btn-text, #375e6b);
    cursor: pointer;
    white-space: nowrap;
    transition: box-shadow .15s, filter .15s;
}
.fd-pill:hover { filter: brightness(1.08); }
.fd-pill[hidden] { display: none; }
.fd-pill[data-tone="overdue"] { background: var(--fd-danger-bg); color: var(--fd-danger-text); border-color: transparent; }
.fd-pill[data-tone="reply"]   { background: var(--fd-warn-bg); color: var(--fd-warn-text); border-color: transparent; }
.fd-pill[data-tone="mine"]    { background: var(--fd-accent-bg); color: var(--fd-accent-text); border-color: transparent; }
.fd-pill[aria-pressed="true"] { box-shadow: 0 0 0 2px var(--fd-accent); }
.fd-btn {
    font-size: 13px;
    font-weight: 500;
    background: var(--fd-btn-bg, #f8f9fa);
    border: 1px solid var(--fd-btn-border, #d7dbe3);
    color: var(--fd-btn-text, #375e6b);
    padding: 2px 14px;
    height: 30px;
    cursor: pointer;
    border-radius: 4px;
    transition: background .18s, color .18s, border-color .18s;
}
.fd-btn:hover, .fd-btn[aria-expanded="true"] { background: var(--fd-btn-bg-hover, #e9ecef); }
.fd-panel {
    display: none;
    position: fixed;
    z-index: 99999;
    width: 330px;
    overflow: auto;
    box-sizing: border-box;
    padding: 12px 16px 10px;
    background: var(--fd-menu-bg, #fff);
    color: var(--fd-menu-text, #19334c);
    border: 1px solid var(--fd-btn-border, #d7dbe3);
    border-radius: 8px;
    box-shadow: var(--fd-menu-shadow);
    font-size: 13px;
    line-height: 1.4;
    text-align: left;
}
.fd-panel.open { display: block; }
.fd-panel h3 {
    margin: 14px 0 4px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: .05em;
    color: var(--fd-text-info);
}
.fd-panel h3:first-child { margin-top: 0; }
.fd-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 4px 0;
}
label.fd-row { cursor: pointer; }
.fd-switch {
    appearance: none;
    flex: none;
    position: relative;
    width: 30px;
    height: 17px;
    margin: 0;
    border-radius: 999px;
    background: var(--fd-btn-border);
    cursor: pointer;
    transition: background .15s;
}
.fd-switch::after {
    content: "";
    position: absolute;
    top: 2px; left: 2px;
    width: 13px; height: 13px;
    border-radius: 50%;
    background: #fff;
    transition: transform .15s;
}
.fd-switch:checked { background: var(--fd-accent); }
.fd-switch:checked::after { transform: translateX(13px); }
.fd-switch:focus-visible, .fd-seg button:focus-visible { outline: 2px solid var(--fd-accent); outline-offset: 2px; }
.fd-seg { display: inline-flex; flex: none; border: 1px solid var(--fd-btn-border); border-radius: 6px; overflow: hidden; }
.fd-seg button {
    font: inherit;
    font-size: 12px;
    padding: 3px 9px;
    border: 0;
    background: transparent;
    color: var(--fd-menu-text);
    cursor: pointer;
}
.fd-seg button + button { border-left: 1px solid var(--fd-btn-border); }
.fd-seg button[aria-pressed="true"] { background: var(--fd-accent); color: #fff; }
.fd-panel textarea {
    display: block;
    width: 100%;
    min-height: 62px;
    margin: 4px 0 2px;
    box-sizing: border-box;
    padding: 6px 8px;
    font: 12px/1.5 ui-monospace, Consolas, monospace;
    background: var(--fd-btn-bg);
    color: var(--fd-menu-text);
    border: 1px solid var(--fd-btn-border);
    border-radius: 6px;
    resize: vertical;
}
.fd-hint { color: var(--fd-text-info); font-size: 11px; }
.fd-panel footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px solid var(--fd-btn-border);
}
.fd-link { font: inherit; font-size: 12px; padding: 0; border: 0; background: none; color: var(--fd-accent); cursor: pointer; white-space: nowrap; }
@media (prefers-reduced-motion: reduce) {
    .fd-switch, .fd-switch::after, .fd-pill, .fd-btn { transition: none; }
}
@media (max-width: 1280px) { .fd-pill { display: none; } }
`;

    const styleElement = document.createElement('style');
    styleElement.id = 'fd-userstyle';
    styleElement.textContent = css;
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
    const EMAIL_BG_SELECTOR = ['.ticket-details__conversation__content', '.ticket-note-typography:not(.fr-box)']
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
    const STATUS_SELECTOR = '[data-test-id="status-before-hover"], [data-test-id="status-hover"], .list-filter__status';

    function detectStatus(card) {
        const text = card.querySelector(STATUS_SELECTOR)?.textContent.trim();
        return text ? STATUSES.find(status => text.startsWith(status)) : null;
    }

    // Word boundaries throughout: without them "a" plus "d", "h" or "m" matches
    // inside words like "and" or "Ahmed", "due" matches inside "overdue", "m"
    // matches "months", and a "Renewal" tag reads as "new". The overdue amount
    // must follow within one word ("Overdue by 2 days"), so the hidden badge
    // can't pair with an unrelated figure further along the card.
    const AMOUNT  = String.raw`\b(\d+|an?)\s*(days?|hours?|hrs?|minutes?|mins?|d|h|m)\b`;
    const OVERDUE = new RegExp(String.raw`\boverdue\b(?:\W+[a-z]+)??\W*` + AMOUNT);
    const DUE_IN  = new RegExp(String.raw`\bdue\b.*?\bin\b.*?` + AMOUNT);

    // Due within four hours, or within a day when the window is counted in days.
    function dueSoon(lower) {
        const due = lower.match(DUE_IN);
        if (!due) return false;
        const value = due[1].startsWith('a') ? 1 : parseInt(due[1], 10);
        const unit  = due[2][0];
        return unit === 'm' || (unit === 'h' && value <= 4) || (unit === 'd' && value === 1);
    }

    function isUrgent(text, tagsLower) {
        const lower = text.toLowerCase();
        if (/\bnew\b/.test(tagsLower)) return true;
        if (OVERDUE.test(lower) || dueSoon(lower)) return true;

        // Recent customer replies only: the window must name minutes or hours and nothing longer.
        const replied = lower.match(/customer responded[\s\S]*?ago/);
        return !!replied
            && /\b(?:mins?|minutes?|hrs?|hours?)\b/.test(replied[0])
            && !/\b(?:days?|weeks?|months?|years?)\b/.test(replied[0]);
    }

    // Writes only on change, so repeated passes don't churn the DOM. True sets an
    // empty attribute; false, null and '' remove it.
    function setAttr(el, name, value) {
        if (value === false || value === null || value === undefined || value === '') {
            if (el.hasAttribute(name)) el.removeAttribute(name);
            return;
        }
        const text = value === true ? '' : String(value);
        if (el.getAttribute(name) !== text) el.setAttribute(name, text);
    }

    // The SLA line is two bare text nodes with icons between them: the last
    // activity ("Agent responded 2 days ago") and the deadline or state
    // ("Resolution overdue by 3 days", "Pending for 3 days").
    function readSla(card) {
        const el = card.querySelector('[data-test-id="sla-status-text"]');
        if (!el) return null;
        const [activity = '', deadline = ''] = [...el.childNodes]
            .filter(node => node.nodeType === Node.TEXT_NODE)
            .map(node => node.data.replace(/\s+/g, ' ').trim())
            .filter(Boolean);
        return { el, activity, deadline };
    }

    function turnOf(activity) {
        if (/^customer responded/i.test(activity)) return 'customer';
        if (/^agent responded/i.test(activity)) return 'agent';
        if (/^created/i.test(activity)) return 'new';
        return '';
    }

    function deadlineTone(text) {
        const lower = text.toLowerCase();
        if (/\boverdue\b/.test(lower)) return 'overdue';
        if (DUE_IN.test(lower)) return dueSoon(lower) ? 'soon' : 'due';
        return text ? 'state' : '';
    }

    // Both halves must parse before the line is redrawn; otherwise the
    // attributes are cleared and Freshdesk's own text shows.
    function annotateDeadline(sla, tone) {
        const complete = !!(sla.activity && sla.deadline);
        setAttr(sla.el, 'data-fd-activity', complete && sla.activity);
        setAttr(sla.el, 'data-fd-deadline', complete && sla.deadline);
        setAttr(sla.el, 'data-fd-tone', complete && tone);
    }

    // The signed-in agent comes from Freshdesk's documented REST API, which
    // accepts the agent's own session. One read per page load, cached for the
    // browser session.
    let myName = sessionStorage.getItem('fd_me');
    let meRequested = false;

    function ensureMe() {
        if (myName || meRequested) return;
        meRequested = true;
        fetch('/api/v2/agents/me', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
            .then(response => (response.ok ? response.json() : null))
            .then(me => {
                const name = me?.contact?.name;
                if (!name) return;
                myName = name;
                sessionStorage.setItem('fd_me', name);
                applyCardStyles();
            })
            .catch(() => { /* ownership features stay off */ });
    }

    // The assignee reads "Group / Agent", with "--" for nobody and long names cut
    // to "Lawrence M...", so a prefix match against the full name is used.
    function annotateAssignee(card) {
        const trigger = card.querySelector('[data-test-id="assign-to-hover"]');
        const label = trigger && [...trigger.querySelectorAll('*')].find(el =>
            [...el.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.data.includes(' / ')));
        const text = label ? label.textContent.replace(/\s+/g, ' ').trim() : '';
        const at = text.lastIndexOf(' / ');
        const agent = at === -1 ? null : text.slice(at + 3).replace(/(?:\.\.\.|…)$/, '').trim();
        const unassigned = agent !== null && /^-*$/.test(agent);
        const mine = !!(agent && !unassigned && myName && agent.length >= 3
            && myName.toLowerCase().startsWith(agent.toLowerCase()));

        setAttr(card, 'data-fd-mine', mine);
        setAttr(card, 'data-fd-unassigned', unassigned);
        if (label) setAttr(label, 'data-fd-kind', mine ? 'mine' : unassigned ? 'unassigned' : null);
    }

    function annotateBadges(card, tags) {
        const info = card.querySelector('.ticket-info');
        if (!info) return;
        const present = new Set(tags.map(tag => tag.toLowerCase()));
        setAttr(info, 'data-fd-badges', badgeRules.filter(rule => present.has(rule.tag)).map(rule => rule.badge).join(''));
    }

    function annotateCard(card, main) {
        main.classList.remove('ticket-priority-border', 'ticket-due-soon-border', 'ticket-due-today-border', 'ticket-new-border');

        // Keep the last known status if the control is mid-render, so the card
        // doesn't flash back to its default colour.
        const status = detectStatus(card) || card.getAttribute('data-status');
        if (status) setAttr(card, 'data-status', status);

        const tags = [...new Set([...main.querySelectorAll('[data-test-list-item], span.tag, span[class^="tag--"], .list-item')]
            .map(el => el.textContent.trim()))];
        const sla  = readSla(card);
        const turn = sla ? turnOf(sla.activity) : '';
        const tone = sla ? deadlineTone(sla.deadline) : '';
        const open = status !== 'Resolved' && status !== 'Closed';

        setAttr(card, 'data-fd-urgent', status === 'Open' && isUrgent(main.textContent, tags.join(' ').toLowerCase()));
        setAttr(card, 'data-fd-turn', turn);
        setAttr(card, 'data-fd-sla', tone);
        setAttr(card, 'data-fd-reply', open && (turn === 'customer' || turn === 'new'));
        if (sla) annotateDeadline(sla, tone);
        annotateAssignee(card);
        annotateBadges(card, tags);
    }

    // Headers only make sense when the list is actually grouped, which is
    // checked from the cards rather than the sort control: every status must
    // form a single unbroken run.
    function markGroups(cards) {
        const runs = [];
        cards.forEach(card => {
            const status = card.getAttribute('data-status') || '';
            const last = runs[runs.length - 1];
            if (last && last.status === status) last.cards.push(card);
            else runs.push({ status, cards: [card] });
        });
        const grouped = runs.length > 1 && runs.every(run => run.status)
            && new Set(runs.map(run => run.status)).size === runs.length;

        runs.forEach(run => run.cards.forEach((card, index) => {
            const cell = card.closest('td') || card.parentElement;
            setAttr(cell, 'data-fd-group', grouped && index === 0 && `${run.status} · ${run.cards.length}`);
        }));
    }

    // Arrivals are tickets that appear in a view after it first rendered. The
    // first pass of each view sets the baseline silently, and a batch of more
    // than three new tickets is a new list (a filter or page change), not an arrival.
    const seenTickets = new Set();
    let viewHref = null;
    let baselinePending = true;

    function flagArrival(card) {
        card.setAttribute('data-fd-arrived', '');
        setTimeout(() => card.removeAttribute('data-fd-arrived'), 2000);
    }

    function trackArrivals(entries) {
        if (location.href !== viewHref) {
            viewHref = location.href;
            seenTickets.clear();
            baselinePending = true;
        }
        const fresh = entries.filter(({ id }) => id && !seenTickets.has(id));
        fresh.forEach(({ id }) => seenTickets.add(id));
        if (baselinePending) baselinePending = !entries.length;
        else if (fresh.length && fresh.length <= 3) fresh.forEach(({ card }) => flagArrival(card));
    }

    function applyCardStyles() {
        if (settings.highlightMine || settings.summary) ensureMe();

        const entries = [];
        document.querySelectorAll('[data-test-ticket-content]').forEach(main => {
            const card = main.closest('.tickets__list');
            if (!card) return;
            annotateCard(card, main);
            entries.push({ card, id: main.getAttribute('data-test-ticket-content') });
        });

        trackArrivals(entries);
        markGroups(entries.map(({ card }) => card));
        updateSummary();
    }

    // Freshdesk's J/K navigation marks the row it is on even before any key is
    // pressed, so the ring only shows once the keyboard is actually in use.
    function trackKeyboard(event) {
        const target = event.target;
        if (event.ctrlKey || event.metaKey || event.altKey || !/^(?:j|k|ArrowUp|ArrowDown)$/.test(event.key)) return;
        if (target.isContentEditable || /^(?:INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
        document.documentElement.classList.add('fd-kbd');
    }

    // ============================
    // Paste sanitisation
    // ============================
    // Pasted content keeps bold, italics, underline, links, lists, tables, images,
    // line breaks and paragraphs, and nothing else. Headings become plain
    // paragraphs; colour, font family, font size and anything else that resizes or
    // restyles text is dropped. Elements, attributes and inline properties are all
    // allow-listed, so a format we haven't thought of can't slip through. Only the
    // clipboard runs through here, so the toolbar's own font controls are unaffected.
    //
    // Executable and interactive nodes are removed with their contents so their
    // guts can't surface as text, and URLs are protocol checked. The handler sits
    // on window in capture, the only place that beats Froala's own paste handler.
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
    // width and height keep a pasted image at its displayed size, not its file size.
    const KEEP_ATTRIBUTES = new Set([
        'href', 'src', 'alt', 'title', 'width', 'height', 'colspan', 'rowspan', 'start', 'style'
    ]);

    // element.style only ever lists longhands, so a border shorthand arrives as
    // separate width, style and colour entries; the lookahead drops the colour and
    // border-image ones and the border follows the text colour. Everything
    // unlisted goes, custom properties included, since var() can smuggle a colour in.
    const KEEP_STYLE = /^(?:font-weight|font-style|text-align|vertical-align|list-style-type|text-decoration(?:-line|-style|-thickness)?|border(?!.*(?:color|image))[\w-]*)$/;

    function stripPastedStyle(el) {
        if (!el.hasAttribute('style')) return;
        const style = el.style;
        Array.from(style).forEach(name => {
            if (!KEEP_STYLE.test(name)) style.removeProperty(name);
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
        // Word's file:// images fail the protocol check and would arrive as broken icons.
        if (el.localName === 'img' && !el.hasAttribute('src')) return el.remove();
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

    // ============================
    // Colour guard
    // ============================
    // A clean fragment isn't enough. When Chrome's insertHTML merges pasted blocks
    // into the paragraph around the caret, it writes the styles CSS was giving
    // them back in as inline styles, so the editor's dark-mode text colour lands
    // in the reply and shows white on white for the customer. Freshdesk's dark
    // mode also rewrites dark inline colours in the editor and parks the originals
    // in data-original-*/data-corrected-* attributes for html.get() to restore.
    // So every element an insertion creates or restyles is scrubbed after it
    // lands, those attributes included.
    const EDITOR      = '.fr-element[contenteditable="true"]';
    const COLOUR_PROP = /color|background|shadow|fill|stroke|filter|border-image/;
    // Colour-named data attributes only: Freshdesk also writes data-original-href
    // on tracked links such as the survey link, and that must survive.
    const COLOUR_ATTR = /^(?:color|bgcolor|background|data-(?:original|corrected)-[\w-]*(?:color|background|bg)[\w-]*)$/;

    function scrubColour(el) {
        [...el.attributes].forEach(attr => {
            if (COLOUR_ATTR.test(attr.name)) el.removeAttribute(attr.name);
        });
        if (!el.style || !el.hasAttribute('style')) return;
        Array.from(el.style).forEach(name => {
            if (COLOUR_PROP.test(name)) el.style.removeProperty(name);
        });
        if (!el.style.length) el.removeAttribute('style');
    }

    // Watches root until the returned finish() runs, then scrubs every element
    // added or restyled in between. Records already handed to the callback are
    // kept as well as the queued ones, since a microtask checkpoint can fall
    // between start and finish.
    function watchInsertion(root) {
        const records = [];
        const observer = new MutationObserver(list => records.push(...list));
        observer.observe(root, {
            childList: true, subtree: true,
            attributes: true, attributeFilter: ['style', 'color', 'bgcolor']
        });
        let done = false;
        return () => {
            if (done) return;
            done = true;
            records.push(...observer.takeRecords());
            observer.disconnect();
            records.forEach(record => {
                if (record.type === 'attributes') return scrubColour(record.target);
                record.addedNodes.forEach(node => {
                    if (node.nodeType !== Node.ELEMENT_NODE) return;
                    scrubColour(node);
                    node.querySelectorAll('*').forEach(scrubColour);
                });
            });
        };
    }

    // Froala saves an undo step, and Freshdesk syncs the draft, on input. The one
    // Chrome fires mid-insertion is held back so neither ever holds the unscrubbed
    // state, and a single input is announced once the result is final.
    let inserting = false;

    function insertScrubbed(root, html, text) {
        // Snapshot the pre-paste state first, as Froala's own paste does, so a
        // single undo returns to it.
        window.FroalaEditor?.INSTANCES?.find(inst => inst.el === root)?.undo?.saveStep();
        const finish = watchInsertion(root);
        inserting = true;
        try {
            if (html) document.execCommand('insertHTML', false, html);
            else document.execCommand('insertText', false, text);
        } finally {
            inserting = false;
            finish();
        }
        root.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }));
    }

    function handleEditorPaste(event) {
        const root = event.target instanceof Element && event.target.closest(EDITOR);
        if (!root || !event.clipboardData) return;

        const html = event.clipboardData.getData('text/html');
        const text = event.clipboardData.getData('text/plain');
        if (!html && !text) return; // image or other non-text content, let Froala have it

        event.preventDefault();
        event.stopImmediatePropagation();
        insertScrubbed(root, html && sanitizeClipboardHtml(html), text);
    }

    // Insertions the browser performs itself (a drop or paste nobody intercepted)
    // sit between beforeinput and input, so they get the same scrub. The timeout
    // closes the watch if the insertion is cancelled and input never comes.
    let finishNative = null;

    function handleBeforeInput(event) {
        if (!event.inputType?.startsWith('insertFrom')) return;
        const root = event.target instanceof Element && event.target.closest(EDITOR);
        if (!root) return;
        finishNative?.();
        finishNative = watchInsertion(root);
        setTimeout(finishNative, 0);
    }

    function handleInput(event) {
        if (inserting) return event.stopImmediatePropagation();
        if (!event.inputType?.startsWith('insertFrom')) return;
        finishNative?.();
        finishNative = null;
    }

    // Froala inserts drops itself, reading the dragged HTML during this dispatch
    // and handling moves and undo. Rather than take that over, the event's
    // getData is swapped so Froala reads the sanitised HTML. (Froala 5.0 also
    // offers cleanup hooks for drops, but 5.5 no longer fires them.) If the browser
    // ends up inserting the drop itself, the beforeinput/input guard above applies.
    function handleEditorDrop(event) {
        const root = event.target instanceof Element && event.target.closest(EDITOR);
        const data = event.dataTransfer;
        if (!root || !data) return;
        const read = data.getData.bind(data);
        data.getData = type => {
            const value = read(type);
            return /html/i.test(type) && value ? sanitizeClipboardHtml(value) : value;
        };
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
    // Top-nav toolbar: summary counts and the Customise panel
    // ============================
    // Counts cover the cards on the current page. Clicking one dims every card
    // that doesn't match; clicking it again clears the focus. The focus is not
    // saved, so a reload never opens on a silently filtered list.
    const FOCUS = [
        { key: 'overdue',    match: '[data-fd-sla="overdue"]', label: n => `${n} overdue` },
        { key: 'reply',      match: '[data-fd-reply]',         label: n => `${n} ${n === 1 ? 'needs' : 'need'} a reply` },
        { key: 'mine',       match: '[data-fd-mine]',          label: n => `${n} yours` },
        { key: 'unassigned', match: '[data-fd-unassigned]',    label: n => `${n} unassigned` }
    ];

    const PANEL = [
        { title: 'Cards', items: [
            { key: 'cardStyle',    label: 'Status colour' },
            { key: 'density',      label: 'Density' },
            { key: 'groupHeaders', label: 'Group headers when sorted by status' },
            { key: 'showTags',     label: "Show Freshdesk's tag rows" }
        ] },
        { title: 'Emphasis', items: [
            { key: 'urgentStripe',    label: 'Red stripe on urgent open tickets' },
            { key: 'deadlineChips',   label: 'Deadline chips' },
            { key: 'customerReplies', label: 'Highlight customer replies' },
            { key: 'highlightMine',   label: 'Highlight my tickets' },
            { key: 'flagUnassigned',  label: 'Flag unassigned tickets' },
            { key: 'quietWaiting',    label: 'Quieten tickets waiting on the customer' },
            { key: 'keyboardRing',    label: 'Ring the ticket selected with J/K' }
        ] },
        { title: 'Summary', items: [
            { key: 'summary', label: 'Counts with focus filters in the toolbar' }
        ] },
        { title: 'Tag badges', items: [
            { key: 'tagBadges', label: 'Badges before the requester' },
            { key: 'badgeMap',  label: 'One per line: tag = badge' }
        ] },
        { title: 'Motion', items: [
            { key: 'motionHover',    label: 'Lift cards on hover' },
            { key: 'motionArrivals', label: 'Highlight newly arrived tickets' },
            { key: 'motionStatus',   label: 'Fade colour on status change' },
            { key: 'motionPulse',    label: 'Pulse the stripe on overdue tickets' }
        ] }
    ];

    let toolbar = null;

    function updateSettings(changes) {
        Object.assign(settings, changes);
        saveSettings();
        applySettings();
        applyCardStyles();
        syncPanel();
    }

    function setFocus(key) {
        const html = document.documentElement;
        if (key && html.dataset.fdFocus !== key) html.dataset.fdFocus = key;
        else delete html.dataset.fdFocus;
        updateSummary();
    }

    function updateSummary() {
        if (!toolbar) return;
        const focus = document.documentElement.dataset.fdFocus;
        FOCUS.forEach(({ key, match, label }) => {
            const pill = toolbar.pills[key];
            const count = document.querySelectorAll('.tickets__list' + match).length;
            pill.textContent = label(count);
            // The active pill stays visible at zero, or there'd be no way to clear it.
            pill.hidden = !settings.summary || (!count && focus !== key);
            pill.setAttribute('aria-pressed', String(focus === key));
        });
    }

    // Reflects the saved values into the controls, so Reset shows straight away.
    function syncPanel() {
        if (!toolbar) return;
        toolbar.panel.querySelectorAll('[data-key]').forEach(control => {
            const value = settings[control.dataset.key];
            if (control.type === 'checkbox') control.checked = value;
            else if (control.tagName === 'TEXTAREA') { if (control.value !== value) control.value = value; }
            else control.setAttribute('aria-pressed', String(control.dataset.value === value));
        });
    }

    function buildControl(key, label) {
        const doc = document;
        if (CHOICES[key]) {
            const row = doc.createElement('div');
            row.className = 'fd-row';
            const name = doc.createElement('span');
            name.textContent = label;
            const group = doc.createElement('div');
            group.className = 'fd-seg';
            group.setAttribute('role', 'group');
            group.setAttribute('aria-label', label);
            Object.entries(CHOICES[key]).forEach(([value, text]) => {
                const option = doc.createElement('button');
                option.type = 'button';
                option.textContent = text;
                option.dataset.key = key;
                option.dataset.value = value;
                option.onclick = () => updateSettings({ [key]: value });
                group.appendChild(option);
            });
            row.append(name, group);
            return row;
        }

        if (typeof DEFAULTS[key] === 'string') {
            const wrap = doc.createElement('label');
            const hint = doc.createElement('span');
            hint.className = 'fd-hint';
            hint.textContent = label;
            const area = doc.createElement('textarea');
            area.dataset.key = key;
            area.spellcheck = false;
            let timer = null;
            area.oninput = () => {
                clearTimeout(timer);
                timer = setTimeout(() => updateSettings({ [key]: area.value }), 300);
            };
            wrap.append(hint, area);
            return wrap;
        }

        const row = doc.createElement('label');
        row.className = 'fd-row';
        const name = doc.createElement('span');
        name.textContent = label;
        const toggle = doc.createElement('input');
        toggle.type = 'checkbox';
        toggle.className = 'fd-switch';
        toggle.dataset.key = key;
        toggle.onchange = () => updateSettings({ [key]: toggle.checked });
        row.append(name, toggle);
        return row;
    }

    function buildPanel() {
        const panel = document.createElement('div');
        panel.className = 'fd-panel';
        panel.id = 'fd-customise-panel';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', 'Customise the ticket list');

        PANEL.forEach(section => {
            const heading = document.createElement('h3');
            heading.textContent = section.title;
            panel.appendChild(heading);
            section.items.forEach(({ key, label }) => panel.appendChild(buildControl(key, label)));
        });

        const footer = document.createElement('footer');
        const note = document.createElement('span');
        note.className = 'fd-hint';
        note.textContent = 'Motion follows your system’s reduced-motion setting.';
        const reset = document.createElement('button');
        reset.type = 'button';
        reset.className = 'fd-link';
        reset.textContent = 'Reset to defaults';
        reset.onclick = () => updateSettings({ ...DEFAULTS });
        footer.append(note, reset);
        panel.appendChild(footer);

        // Clicks inside the shadow root reach the document retargeted to the host,
        // so the panel stops them before the outside-click handler sees them.
        panel.addEventListener('click', event => event.stopPropagation());
        return panel;
    }

    function positionPanel() {
        const { button, panel } = toolbar;
        const rect = button.getBoundingClientRect();
        panel.style.top = `${rect.bottom + 6}px`;
        panel.style.right = `${Math.max(8, window.innerWidth - rect.right)}px`;
        panel.style.maxHeight = `${Math.max(200, window.innerHeight - rect.bottom - 18)}px`;
    }

    function togglePanel(open) {
        if (!toolbar) return;
        const show = open ?? !toolbar.panel.classList.contains('open');
        if (show) { syncPanel(); positionPanel(); }
        toolbar.panel.classList.toggle('open', show);
        toolbar.button.setAttribute('aria-expanded', String(show));
    }

    // The top nav lives in a shadow root and can be re-rendered, so the toolbar
    // is rebuilt whenever its button is no longer connected.
    function setupToolbar() {
        const root = document.querySelector('ticket-top-nav')?.shadowRoot;
        if (!root || (toolbar && toolbar.root === root && toolbar.button.isConnected)) return;
        const target = root.querySelector('[data-testid="right-section"]');
        if (!target) return;

        if (!root.getElementById('fd-toolbar-style')) {
            const style = document.createElement('style');
            style.id = 'fd-toolbar-style';
            style.textContent = toolbarCss;
            root.appendChild(style);
        }

        // Counts sit at the start of the section, ahead of the page numbers and
        // Filters; Customise goes at the end.
        const summary = document.createElement('div');
        summary.className = 'fd-toolbar';

        const pills = {};
        FOCUS.forEach(({ key }) => {
            const pill = document.createElement('button');
            pill.type = 'button';
            pill.className = 'fd-pill';
            pill.dataset.tone = key;
            pill.hidden = true;
            pill.onclick = event => { event.stopPropagation(); setFocus(key); };
            pills[key] = pill;
            summary.appendChild(pill);
        });

        const bar = document.createElement('div');
        bar.className = 'fd-toolbar';

        const button = document.createElement('button');
        button.type = 'button';
        button.id = 'fd-customise-btn';
        button.className = 'fd-btn';
        button.textContent = 'Customise';
        button.setAttribute('aria-haspopup', 'dialog');
        button.setAttribute('aria-controls', 'fd-customise-panel');
        button.setAttribute('aria-expanded', 'false');
        button.onclick = event => { event.stopPropagation(); togglePanel(); };

        const panel = buildPanel();
        bar.append(button, panel);
        target.prepend(summary);
        target.appendChild(bar);

        toolbar = { root, pills, button, panel };
        syncPanel();
        updateSummary();
    }

    // Registered once, not per build, so a re-rendered nav doesn't stack listeners.
    document.addEventListener('click', () => togglePanel(false));
    document.addEventListener('keydown', event => { if (event.key === 'Escape') togglePanel(false); });
    window.addEventListener('resize', () => { if (toolbar?.panel.classList.contains('open')) positionPanel(); });

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
        applyCardStyles();
        setupToolbar();
        normalizeEmailBackgrounds();
        setupEditorToolbars();
    }

    applySettings();
    window.addEventListener('paste', handleEditorPaste, true);
    window.addEventListener('drop', handleEditorDrop, true);
    window.addEventListener('beforeinput', handleBeforeInput, true);
    window.addEventListener('input', handleInput, true);
    window.addEventListener('keydown', trackKeyboard, true);
    window.addEventListener('mousedown', () => document.documentElement.classList.remove('fd-kbd'), true);
    refresh();
})();
