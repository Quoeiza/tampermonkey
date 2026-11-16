// ==UserScript==
// @name         Culverdocs - Freshdesk
// @namespace    http://culverdocs.co.uk/
// @version      3.4
// @description  QoL improvements for the Freshdesk ticket list and editor. Status colours, urgency stripe, deadline chips, ownership and unassigned labels, quietened waiting tickets, status group headers, tag badges, summary counts with focus filters, density and subtle motion, all adjustable from a Customise panel. Auto-adapts to Freshdesk's light and dark themes. Pasted or dropped content can never bring colour into the editor; paste also drops font family and font size. Editor toolbar is extended with the Froala commands Freshdesk loads but never exposes.
// @author       Lawrence Murrell
// @match        https://culverdocs.freshdesk.com/a/tickets*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=culverdocs.co.uk
// @grant        none
// @updateURL    https://raw.githubusercontent.com/Quoeiza/templates/main/Culverdocs-Freshdesk.user.js
// @downloadURL  https://raw.githubusercontent.com/Quoeiza/templates/main/Culverdocs-Freshdesk.user.js
// ==/UserScript==

// Sections, in order: settings, styles, theme, ticket list, toolbar and Customise
// panel, editor (paste, colour guard, toolbar), start-up.
//
// Robustness rules followed throughout: Freshdesk's data-test-* hooks are
// preferred to class names (their own automated tests depend on them), the
// script only ever writes attributes and classes (never nodes inside Ember's
// list), CSS does all the styling, and a missing hook switches its feature off
// quietly rather than throwing.

