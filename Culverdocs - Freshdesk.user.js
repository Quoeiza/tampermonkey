// ==UserScript==
// @name         Culverdocs - Freshdesk
// @namespace    http://culverdocs.co.uk/
// @version      0.2.0
// @description  Quality-of-life improvements for displaying tickets on the platform, highlighting priority tickets more clearly.
// @author       Lawrence Murrell
// @match        https://culverdocs.freshdesk.com/a/tickets*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=culverdocs.co.uk
// @grant        none
// @updateURL    https://raw.githubusercontent.com/Quoeiza/tampermonkey/main/Culverdocs%20-%20Freshdesk-0.2.1.user.js
// @downloadURL  https://raw.githubusercontent.com/Quoeiza/tampermonkey/main/Culverdocs%20-%20Freshdesk-0.2.1.user.js
// ==/UserScript==

(function () {
    'use strict';

    /* ----------  PERSISTENT STYLE MODE  ---------- */
    const STORAGE_KEY = 'fd_card_style_mode';
    const modeNames   = ['Gradient', 'Fill', 'None'];
    const stored      = localStorage.getItem(STORAGE_KEY);
    let   styleMode   = stored === null ? 2 : parseInt(stored, 10);
    if (![0,1,2].includes(styleMode)) {
        styleMode = 2;
        localStorage.setItem(STORAGE_KEY, '2');
    }
    const HIGHLIGHT_STORAGE_KEY = 'fd_highlight_mode';
    const highlightModeNames = ['All', 'Company', 'Users', 'None'];
    const storedHighlight = localStorage.getItem(HIGHLIGHT_STORAGE_KEY);
    let highlightMode = storedHighlight === null ? 0 : parseInt(storedHighlight, 10);
    if (![0,1,2,3].includes(highlightMode)) {
        highlightMode = 0;
        localStorage.setItem(HIGHLIGHT_STORAGE_KEY, '0');
    }

    /* ----------  COMPANY COLOR DEFINITIONS  ---------- */
    const predefinedCompanyColors = {
        '5AM Contract Cleaning': '#10a7d7',
        'A - New Test Acc': '#5aa6b8',
        'A1 Fire Protection': '#401eeb',
        'Abbey Cleaning Limited': '#ed1f29',
        'Able Safety': '#a91e18',
        'Acorn Environmental Management Group': '#fa4d09',
        'ACS Cleaners': '#299035',
        'Advantage Catering Equipment': '#3d67ad',
        'Aegis Support Services': '#4c83b5',
        'Aegis Support Services - Security': '#4c83b5',
        'Air Force 1 Ltd': '#95b3d7',
        'Albert J Jones Ltd': '#351ec5',
        'Alliance Group Solutions': '#0097cc',
        'Alpha Hospital Group': '#111111',
        'Angel Refrigeration': '#394c6c',
        'Argenbright Security Europe Limited (ASEL)': '#312783',
        'ARS UK Ltd': '#ed8b02',
        'Ashlea Ltd': '#1e6d02',
        'Asset-fix Limited': '#5aa6b8',
        'Asvina (UK) Ltd': '#e20612',
        'At home live in care': '#5aa6b8',
        'Atlas FM': '#4d8eb4',
        'AVA Holding Group': '#22a385',
        'B&B Group': '#067b58',
        'B&R Couriers': '#073255',
        'BAGMA': '#ef3e33',
        'BAGMA Feedback': '#ef3e33',
        'BAGMA Webinar': '#ef3e33',
        'Banham Poultry Ltd': '#d03924',
        'Banlaw Systems (Europe) Ltd': '#5aa6b8',
        'Baroness': '#d80b24',
        'Barrell Treecare': '#49176d',
        'Base One': '#b68300',
        'BCL School Attendance Team': '#2b3e5f',
        'Ben Burgess': '#2e561d',
        'bespoke Cleaning Services': '#623379',
        'bespoke Cleaning Services - UOG': '#5aa6b8',
        'Big Atom': '#44c26d',
        'Big Mountain Consultancy Ltd': '#22a2c4',
        'Birch Utility Services': '#0c8741',
        'Bloomsbury Glass': '#007495',
        'Blue Art Clean Services': '#53d5fd',
        'Blue Square Utilities': '#5aa6b8',
        'BML Group Ltd': '#4986aa',
        'Bourne Group': '#170c42',
        'BoxVn': '#8fd000',
        'BreArb Tree Services': '#104b26',
        'Campbell of Doune Ltd': '#70924f',
        'Capel Machinery': '#ec6707',
        'CarrÆs Billington': '#003057',
        'CBRE Ltd': '#003f2d',
        'CDER Group': '#5aa6b8',
        'Cerebral Security Solutions': '#019acf',
        'Charterhouse Medical': '#0042ff',
        'City Access Scaffolding': '#efc10b',
        'Cityfield Recruitment': '#53b4e4',
        'Clean Water Systems Ltd': '#1c519e',
        'CleanEvent Services': '#053694',
        'Cleaning Team': '#5aa6b8',
        'Cloudfm Group': '#211e53',
        'CMC Chesterfield': '#25487f',
        'Cole Fabrics': '#605355',
        'Colours Test (INTERNAL ACC)': '#c80000',
        'Community Windpower Limited': '#5aa6b8',
        'Complete Warehouse Services': '#5aa6b8',
        'Construction Co. (INTERNAL ACC)': '#642200',
        'Copeinca': '#00363b',
        'Cotswold Gleam Team': '#183040',
        'County Linen': '#00a5e3',
        'CQ Cleaning': '#e02b20',
        'Crimson Care': '#f02624',
        'Culverdocs Cleaning Co.': '#5aa6b8',
        'Culverdocs Demo Co.': '#0c133d',
        'Culverdocs Sandbox': '#5aa6b8',
        'Culverdocs Training Centre - Cara Tuck': '#5aa6b8',
        'Culverdocs Training Centre - Latif Murad': '#5aa6b8',
        'Culverdocs Training Centre - Lawrence Murrell': '#5aa6b8',
        'Culverdocs Training Centre - Thomas King': '#5aa6b8',
        'Culvertech Ltd': '#453b6d',
        'D2 Facilities': '#97c33d',
        'Dace Motor Company': '#5aa6b8',
        'Dance & Dean': '#24356d',
        'Davis Trackhire': '#00a601',
        'Demelza': '#ff0000',
        'Dementia Experts': '#014745',
        'Demo - Quality & Service': '#23338a',
        'Derwent FM': '#0f2860',
        'Design Cleaning': '#5aa6b8',
        'Direct Cleaning Services': '#213480',
        'Dovetail Group': '#3767ae',
        'Dowds Group': '#2d2f87',
        'DP Builders': '#9e326c',
        'Dr. Oetker': '#003f9a',
        'DSM Nutritional Products (UK) Ltd': '#1b3f95',
        'Dubai Aerospace Enterprise (DAE) Ltd': '#b7191f',
        'Dupliq Limited': '#74388b',
        'Dynova': '#5a5c9d',
        'E.G Steele Co Ltd': '#1b6e90',
        'Early Excellence': '#89ccca',
        'Earthmoving Extras': '#d18f00',
        'Ebrington (NI) Ltd': '#163c8b',
        'Eco Brite Cleaning': '#3c752e',
        'Engineering Co. (INTERNAL ACC)': '#5aa6b8',
        'ESM Group': '#802f5e',
        'Evalian Test Account': '#24b4b5',
        'Express Service Engineering Ltd': '#1e4b87',
        'Faithorn Farrell Timms': '#0075c5',
        'Farplants': '#74a037',
        'Fire Risk Prevention Agency': '#df1a16',
        'Fit To Last': '#000000',
        'Focus on Testing': '#ff0020',
        'ForeWood Renewables Ltd': '#469b23',
        'Foundry Steels': '#0e74c6',
        'Four Seasons Fruiterers': '#0b8343',
        'GA Groundcare Ltd': '#026635',
        'Galebreaker': '#5aa6b8',
        'Gavin Jones': '#006a32',
        'George Benson Limited': '#5762aa',
        'GGM Group Ltd': '#0c8c48',
        'Glenn Cleaning and Support Services': '#96c93d',
        'Google oAuth Testing': '#5aa6b8',
        'GP Masonry Contractors': '#586971',
        'Gray & Amor Ltd': '#11573f',
        'Grimshaw Architects': '#262626',
        'Grosvenor Services': '#1e6aab',
        'GrowUp Farms': '#3b683d',
        'Guthrie & Craig': '#1f2936',
        'Hamilton Ross Group': '#c0995d',
        'Harriet Ellis Training Solutions': '#0d2467',
        'Helicom': '#000000',
        'Helping Hands': '#aac34d',
        'Hindley Circuits': '#5aa6b8',
        'HOLT JCB': '#5aa6b8',
        'HSL Compliance (Amersham Hospital)': '#123a5e',
        'HSL Compliance (Beacon Centre)': '#123a5e',
        'HSL Compliance (HOME)': '#121568',
        'HSL Compliance (PRU)': '#5e1212',
        'HSL Compliance (PRU) - NEW': '#123a5e',
        'HSL Compliance (QEH)': '#123a5e',
        'HSL Compliance (Rugby St Cross)': '#123a5e',
        'HSL Compliance (Skanska)': '#121568',
        'HSL Compliance (Townlands Hospital)': '#123a5e',
        'HSL Compliance (Walsgrave - OLD)': '#5e121d',
        'HSL Compliance (Walsgrave)': '#123a5e',
        'HSL Compliance (Whiston Hospital)': '#123a5e',
        'HSL Compliance (Wycombe Hospital)': '#123a5e',
        'HTB Services': '#0e365d',
        'Huddersfield Giants Ltd': '#7f0654',
        'Humphreys Electrical Limited': '#00448b',
        'Hunt Forest Group': '#367c26',
        'Hygiene Group': '#c3c000',
        'Icon Lifts': '#4055b2',
        'idverde UK': '#50a584',
        'Ikonic Lifts': '#00248f',
        'Imedco': '#3558a2',
        'Industrial Commercial Domestic Ltd (ICD)': '#2c4c6c',
        'InstaGroup Ltd': '#ff8200',
        'Intech Environmental': '#297136',
        'Interprit Limited': '#700099',
        'Isle of Man Fire & Rescue Service': '#f31b1f',
        'Jamelah Permanent Cosmetics': '#5aa6b8',
        'JB Fire Safety': '#fe040b',
        'Jiangnan Xie': '#5aa6b8',
        'John Peck Construction': '#5aa6b8',
        'Jools Howe - Veterinary Physiotherapy & Rehabilitation': '#0b5a6d',
        'Just Ask Estate Services Ltd': '#53519e',
        'Karsten UK': '#25618d',
        'KCC Services': '#5aa6b8',
        'Kemp Services Ltd': '#5aa9dd',
        'Key Health Solutions': '#35ae65',
        'Kier Group': '#e42312',
        'Kumon Study Centre': '#5aa6b8',
        'LARC Construction': '#588030',
        'Lees Decorators': '#525252',
        'Liftsafe Solutions': '#ff0000',
        'Lister Wilder': '#575756',
        'Loma Systems': '#0033a0',
        'Lorem Veterinary Physiotherapy': '#800029',
        'Lotus Care Technology': '#5aa6b8',
        'LT Training Services Ltd': '#02037c',
        'Luxus Ltd': '#7eccc2',
        'Mandy Rail': '#0c0c0d',
        'Mars Pet Care': '#0000a0',
        'Marst Agri': '#4bae46',
        'Martin Gibb Associates': '#649b3d',
        'Martlets Hospice': '#3b80cc',
        'Masons Kings': '#14723f',
        'Max Hilton Training': '#803300',
        'Meadow': '#173f2d',
        'Meirion Davies': '#007237',
        'Messenger Building Repairs': '#2a364c',
        'MJS Tax': '#5aa6b8',
        'MNF Solutions': '#1336e7',
        'Moorville Residential': '#37549a',
        'Multi Serve': '#279029',
        'Nairn\'s Oatcakes': '#672e3f',
        'Natural World Products': '#009360',
        'New College': '#003366',
        'Northern Lift Trucks': '#24264e',
        'NorthernArb Tree Services': '#1e1e1e',
        'Ohui Restorations Ltd': '#5aa6b8',
        'OJ Building Services': '#2733a1',
        'Old Lanwarnick Cottages': '#141b41',
        'Olivers Mill': '#1a2d4e',
        'Olivers Mill - MAIN': '#1a2d4e',
        'Opsana': '#5aa6b8',
        'Oracy': '#3a8ce0',
        'Owen Environmental Ltd': '#080808',
        'Palfinger UK': '#ff0000',
        'Pan Publicity': '#c80f40',
        'Passmore Cleaning': '#225ebf',
        'Pendrich Height Services Ltd': '#1d0a62',
        'Pennington Choices Ltd': '#8f95bb',
        'Praxis Yacht Services': '#002c4a',
        'Premier Services': '#13274b',
        'PrepWorld': '#812990',
        'PrepWorld Training': '#5aa6b8',
        'Proarb Ltd': '#fb8826',
        'Proclean Oxford Limited': '#a71021',
        'Prolec Electrical Services': '#25aae2',
        'Purbeck Safety': '#189d9a',
        'Quality & Service': '#24348b',
        'QuidelOrtho': '#774def',
        'R-S-S': '#1b253d',
        'RDI Renewables': '#5aa6b8',
        'Realm Staffing Solutions': '#1a73b8',
        'Redlynch Tractors': '#326b3d',
        'Remora Cleaning': '#0090c8',
        'Renewable Energy Management': '#f5622c',
        'Resmar Ltd': '#105f99',
        'Revolution Veterinary Physiotherapy': '#c47317',
        'Rhenus Logistics': '#084997',
        'Royal Devon University Healthcare NHS Foundation Trust': '#005eb8',
        'Royal National Lifeboat Institution (RNLI)': '#003672',
        'RSR': '#182435',
        'RT Solar': '#53b1b1',
        'Sabre Jetting Services Ltd': '#011f3b',
        'Safety Aide Ltd': '#414240',
        'Sansum Solutions Group Limited': '#5aa6b8',
        'Scotbark': '#098e07',
        'SFM (UK) Ltd': '#1b1b51',
        'SGL System': '#00243e',
        'Shazan Foods Limited': '#540b3c',
        'SIE Industrial': '#15325c',
        'Simbec-Orion': '#0aacc3',
        'Skyncare': '#57568f',
        'Slicker Recycling': '#81c240',
        'Sofa Brands International': '#43b9e9',
        'Southgate Global': '#c5062b',
        'Sowerbys': '#3f4b47',
        'Spectrum Brands': '#0576d6',
        'Spectrum Gas Systems Ltd': '#1c5780',
        'St. George\'s Hill Residents\' Assoc.': '#33613c',
        'Steadline': '#049f8d',
        'Stevenage Borough Council': '#009452',
        'Susan Ryrie Therapies': '#b5404f',
        'Susanne Kaufmann Ltd': '#5aa6b8',
        'Swift Inspection Services': '#a52824',
        'Swindon Borough Council': '#f47b20',
        'Switch Rail': '#5aa6b8',
        'T H WHITE': '#282f67',
        'TAC Security - CASA Scan': '#5aa6b8',
        'Tangmere Airfield Nurseries': '#1c8759',
        'TeacherActive Ltd': '#0033ab',
        'Template Forms': '#5aa6b8',
        'TH Moore': '#eb3245',
        'The Bar Company': '#5aa6b8',
        'The Monster Shop': '#000000',
        'The Stage Bus': '#222720',
        'The Utilisation Management Unit (NHS)': '#0367bc',
        'Thorpe Park': '#142248',
        'Tidy Green Clean': '#5aa6b8',
        'Total Clean': '#75b526',
        'Tranquility Homes': '#00406f',
        'Trueline Midlands Ltd': '#c5001c',
        'TUV SUD - Nuclear Technologies': '#004c8e',
        'UK Gas Technologies Group': '#003972',
        'UK Radiators': '#5aa6b8',
        'Ulyett Landscapes': '#a70048',
        'Vendmaster Ltd': '#008251',
        'Veterinary Medicines Directorate (VMD)': '#5aa6b8',
        'Vincent Tractors Ltd': '#d64629',
        'VIVID Digital Retail': '#1d1d1d',
        'Waitings Ltd': '#3b8a3f',
        'Water Direct': '#003794',
        'Wil-Test Solutions Ltd': '#000000',
        'William Grant & Sons': '#1e1a34',
        'Xenon Services Ltd': '#5aa6b8',
        'Yamaha': '#000000',
        'Yamaha Motor Europe N.V.': '#e40514',
        'Yamaha Motor Europe N.V., Branch Benelux': '#e40714',
        'Yamaha Motor Europe N.V., Branch UK': '#d52b1e',
        'Yamaha Motor Europe N.V., filial Sverige': '#e00611',
        'Yamaha Motor Europe N.V., Spain': '#f20707',
        'Zapier Testing (INTERNAL ACC)': '#f74800'
    };

    /* ----------  BASE CSS STYLES  ---------- */
    const css = `
/* ========================================
    LAYOUT & GENERAL STYLES
    ======================================== */

.col-md-12 {
    padding-left: 0;
    padding-right: 0;
}

.left-nav-mfe-wrapper,
.left-nav-mfe {
    width: 240px !important;
}

/* Style for highlighted company names */
.company-name-highlight {
    font-weight: 600;
    padding: 0px 5px 1px 6px;
    border-radius: 100px;
    margin-left: 0px;
    display: inline-block;
}

/* Style for highlighted user names */
.user-name-highlight {
    font-weight: 600;
    padding: 0px 5px 1px 6px;
    border-radius: 100px;
    display: inline-block;
}

/* ========================================
    BUTTONS & DROPDOWNS
    ======================================== */

.fd-style-dropdown {
    position: relative;
    display: inline-block;
    vertical-align: middle;
    margin-right: 10px;
}

.fd-style-dropdown-btn {
    font-size: 13px;
    font-weight: 500;
    background: #f8f9fa;
    border: 1px solid #d7dbe3;
    border-radius: 6px;
    color: #375e6b;
    padding: 2px 14px;
    height: 30px;
    cursor: pointer;
    transition: background .18s, color .18s;
    outline: none;
    min-width: auto;
    text-align: left;
}

.fd-style-dropdown-content {
    display: none;
    position: absolute;
    background-color: #f1f1f1;
    min-width: 160px;
    box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.2);
    z-index: 10;
    border-radius: 6px;
    overflow: hidden;
}

.fd-style-dropdown-content a {
    color: black;
    padding: 8px 16px;
    text-decoration: none;
    display: block;
    font-size: 13px;
}

.fd-style-dropdown-content a:hover {
    background-color: #ddd;
}

.show-dropdown {
    display: block;
}


/* ========================================
    ICONS & BADGES
    ======================================== */

.esc-icon {
    display: inline-block;
    width: 14px;
    height: 14px;
    margin-right: 6px;
    vertical-align: text-bottom;
    position: relative;
    top: -8px;
    left: -2px;
}

.hidden-overdue-badge {
    display: none !important;
}

.avatar-icon.avatar-icon--rounded .avatar-block {
    margin-left: 9px;
}

.avatar-image {
  display: none !important;
}

/* ========================================
    TABLES
    ======================================== */

.ember-light-table table {
    table-layout: fixed;
    border-collapse: collapse;
    width: 99.1%;
    box-sizing: border-box;
}

.current__item--active td:first-child::before {
    width: 0;
}

.__module-tickets__tickets-list__tickets-table__group-agent-column-renderer .header-text:first-child {
  display: none;
}

.__module-tickets__assign-to .element-flex > div:first-child {
  display: none;
}

[style*="width: 400px"] {
  width: 120px !important;
}

[style*="width: 120px"] {
  width: 200px !important;}

[style*="width: 12vw"] {
  width: 80px !important;
}

th:has([data-test-id="ticket-table-view-header-status"]) {
  width: 80px !important;
}

td:has([data-test-id="statusTranslatedLabel_test_label"]) {
  width: 80px !important;
}

/* ========================================
    TICKETS LIST CONTAINER
    ======================================== */

.list-filter-wrap .list-filter__item, .tickets__list {
    margin-bottom: 15px;
}

.tickets__list {
    min-height: 76px;
    border-radius: 5px;
    background: transparent;
    display: table;
    width: 99%;
    box-sizing: border-box;
    position: relative;
    /* z-index removed to prevent stacking context issues */
}

/* New pseudo-element for the background */
.tickets__list::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: -1;
    border-radius: 5px;
    background: var(--card-background, #fff);
}


.tickets__list,
.trial-widget {
    margin-bottom: 12px !important;
    box-shadow: 2px 4px 6px 0px #cfd7df;
}

.__module-tickets__tickets-list__tickets-table__ticket-item .list-content {
    padding-left: 0px !important;
}

.tickets__list .list-content--main {
    padding-right: 0px;
}
.tickets__list .list-content {
    padding-top: 0px;
    padding-bottom: 0px;
}

/* ========================================
    TICKET LIST CONTENT & STYLING
    ======================================== */

.list-filter-wrap .list-filter__item, .tickets__list {
    margin-bottom: 6px;
}

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
    color: #778393;
    min-width: 52px;
    text-align: right;
}

/* ========================================
    TICKET TITLE & TEXT STYLING
    ======================================== */

.wordbreak-fix {
    color: #19334c;
    font-size: 18px;
    font-weight: 600;
}

.ticket-info {
    padding-top: 8px;
    color: #6f7c87;
    font-size: 14px;
}

/* Development environment indicator */
.list-content[data-esc="dev"] .wordbreak-fix::before {
    content: '🛠️';
    font-size: 14px;
    position: relative;
    left: -3.5px;
    top: -3px;
    text-shadow: 1px 1px 0px rgba(0, 0, 0, 0.5);
}

/* Support environment indicator */
.list-content[data-esc="sup"] .wordbreak-fix::before {
    content: '🔔';
    font-size: 14px;
    position: relative;
    left: -3.5px;
    top: -3px;
    text-shadow: 1px 1px 0px rgba(0, 0, 0, 0.5);
}

/* ========================================
    TICKET HIGHLIGHTING & BORDERS
    ======================================== */

.lt-row.ticket-highlighted {
    position: relative;
}

.lt-row.ticket-highlighted::before {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    width: 5px;
    background: #ff2222;
}

.ticket-due-soon-border,
.ticket-due-today-border,
.ticket-priority-border,
.ticket-new-border {
    border-left: none !important;
}

.ticket-priority-border::before,
.ticket-new-border::before {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    width: 5px;
    background: #ff2222;
    border-top-left-radius: 5px;
    border-bottom-left-radius: 5px;
}

/* ========================================
    TICKET TAGS (HIDDEN)
    ======================================== */

.ticket-tag-toprow,
.ticket-tag-toprow > .tag,
.ticket-tag-toprow > span[class^="tag--"],
.ticket-tag-toprow > .ticket-ribbon {
    display: none !important;
}

/* ========================================
    LIST FILTERS & CONTROLS
    ======================================== */

.list-check-wrap {
    position: relative;
}

.list-filter-wrap .list-filter__item {
    width: 170px;
}

.list-filter-wrap .list-filter__priority {
    width: 170px;
}

.list-filter-wrap .list-filter__status {
    width: 170px;
}

.list-filter-wrap .list-filter__icon-assignto,
.list-filter-wrap .list-filter__icon-status {
    top: -2px;
}

.list-filter-wrap .list-filter__item--icon-overlay {
    background: #ffffff00;
}

.list-filter-wrap .list-filter__priority .list-filter__item--icon-overlay {
    top: 1px;
}

/* Disable all hover/focus background changes on filter elements */
.list-filter__item,
.list-filter__item:hover,
.list-filter__item:focus,
.list-filter__item:active,
.list-filter__priority,
.list-filter__priority:hover,
.list-filter__priority:focus,
.list-filter__priority:active,
.list-filter__status,
.list-filter__status:hover,
.list-filter__status:focus,
.list-filter__status:active,
.assignto-filter-wrap,
.assignto-filter-wrap:hover,
.assignto-filter-wrap:focus,
.assignto-filter-wrap:active,
.ticket-list-dropselect,
.ticket-list-dropselect:hover,
.ticket-list-dropselect:focus,
.ticket-list-dropselect:active,
.ember-power-select-trigger,
.ember-power-select-trigger:hover,
.ember-power-select-trigger:focus,
.ember-power-select-trigger:active,
.ember-basic-dropdown-trigger,
.ember-basic-dropdown-trigger:hover,
.ember-basic-dropdown-trigger:focus,
.ember-basic-dropdown-trigger:active {
    background: transparent !important;
    background-color: transparent !important;
}

/* ========================================
    TICKETS TABLE MODULE
    ======================================== */

.list-content-wrap {
    padding: 16px;
}

.app-content-area, body {
    min-width: 958px;
}

.col-md-9 {
    width: auto;
}

@media (max-width: 1120px) {
.tickets__list .list-content--info, .fd-style-dropdown-btn  {
    display: none;
  }
}

.__module-tickets__tickets-list__tickets-table .list-content .list-check-wrap {
    width: 28px;
}

.__module-tickets__tickets-list__tickets-table .list-content .list-check-wrap .custom-checkbox {
    top: -19px;
}

.__module-tickets__tickets-list__tickets-table .list-content .list-check-wrap .app-user-photo {
    display: none;
}
`;

    const styleEl = document.createElement('style');
    styleEl.textContent = css;
    document.head.appendChild(styleEl);

    /* ----------  COLOURS & UTILITIES  ---------- */
    const colourMap = {
        Open:'#ffe4e1', Pending:'#fff6cc', 'On Hold':'#e8f4fc', Resolved:'#ddfddf', Closed:'#ddfddf'
    };

    const companyColorMap = {};
    const userColorMap = {};

    /* ----------  COMPANY NAME MATCHING UTILITIES  ---------- */

    // Normalize company name for fuzzy matching
    function normalizeCompanyName(name) {
        return name
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .replace(/[^\w\s&]/g, '')
            .replace(/\b(ltd|limited|inc|incorporated|corp|corporation|llc|plc|co|company)\b/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    // Find the best matching company from predefined list
    function findBestCompanyMatch(inputName) {
        const normalizedInput = normalizeCompanyName(inputName);

        // First try exact match with original name
        if (predefinedCompanyColors[inputName]) {
            return predefinedCompanyColors[inputName];
        }

        // Try exact match with normalized names
        for (const [companyName, color] of Object.entries(predefinedCompanyColors)) {
            if (normalizeCompanyName(companyName) === normalizedInput) {
                return color;
            }
        }

        // Try fuzzy matching - check if normalized input is contained in any company name
        for (const [companyName, color] of Object.entries(predefinedCompanyColors)) {
            const normalizedCompany = normalizeCompanyName(companyName);
            if (normalizedCompany.includes(normalizedInput) || normalizedInput.includes(normalizedCompany)) {
                return color;
            }
        }

        // Try partial word matching for multi-word companies
        const inputWords = normalizedInput.split(' ').filter(word => word.length > 2);
        for (const [companyName, color] of Object.entries(predefinedCompanyColors)) {
            const companyWords = normalizeCompanyName(companyName).split(' ').filter(word => word.length > 2);

            // Check if most significant words match
            let matchCount = 0;
            for (const inputWord of inputWords) {
                for (const companyWord of companyWords) {
                    if (inputWord === companyWord ||
                        inputWord.includes(companyWord) ||
                        companyWord.includes(inputWord)) {
                        matchCount++;
                        break;
                    }
                }
            }

            // If majority of words match, consider it a match
            if (matchCount >= Math.min(inputWords.length, companyWords.length) * 0.6) {
                return color;
            }
        }

        return null; // No match found
    }

    // Enhanced company color function with predefined colors
    function getCompanyColorFromString(name, colorMap) {
        if (colorMap[name]) {
            return colorMap[name];
        }

        // Try to find a predefined color first
        const predefinedColor = findBestCompanyMatch(name);
        if (predefinedColor) {
            colorMap[name] = predefinedColor;
            return predefinedColor;
        }

        // Fall back to algorithmic color generation
        let hash = 0;
        const prime = 31;
        for (let i = 0; i < name.length; i++) {
            hash = prime * hash + name.charCodeAt(i);
        }
        const h = (hash * 137.508) % 360;
        const color = `hsl(${h}, 55%, 75%)`;
        colorMap[name] = color;
        return color;
    }

    // Generates a less vibrant, distinct color for Users
    function getUserColorFromString(name, colorMap) {
        if (colorMap[name]) {
            return colorMap[name];
        }
        let hash = 0;
        const prime = 17; // Different prime for a different color set
        for (let i = 0; i < name.length; i++) {
            hash = prime * hash + name.charCodeAt(i);
        }
        const h = (hash * 137.508) % 360;
        // Lower saturation and higher lightness for a more subdued pastel effect
        const color = `hsl(${h}, 40%, 85%)`;
        colorMap[name] = color;
        return color;
    }

    function extractDueInfo(text){
        const lower=text.toLowerCase();
        const mOver=lower.match(/overdue.*?(\d+)\s*(?:day|hour|minute|d|h|m)/i);
        if(mOver) return {type:'overdue', value:+mOver[1]};
        const mDue=lower.match(/due.*?in.*?(\d+)\s*(?:day|hour|minute|d|h|m)/i);
        if(!mDue) return null;
        return {type:'due', value:+mDue[1], unit:mDue[0].match(/day|hour|minute|d|h|m/i)[0]};
    }

    /* ---------- NAME HIGHLIGHTERS ---------- */
function highlightCompanyName(parentElement) {
    try {
        const ticketInfo = parentElement.querySelector('.ticket-info');
        if (!ticketInfo) return;

        // Check if we should show company highlights
        if (highlightMode !== 0 && highlightMode !== 1) {
            // Remove existing highlights if they exist
            const existingHighlight = ticketInfo.querySelector('.company-name-highlight');
            if (existingHighlight) {
                const originalText = existingHighlight.textContent;
                existingHighlight.replaceWith(document.createTextNode(originalText));
                // Reset the styling flag when removing highlights
                ticketInfo.dataset.companyStyled = 'false';
            }
            return;
        }

        // If we're switching back to company highlighting, force a reset and re-detection
        if (ticketInfo.dataset.companyStyled === 'true') {
            const existingHighlight = ticketInfo.querySelector('.company-name-highlight');
            if (!existingHighlight) {
                // Highlight was removed but flag wasn't reset, force re-detection
                ticketInfo.dataset.companyStyled = 'false';
            } else {
                return; // Already properly highlighted
            }
        }

        // Try to find company name pattern in the text content
        const allNodes = Array.from(ticketInfo.childNodes);
        const userLink = ticketInfo.querySelector('.user-link');
        if (!userLink) return;

        const userLinkIndex = allNodes.indexOf(userLink);
        if (userLinkIndex === -1) return;

        const textNodes = allNodes.slice(userLinkIndex + 1).filter(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim() !== '');

        if (textNodes.length >= 3 &&
            textNodes[0].textContent.trim() === '(' &&
            textNodes[2].textContent.trim() === ')') {

            const companyName = textNodes[1].textContent.trim();
            const color = getCompanyColorFromString(companyName, companyColorMap);
            const span = document.createElement('span');
            span.className = 'company-name-highlight';
            span.style.color = 'black';
            // Convert color to rgba with 50% opacity
            const rgba = color.startsWith('#')
                ? `${color}80`  // Add 80 (50% in hex) for hex colors
                : color.replace('hsl(', 'hsla(').replace(')', ', 0.5)');  // Convert HSL to HSLA
            span.style.backgroundColor = rgba;
            span.textContent = textNodes[0].textContent + textNodes[1].textContent + textNodes[2].textContent;

            textNodes[0].parentNode.replaceChild(span, textNodes[0]);
            textNodes[1].remove();
            textNodes[2].remove();

            ticketInfo.dataset.companyStyled = 'true';
        } else {
            // Alternative approach: look for company pattern in the full text
            const fullText = ticketInfo.textContent;
            const match = fullText.match(/\s+\(([^)]+)\)(?:\s|$)/);
            if (match) {
                // Find all text nodes and try to locate the company name
                const walker = document.createTreeWalker(
                    ticketInfo,
                    NodeFilter.SHOW_TEXT,
                    null,
                    false
                );

                let textNode;
                while (textNode = walker.nextNode()) {
                    const nodeText = textNode.textContent;
                    if (nodeText.includes('(' + match[1] + ')')) {
                        const companyName = match[1].trim();
                        const color = getCompanyColorFromString(companyName, companyColorMap);
                        const rgba = color.startsWith('#')
                            ? `${color}80`
                            : color.replace('hsl(', 'hsla(').replace(')', ', 0.5)');

                        // Replace the text node with highlighted version
                        const newText = nodeText.replace(
                            '(' + match[1] + ')',
                            `<span class="company-name-highlight" style="color: black; background-color: ${rgba}; font-weight: 600; padding: 0px 5px 1px 6px; border-radius: 10px; margin: 0 1px; display: inline-block;">(${companyName})</span>`
                        );

                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = newText;
                        const fragment = document.createDocumentFragment();
                        while (tempDiv.firstChild) {
                            fragment.appendChild(tempDiv.firstChild);
                        }
                        textNode.parentNode.replaceChild(fragment, textNode);

                        ticketInfo.dataset.companyStyled = 'true';
                        break;
                    }
                }
            }
        }
    } catch (e) { /* Silently fail */ }
}

function highlightUserName(parentElement) {
    try {
        const assignToElement = parentElement.querySelector('[data-test-assignto-trigger] > div');
        if (!assignToElement) return;

        // Check if we should show user highlights
        if (highlightMode !== 0 && highlightMode !== 2) {
            // Remove existing highlights if they exist
            const existingHighlight = assignToElement.querySelector('.user-name-highlight');
            if (existingHighlight) {
                const originalText = existingHighlight.textContent;
                assignToElement.innerHTML = originalText;
                assignToElement.dataset.userStyled = 'false';
            }
            return;
        }

        // If we're switching back to user highlighting, force a reset
        if (assignToElement.dataset.userStyled === 'true') {
            const existingHighlight = assignToElement.querySelector('.user-name-highlight');
            if (!existingHighlight) {
                // Highlight was removed but flag wasn't reset, so reset it
                assignToElement.dataset.userStyled = 'false';
            } else {
                return; // Already properly highlighted
            }
        }

        const userName = assignToElement.textContent.trim();
        if (userName && userName !== '--') {
            const color = getUserColorFromString(userName, userColorMap);
            const span = document.createElement('span');
            span.className = 'user-name-highlight';
            span.style.color = 'black';
            span.style.backgroundColor = color;
            span.textContent = userName;

            // Clear the element and append the new styled span
            assignToElement.innerHTML = '';
            assignToElement.appendChild(span);
            assignToElement.dataset.userStyled = 'true';
        }
    } catch (e) { /* Silently fail */ }
}


    /* ----------  CARD PROCESSOR  ---------- */
    function applyCardColours(){
        document.querySelectorAll('.__module-tickets__tickets-list__tickets-table__ticket-item').forEach(card=>{
            const mainContent = card.querySelector('[data-test-ticket-content]');
            if (!mainContent) return;

            mainContent.classList.remove('ticket-priority-border','ticket-due-soon-border','ticket-due-today-border','ticket-new-border');

            const status = Object.keys(colourMap).find(s=>mainContent.textContent.includes(s))||'Open';
            const ticketContainer = card.closest('.tickets__list');

            if (ticketContainer) {
                let backgroundStyle = '#fff';
                if (styleMode === 0) {
                    backgroundStyle = `linear-gradient(90deg,${colourMap[status]} 0,#fff 540px)`;
                } else if (styleMode === 1) {
                    backgroundStyle = colourMap[status];
                }
                ticketContainer.style.setProperty('--card-background', backgroundStyle);
            }

            mainContent.style.background = 'transparent';
            const infoPanel = card.querySelector('.list-content--info');
            if (infoPanel) {
                infoPanel.style.background = 'transparent';
            }

            if(status==='Open'){
                const d = extractDueInfo(mainContent.textContent);
                const newTag = [...mainContent.querySelectorAll('span.tag, span[class^="tag--"]')]
                    .some(el=>el.textContent.trim().toLowerCase()==='new');
                let urgent = newTag || (d&&d.type==='overdue');
                if(!urgent&&d&&d.type==='due'){
                    const u=d.unit[0];
                    urgent = u==='m'||(u==='h'&&d.value<=4)||(u==='d'&&d.value===1);
                }
                mainContent.classList.toggle('ticket-new-border',urgent);
            }

            mainContent.querySelectorAll('.esc-icon').forEach(e=>e.remove());

            const tags=[...mainContent.querySelectorAll('span.tag, span[class^="tag--"], .list-item')]
                .map(el=>el.textContent.trim());
            if(tags.includes('DEV-ESC'))      mainContent.setAttribute('data-esc','dev');
            else if(tags.includes('SUP-ESC')) mainContent.setAttribute('data-esc','sup');
            else                              mainContent.removeAttribute('data-esc');

            mainContent.querySelectorAll('.ticket-tag-wrap, .status-tag-wrap, .ticket-tag-toprow')
                .forEach(el=>el.style.display='none');

            highlightCompanyName(mainContent);
            highlightUserName(card);
        });
    }

/* ----------  TABLE PROCESSOR (UPDATED WITH TABLE HIGHLIGHTING)  ---------- */
function applyTableColours(){
    document.querySelectorAll('tr[data-test-id^="ticket-row"]').forEach(row=>{
        row.classList.remove('ticket-highlighted');
        row.style.background='';
        row.querySelectorAll('.esc-icon').forEach(e=>e.remove());

        let status='Open';

        // Find status cell using data-test-id instead of column position
        const statusCell = row.querySelector('[data-test-id="statusTranslatedLabel_test_label"]');
        if(statusCell) {
            status = statusCell.textContent.trim();
        }

        // Apply background color based on status
        row.style.background = styleMode===0
            ?`linear-gradient(90deg,${colourMap[status]} 0,#fff 540px)`
            :styleMode===1?colourMap[status]:'#fff';

        const due=extractDueInfo(row.textContent);

        // Find tags using a more flexible approach - look for elements with 'list-item' class
        const tagElements = row.querySelectorAll('.list-item');
        const tags = [...tagElements].map(el=>el.textContent.trim());

        // Determine if ticket is urgent
        const urgent=tags.includes('new')||(due&&due.type==='overdue')||
                     (due&&due.type==='due'&&(due.unit[0]==='m'||(due.unit[0]==='h'&&due.value<=4)||(due.unit[0]==='d'&&due.value===1)));
        if(urgent) row.classList.add('ticket-highlighted');

        // Find subject cell - look for the cell containing the subject link or text
        const subjectCell = row.querySelector('td a[data-test-id^="ticket-subject-link"]')?.closest('td') ||
                           row.querySelector('td .wordbreak-fix')?.closest('td');

        if(subjectCell){
            const icon = document.createElement('span');
            icon.className='esc-icon';
            if(tags.includes('DEV-ESC')) {
                icon.textContent='🛠️';
                subjectCell.insertBefore(icon,subjectCell.firstChild);
            } else if(tags.includes('SUP-ESC')) {
                icon.textContent='🔔';
                subjectCell.insertBefore(icon,subjectCell.firstChild);
            }
        }

        // Highlight company name in table layout
        highlightCompanyNameTable(row);

        // Highlight user name in table layout
        highlightUserNameTable(row);
    });
}

/* ----------  TABLE-SPECIFIC HIGHLIGHTERS  ---------- */
function highlightCompanyNameTable(row) {
    try {
        // Find company cell by looking for header with company test-id
        const companyHeader = document.querySelector('th [data-test-id="ticket-table-view-header-company"]');
        if (!companyHeader) return;

        const headerTh = companyHeader.closest('th');
        const headers = Array.from(document.querySelectorAll('thead th'));
        const companyColumnIndex = headers.indexOf(headerTh);

        if (companyColumnIndex === -1) return;

        const companyCell = row.querySelectorAll('td')[companyColumnIndex];
        if (!companyCell) return;

        // Check if we should show company highlights
        if (highlightMode !== 0 && highlightMode !== 1) {
            // Remove existing highlights if they exist
            const existingHighlight = companyCell.querySelector('.company-name-highlight');
            if (existingHighlight) {
                const originalText = existingHighlight.textContent;
                companyCell.innerHTML = originalText;
                companyCell.dataset.companyStyled = 'false';
            }
            return;
        }

        // If we're switching back to company highlighting, force a reset and re-detection
        if (companyCell.dataset.companyStyled === 'true') {
            const existingHighlight = companyCell.querySelector('.company-name-highlight');
            if (!existingHighlight) {
                // Highlight was removed but flag wasn't reset, force re-detection
                companyCell.dataset.companyStyled = 'false';
            } else {
                return; // Already properly highlighted
            }
        }

        const companyName = companyCell.textContent.trim();
        if (companyName && companyName !== '--' && companyName !== '') {
            const color = getCompanyColorFromString(companyName, companyColorMap);
            const span = document.createElement('span');
            span.className = 'company-name-highlight';
            span.style.color = 'black';
            // Convert color to rgba with 50% opacity
            const rgba = color.startsWith('#')
                ? `${color}80`  // Add 80 (50% in hex) for hex colors
                : color.replace('hsl(', 'hsla(').replace(')', ', 0.5)');  // Convert HSL to HSLA
            span.style.backgroundColor = rgba;
            span.textContent = companyName;

            // Clear the cell and append the new styled span
            companyCell.innerHTML = '';
            companyCell.appendChild(span);
            companyCell.dataset.companyStyled = 'true';
        }
    } catch (e) { /* Silently fail */ }
}

function highlightUserNameTable(row) {
    try {
        // Find user cell in the Group/Agent column
        const agentCell = row.querySelector('[data-test-id="agent-select"]');
        if (!agentCell) return;

        const cellContainer = agentCell.closest('td');
        if (!cellContainer) return;

        // Check if we should show user highlights
        if (highlightMode !== 0 && highlightMode !== 2) {
            // Remove existing highlights if they exist
            const existingHighlight = cellContainer.querySelector('.user-name-highlight-wrapper');
            if (existingHighlight) {
                // Remove the wrapper and restore original structure
                const originalContent = existingHighlight.innerHTML;
                existingHighlight.outerHTML = originalContent;
                cellContainer.dataset.userStyled = 'false';
            }
            return;
        }

        // If we're switching back to user highlighting, force a reset and re-detection
        if (cellContainer.dataset.userStyled === 'true') {
            const existingHighlight = cellContainer.querySelector('.user-name-highlight-wrapper');
            if (!existingHighlight) {
                // Highlight was removed but flag wasn't reset, force re-detection
                cellContainer.dataset.userStyled = 'false';
            } else {
                return; // Already properly highlighted
            }
        }

        const userDisplayElement = agentCell.querySelector('.ember-power-select-selected-item');
        if (!userDisplayElement) return;

        const userName = userDisplayElement.textContent.trim();
        if (userName && userName !== '--' && userName !== '') {
            const color = getUserColorFromString(userName, userColorMap);

            // Create a wrapper div that will persist through hover changes
            const wrapper = document.createElement('div');
            wrapper.className = 'user-name-highlight-wrapper';
            wrapper.style.cssText = `
                background-color: ${color};
                color: black;
                font-weight: 600;
                padding: 0px 5px 1px 6px;
                border-radius: 100px;
                display: inline-block;
                width: 70%;
                box-sizing: border-box;
            `;

            // Wrap the entire agent select element
            agentCell.parentNode.insertBefore(wrapper, agentCell);
            wrapper.appendChild(agentCell);

            cellContainer.dataset.userStyled = 'true';
        }
    } catch (e) { /* Silently fail */ }
}

    /* ----------  ROUTER & EXECUTION  ---------- */
    const paint = () => {
        const btn=document.querySelector('button[data-test-id="view-dropdown"]');
        (btn && btn.textContent.trim()==='Table') ? applyTableColours() : applyCardColours();
    };

function setupDropdowns() {
    if (document.querySelector('.fd-style-dropdown')) return; // Already exists
    const target = [...document.querySelectorAll('.dropdown-layout.ember-basic-dropdown')]
        .find(el => /Layout:/i.test(el.textContent));
    if (!target) return;

    // Create highlight dropdown
    const highlightDropdown = document.createElement('div');
    highlightDropdown.className = 'fd-style-dropdown';

    const highlightBtn = document.createElement('button');
    highlightBtn.id = 'highlight-select-btn';
    highlightBtn.type = 'button';
    highlightBtn.textContent = 'Highlights: ' + highlightModeNames[highlightMode];
    highlightBtn.className = 'fd-style-dropdown-btn';

    const highlightContent = document.createElement('div');
    highlightContent.className = 'fd-style-dropdown-content';

    highlightModeNames.forEach((name, index) => {
        const option = document.createElement('a');
        option.href = '#';
        option.textContent = name;
        option.dataset.index = index;
        option.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            highlightMode = parseInt(option.dataset.index, 10);
            localStorage.setItem(HIGHLIGHT_STORAGE_KEY, String(highlightMode));
            highlightBtn.textContent = 'Highlights: ' + highlightModeNames[highlightMode];
            highlightContent.classList.remove('show-dropdown');
            paint();
        };
        highlightContent.appendChild(option);
    });

    highlightBtn.onclick = (e) => {
        e.stopPropagation();
        document.querySelectorAll('.fd-style-dropdown-content').forEach(content => {
            if (content !== highlightContent) {
                content.classList.remove('show-dropdown');
            }
        });
        highlightContent.classList.toggle('show-dropdown');
    };

    highlightDropdown.appendChild(highlightBtn);
    highlightDropdown.appendChild(highlightContent);

    // Create style dropdown
    const styleDropdown = document.createElement('div');
    styleDropdown.className = 'fd-style-dropdown';

    const styleBtn = document.createElement('button');
    styleBtn.id = 'style-select-btn';
    styleBtn.type = 'button';
    styleBtn.textContent = 'Style: ' + modeNames[styleMode];
    styleBtn.className = 'fd-style-dropdown-btn';

    const styleContent = document.createElement('div');
    styleContent.className = 'fd-style-dropdown-content';

    modeNames.forEach((name, index) => {
        const option = document.createElement('a');
        option.href = '#';
        option.textContent = name;
        option.dataset.index = index;
        option.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            styleMode = parseInt(option.dataset.index, 10);
            localStorage.setItem(STORAGE_KEY, String(styleMode));
            styleBtn.textContent = 'Style: ' + modeNames[styleMode];
            styleContent.classList.remove('show-dropdown');
            paint();
        };
        styleContent.appendChild(option);
    });

    styleBtn.onclick = (e) => {
        e.stopPropagation();
        document.querySelectorAll('.fd-style-dropdown-content').forEach(content => {
            if (content !== styleContent) {
                content.classList.remove('show-dropdown');
            }
        });
        styleContent.classList.toggle('show-dropdown');
    };

    styleDropdown.appendChild(styleBtn);
    styleDropdown.appendChild(styleContent);

    // Insert both dropdowns
    target.parentNode.insertBefore(highlightDropdown, target);
    target.parentNode.insertBefore(styleDropdown, target);

    // Close dropdowns when clicking elsewhere
    document.addEventListener('click', (event) => {
        if (!event.target.closest('.fd-style-dropdown')) {
            document.querySelectorAll('.fd-style-dropdown-content').forEach(dropdown => {
                dropdown.classList.remove('show-dropdown');
            });
        }
    });
}

    // This function will be called by the observer
    const runStyling = () => {
        obs.disconnect();
        paint();
        setupDropdowns();
        obs.observe(document.body, { childList: true, subtree: true });
    };

    /* ----------  OBSERVER & INIT  ---------- */
    const obs = new MutationObserver(runStyling);
    obs.observe(document.body, { childList: true, subtree: true });

    // Initial run on script load
    runStyling();
})();