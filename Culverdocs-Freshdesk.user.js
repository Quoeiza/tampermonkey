// ==UserScript==
// @name         Culverdocs-Freshdesk
// @namespace    http://culverdocs.co.uk/
// @version      2.2.1
// @description  QoL improvements for displaying tickets with clearer priority and ESC indicators.
// @author       Lawrence Murrell
// @match        https://culverdocs.freshdesk.com/a/tickets*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=culverdocs.co.uk
// @grant        none
// @updateURL    https://raw.githubusercontent.com/Quoeiza/tampermonkey/main/Culverdocs-Freshdesk.user.js
// @downloadURL  https://raw.githubusercontent.com/Quoeiza/tampermonkey/main/Culverdocs-Freshdesk.user.js
// ==/UserScript==

(function () {
    'use strict';

    // ============================
    // Configuration and state
    // ============================
    const STORAGE_KEY = 'fd_card_style_mode';
    const STYLE_NAMES = ['Gradient','Fill','None'];
    const storedMode  = localStorage.getItem(STORAGE_KEY);
    let styleMode     = storedMode == null ? 2 : parseInt(storedMode,10);

    if (![0,1,2].includes(styleMode)) {
        styleMode = 2;
        localStorage.setItem(STORAGE_KEY,'2');
    }

    const statusColours = {
        Open: '#ffe4e1',
        Pending: '#fff6cc',
        'On Hold': '#e8f4fc',
        Resolved: '#ddfddf',
        Closed: '#ddfddf'
    };

    // ============================
    // CSS injection
    // ============================
    const css = `
.col-md-12{padding-left:0;padding-right:0}
.left-nav-mfe-wrapper,.left-nav-mfe{width:240px!important}
.fd-style-dropdown{position:relative;display:inline-block;vertical-align:middle;margin-right:10px}
.fd-style-dropdown-btn{font-size:13px;font-weight:500;background:#f8f9fa;border:1px solid #d7dbe3;color:#375e6b;padding:2px 14px;height:30px;cursor:pointer;transition:background .18s,color .18s;outline:0;min-width:auto;text-align:left}
.fd-style-dropdown-content{display:none;position:absolute;background-color:#f1f1f1;min-width:160px;box-shadow:0 8px 16px 0 rgba(0,0,0,.2);z-index:10;overflow:hidden}
.fd-style-dropdown-content a{color:#000;padding:8px 16px;text-decoration:none;display:block;font-size:13px}
.fd-style-dropdown-content a:hover{background-color:#ddd}
.show-dropdown{display:block}
.hidden-overdue-badge{display:none!important}
.avatar-icon.avatar-icon--rounded .avatar-block{margin-left:9px}
.avatar-image{display:none!important}
.ticket-info[data-esc]::before{display:inline-block;margin-right:4px;font-size:13px;vertical-align:text-top;white-space:nowrap}
.ticket-info[data-esc="L1"]::before{content:"⚠️"}
.ticket-info[data-esc="L2"]::before{content:"🚨"}
.ticket-info[data-esc="L1L2"]::before{content:"⚠️🚨"}
.current__item--active td:first-child::before{width:0}
.__module-tickets__assign-to .element-flex>div:first-child{display:none}
[style*="width: 400px"]{width:120px!important}
[style*="width: 120px"]{width:200px!important}
[style*="width: 12vw"]{width:80px!important}
.tickets__list{min-height:76px;display:table;width:99%;box-sizing:border-box;position:relative;margin-bottom:6px;background:var(--card-background,#fff);border-radius:0px !important;}
.tickets__list,.trial-widget{margin-bottom:12px!important;box-shadow:2px 4px 6px 0 #cfd7df}
.__module-tickets__tickets-list__tickets-table__ticket-item .list-content{padding-left:0!important}
.tickets__list .list-content--main{padding-right:0;background:transparent!important}
.tickets__list .list-content{padding-top:0;padding-bottom:0}
.tickets__list .ticket-title-row{display:flex;align-items:center!important;margin:0;gap:0;width:100%}
.tickets__list .ticket-title-row .muted[data-test-ticket-id]{margin-left:auto!important;font-size:15px;font-weight:500;color:#778393;min-width:52px;text-align:right}
.wordbreak-fix{color:#19334c;font-size:18px;font-weight:600}
.ticket-info{padding-top:0px;color:#6f7c87;font-size:14px}
.ticket-due-soon-border,.ticket-due-today-border,.ticket-priority-border,.ticket-new-border{border-left:none!important}
.ticket-priority-border::before,.ticket-new-border::before{content:"";position:absolute;top:0;bottom:0;left:0;width:5px;background:#f22;border-top-left-radius:0px;border-bottom-left-radius:0px}
.ticket-tag-toprow,.ticket-tag-toprow>.tag,.ticket-tag-toprow>span[class^="tag--"],.ticket-tag-toprow>.ticket-ribbon{display:none!important}
.list-check-wrap{position:relative}
.list-filter-wrap .list-filter__item,.list-filter-wrap .list-filter__priority,.list-filter-wrap .list-filter__status{width:170px}
.list-filter-wrap .list-filter__icon-assignto,.list-filter-wrap .list-filter__icon-status{top:-2px}
.list-filter-wrap .list-filter__item--icon-overlay{background:#ffffff00}
.list-filter-wrap .list-filter__priority .list-filter__item--icon-overlay{top:1px}
.list-filter__item,.list-filter__item:hover,.list-filter__item:focus,.list-filter__item:active,.list-filter__priority,.list-filter__priority:hover,.list-filter__priority:focus,.list-filter__priority:active,.list-filter__status,.list-filter__status:hover,.list-filter__status:focus,.list-filter__status:active,.assignto-filter-wrap,.assignto-filter-wrap:hover,.assignto-filter-wrap:focus,.assignto-filter-wrap:active,.ticket-list-dropselect,.ticket-list-dropselect:hover,.ticket-list-dropselect:focus,.ticket-list-dropselect:active,.ember-power-select-trigger,.ember-power-select-trigger:hover,.ember-power-select-trigger:focus,.ember-power-select-trigger:active,.ember-basic-dropdown-trigger,.ember-basic-dropdown-trigger:hover,.ember-basic-dropdown-trigger:focus,.ember-basic-dropdown-trigger:active{background:0 0!important;background-color:transparent!important}
.list-content-wrap{padding:16px}
.list-content--info{background:transparent!important}
.app-content-area,body{min-width:958px}
.col-md-9{width:auto}
@media (max-width:1120px){
.tickets__list .list-content--info,.fd-style-dropdown-btn{display:none}
}
`;

    const styleElement = document.createElement('style');
    styleElement.textContent = css;
    document.head.appendChild(styleElement);

    // ============================
    // Utility functions
    // ============================
    function extractDueInfo(text) {
        const lower = text.toLowerCase();
        const overdueMatch = lower.match(/overdue.*?(\d+)\s*(day|hour|minute|d|h|m)/i);
        if (overdueMatch) return { type: 'overdue', value: +overdueMatch[1], unit: overdueMatch[2] };
        const dueMatch = lower.match(/due.*?in.*?(\d+)\s*(day|hour|minute|d|h|m)/i);
        return dueMatch ? { type: 'due', value: +dueMatch[1], unit: dueMatch[2] } : null;
    }

    function applyEscState(rootElement,tags) {
        const infoElement = rootElement.querySelector('.ticket-info');
        if (!infoElement) return;
        infoElement.removeAttribute('data-esc');
        const hasL2 = tags.includes('L2-ESC');
        const hasL1 = tags.includes('L1-ESC');
        if (hasL1 && hasL2) infoElement.setAttribute('data-esc','L1L2');
        else if (hasL1) infoElement.setAttribute('data-esc','L1');
        else if (hasL2) infoElement.setAttribute('data-esc','L2');
    }

    function isUrgent(fullText,dueInfo,tagsText) {
        if (!dueInfo && tagsText.indexOf('new') < 0) return false;

        let urgent = false;
        if (dueInfo) {
            if (dueInfo.type === 'overdue') urgent = true;
            if (dueInfo.type === 'due') {
                const unitShort = (dueInfo.unit || '')[0];
                if (unitShort === 'm') urgent = true;
                else if (unitShort === 'h' && dueInfo.value <= 4) urgent = true;
                else if (unitShort === 'd' && dueInfo.value === 1) urgent = true;
            }
        }
        if (tagsText.indexOf('new') > -1) urgent = true;

        if (!urgent && fullText) {
            const lower = fullText.toLowerCase();
            const idx = lower.indexOf('customer responded');
            if (idx !== -1) {
                const windowText = lower.slice(idx,idx + 120);
                const recentShort = /\b(minute|min|minutes|mins|hour|hr|hours)\b/.test(windowText);
                const recentLong  = /\b(day|days|week|weeks|month|months|year|years)\b/.test(windowText);
                if (recentShort && !recentLong) urgent = true;
            }
        }
        return urgent;
    }

    function hideTagElements(rootElement) {
        rootElement
            .querySelectorAll('.ticket-tag-wrap,.status-tag-wrap,.ticket-tag-toprow')
            .forEach(el => { el.style.display = 'none'; });
    }

    // ============================
    // Card styling
    // ============================
    function applyCardStyles() {
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
                const ticketStatus  = Object.keys(statusColours).find(status => ticketText.includes(status)) || 'Open';
                const listContainer = cardElement.closest('.tickets__list');

                if (listContainer) {
                    let background = '#fff';
                    if (styleMode === 0) {
                        background = `linear-gradient(90deg,${statusColours[ticketStatus]} 0,#fff 800px)`;
                    } else if (styleMode === 1) {
                        background = statusColours[ticketStatus];
                    }
                    listContainer.style.background = background;
                }

                mainContent.style.background = 'transparent';
                const infoBlock = cardElement.querySelector('.list-content--info');
                if (infoBlock) infoBlock.style.background = 'transparent';

                const dueInfo        = extractDueInfo(ticketText);
                const tagNodes       = [...mainContent.querySelectorAll('span.tag,span[class^="tag--"],.list-item')];
                const tags           = tagNodes.map(el => el.textContent.trim());
                const tagsLowerJoined = tagNodes
                    .map(el => el.textContent.trim().toLowerCase())
                    .join(' ');
                const urgent         = isUrgent(ticketText,dueInfo,tagsLowerJoined);

                mainContent.classList.toggle(
                    'ticket-new-border',
                    ticketStatus === 'Open' && urgent
                );

                hideTagElements(mainContent);
                applyEscState(cardElement,tags);
            });
    }

    // ============================
    // Dropdown setup
    // ============================
    function setupDropdowns() {
        if (document.getElementById('style-select-btn')) return;

        const targetContainer = document.querySelector('.page-actions__right .pull-right');
        if (!targetContainer) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'fd-style-dropdown';

        const button = document.createElement('button');
        button.id = 'style-select-btn';
        button.type = 'button';
        button.textContent = 'Style: ' + STYLE_NAMES[styleMode];
        button.className = 'fd-style-dropdown-btn';

        const menu = document.createElement('div');
        menu.className = 'fd-style-dropdown-content';

        STYLE_NAMES.forEach((name,index) => {
            const link = document.createElement('a');
            link.href = '#';
            link.textContent = name;
            link.dataset.index = String(index);
            link.onclick = event => {
                event.preventDefault();
                event.stopPropagation();
                styleMode = index;
                localStorage.setItem(STORAGE_KEY,String(styleMode));
                button.textContent = 'Style: ' + STYLE_NAMES[styleMode];
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

        wrapper.appendChild(button);
        wrapper.appendChild(menu);
        targetContainer.insertBefore(wrapper,targetContainer.firstChild);

        document.addEventListener('click',event => {
            if (!event.target.closest('.fd-style-dropdown')) {
                document
                    .querySelectorAll('.fd-style-dropdown-content')
                    .forEach(dropdown => dropdown.classList.remove('show-dropdown'));
            }
        });
    }

    // ============================
    // Mutation observer and initialisation
    // ============================
    const observer = new MutationObserver(() => {
        observer.disconnect();
        applyCardStyles();
        setupDropdowns();
        observer.observe(document.body,{ childList: true, subtree: true });
    });

    observer.observe(document.body,{ childList: true, subtree: true });
    applyCardStyles();
    setupDropdowns();
})();
