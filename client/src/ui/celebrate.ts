/**
 * The full-screen moment when a floor opens (or is sealed) for the whole server: a golden
 * veil, turning light rays, shockwave rings, a flying shower of sparks and a slammed title.
 * Purely visual: it never takes input, and it clears itself.
 */
const FLOOR_NAMES: Record<number, string> = { 2: "The Gilded Terraces" };

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

const joinNames = (names: string[]) =>
  names.length > 2 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names.join(" and ");

function sparks(n: number) {
  const box = document.createElement("div");
  box.className = "fo-sparks";
  for (let i = 0; i < n; i++) {
    const s = document.createElement("i");
    s.style.setProperty("--a", `${Math.random() * 360}deg`);
    s.style.setProperty("--d", `${28 + Math.random() * 60}vmax`);
    s.style.setProperty("--t", `${1.3 + Math.random() * 1.8}s`);
    s.style.setProperty("--w", `${0.15 + Math.random() * 1.4}s`);
    s.style.setProperty("--s", `${3 + Math.random() * 7}px`);
    box.append(s);
  }
  return box;
}

function show(root: HTMLElement, ms: number) {
  document.getElementById("floor-open")?.remove();
  root.id = "floor-open";
  document.body.append(root);
  setTimeout(() => root.classList.add("out"), ms);
  setTimeout(() => root.remove(), ms + 1400);
}

export function floorOpenedOverlay(m: { floor: number; by: string[]; boss?: string; admin?: boolean }) {
  const root = document.createElement("div");
  const who = esc(joinNames(m.by) || "A party of climbers");
  const line = m.admin ? `${who} has opened the way.` : `${who} defeated ${esc(m.boss ?? "the Floor Boss")}.`;
  root.innerHTML = `
    <div class="fo-veil"></div>
    <div class="fo-rays"></div>
    <div class="fo-ring"></div><div class="fo-ring r2"></div><div class="fo-ring r3"></div>
    <div class="fo-text">
      <div class="fo-kicker">The way up is open</div>
      <div class="fo-title">Floor ${m.floor}</div>
      <div class="fo-name">${esc(FLOOR_NAMES[m.floor] ?? "")}</div>
      <div class="fo-rule"></div>
      <div class="fo-by">${line}<br><b>Every climber may now ascend.</b></div>
    </div>`;
  root.append(sparks(70));
  show(root, 7000);
}

export function floorSealedOverlay(m: { floor: number; by: string }) {
  const root = document.createElement("div");
  root.className = "sealed";
  root.innerHTML = `
    <div class="fo-veil"></div>
    <div class="fo-ring"></div>
    <div class="fo-text">
      <div class="fo-kicker">By order of the tower</div>
      <div class="fo-title">Floor ${m.floor}</div>
      <div class="fo-name">is sealed</div>
      <div class="fo-rule"></div>
      <div class="fo-by">${esc(m.by)} has closed the way up. It opens again when a party defeats the Floor Boss.</div>
    </div>`;
  show(root, 5200);
}