(function () {
    'use strict';

    // =========================================================================
    // Settings
    // =========================================================================
    const SETTINGS_KEY = 'fd_customise';
    const STATUSES = ['Open', 'Pending', 'On Hold', 'Resolved', 'Closed'];
    const CHOICES = {
        cardStyle: { gradient: 'Gradient', fill: 'Fill', none: 'None' },
        density:   { comfortable: 'Comfortable', compact: 'Compact' }
    };
    // One line per Customise panel section.
    const DEFAULTS = {
        cardStyle: 'gradient', density: 'comfortable', groupHeaders: true, showTags: true,
        urgentStripe: true, deadlineChips: true, customerReplies: true, highlightMine: true,
        flagUnassigned: true, quietWaiting: true, keyboardRing: true,
        summary: true,
        tagBadges: true, badgeMap: 'L1-ESC = ⚠️\nL2-ESC = 🚨',
        motionHover: true, motionArrivals: true, motionPulse: true
    };

    // A saved value is used only if it has the default's type or is one of the
    // listed choices, so a corrupt or outdated entry falls back cleanly. The first
    // run after 2.x carries over the old Style and Tags keys (a numeric style is
    // older still and maps by index).
    function loadSettings() {
        let saved = null;
        try { saved = JSON.parse(localStorage.getItem(SETTINGS_KEY)); } catch { /* corrupt entry */ }
        if (!saved || typeof saved !== 'object') {
            const style = localStorage.getItem('fd_card_style_mode');
            saved = { cardStyle: Object.keys(CHOICES.cardStyle)[style] || style, showTags: localStorage.getItem('fd_show_tags') === 'true' };
        }
        const valid = (key, value) => (CHOICES[key] ? Object.hasOwn(CHOICES[key], String(value)) : typeof value === typeof DEFAULTS[key]);
        return Object.fromEntries(Object.entries(DEFAULTS).map(([key, fallback]) => [key, valid(key, saved[key]) ? saved[key] : fallback]));
    }

    const settings = loadSettings();
    let badgeRules = [];

    // Only values that differ from the defaults are stored, so a default changed
    // in a later version reaches everyone who never touched that setting.
    function saveSettings() {
        const changed = Object.fromEntries(Object.entries(settings).filter(([key, value]) => value !== DEFAULTS[key]));
        try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(changed)); } catch { /* storage unavailable */ }
    }

    // Lines of "tag = badge", split at the last "=" so a tag may contain one.
    function parseBadgeMap(text) {
        return text.split('\n')
            .map(line => line.split(/=(?=[^=]*$)/).map(part => part.trim()))
            .filter(([tag, badge]) => tag && badge)
            .map(([tag, badge]) => ({ tag: tag.toLowerCase(), badge }));
    }

    // Switches become classes on <html> (highlightMine → fd-highlight-mine), so CSS
    // covers every card at once, including cards rendered later.
    function applySettings() {
        const html = document.documentElement;
        Object.entries(settings).forEach(([key, value]) => {
            if (typeof value === 'boolean') html.classList.toggle('fd-' + key.replace(/[A-Z]/g, c => '-' + c.toLowerCase()), value);
        });
        html.dataset.fdCardStyle = settings.cardStyle;
        html.dataset.fdDensity = settings.density;
        if (!settings.summary) delete html.dataset.fdFocus;
        badgeRules = parseBadgeMap(settings.badgeMap);
    }

    function updateSettings(changes) {
        Object.assign(settings, changes);
        saveSettings();
        applySettings();
        refreshList();
        syncPanel();
    }

    // Each tab holds its own copy, so a change saved in another tab is adopted
    // here; otherwise this tab would write its stale copy back on its next save.
    function adoptSavedSettings(event) {
        if (event.key !== SETTINGS_KEY) return;
        Object.assign(settings, loadSettings());
        applySettings();
        refreshList();
        syncPanel();
    }

    // =========================================================================
    // Styles
    // =========================================================================
    // All theming runs through custom properties; the script writes data-*
    // attributes and <html> classes and these rules decide what they look like.
    const css = `
/* ---- Theme ---- */
:root {
    --fd-status-open: #ffe4e1;    --fd-status-pending: #fff6cc;  --fd-status-on-hold: #e8f4fc;
    --fd-status-resolved: #ddfddf; --fd-status-closed: #e6e8ea;
    --fd-card-bg: #fff;  --fd-gradient-fade: #fff;
    --fd-card-shadow: 2px 4px 6px 0 #cfd7df;  --fd-card-shadow-hover: 2px 7px 14px 0 #c3ccd6;
    --fd-text-title: #19334c;  --fd-text-info: #6f7c87;  --fd-text-ticket-id: #778393;
    --fd-priority-border: #f22;
    --fd-accent: #2c66d1;  --fd-accent-bg: #e4edfc;  --fd-accent-text: #1f4fa8;
    --fd-warn-bg: #fff0d4;  --fd-warn-text: #8a5300;
    --fd-danger-bg: #fde3e1;  --fd-danger-text: #a3262a;
    --fd-btn-bg: #f8f9fa;  --fd-btn-bg-hover: #e9ecef;  --fd-btn-border: #d7dbe3;  --fd-btn-text: #375e6b;
    --fd-menu-bg: #fff;  --fd-menu-text: #19334c;  --fd-menu-shadow: 0 8px 24px 0 rgba(0,0,0,.18);
}
/* Status hues sit on a near-black card so they read as accents, not panels. */
html.fd-dark {
    --fd-status-open: #4a2a2a;    --fd-status-pending: #4a3f1a;  --fd-status-on-hold: #1e3a52;
    --fd-status-resolved: #1e4030; --fd-status-closed: #383838;
    --fd-card-bg: #1a1a1a;  --fd-gradient-fade: #1a1a1a;
    --fd-card-shadow: 2px 4px 6px 0 rgba(0,0,0,.5);  --fd-card-shadow-hover: 2px 7px 16px 0 rgba(0,0,0,.7);
    --fd-text-title: #e8edf3;  --fd-text-info: #b4bcc6;  --fd-text-ticket-id: #98a3b0;
    --fd-priority-border: #ff5a5a;
    --fd-accent: #6ea8ff;  --fd-accent-bg: #1c3150;  --fd-accent-text: #b3cdff;
    --fd-warn-bg: #4a3810;  --fd-warn-text: #f6c76e;
    --fd-danger-bg: #561f1f;  --fd-danger-text: #ffb4ae;
    --fd-btn-bg: #262626;  --fd-btn-bg-hover: #333333;  --fd-btn-border: #3a3a3a;  --fd-btn-text: #d0d0d0;
    --fd-menu-bg: #222222;  --fd-menu-text: #e8edf3;  --fd-menu-shadow: 0 8px 24px 0 rgba(0,0,0,.6);
}

/* ---- Page layout. Grid classes are scoped to cards: the ticket page matches this script too. ---- */
.tickets__list .col-md-12 { padding-left: 0; padding-right: 0; }
.tickets__list .col-md-9 { width: auto; }
.left-nav-mfe-wrapper, .left-nav-mfe { width: 240px !important; }
.ember-light-table table { border-collapse: separate; }
.hidden-overdue-badge, .avatar-image { display: none !important; }
/* The avatar moves with its wrapper, so Freshdesk's fade overlay for closed and
   resolved tickets moves with it. The overlay is a white square, invisible on a
   white card; it is made round and given the card colour so it fades in dark mode too. */
.tickets__list .app-user-photo { position: relative; left: 9px; }
.tickets__list .app-user-photo > .avatar-overlay { border-radius: 50% !important; background-color: var(--fd-card-bg) !important; }
.current__item--active td:first-child::before { width: 0; }
.__module-tickets__assign-to .element-flex > div:first-child { display: none; }
.app-content-area, body { min-width: 958px; }
@media (max-width: 1120px) { .tickets__list .list-content--info { display: none; } }
/* Table view's hard-coded column widths, scoped so the attribute match can't catch anything else. */
.ember-light-table [style*="width: 400px"] { width: 120px !important; }
.ember-light-table [style*="width: 120px"] { width: 200px !important; }
.ember-light-table [style*="width: 12vw"]  { width: 80px !important; }

/* ---- Cards ---- */
.tickets__list {
    --fd-status-bg: var(--fd-card-bg);
    display: table; position: relative; box-sizing: border-box; overflow: hidden;
    width: 99.9%; min-height: 76px; margin-bottom: 11px !important;
    background: var(--fd-card-bg); border-radius: 8px !important; box-shadow: var(--fd-card-shadow);
    transition: opacity .2s, filter .2s, box-shadow .15s ease-out, transform .15s ease-out;
}
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

.tickets__list .list-content { padding-left: 0 !important; padding-top: 0; padding-bottom: 0; }
.tickets__list .list-content--main { padding-right: 0; background: transparent !important; }
.list-content--info { background: transparent !important; }
.list-check-wrap { position: relative; }
/* 17px on the left matches the 8px between checkbox and avatar, centring the avatar. */
.list-content-wrap { padding: 16px 16px 16px 17px; }
/* Priority, assignee and status rows, kept to the rhythm of the subject lines. The
   column padding matches the space they get on a card whose left side runs to three
   lines, so a shorter card (common in a wide window) never squeezes them to the edges. */
.tickets__list .list-content--info { padding-block: 21px; }
.tickets__list .list-content--info .list-filter > :not(:last-child) { margin-bottom: 5px; }
.tickets__list .ticket-title-row { display: flex; align-items: center !important; gap: 0; width: 100%; margin: 0; }
.tickets__list .ticket-title-row .muted[data-test-ticket-id] {
    margin-left: auto !important; min-width: 52px; text-align: right;
    font-size: 15px; font-weight: 500; color: var(--fd-text-ticket-id);
}
/* Freshdesk's own dark-mode CSS misses these. */
.wordbreak-fix { color: var(--fd-text-title) !important; font-size: 18px; font-weight: 600; }
.ticket-info, .ticket-info .user, .ticket-info [data-test-id="user-name"] { color: var(--fd-text-info) !important; }
.ticket-info { padding-top: 6px; font-size: 14px; }

html[data-fd-density="compact"] .tickets__list { min-height: 0; margin-bottom: 6px !important; }
html[data-fd-density="compact"] .list-content-wrap { padding: 8px 12px 8px 17px; }
html[data-fd-density="compact"] .tickets__list .list-content--info { padding-block: 10px; }
html[data-fd-density="compact"] .tickets__list .list-content--info .list-filter > :not(:last-child) { margin-bottom: 3px; }
html[data-fd-density="compact"] .wordbreak-fix { font-size: 15px; }
html[data-fd-density="compact"] .ticket-info { padding-top: 2px; font-size: 13px; }
html[data-fd-density="compact"] .tickets__list .ticket-title-row .muted[data-test-ticket-id] { font-size: 13px; }

/* ---- Card features ---- */
/* Freshdesk's coloured left borders give way to the urgent stripe, drawn by the card so it keeps the radius. */
.ticket-due-soon-border, .ticket-due-today-border, .ticket-priority-border, .ticket-new-border { border-left: none !important; }
html.fd-urgent-stripe .tickets__list[data-fd-urgent]::before {
    content: ""; position: absolute; top: 0; bottom: 0; left: 0; z-index: 1;
    width: 6px; background: var(--fd-priority-border);
}

html:not(.fd-show-tags) .tickets__list .ticket-tag-wrap,
html:not(.fd-show-tags) .tickets__list .status-tag-wrap,
html:not(.fd-show-tags) .ticket-tag-toprow,
html:not(.fd-show-tags) .ticket-tag-toprow > .tag,
html:not(.fd-show-tags) .ticket-tag-toprow > span[class^="tag--"],
html:not(.fd-show-tags) .ticket-tag-toprow > .ticket-ribbon { display: none !important; }
html.fd-tag-badges .ticket-info[data-fd-badges]::before {
    content: attr(data-fd-badges); display: inline-block; margin-right: 4px;
    font-size: 13px; vertical-align: text-top; white-space: nowrap;
}

/* Group headers sit on the list cell, so no node is added to Ember's list.
   Freshdesk uses this pseudo-element for its selected-row marker (hidden above),
   so the header pins its own layout. */
html.fd-group-headers td[data-fd-group]::before {
    content: attr(data-fd-group) !important; display: block !important; position: static !important;
    width: auto !important; height: auto !important; background: none !important;
    margin: 18px 6px 7px; font-size: 12px; font-weight: 600; letter-spacing: .03em; color: var(--fd-text-ticket-id);
}
html.fd-group-headers tr:first-child > td[data-fd-group]::before { margin-top: 2px; }

/* Deadline chips. The SLA line is bare text nodes, so it is redrawn from two
   attributes; without them Freshdesk's own text shows. */
html.fd-deadline-chips [data-fd-deadline] { font-size: 0 !important; }
html.fd-deadline-chips [data-fd-deadline] > svg { display: none !important; }
html.fd-deadline-chips [data-fd-deadline]::before { content: attr(data-fd-activity); font-size: 14px; }
html[data-fd-density="compact"].fd-deadline-chips [data-fd-deadline]::before { font-size: 13px; }
html.fd-deadline-chips [data-fd-deadline]::after {
    content: attr(data-fd-deadline); display: inline-block; margin-left: 8px; padding: 0 8px;
    border: 1px solid var(--fd-btn-border); border-radius: 999px;
    font-size: 12px; font-weight: 400; line-height: 19px; vertical-align: 1px; color: var(--fd-text-info);
}
html.fd-deadline-chips [data-fd-tone="overdue"]::after { background: var(--fd-danger-bg); color: var(--fd-danger-text); border-color: transparent; font-weight: 500; }
html.fd-deadline-chips [data-fd-tone="soon"]::after { background: var(--fd-warn-bg); color: var(--fd-warn-text); border-color: transparent; font-weight: 500; }
html.fd-deadline-chips [data-fd-tone="state"]::after { content: "·  " attr(data-fd-deadline); border-color: transparent; padding: 0; }

/* Ball in our court: the customer replied last. */
html.fd-customer-replies .tickets__list[data-fd-turn="customer"] [data-test-id="sla-status-text"] { color: var(--fd-warn-text) !important; font-weight: 500; }

/* Ownership: the assignee label is redrawn as "Group / You" or "Group / Unassigned".
   Freshdesk's label already uses its pseudo-elements for a hint.css tooltip, so
   these pin their own layout over the tooltip's. */
html.fd-highlight-mine [data-fd-kind="mine"], html.fd-flag-unassigned [data-fd-kind="unassigned"] { font-size: 0 !important; }
html.fd-highlight-mine [data-fd-kind="mine"]::before, html.fd-highlight-mine [data-fd-kind="mine"]::after,
html.fd-flag-unassigned [data-fd-kind="unassigned"]::before, html.fd-flag-unassigned [data-fd-kind="unassigned"]::after {
    position: static !important; display: inline-block !important; z-index: auto !important;
    visibility: visible !important; opacity: 1 !important; transform: none !important; transition: none !important;
    width: auto !important; height: auto !important; margin: 0 !important; border: 0 !important;
    box-shadow: none !important; text-shadow: none !important; white-space: nowrap !important; pointer-events: none;
    font-size: 13px !important; line-height: 20px !important;
}
html.fd-highlight-mine [data-fd-kind="mine"]::before, html.fd-flag-unassigned [data-fd-kind="unassigned"]::before {
    content: attr(data-fd-group) " /" !important; padding: 0 5px 0 0 !important;
    background: none !important; color: inherit !important; font-weight: inherit !important;
}
html.fd-highlight-mine [data-fd-kind="mine"]::after, html.fd-flag-unassigned [data-fd-kind="unassigned"]::after {
    padding: 0 8px !important; border-radius: 999px !important; font-weight: 500 !important;
}
html.fd-highlight-mine [data-fd-kind="mine"]::after { content: "You" !important; background: var(--fd-accent-bg) !important; color: var(--fd-accent-text) !important; }
html.fd-flag-unassigned [data-fd-kind="unassigned"]::after { content: "Unassigned" !important; background: var(--fd-warn-bg) !important; color: var(--fd-warn-text) !important; }
html.fd-flag-unassigned .tickets__list[data-fd-unassigned] { outline: 1.5px dashed var(--fd-warn-text); outline-offset: -1.5px; }

/* Waiting on the customer with nothing for us to do: step back until hovered. */
html.fd-quiet-waiting .tickets__list:is([data-status="Pending"], [data-status="On Hold"])[data-fd-turn="agent"]:not(:hover) { opacity: .62; filter: saturate(.55); }

/* Focus filters from the summary counts dim everything that doesn't match. */
html[data-fd-focus="overdue"] .tickets__list:not([data-fd-sla="overdue"]),
html[data-fd-focus="reply"] .tickets__list:not([data-fd-reply]),
html[data-fd-focus="mine"] .tickets__list:not([data-fd-mine]),
html[data-fd-focus="unassigned"] .tickets__list:not([data-fd-unassigned]) { opacity: .25 !important; filter: saturate(.3) !important; }

/* J/K selection ring, shown only once the keyboard is in use. */
html.fd-keyboard-ring.fd-kbd .current__item--active .tickets__list { outline: 2px solid var(--fd-accent); outline-offset: 2px; }

/* ---- Motion: transform and opacity only, all off under reduced motion ---- */
html.fd-motion-hover .tickets__list:hover { transform: translateY(-1px); box-shadow: var(--fd-card-shadow-hover); }
@keyframes fd-arrive { from { opacity: .45; } to { opacity: 0; } }
html.fd-motion-arrivals .tickets__list[data-fd-arrived]::after {
    content: ""; position: absolute; inset: 0; z-index: 2; pointer-events: none;
    background: var(--fd-accent); opacity: 0; animation: fd-arrive 1.8s ease-out;
}
/* Runs for as long as the ticket is overdue. A fixed count starts when the card
   first renders (often off-screen or in a background tab) and is over before anyone looks. */
@keyframes fd-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .3; } }
html.fd-motion-pulse.fd-urgent-stripe .tickets__list[data-fd-urgent][data-fd-sla="overdue"]::before { animation: fd-pulse 2.4s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
    .tickets__list, .tickets__list::before, .tickets__list::after { transition: none !important; animation: none !important; }
    .tickets__list:hover { transform: none !important; }
}

/* ---- Filter controls: fixed widths, and no hover backgrounds over the card colour ---- */
.list-filter-wrap .list-filter__item, .list-filter-wrap .list-filter__priority, .list-filter-wrap .list-filter__status { width: 170px; }
.list-filter-wrap .list-filter__icon-assignto, .list-filter-wrap .list-filter__icon-status { top: -2px; }
.list-filter-wrap .list-filter__item--icon-overlay { background: transparent; }
.list-filter-wrap .list-filter__priority .list-filter__item--icon-overlay { top: 1px; }
:is(.list-filter__item, .list-filter__priority, .list-filter__status, .assignto-filter-wrap, .ticket-list-dropselect,
    .ember-power-select-trigger, .ember-basic-dropdown-trigger):is(*, :hover, :focus, :active) {
    background: transparent !important;
}

/* ---- Conversation (dark mode) ----
   Customer email clients inline black text and white signature tables, both
   unreadable on a dark card. The editor box shares .ticket-note-typography and
   is excluded: Freshdesk already corrects its colours, and an override there
   hides real colours and gets inlined into replies by Chrome when it merges blocks. */
html.fd-dark :is(.ticket-details__conversation__content, .ticket-note-typography:not(.fr-box)),
html.fd-dark :is(.ticket-details__conversation__content, .ticket-note-typography:not(.fr-box)) * { color: var(--fd-text-info) !important; }
html.fd-dark :is(.ticket-details__conversation__content, .ticket-note-typography:not(.fr-box)) a { color: #6ea8ff !important; }
/* Bright inline backgrounds are tagged by the script; any gradient goes with them. */
html.fd-dark .fd-bg-darkened { background-color: var(--fd-card-bg) !important; background-image: none !important; }

/* ---- Editor ---- */
/* Froala's code-block background is a stylesheet rule the script can't see. */
html.fd-dark :is(.fr-element, .fr-view) pre { background-color: var(--fd-card-bg) !important; }
/* Pasted content loses its typeface, so restore monospace where it means something. */
:is(.fr-element, .fr-view) :is(pre, code, kbd, samp, tt) {
    font-family: ui-monospace, "Cascadia Mono", "Segoe UI Mono", Consolas, "Liberation Mono", Menlo, monospace;
}
/* Borderless pasted tables would read as a run of words, so give them a hairline. */
:is(.fr-element, .fr-view) table:not([style*="border"]) :is(td, th) { border: 1px solid currentColor; padding: 4px 8px; vertical-align: top; }
/* Insurance for the pinned toolbar group, in case Froala's own float rule is absent. */
.fr-toolbar .fr-btn-grp.fr-float-right { float: right; }
`;

    // Goes into the top-nav shadow root; custom properties inherit through it.
    const toolbarCss = `
#ticket-top-nav, .root-app, [data-testid="top-navigation-container"], [data-testid="right-section"] { overflow: visible !important; }
.fd-toolbar { display: inline-flex; align-items: center; gap: 6px; margin-right: 10px; vertical-align: middle; }
.fd-pill {
    font: inherit; font-size: 12px; font-weight: 500; line-height: 22px; white-space: nowrap; cursor: pointer;
    padding: 0 10px; border: 1px solid var(--fd-btn-border); border-radius: 999px;
    background: var(--fd-btn-bg); color: var(--fd-btn-text); transition: box-shadow .15s, filter .15s;
}
.fd-pill:hover { filter: brightness(1.08); }
.fd-pill[hidden] { display: none; }
.fd-pill[data-tone="overdue"] { background: var(--fd-danger-bg); color: var(--fd-danger-text); border-color: transparent; }
.fd-pill[data-tone="reply"]   { background: var(--fd-warn-bg); color: var(--fd-warn-text); border-color: transparent; }
.fd-pill[data-tone="mine"]    { background: var(--fd-accent-bg); color: var(--fd-accent-text); border-color: transparent; }
.fd-pill[aria-pressed="true"] { box-shadow: 0 0 0 2px var(--fd-accent); }
/* Narrow windows hide the counts, but never an active one: it is the only way to clear the focus. */
@media (max-width: 1280px) { .fd-pill:not([aria-pressed="true"]) { display: none; } }
.fd-btn {
    height: 30px; padding: 2px 14px; border: 1px solid var(--fd-btn-border); border-radius: 4px; cursor: pointer;
    font-size: 13px; font-weight: 500; background: var(--fd-btn-bg); color: var(--fd-btn-text);
    transition: background .18s, color .18s, border-color .18s;
}
.fd-btn:hover, .fd-btn[aria-expanded="true"] { background: var(--fd-btn-bg-hover); }
.fd-panel {
    display: none; position: fixed; z-index: 99999; box-sizing: border-box; width: 330px; overflow: auto;
    padding: 12px 16px 10px; border: 1px solid var(--fd-btn-border); border-radius: 8px;
    background: var(--fd-menu-bg); color: var(--fd-menu-text); box-shadow: var(--fd-menu-shadow);
    font-size: 13px; line-height: 1.4; text-align: left; user-select: none;
}
.fd-panel.open { display: block; }
.fd-panel h3 { margin: 14px 0 4px; font-size: 11px; font-weight: 600; letter-spacing: .05em; color: var(--fd-text-info); }
.fd-panel h3:first-child { margin-top: 0; }
.fd-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 4px 0; }
label.fd-row { cursor: pointer; }
.fd-switch {
    appearance: none; flex: none; position: relative; width: 30px; height: 17px; margin: 0; cursor: pointer;
    border-radius: 999px; background: var(--fd-btn-border); transition: background .15s;
}
.fd-switch::after {
    content: ""; position: absolute; top: 2px; left: 2px; width: 13px; height: 13px;
    border-radius: 50%; background: #fff; transition: transform .15s;
}
.fd-switch:checked { background: var(--fd-accent); }
.fd-switch:checked::after { transform: translateX(13px); }
.fd-switch:focus-visible, .fd-seg button:focus-visible { outline: 2px solid var(--fd-accent); outline-offset: 2px; }
.fd-seg { display: inline-flex; flex: none; border: 1px solid var(--fd-btn-border); border-radius: 6px; overflow: hidden; }
.fd-seg button { font: inherit; font-size: 12px; padding: 3px 9px; border: 0; background: transparent; color: var(--fd-menu-text); cursor: pointer; }
.fd-seg button + button { border-left: 1px solid var(--fd-btn-border); }
.fd-seg button[aria-pressed="true"] { background: var(--fd-accent); color: #fff; }
.fd-panel textarea {
    display: block; box-sizing: border-box; width: 100%; min-height: 62px; margin: 4px 0 2px; padding: 6px 8px; resize: vertical;
    font: 12px/1.5 ui-monospace, Consolas, monospace; user-select: text;
    background: var(--fd-btn-bg); color: var(--fd-menu-text); border: 1px solid var(--fd-btn-border); border-radius: 6px;
}
.fd-hint { color: var(--fd-text-info); font-size: 11px; }
.fd-panel footer {
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
    margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--fd-btn-border);
}
.fd-link { font: inherit; font-size: 12px; padding: 0; border: 0; background: none; color: var(--fd-accent); cursor: pointer; white-space: nowrap; }
@media (prefers-reduced-motion: reduce) { .fd-switch, .fd-switch::after, .fd-pill, .fd-btn { transition: none; } }
`;

    const styleElement = document.createElement('style');
    styleElement.id = 'fd-userstyle';
    styleElement.textContent = css;
    document.head.appendChild(styleElement);

    // =========================================================================
    // Theme
    // =========================================================================
    // Freshdesk's dark-mode mechanism changes between releases, so the computed
    // background is measured rather than class names guessed. Computed colours
    // are always rgb()/rgba(); null means transparent or unreadable.
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
        if (isDark) normalizeEmailBackgrounds();
    }

    // Emails inline near-white backgrounds that glare against the dark card, in
    // shades no attribute selector can match, so anything brighter than ~85%
    // luminance is tagged for the CSS. Each element is measured once.
    const EMAIL_BG_SELECTOR = ['.ticket-details__conversation__content', '.ticket-note-typography:not(.fr-box)']
        .map(root => `${root} [style*="background"]:not(.fd-bg-darkened)`).join(',');
    const measuredBackgrounds = new WeakSet();

    function normalizeEmailBackgrounds() {
        if (!isDark) return;
        document.querySelectorAll(EMAIL_BG_SELECTOR).forEach(el => {
            if (measuredBackgrounds.has(el)) return;
            measuredBackgrounds.add(el);
            if (luminance(getComputedStyle(el).backgroundColor) > 0.85) el.classList.add('fd-bg-darkened');
        });
    }

    // =========================================================================
    // Ticket list
    // =========================================================================
    // Each card is annotated with data-fd-* attributes describing its state;
    // the CSS above turns those into colours, chips, labels and headers.

    // Writes only on change, so repeated passes don't churn the DOM. true sets an
    // empty attribute; false, null, undefined and '' remove it.
    function setAttr(el, name, value) {
        if (value === false || value == null || value === '') {
            if (el.hasAttribute(name)) el.removeAttribute(name);
        } else {
            const text = value === true ? '' : String(value);
            if (el.getAttribute(name) !== text) el.setAttribute(name, text);
        }
    }

    // The status control is the authoritative source: the card body carries SLA
    // phrases like "Resolved on time" that describe the outcome, not the state.
    // Hovering swaps the label for a dropdown, so either is read.
    function detectStatus(card) {
        const text = card.querySelector('[data-test-id="status-before-hover"], [data-test-id="status-hover"], .list-filter__status')?.textContent.trim();
        return text ? STATUSES.find(status => text.startsWith(status)) : null;
    }

    // Word boundaries throughout: without them "a" plus "d", "h" or "m" matches
    // inside "and" or "Ahmed", "due" inside "overdue" and "m" inside "months". The
    // overdue amount must follow within one word ("Overdue by 2 days"), so the
    // hidden overdue badge can't pair with an unrelated figure further along.
    const AMOUNT  = String.raw`\b(\d+|an?)\s*(days?|hours?|hrs?|minutes?|mins?|d|h|m)\b`;
    const OVERDUE = new RegExp(String.raw`\boverdue\b(?:\W+[a-z]+)??\W*` + AMOUNT);
    const DUE_IN  = new RegExp(String.raw`\bdue\b.*?\bin\b.*?` + AMOUNT);

    // Due within four hours, or within a day when counted in days.
    function dueSoon(lower) {
        const due = lower.match(DUE_IN);
        if (!due) return false;
        const value = due[1].startsWith('a') ? 1 : parseInt(due[1], 10);
        const unit = due[2][0];
        return unit === 'm' || (unit === 'h' && value <= 4) || (unit === 'd' && value === 1);
    }

    // New, overdue, due soon, or a customer reply within the last few hours.
    function isUrgent(text, tags) {
        const lower = text.toLowerCase();
        if (tags.some(tag => /\bnew\b/i.test(tag)) || OVERDUE.test(lower) || dueSoon(lower)) return true;
        const replied = lower.match(/customer responded[\s\S]*?ago/)?.[0];
        return !!replied && /\b(?:mins?|minutes?|hrs?|hours?)\b/.test(replied) && !/\b(?:days?|weeks?|months?|years?)\b/.test(replied);
    }

    // The SLA line is two bare text nodes with icons between: the last activity
    // ("Agent responded 2 days ago") and the deadline or state ("Resolution
    // overdue by 3 days", "Pending for 3 days"). Both must parse before the line
    // is redrawn; otherwise the attributes are cleared and Freshdesk's text shows.
    function annotateSla(card) {
        const el = card.querySelector('[data-test-id="sla-status-text"]');
        const [activity = '', deadline = ''] = el ? [...el.childNodes]
            .filter(node => node.nodeType === Node.TEXT_NODE)
            .map(node => node.data.replace(/\s+/g, ' ').trim())
            .filter(Boolean) : [];
        const turn = /^customer responded/i.test(activity) ? 'customer'
                   : /^agent responded/i.test(activity) ? 'agent'
                   : /^created/i.test(activity) ? 'new' : '';
        const lower = deadline.toLowerCase();
        const tone = /\boverdue\b/.test(lower) ? 'overdue'
                   : DUE_IN.test(lower) ? (dueSoon(lower) ? 'soon' : 'due')
                   : deadline ? 'state' : '';
        if (el) {
            const complete = !!(activity && deadline);
            setAttr(el, 'data-fd-activity', complete && activity);
            setAttr(el, 'data-fd-deadline', complete && deadline);
            setAttr(el, 'data-fd-tone', complete && tone);
        }
        return { turn, tone };
    }

    // The signed-in agent comes from Freshdesk's documented REST API, which
    // accepts the agent's own session: one read per page load, cached for the
    // browser session.
    let myName = sessionStorage.getItem('fd_me');
    let meRequested = false;

    function ensureMe() {
        if (myName || meRequested) return;
        meRequested = true;
        fetch('/api/v2/agents/me', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
            .then(response => (response.ok ? response.json() : null))
            .then(me => {
                if (!me?.contact?.name) return;
                myName = me.contact.name;
                sessionStorage.setItem('fd_me', myName);
                refreshList();
            })
            .catch(() => { /* ownership features stay off */ });
    }

    // The assignee reads "Group / Agent", with "--" for nobody and long names cut
    // to "Lawrence M...", so the agent is prefix-matched against the full name.
    // The label is the element holding that text directly.
    function annotateAssignee(card) {
        const trigger = card.querySelector('[data-test-id="assign-to-hover"]');
        const label = trigger && [...trigger.querySelectorAll('*')].find(el =>
            [...el.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.data.includes(' / ')));
        const text = label ? label.textContent.replace(/\s+/g, ' ').trim() : '';
        const at = text.lastIndexOf(' / ');
        const agent = at === -1 ? null : text.slice(at + 3).replace(/(?:\.\.\.|…)$/, '').trim();
        const unassigned = agent !== null && /^-*$/.test(agent);
        const mine = !!(agent && !unassigned && myName && agent.length >= 3 && myName.toLowerCase().startsWith(agent.toLowerCase()));
        const kind = mine ? 'mine' : unassigned ? 'unassigned' : null;

        setAttr(card, 'data-fd-mine', mine);
        setAttr(card, 'data-fd-unassigned', unassigned);
        if (!label) return;
        setAttr(label, 'data-fd-kind', kind);
        setAttr(label, 'data-fd-group', kind && text.slice(0, at).trim());
    }

    function annotateCard(card) {
        const main = card.querySelector('[data-test-ticket-content]');
        if (!main) return;
        main.classList.remove('ticket-priority-border', 'ticket-due-soon-border', 'ticket-due-today-border', 'ticket-new-border');

        // Keep the last known status while the control is mid-render, so the
        // card doesn't flash back to its default colour.
        const status = detectStatus(card) || card.getAttribute('data-status');
        const tags = [...new Set([...main.querySelectorAll('[data-test-list-item], span.tag, span[class^="tag--"], .list-item')]
            .map(el => el.textContent.trim()))];
        const { turn, tone } = annotateSla(card);
        const open = status !== 'Resolved' && status !== 'Closed';

        setAttr(card, 'data-status', status);
        setAttr(card, 'data-fd-urgent', status === 'Open' && isUrgent(main.textContent, tags));
        setAttr(card, 'data-fd-turn', turn);
        setAttr(card, 'data-fd-sla', tone);
        setAttr(card, 'data-fd-reply', open && (turn === 'customer' || turn === 'new'));
        annotateAssignee(card);

        const info = card.querySelector('.ticket-info');
        const present = new Set(tags.map(tag => tag.toLowerCase()));
        if (info) setAttr(info, 'data-fd-badges', badgeRules.filter(rule => present.has(rule.tag)).map(rule => rule.badge).join(''));
    }

    // Headers only make sense when the list is actually grouped, which is checked
    // from the cards rather than the sort control: every status must form one run.
    function markGroups(cards) {
        const runs = [];
        cards.forEach(card => {
            const status = card.getAttribute('data-status') || '';
            if (runs.at(-1)?.status === status) runs.at(-1).cards.push(card);
            else runs.push({ status, cards: [card] });
        });
        const grouped = runs.length > 1 && runs.every(run => run.status) && new Set(runs.map(run => run.status)).size === runs.length;
        runs.forEach(run => run.cards.forEach((card, index) =>
            setAttr(card.closest('td') || card.parentElement, 'data-fd-group', grouped && index === 0 && `${run.status} · ${run.cards.length}`)));
    }

    // Arrivals are tickets that appear in a view after it first rendered. The
    // first pass of each view sets the baseline silently, and more than three new
    // tickets at once is a new list (a filter or page change), not an arrival.
    const seenTickets = new Set();
    let viewHref = null;
    let baselinePending = true;

    function trackArrivals(cards) {
        if (location.href !== viewHref) {
            viewHref = location.href;
            seenTickets.clear();
            baselinePending = true;
        }
        const fresh = cards.filter(card => {
            const id = card.querySelector('[data-test-ticket-content]')?.getAttribute('data-test-ticket-content');
            if (!id || seenTickets.has(id)) return false;
            seenTickets.add(id);
            return true;
        });
        if (baselinePending) {
            baselinePending = !cards.length;
            return;
        }
        if (fresh.length > 3) return;
        fresh.forEach(card => {
            card.setAttribute('data-fd-arrived', '');
            setTimeout(() => card.removeAttribute('data-fd-arrived'), 2000);
        });
    }

    function refreshList() {
        if (settings.highlightMine || settings.summary) ensureMe();
        const cards = [...document.querySelectorAll('[data-test-ticket-content]')]
            .map(main => main.closest('.tickets__list')).filter(Boolean);
        cards.forEach(annotateCard);
        trackArrivals(cards);
        markGroups(cards);
        updateSummary();
    }

    // Freshdesk's J/K navigation marks a row even before any key is pressed, so
    // the ring only shows once the keyboard is in use, and goes on the next click.
    // The class is checked first: rewriting it would wake the theme observer.
    function trackKeyboard(event) {
        const { target } = event;
        const html = document.documentElement;
        if (html.classList.contains('fd-kbd') || event.ctrlKey || event.metaKey || event.altKey) return;
        if (!/^(?:j|k|ArrowUp|ArrowDown)$/.test(event.key) || target.isContentEditable || /^(?:INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
        html.classList.add('fd-kbd');
    }

    function clearKeyboard() {
        const html = document.documentElement;
        if (html.classList.contains('fd-kbd')) html.classList.remove('fd-kbd');
    }

    // =========================================================================
    // Toolbar: summary counts and the Customise panel
    // =========================================================================
    // Counts cover the cards on the current page. Clicking one dims every card
    // that doesn't match and clicking it again clears the focus, which is never
    // saved, so a reload can't open on a silently filtered list.
    const FOCUS = [
        { key: 'overdue',    match: '[data-fd-sla="overdue"]', label: n => `${n} overdue` },
        { key: 'reply',      match: '[data-fd-reply]',         label: n => `${n} ${n === 1 ? 'needs' : 'need'} a reply` },
        { key: 'mine',       match: '[data-fd-mine]',          label: n => `${n} yours` },
        { key: 'unassigned', match: '[data-fd-unassigned]',    label: n => `${n} unassigned` }
    ];

    const PANEL = {
        'Cards': {
            cardStyle: 'Status Colour', density: 'Density',
            groupHeaders: 'Show Group Headers', showTags: "Show Tags"
        },
        'Emphasis': {
            urgentStripe: 'Highlight urgent open tickets', deadlineChips: 'Highlight due dates & times',
            customerReplies: 'Highlight customer replies', flagUnassigned: 'Highlight unassigned tickets',
            keyboardRing: 'Highlight tickets using shortcuts J/K', quietWaiting: 'Fade tickets waiting for customer',
            highlightMine: 'Label own tickets as "You"',
        },
        'Summary': { summary: 'Show Focus Filters' },
        'Tag Badges': { tagBadges: 'Show Badges', badgeMap: 'Define badge conditions, one per line: "TAG = BADGE"' },
        'Motion': {
            motionHover: 'Lift cards on hover', motionArrivals: 'Highlight newly arrived tickets',
            motionPulse: 'Pulse the stripe on overdue tickets'
        }
    };

    let toolbar = null;

    // make('button', { className, onclick, dataset: {...}, attrs: {...} }, ...children)
    function make(tag, { dataset, attrs, ...props } = {}, ...children) {
        const node = Object.assign(document.createElement(tag), props);
        Object.assign(node.dataset, dataset);
        Object.entries(attrs || {}).forEach(([name, value]) => node.setAttribute(name, value));
        node.append(...children);
        return node;
    }

    function setFocus(key) {
        const html = document.documentElement;
        if (html.dataset.fdFocus === key) delete html.dataset.fdFocus;
        else html.dataset.fdFocus = key;
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

    // Reflects the settings into the controls, so Reset or another tab shows straight away.
    function syncPanel() {
        toolbar?.panel.querySelectorAll('[data-key]').forEach(control => {
            const value = settings[control.dataset.key];
            if (control.type === 'checkbox') control.checked = value;
            else if (control.tagName === 'TEXTAREA') { if (control.value !== value) control.value = value; }
            else control.setAttribute('aria-pressed', String(control.dataset.value === value));
        });
    }

    function buildControl(key, label) {
        if (CHOICES[key]) {
            const options = Object.entries(CHOICES[key]).map(([value, text]) => make('button', {
                type: 'button', textContent: text, dataset: { key, value }, onclick: () => updateSettings({ [key]: value })
            }));
            return make('div', { className: 'fd-row' }, make('span', { textContent: label }),
                make('div', { className: 'fd-seg', attrs: { role: 'group', 'aria-label': label } }, ...options));
        }
        if (typeof DEFAULTS[key] === 'string') {
            let timer = null;
            const area = make('textarea', { spellcheck: false, dataset: { key }, oninput: () => {
                clearTimeout(timer);
                timer = setTimeout(() => updateSettings({ [key]: area.value }), 300);
            } });
            return make('label', {}, make('span', { className: 'fd-hint', textContent: label }), area);
        }
        const toggle = make('input', { type: 'checkbox', className: 'fd-switch', dataset: { key }, onchange: () => updateSettings({ [key]: toggle.checked }) });
        return make('label', { className: 'fd-row' }, make('span', { textContent: label }), toggle);
    }

    function buildPanel() {
        const sections = Object.entries(PANEL).flatMap(([title, items]) =>
            [make('h3', { textContent: title }), ...Object.entries(items).map(([key, label]) => buildControl(key, label))]);
        const footer = make('footer', {},
            make('span', { className: 'fd-hint', textContent: 'Motion follows your system’s reduced-motion setting.' }),
            make('button', { type: 'button', className: 'fd-link', textContent: 'Reset to defaults', onclick: () => updateSettings({ ...DEFAULTS }) }));
        const panel = make('div', { className: 'fd-panel', id: 'fd-customise-panel', attrs: { role: 'dialog', 'aria-label': 'Customise the ticket list' } },
            ...sections, footer);
        // Clicks in the shadow root reach the document retargeted to the host, so
        // the panel stops them before the outside-click handler closes it.
        panel.addEventListener('click', event => event.stopPropagation());
        return panel;
    }

    function positionPanel() {
        const rect = toolbar.button.getBoundingClientRect();
        Object.assign(toolbar.panel.style, {
            top: `${rect.bottom + 6}px`,
            right: `${Math.max(8, window.innerWidth - rect.right)}px`,
            maxHeight: `${Math.max(200, window.innerHeight - rect.bottom - 18)}px`
        });
    }

    const panelOpen = () => !!toolbar?.panel.classList.contains('open');

    // Does nothing when already in the requested state, so the document-wide
    // click handler costs nothing while the panel is closed.
    function togglePanel(open = !panelOpen()) {
        if (!toolbar || open === panelOpen()) return;
        if (open) { syncPanel(); positionPanel(); }
        toolbar.panel.classList.toggle('open', open);
        toolbar.button.setAttribute('aria-expanded', String(open));
    }

    // The top nav lives in a shadow root and can be re-rendered, so the toolbar
    // is rebuilt whenever its button is no longer connected. Counts go at the
    // start of the section, before the page numbers and Filters; Customise at the end.
    function setupToolbar() {
        const root = document.querySelector('ticket-top-nav')?.shadowRoot;
        if (!root || (toolbar?.root === root && toolbar.button.isConnected)) return;
        const target = root.querySelector('[data-testid="right-section"]');
        if (!target) return;

        if (!root.getElementById('fd-toolbar-style')) root.appendChild(make('style', { id: 'fd-toolbar-style', textContent: toolbarCss }));

        const pills = Object.fromEntries(FOCUS.map(({ key }) => [key, make('button', {
            type: 'button', className: 'fd-pill', hidden: true, dataset: { tone: key },
            onclick: event => { event.stopPropagation(); setFocus(key); }
        })]));
        const button = make('button', {
            type: 'button', id: 'fd-customise-btn', className: 'fd-btn', textContent: 'Customise',
            attrs: { 'aria-haspopup': 'dialog', 'aria-controls': 'fd-customise-panel', 'aria-expanded': 'false' },
            onclick: event => { event.stopPropagation(); togglePanel(); }
        });
        const panel = buildPanel();

        target.prepend(make('div', { className: 'fd-toolbar' }, ...Object.values(pills)));
        target.appendChild(make('div', { className: 'fd-toolbar' }, button, panel));
        toolbar = { root, pills, button, panel };
        syncPanel();
        updateSummary();
    }

    // =========================================================================
    // Editor: paste sanitiser
    // =========================================================================
    // Pasted content keeps bold, italics, underline, links, lists, tables, images,
    // line breaks and paragraphs, and nothing else. Headings become paragraphs;
    // colour, font family, font size and anything else that resizes or restyles
    // text goes. Elements, attributes and inline properties are all allow-listed,
    // so an unforeseen format can't slip through. Only the clipboard runs through
    // here, so the toolbar's own font controls are unaffected.
    const LINK_PROTOCOLS  = /^(?:https?:|mailto:|tel:|#)/i;
    const IMAGE_PROTOCOLS = /^(?:https?:|cid:|data:image\/)/i;

    // Executable and interactive nodes go with their contents, so their guts
    // can't surface as text.
    const DROP_SELECTOR = 'script,style,link,meta,title,base,noscript,iframe,frame,frameset,object,embed,applet,form,input,button,select,textarea,option';

    // Any other element is unwrapped: the tag goes, its text stays. Table
    // internals are listed because unwrapping them would collapse the table.
    const KEEP_ELEMENTS = new Set(['p', 'div', 'br', 'span', 'b', 'strong', 'i', 'em', 'u', 'a', 'ul', 'ol', 'li', 'pre', 'code', 'img',
        'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption']);
    // width and height keep a pasted image at its displayed size, not its file size.
    const KEEP_ATTRIBUTES = new Set(['href', 'src', 'alt', 'title', 'width', 'height', 'colspan', 'rowspan', 'start', 'style']);

    // element.style only lists longhands, so a border shorthand arrives as width,
    // style and colour entries; the lookahead drops colour and border-image and
    // the border follows the text colour. Custom properties go too, since var()
    // can smuggle a colour in.
    const KEEP_STYLE = /^(?:font-weight|font-style|text-align|vertical-align|list-style-type|text-decoration(?:-line|-style|-thickness)?|border(?!.*(?:color|image))[\w-]*)$/;

    function sanitizeElement(el) {
        [...el.attributes].forEach(({ name, value }) => {
            const lower = name.toLowerCase();
            const protocols = lower === 'href' ? LINK_PROTOCOLS : lower === 'src' ? IMAGE_PROTOCOLS : null;
            if (!KEEP_ATTRIBUTES.has(lower) || (protocols && !protocols.test(value.trim()))) el.removeAttribute(name);
        });
        // Word's file:// images fail the protocol check and would arrive as broken icons.
        if (el.localName === 'img' && !el.hasAttribute('src')) return el.remove();
        if (!el.hasAttribute('style')) return;
        Array.from(el.style).forEach(prop => { if (!KEEP_STYLE.test(prop)) el.style.removeProperty(prop); });
        if (!el.style.length) el.removeAttribute('style');
    }

    function sanitizeClipboardHtml(html) {
        // DOMParser neither loads images nor runs scripts, so this is a safe tree.
        const body = new DOMParser().parseFromString(html, 'text/html').body;
        body.querySelectorAll(DROP_SELECTOR).forEach(el => el.remove());

        // Word and Outlook wrap blocks in conditional comments; drop the lot.
        const walker = body.ownerDocument.createTreeWalker(body, NodeFilter.SHOW_COMMENT);
        const comments = [];
        while (walker.nextNode()) comments.push(walker.currentNode);
        comments.forEach(node => node.remove());

        // Headings, <big>, <small> and <font> carry their size in the tag name, so
        // only unwrapping removes it. Headings keep their paragraph break; the rest
        // unwrap innermost first, so nesting collapses in one pass.
        body.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(heading => {
            const paragraph = body.ownerDocument.createElement('p');
            paragraph.append(...heading.childNodes);
            heading.replaceWith(paragraph);
        });
        [...body.querySelectorAll('*')].reverse().forEach(el => { if (!KEEP_ELEMENTS.has(el.localName)) el.replaceWith(...el.childNodes); });
        body.querySelectorAll('*').forEach(sanitizeElement);
        return body.innerHTML.trim();
    }

    // =========================================================================
    // Editor: colour guard
    // =========================================================================
    // A clean fragment isn't enough. When Chrome's insertHTML merges pasted blocks
    // into the paragraph around the caret, it writes the styles CSS was giving
    // them back in as inline styles, so a dark-mode text colour can land in the
    // reply and show white on white for the customer. Freshdesk's dark mode also
    // rewrites dark inline colours in the editor, parking the originals in
    // data-original-*/data-corrected-* attributes for html.get() to restore. So
    // every element an insertion creates or restyles is scrubbed after it lands.
    const EDITOR      = '.fr-element[contenteditable="true"]';
    const COLOUR_PROP = /color|background|shadow|fill|stroke|filter|border-image/;
    // Colour-named data attributes only: tracked links such as the survey link
    // carry data-original-href, which must survive.
    const COLOUR_ATTR = /^(?:color|bgcolor|background|data-(?:original|corrected)-[\w-]*(?:color|background|bg)[\w-]*)$/;

    const editorOf = target => (target instanceof Element ? target.closest(EDITOR) : null);

    function scrubColour(el) {
        [...el.attributes].forEach(({ name }) => { if (COLOUR_ATTR.test(name)) el.removeAttribute(name); });
        if (!el.style || !el.hasAttribute('style')) return;
        Array.from(el.style).forEach(prop => { if (COLOUR_PROP.test(prop)) el.style.removeProperty(prop); });
        if (!el.style.length) el.removeAttribute('style');
    }

    // Watches root until the returned finish() runs, then scrubs every element
    // added or restyled in between. Records already handed to the callback are
    // kept as well as queued ones, since a microtask checkpoint can fall between.
    function watchInsertion(root) {
        const records = [];
        const observer = new MutationObserver(list => records.push(...list));
        observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'color', 'bgcolor'] });
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
    // state, and a single input is announced once the result is final. The
    // pre-paste state is snapshotted first, as Froala's own paste does, so one
    // undo returns to it.
    let inserting = false;

    function insertScrubbed(root, html, text) {
        window.FroalaEditor?.INSTANCES?.find(inst => inst.el === root)?.undo?.saveStep();
        const finish = watchInsertion(root);
        inserting = true;
        try {
            document.execCommand(html ? 'insertHTML' : 'insertText', false, html || text);
        } finally {
            inserting = false;
            finish();
        }
        root.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }));
    }

    // On window in capture: the only place that beats Froala's own paste handler.
    function handleEditorPaste(event) {
        const root = editorOf(event.target);
        if (!root || !event.clipboardData) return;
        const html = event.clipboardData.getData('text/html');
        const text = event.clipboardData.getData('text/plain');
        if (!html && !text) return; // image or other non-text content: Froala uploads it
        event.preventDefault();
        event.stopImmediatePropagation();
        insertScrubbed(root, html && sanitizeClipboardHtml(html), text);
    }

    // Froala inserts drops itself, reading the dragged HTML during this dispatch
    // and handling moves and undo, so the event's getData is swapped to hand it
    // sanitised HTML instead. (Froala 5.0 also offers cleanup hooks for drops,
    // but 5.5 no longer fires them.)
    function handleEditorDrop(event) {
        const data = event.dataTransfer;
        if (!editorOf(event.target) || !data) return;
        const read = data.getData.bind(data);
        data.getData = type => {
            const value = read(type);
            return /html/i.test(type) && value ? sanitizeClipboardHtml(value) : value;
        };
    }

    // Insertions the browser performs itself (a drop or paste nobody intercepted)
    // sit between beforeinput and input, so they get the same scrub. The timeout
    // closes the watch if the insertion is cancelled and input never comes.
    let finishNative = null;

    function handleBeforeInput(event) {
        const root = editorOf(event.target);
        if (!root || !event.inputType?.startsWith('insertFrom')) return;
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

    // =========================================================================
    // Editor: toolbar
    // =========================================================================
    // Freshdesk loads far more Froala plugins than it exposes buttons for, so the
    // additions are built from Froala's own registry: icon, tooltip, shortcut,
    // dropdown, popup and disabled state all arrive with the markup. Keys are the
    // data-cmd of an existing button; the listed commands go directly after it.
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
    // app-icon on a 16 one; a viewBox scales to whatever box the class sets, so
    // swapping the class makes the two sets match.
    function buildButtons(inst, commands) {
        return inst.button.buildList(commands).replace(/\bfr-svg\b/g, 'app-icon app-icon--small');
    }

    // The overflow panel's padding is baked in at init from its button's position,
    // so buttons added to the left of that button would leave the two detached.
    function alignMorePanels(toolbarEl) {
        if (!toolbarEl.offsetParent) return;
        const left = toolbarEl.getBoundingClientRect().left;
        toolbarEl.querySelectorAll('.fr-more-toolbar[data-name]').forEach(panel => {
            const button = document.getElementById(panel.dataset.name);
            if (button) panel.style.paddingLeft = `${button.getBoundingClientRect().left - left}px`;
        });
    }

    // buildList returns each button with its dropdown menu as a sibling, so the
    // whole string goes in as one insertion and the two stay adjacent. Commands
    // are delegated from the toolbar, so injected buttons wire themselves.
    function extendToolbar(inst, toolbarEl) {
        Object.entries(TOOLBAR_ADDITIONS).forEach(([cmd, commands]) => {
            toolbarEl.querySelector(`.fr-btn-grp [data-cmd="${cmd}"]`)?.insertAdjacentHTML('afterend', buildButtons(inst, commands));
        });
        const group = make('div', { className: 'fr-btn-grp fr-float-right' });
        group.innerHTML = buildButtons(inst, TOOLBAR_TRAILING);
        toolbarEl.appendChild(group);
    }

    // Reply, note and forward each get their own editor and instance number, so
    // the guard lives on the toolbar element rather than on any id.
    function setupEditorToolbars() {
        window.FroalaEditor?.INSTANCES?.forEach(inst => {
            const toolbarEl = inst.$tb?.[0] || inst.$tb?.get?.(0) || document.getElementById('bold-' + inst.id)?.closest('.fr-toolbar');
            if (!toolbarEl) return;
            if (!toolbarEl.dataset.fdExtended) {
                toolbarEl.dataset.fdExtended = '1';
                extendToolbar(inst, toolbarEl);
            }
            alignMorePanels(toolbarEl);
        });
    }

    // =========================================================================
    // Start-up
    // =========================================================================
    // The editor toolbar goes last: it leans on a third-party registry, so a
    // change there can't take the list styling down with it.
    function refresh() {
        syncTheme();
        refreshList();
        setupToolbar();
        normalizeEmailBackgrounds();
        setupEditorToolbars();
    }

    // A card that changed is re-annotated inside the observer callback, which runs
    // before the browser paints: Freshdesk rebuilds parts of a card on its first
    // hover, and waiting would flash the plain labels. Text changes count too, so
    // a deadline that ticks over updates its chip. Everything else waits for the
    // debounced pass, which collapses an Ember re-render's flurry into one.
    let refreshTimer = null;
    new MutationObserver(records => {
        const cards = new Set();
        records.forEach(({ target }) => {
            const card = (target.nodeType === Node.ELEMENT_NODE ? target : target.parentElement)?.closest('.tickets__list');
            if (card) cards.add(card);
        });
        cards.forEach(annotateCard);
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(refresh, 150);
    }).observe(document.body, { childList: true, subtree: true, characterData: true });

    // Theme switches can happen with no DOM changes at all.
    const themeObserver = new MutationObserver(syncTheme);
    [document.documentElement, document.body].forEach(el =>
        themeObserver.observe(el, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] }));
    window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', syncTheme);

    window.addEventListener('storage', adoptSavedSettings);
    window.addEventListener('paste', handleEditorPaste, true);
    window.addEventListener('drop', handleEditorDrop, true);
    window.addEventListener('beforeinput', handleBeforeInput, true);
    window.addEventListener('input', handleInput, true);
    window.addEventListener('keydown', trackKeyboard, true);
    window.addEventListener('mousedown', clearKeyboard, true);
    window.addEventListener('resize', () => { if (panelOpen()) positionPanel(); });
    document.addEventListener('click', () => togglePanel(false));
    document.addEventListener('keydown', event => { if (event.key === 'Escape') togglePanel(false); });

    applySettings();
    refresh();
})();
