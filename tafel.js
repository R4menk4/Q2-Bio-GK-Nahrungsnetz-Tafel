'use strict';

const stages = [
  ['Begriffe', 'Was sind Produzenten?'],
  ['Begriffe', 'Was sind Konsumenten 1. Ordnung?'],
  ['Begriffe', 'Was sind Konsumenten 2. Ordnung?'],
  ['Zuordnen', 'Welche Lebewesen gehören zu welcher Trophieebene?'],
  ['Nahrungspfeile', 'Wie sind die Lebewesen im Nahrungsnetz verbunden?'],
];
const levels = { grass: 1, mouse: 2, hopper: 2, bird: 3 };
const solution = ['grass>mouse', 'grass>hopper', 'mouse>bird', 'hopper>bird'];
const $ = id => document.getElementById(id);
const board = $('board');
const arrows = $('arrows');
const cards = [...board.querySelectorAll('[data-species]')];
const byId = Object.fromEntries(cards.map(card => [card.dataset.species, card]));
const destinations = [...board.querySelectorAll('[data-destination]')];
const positions = Object.fromEntries(cards.map(card => [card.dataset.species, 0]));

let stage = 0;
let edges = [];
let selected = null;
let drag = null;
let suppressClick = false;

const drawing = () => stage === 4;
const complete = () => Object.values(positions).every(Boolean);
const speciesName = id => byId[id].querySelector('strong').textContent;

function feedback(message = '') {
  $('feedback').textContent = message;
}

function select(id) {
  selected = id;
  for (const card of cards) {
    const active = card.dataset.species === id;
    card.classList.toggle('selected', active);
    card.setAttribute('aria-pressed', String(active));
  }
}

function render() {
  const intro = stage < 3;
  $('definitions').hidden = !intro;
  $('diagram').hidden = intro;
  document.querySelectorAll('[data-definition]').forEach(card => {
    card.hidden = Number(card.dataset.definition) > stage;
  });
  $('count').textContent = stages[stage][0];
  $('question').textContent = stages[stage][1];
  $('instruction').textContent = drawing()
    ? 'Ziehe von der Nahrung zum Konsumenten („wird gefressen von“). Du kannst auch beide Karten nacheinander antippen.'
    : 'Ziehe die Bildkarten auf die passende Ebene oder tippe eine Karte und dann die Ebene an.';
  board.classList.toggle('drawing', drawing());
  board.querySelector('.tray').hidden = drawing();
  destinations.forEach(button => { button.disabled = drawing(); });
  $('connections').hidden = !drawing();
  $('check').textContent = drawing() ? 'Pfeile prüfen' : 'Zuordnung prüfen';
  $('back').disabled = stage === 0;
  $('next').hidden = drawing();
  $('next').disabled = stage === 3 && !complete();
  $('next').textContent = stage === 3 ? 'Zu den Nahrungspfeilen' : 'Weiter';
  $('student').hidden = !drawing();
  requestAnimationFrame(drawEdges);
}

function go(next) {
  if (next < 0 || next >= stages.length || (next === 4 && !complete())) return;
  finishDrag();
  stage = next;
  select(null);
  feedback();
  render();
}

function place(id, level) {
  if (positions[id] !== level) {
    positions[id] = level;
    $('level-' + level).append(byId[id]);
  }
  select(null);
  feedback();
  $('next').disabled = !complete();
}

function addEdge(from, to) {
  select(null);
  if (from === to) return;
  const edge = from + '>' + to;
  if (edges.includes(edge)) {
    feedback('Diesen Pfeil gibt es schon.');
    return;
  }
  edges.push(edge);
  feedback();
  renderConnections();
}

function renderConnections() {
  const buttons = edges.map(edge => {
    const [from, to] = edge.split('>');
    const button = document.createElement('button');
    const label = speciesName(from) + ' → ' + speciesName(to);
    button.textContent = label + ' ×';
    button.setAttribute('aria-label', 'Pfeil entfernen: ' + label);
    button.onclick = () => {
      edges = edges.filter(item => item !== edge);
      feedback();
      renderConnections();
      $('check').focus();
    };
    return button;
  });
  $('edgeList').replaceChildren(...buttons);
  drawEdges();
}

function cardRect(id) {
  return byId[id].getBoundingClientRect();
}

function center(rect) {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

// Attach lines at the card outlines, with room for the arrowhead.
function anchor(rect, dx, dy, gap) {
  const point = center(rect);
  const scale = Math.min(rect.width / 2 / Math.abs(dx), rect.height / 2 / Math.abs(dy));
  const distance = Math.hypot(dx, dy);
  return { x: point.x + dx * (scale + gap / distance), y: point.y + dy * (scale + gap / distance) };
}

function pathBetween(from, to, offset = 0) {
  const startRect = cardRect(from);
  const endRect = cardRect(to);
  const start = center(startRect);
  const end = center(endRect);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (!Math.hypot(dx, dy)) return '';
  const bend = { x: (start.x + end.x) / 2 - dy * offset, y: (start.y + end.y) / 2 + dx * offset };
  const a = anchor(startRect, bend.x - start.x, bend.y - start.y, 1);
  const b = anchor(endRect, bend.x - end.x, bend.y - end.y, 5);
  const bounds = arrows.getBoundingClientRect();
  return `M ${a.x - bounds.left} ${a.y - bounds.top} Q ${bend.x - bounds.left} ${bend.y - bounds.top} ${b.x - bounds.left} ${b.y - bounds.top}`;
}

function drawEdges() {
  const paths = drawing() ? edges.map(edge => {
    const [from, to] = edge.split('>');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathBetween(from, to, edges.includes(to + '>' + from) ? .16 : 0));
    return path;
  }) : [];
  $('edgePaths').replaceChildren(...paths);
}

function drawDraft(id, x, y) {
  const rect = cardRect(id);
  const point = center(rect);
  const dx = x - point.x;
  const dy = y - point.y;
  const draft = $('draft');
  const inside = Math.abs(dx) <= rect.width / 2 && Math.abs(dy) <= rect.height / 2;
  draft.toggleAttribute('hidden', inside);
  if (inside) return;
  const start = anchor(rect, dx, dy, 0);
  const bounds = arrows.getBoundingClientRect();
  draft.setAttribute('d', `M ${start.x - bounds.left} ${start.y - bounds.top} L ${x - bounds.left} ${y - bounds.top}`);
}

function targetAt(event) {
  const element = document.elementFromPoint(event.clientX, event.clientY);
  return element?.closest(drawing() ? '[data-species]' : '[data-zone]');
}

function finishDrag() {
  if (!drag) return;
  drag.ghost?.remove();
  drag.target?.classList.remove('target');
  $('draft').setAttribute('hidden', '');
  drag = null;
}

for (const card of cards) {
  const id = card.dataset.species;
  card.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    suppressClick = false;
    drag = { id, x: event.clientX, y: event.clientY, active: false };
    card.setPointerCapture(event.pointerId);
  });
  card.addEventListener('pointermove', event => {
    if (!event.isPrimary || drag?.id !== id) return;
    if (!drag.active) {
      if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 8) return;
      drag.active = true;
      select(id);
      if (!drawing()) {
        const ghost = card.cloneNode(true);
        ghost.classList.add('ghost');
        ghost.setAttribute('aria-hidden', 'true');
        ghost.tabIndex = -1;
        ghost.style.width = card.offsetWidth + 'px';
        document.body.append(ghost);
        drag.ghost = ghost;
      }
    }
    drag.target?.classList.remove('target');
    drag.target = targetAt(event);
    if (drag.target !== card) drag.target?.classList.add('target');
    if (drawing()) drawDraft(id, event.clientX, event.clientY);
    if (drag.ghost) {
      drag.ghost.style.left = event.clientX + 'px';
      drag.ghost.style.top = event.clientY + 'px';
    }
  });
  card.addEventListener('pointerup', event => {
    if (!event.isPrimary || drag?.id !== id) return;
    const active = drag.active;
    const target = active ? targetAt(event) : null;
    finishDrag();
    if (!active) return;
    suppressClick = true;
    select(null);
    if (!target) return;
    if (drawing()) addEdge(id, target.dataset.species);
    else place(id, Number(target.dataset.zone));
  });
  card.addEventListener('pointercancel', () => {
    finishDrag();
    select(null);
  });
  card.addEventListener('lostpointercapture', finishDrag);
  card.addEventListener('click', event => {
    if (suppressClick && event.detail) return;
    if (drawing() && selected && selected !== id) {
      addEdge(selected, id);
    } else {
      select(selected === id ? null : id);
    }
  });
}

for (const button of destinations) {
  button.addEventListener('click', () => {
    if (!selected) {
      feedback('Wähle zuerst eine Bildkarte aus.');
      return;
    }
    const id = selected;
    place(id, Number(button.dataset.destination));
    byId[id].focus();
  });
}

$('check').onclick = () => {
  if (!drawing()) {
    const wrong = cards.filter(card => {
      const id = card.dataset.species;
      return positions[id] && positions[id] !== levels[id];
    });
    if (wrong.length) feedback('Überprüfe die Zuordnung von ' + wrong.map(card => speciesName(card.dataset.species)).join(', ') + '.');
    else if (!complete()) feedback('Die bisherigen Zuordnungen stimmen. Ordne auch die Karten aus der Ablage zu.');
    else feedback('Alle vier Lebewesen sind richtig zugeordnet.');
    return;
  }
  if (edges.some(edge => !solution.includes(edge))) {
    feedback('Mindestens ein Pfeil passt noch nicht. Prüfe die Fraßbeziehungen und die Pfeilrichtung. Zum Löschen tippe auf den Pfeilnamen unter dem Netz.');
  } else if (edges.length < solution.length) {
    feedback('Die eingezeichneten Pfeile stimmen. Es fehlen noch ' + (solution.length - edges.length) + ' von 4.');
  } else {
    feedback('Alle vier Nahrungspfeile sind richtig. Zwei Nahrungsketten bilden ein Nahrungsnetz.');
  }
};

$('solution').onclick = () => {
  if (drawing()) {
    edges = [...solution];
    select(null);
    renderConnections();
    feedback('Lösung: Vier Pfeile zeigen von der Nahrung zum jeweiligen Konsumenten.');
  } else {
    for (const id of Object.keys(levels)) place(id, levels[id]);
    feedback('Lösung: Alle Arten sind ihrer Trophieebene zugeordnet.');
  }
};

$('back').onclick = () => go(stage - 1);
$('next').onclick = () => go(stage + 1);
$('reset').onclick = () => {
  edges = [];
  for (const card of cards) place(card.dataset.species, 0);
  renderConnections();
  go(0);
};
$('full').onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    $('full').textContent = 'Vollbild mit F11';
  }
};
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') select(null);
  if (event.target.closest('button,a,summary')) return;
  if (event.key === 'ArrowRight') go(stage + 1);
  if (event.key === 'ArrowLeft') go(stage - 1);
});
new ResizeObserver(drawEdges).observe(board);
select(null);
render();
