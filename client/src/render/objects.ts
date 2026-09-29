import * as Phaser from "phaser";
import { floorOfRoom, itemBase, mapFloorNumber, missionReady, MOON_PHASES, CG_VALVE_BIT, QUESTS, questOpen, RARITY_COLORS, SEAT_PROPS, seatPoint, SG, SG_MOON_BIT, SS_CONDUIT_BIT, type NpcDef, type WorldMap, type WorldObject } from "@floors/shared";
import type { Drop } from "../../../server/src/state.ts";
import { RES } from "../art/characters.ts";
import { itemIconCanvas } from "../ui/icons.ts";
import type { InvView } from "../ui/ui.ts";
import { HumanoidRig, locomotionPose, restPose } from "./rig.ts";

interface NpcView {
  def: NpcDef;
  /** People have a rig; a Mission Board is just its board (a prop on the map). */
  rig?: HumanoidRig;
  label: Phaser.GameObjects.Text;
  marker: Phaser.GameObjects.Text;
  phase: number;
}

interface ObjView {
  def: WorldObject;
  img: Phaser.GameObjects.Image;
  state: string;
}

interface DropView {
  img: Phaser.GameObjects.Image;
  beam?: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  born: number;
}

export interface Interactable {
  kind: "npc" | "object" | "drop" | "player" | "ally" | "seat";
  id: string;
  x: number;
  y: number;
  label: string;
}

/** NPCs, interactive objects and loot on the ground. */
export class WorldObjects {
  private npcs: NpcView[] = [];
  private objs: ObjView[] = [];
  private drops = new Map<string, DropView>();
  merchantActive = false;
  /** Instance gate mask; the Stormspire also keeps its woken conduits in bits 16+. */
  gates = 0;

  constructor(private scene: Phaser.Scene, private map: WorldMap) {
    paintObjects(scene);
    for (const def of map.npcs) {
      if (def.role === "board") {
        const label = scene.add.text(def.x, def.y - 74, def.name, { fontFamily: "Georgia, serif", fontSize: "17px", color: "#ffe1a0", stroke: "#1d1a17", strokeThickness: 4 }).setOrigin(0.5, 1).setScale(0.5);
        const marker = scene.add.text(def.x, def.y - 86, "", { fontFamily: "Georgia, serif", fontSize: "34px", color: "#ffd24a", stroke: "#1d1a17", strokeThickness: 5, fontStyle: "bold" }).setOrigin(0.5, 1).setScale(0.5);
        this.npcs.push({ def, label, marker, phase: Math.random() * 1000 });
        continue;
      }
      const rig = new HumanoidRig(scene, { key: `npc:${def.id}`, skin: def.look.skin, hair: def.look.hair, cloth: def.look.cloth, trim: def.look.trim, helm: def.look.helm ?? "none", bulk: 1 }, "none", 0, 1);
      const label = scene.add.text(def.x, def.y - 40, def.name, { fontFamily: "Georgia, serif", fontSize: "17px", color: "#fff1c0", stroke: "#1d1a17", strokeThickness: 4 }).setOrigin(0.5, 1).setScale(0.5);
      const marker = scene.add.text(def.x, def.y - 52, "", { fontFamily: "Georgia, serif", fontSize: "34px", color: "#ffd24a", stroke: "#1d1a17", strokeThickness: 5, fontStyle: "bold" }).setOrigin(0.5, 1).setScale(0.5);
      this.npcs.push({ def, rig, label, marker, phase: Math.random() * 1000 });
    }
    for (const def of map.objects) {
      const img = scene.add.image(def.x, def.y + 10, texFor(def, "")).setOrigin(0.5, 1).setScale(1 / RES).setDepth(def.y + 10);
      // "?" forces the first update to apply the real state (visibility, texture).
      this.objs.push({ def, img, state: "?" });
    }
  }

  /** Per-frame: idle NPCs, quest markers, object states, drop bobbing. */
  update(dtMs: number, inv: InvView | undefined, stage: string, playerX: number, playerY: number) {
    for (const n of this.npcs) {
      const visible = n.def.role !== "merchant" || this.merchantActive;
      if (!n.rig) {
        n.phase += dtMs;
        const m = markerFor(n.def.id, inv);
        n.marker.setText(m);
        n.marker.setColor(m === "?" ? "#9fe0a6" : "#ffd24a");
        n.marker.setPosition(n.def.x, n.def.y - 84 + Math.sin(n.phase / 300) * 2).setDepth(n.def.y + 2);
        n.label.setDepth(n.def.y + 1);
        continue;
      }
      n.rig.root.setVisible(visible);
      n.label.setVisible(visible);
      n.marker.setVisible(visible);
      if (!visible) continue;
      n.phase += dtMs;
      const face = Math.atan2(playerY - n.def.y, playerX - n.def.x);
      const near = Math.hypot(playerX - n.def.x, playerY - n.def.y) < 140;
      const pose = locomotionPose(near ? face : Math.PI / 2, 0, n.phase, restPose(Math.PI / 2));
      n.rig.apply(pose);
      n.rig.root.setPosition(n.def.x, n.def.y).setDepth(n.def.y);
      n.label.setDepth(n.def.y + 1);
      const m = markerFor(n.def.id, inv);
      n.marker.setText(m);
      n.marker.setColor(m === "?" ? "#9fe0a6" : "#ffd24a");
      n.marker.setPosition(n.def.x, n.def.y - 50 + Math.sin(n.phase / 300) * 2).setDepth(n.def.y + 2);
    }
    for (const o of this.objs) {
      const st = objState(o.def, inv, stage, this.gates);
      if (st !== o.state) {
        o.state = st;
        o.img.setTexture(texFor(o.def, st));
        o.img.setVisible(!(o.def.id === "ascent" && st !== "open"));
      }
      if (o.def.kind === "campfire" || st === "lit" || (o.def.kind === "gate" && st === "open")) o.img.setAlpha(0.9 + Math.sin(performance.now() / 120 + o.def.x) * 0.1);
    }
    const t = performance.now();
    for (const d of this.drops.values()) {
      const age = t - d.born;
      const bob = Math.sin(age / 350) * 2 - Math.max(0, 1 - age / 300) * 12;
      d.img.setY(d.img.getData("y") + bob);
      if (d.beam) d.beam.setAlpha(0.5 + Math.sin(age / 400) * 0.15);
      const near = Math.hypot(playerX - d.img.x, playerY - d.img.getData("y")) < 90;
      d.label.setVisible(near);
    }
  }

  syncDrops(drops: Map<string, Drop> | undefined, myKey: string | undefined) {
    const seen = new Set<string>();
    drops?.forEach((d, id) => {
      seen.add(id);
      if (this.drops.has(id)) return;
      const tex = d.kind === 1 ? "dropGold" : d.kind === 2 ? "dropBag" : this.iconTex(d.key, d.rarity);
      const img = this.scene.add.image(d.x, d.y, tex).setOrigin(0.5, 1).setScale(d.kind === 0 ? 0.36 : 0.5).setDepth(d.y);
      img.setData("y", d.y);
      let beam: Phaser.GameObjects.Image | undefined;
      if (d.kind === 0 && d.rarity >= 2) {
        beam = this.scene.add.image(d.x, d.y, "lootBeam").setOrigin(0.5, 1).setScale(0.5, 0.5 + d.rarity * 0.15).setDepth(d.y - 1).setBlendMode(Phaser.BlendModes.ADD);
        beam.setTint(Phaser.Display.Color.HexStringToColor(RARITY_COLORS[d.rarity]).color);
      }
      const mine = !d.owner || d.owner === myKey;
      const name = d.kind === 1 ? `${d.qty} gold` : d.kind === 2 ? (d.owner === myKey ? "Your belongings" : "Someone's belongings") : `${d.qty > 1 ? `${d.qty}× ` : ""}${itemName(d.key)}`;
      const label = this.scene.add
        .text(d.x, d.y - 22, name, { fontFamily: "Trebuchet MS", fontSize: "16px", color: d.kind === 0 ? RARITY_COLORS[d.rarity] : "#f2c94c", stroke: "#1d1a17", strokeThickness: 4 })
        .setOrigin(0.5, 1)
        .setScale(0.5)
        .setDepth(1e6 - 2)
        .setAlpha(mine ? 1 : 0.5)
        .setVisible(false);
      this.drops.set(id, { img, beam, label, born: performance.now() });
    });
    for (const [id, v] of this.drops) {
      if (seen.has(id)) continue;
      v.img.destroy();
      v.beam?.destroy();
      v.label.destroy();
      this.drops.delete(id);
    }
  }

  private iconTex(key: string, rarity: number) {
    const tk = `icon:${key}:${rarity}`;
    if (!this.scene.textures.exists(tk)) this.scene.textures.addCanvas(tk, itemIconCanvas(key, rarity));
    return tk;
  }

  /** Everything the player could press F on, nearest first. */
  interactables(x: number, y: number, drops: Map<string, Drop> | undefined, myKey: string | undefined, sitting = false): Interactable[] {
    const out: (Interactable & { d: number })[] = [];
    this.map.props.forEach((pr, i) => {
      const what = SEAT_PROPS[pr.kind];
      if (!what || sitting) return; // seated: moving (or X) stands you up
      const s = seatPoint(pr);
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < 44) out.push({ kind: "seat", id: String(i), x: s.x, y: s.y - 36, label: `Sit on the ${what}`, d: d + 6 });
    });
    for (const n of this.npcs) {
      if (n.def.role === "merchant" && !this.merchantActive) continue;
      const d = Math.hypot(n.def.x - x, n.def.y - y);
      if (d < 56) out.push({ kind: "npc", id: n.def.id, x: n.def.x, y: n.def.y - 44, label: n.def.role === "board" ? "Read the Mission Board" : `Talk to ${n.def.name}`, d });
    }
    for (const o of this.objs) {
      if (o.def.id === "ascent" && o.state !== "open") continue;
      const d = Math.hypot(o.def.x - x, o.def.y - y);
      if (d < 56) out.push({ kind: "object", id: o.def.id, x: o.def.x, y: o.def.y - 36, label: objLabel(o.def, o.state, mapFloorNumber(this.map.name)), d });
    }
    drops?.forEach((dr, id) => {
      if (dr.kind === 1) return;
      const d = Math.hypot(dr.x - x, dr.y - y);
      if (d < 44) out.push({ kind: "drop", id, x: dr.x, y: dr.y - 24, label: dr.kind === 2 ? (dr.owner === myKey ? "Recover your belongings" : "Someone's belongings") : `Pick up ${itemName(dr.key)}`, d: d - 10 });
    });
    return out.sort((a, b) => a.d - b.d);
  }

  destroy() {
    for (const n of this.npcs) {
      n.rig?.destroy();
      n.label.destroy();
      n.marker.destroy();
    }
    for (const o of this.objs) o.img.destroy();
    for (const d of this.drops.values()) {
      d.img.destroy();
      d.beam?.destroy();
      d.label.destroy();
    }
  }
}

const itemName = (key: string) => itemBase(key)?.name ?? key;

/** "!" = has a quest for you, "?" = something to hand in. */
function markerFor(npc: string, inv?: InvView): string {
  if (!inv) return "";
  for (const q of QUESTS) {
    const st = inv.quests[q.id];
    if (!st || st.done) continue;
    const stage = q.stages[st.stage];
    if (stage.kind === "talk" && stage.npc === npc) return "?";
    if (stage.kind === "collect" && q.giver === npc) {
      let n = 0;
      for (const it of inv.inventory) if (it?.key === stage.item) n += it.qty;
      if (n >= stage.count) return "?";
    }
  }
  for (const q of QUESTS) {
    if (q.giver !== npc) continue;
    const st = inv.quests[q.id];
    if ((q.mission ? missionReady(st, Date.now()) : !st) && questOpen(q, (id) => !!inv.quests[id]?.done, inv.floor)) return "!";
  }
  return "";
}

/** Levers whose lit state is synced in the gate mask: the Stormspire's conduits and the Roost's flame seals. */
const isConduit = (o: WorldObject) => o.kind === "lever" && (o.name.endsWith("Conduit") || o.name.startsWith("Seal of") || o.name.startsWith("Rune of"));
const isSeal = (o: WorldObject) => o.kind === "lever" && o.name.startsWith("Seal of");
/** The Sanctum's moon lanterns: each one's phase rides in the gate mask, two bits apiece. */
const isMoon = (o: WorldObject) => o.kind === "lever" && o.name === "Moon Lantern";
/** The Cathedral's sluice valves: turned ones ride in the gate mask. */
const isValve = (o: WorldObject) => o.kind === "lever" && o.name === "Sluice Valve";

function objState(o: WorldObject, inv: InvView | undefined, stage: string, gates: number): string {
  switch (o.kind) {
    case "lever":
      if (isValve(o)) return (gates >> (CG_VALVE_BIT + Number(o.id.split("-")[1]))) & 1 ? "lit" : "";
      if (isMoon(o)) return `moon${(gates >> (SG_MOON_BIT + Number(o.id.split("-")[1]) * 2)) & 3}${(gates >> SG.moonsNorth) & 1 ? "lit" : ""}`;
      return isConduit(o) && (gates >> (SS_CONDUIT_BIT + Number(o.id.split("-")[1]))) & 1 ? "lit" : "";
    case "chest":
      return inv?.discovered.includes(`chest:${o.id}`) ? "open" : "";
    case "waystone":
      return inv?.discovered.includes(`ws:${o.id}`) ? "on" : "";
    case "gate": {
      const to = floorOfRoom(o.dest ?? "");
      if (!to) return ""; // the floor above is not built yet
      if (o.id === "ascent") return stage === "cleared" ? "open" : "";
      return (inv?.floor ?? 1) >= to.n ? "open" : "";
    }
    case "lore":
      return inv?.discovered.includes(`lore:${o.id}`) ? "read" : "";
    default:
      return "";
  }
}

function objLabel(o: WorldObject, state: string, here: number): string {
  switch (o.kind) {
    case "chest":
      return state === "open" ? `${o.name} (empty)` : `Open ${o.name}`;
    case "lore":
      return `Read ${o.name}`;
    case "waystone":
      return state === "on" ? `Travel — ${o.name}` : `Attune ${o.name}`;
    case "door":
      return o.id === "exit" ? o.name : `Unseal ${o.name}`;
    case "gate": {
      const to = floorOfRoom(o.dest ?? "");
      if (state !== "open" || !to) return `Examine ${o.name}`;
      return to.n > here || o.id === "ascent" ? `Ascend to Floor ${to.n}` : `Descend to ${to.town}`;
    }
    case "entry":
      return o.id.startsWith("enter-") ? `Enter ${o.name}` : "Step outside";
    case "campfire":
      return `Rest at ${o.name}`;
    case "lever":
      if (isSeal(o)) return state === "lit" ? `${o.name} (burning)` : `Light the ${o.name}`;
      if (isValve(o)) return state === "lit" ? "Sluice Valve (shut)" : "Turn the Sluice Valve";
      if (isMoon(o)) return state.endsWith("lit") ? `Moon Lantern (${MOON_PHASES[Number(state[4])]}, aligned)` : `Turn the Moon Lantern (${MOON_PHASES[Number(state[4])]})`;
      if (o.name.startsWith("Rune of")) return state === "lit" ? `${o.name} (ringing)` : `Strike the ${o.name}`;
      return isConduit(o) ? (state === "lit" ? `${o.name} (awake)` : `Wake the ${o.name}`) : `Pull the ${o.name}`;
  }
}

function texFor(o: WorldObject, state: string): string {
  switch (o.kind) {
    case "chest":
      return state === "open" ? "objChestOpen" : "objChest";
    case "lore":
      return "objLore";
    case "waystone":
      return state === "on" ? "objWaystoneOn" : "objWaystone";
    case "door":
      return o.id === "exit" ? "objStairs" : o.dest === "stormspire" ? "objSpireDoor" : "objDoor";
    case "gate":
      return o.id === "ascent" ? "objBeam" : state === "open" ? "objArchOpen" : "objArch";
    case "campfire":
      return "objBrazier";
    case "lever":
      if (isSeal(o)) return state === "lit" ? "objBrazier" : "objSeal";
      if (isMoon(o)) return `objMoon${state[4] ?? 0}`;
      return isConduit(o) ? (state === "lit" ? "objConduitLit" : "objConduit") : "objLever";
    case "entry":
      return o.id.startsWith("enter-") ? "objNone" : "objDoormat";
  }
}

function paintObjects(scene: Phaser.Scene) {
  if (scene.textures.exists("objChest")) return;
  const make = (key: string, w: number, h: number, paint: (g: CanvasRenderingContext2D) => void) => {
    const tex = scene.textures.createCanvas(key, w, h)!;
    const g = tex.getContext();
    g.lineJoin = "round";
    paint(g);
    tex.refresh();
  };
  const O = "#1d1a17";
  const chest = (open: boolean) => (g: CanvasRenderingContext2D) => {
    g.fillStyle = "rgba(0,0,0,0.3)";
    g.beginPath();
    g.ellipse(32, 58, 26, 6, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = O;
    g.fillRect(6, 26, 52, 32);
    g.fillStyle = "#8a5a34";
    g.fillRect(9, 29, 46, 26);
    g.fillStyle = "#c9a24a";
    g.fillRect(9, 38, 46, 4);
    if (open) {
      g.fillStyle = O;
      g.fillRect(6, 6, 52, 18);
      g.fillStyle = "#6b4426";
      g.fillRect(9, 9, 46, 13);
      g.fillStyle = "#2a1c12";
      g.fillRect(9, 26, 46, 8);
    } else {
      g.fillStyle = O;
      g.beginPath();
      g.roundRect(4, 12, 56, 18, [10, 10, 0, 0]);
      g.fill();
      g.fillStyle = "#a06a3e";
      g.beginPath();
      g.roundRect(7, 15, 50, 13, [8, 8, 0, 0]);
      g.fill();
      g.fillStyle = "#f2c94c";
      g.fillRect(28, 26, 8, 10);
    }
  };
  make("objNone", 2, 2, () => {});
  // An unlit flame seal: a basalt pedestal holding a cold basin.
  make("objSeal", 70, 110, (g) => {
    g.fillStyle = "rgba(0,0,0,0.3)";
    g.beginPath();
    g.ellipse(35, 104, 24, 6, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = O;
    g.fillRect(21, 50, 28, 56);
    g.fillStyle = "#4a423c";
    g.fillRect(24, 53, 22, 51);
    g.fillStyle = "#ff8a3a";
    g.fillRect(33, 64, 4, 26);
    g.fillStyle = O;
    g.beginPath();
    g.ellipse(35, 48, 24, 10, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#5e5650";
    g.beginPath();
    g.ellipse(35, 46, 21, 8, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#2a2220";
    g.beginPath();
    g.ellipse(35, 45, 15, 5, 0, 0, Math.PI * 2);
    g.fill();
  });
  // Moon lanterns: a black stone post holding a glass moon in one of four phases.
  for (let ph = 0; ph < 4; ph++) {
    make(`objMoon${ph}`, 70, 120, (g) => {
      g.fillStyle = "rgba(0,0,0,0.3)";
      g.beginPath();
      g.ellipse(35, 114, 22, 6, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = O;
      g.fillRect(25, 56, 20, 60);
      g.fillStyle = "#3a3448";
      g.fillRect(28, 59, 14, 55);
      g.fillStyle = "#5a5070";
      g.fillRect(28, 59, 4, 55);
      // The glass moon.
      const cx = 35;
      const cy = 32;
      const r = 22;
      g.fillStyle = O;
      g.beginPath();
      g.arc(cx, cy, r + 3, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#120e1c";
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.fill();
      g.save();
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.clip();
      g.shadowColor = "#e0d8ff";
      g.shadowBlur = ph ? 14 : 0;
      const lit = g.createRadialGradient(cx - 5, cy - 6, 2, cx, cy, r);
      lit.addColorStop(0, "#ffffff");
      lit.addColorStop(1, "#c8b8f0");
      g.fillStyle = lit;
      if (ph === 3) {
        g.beginPath();
        g.arc(cx, cy, r, 0, Math.PI * 2);
        g.fill();
      } else if (ph === 2) {
        g.fillRect(cx, cy - r, r, r * 2);
      } else if (ph === 1) {
        g.beginPath();
        g.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2);
        g.arc(cx + r * 0.55, cy, r * 1.15, Math.PI * 0.62, -Math.PI * 0.62, true);
        g.closePath();
        g.fill();
      }
      g.restore();
      g.strokeStyle = "#8a7aa8";
      g.lineWidth = 2;
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.stroke();
      // Silver cage.
      g.strokeStyle = "#d8d0e8";
      g.lineWidth = 1.5;
      for (const a of [0.3, 1.2, 1.9, 2.8]) {
        g.beginPath();
        g.moveTo(cx + Math.cos(a) * (r + 3), cy + Math.sin(a) * (r + 3) * -1);
        g.lineTo(cx + Math.cos(a) * (r + 3), cy + Math.sin(a) * (r + 3));
        g.stroke();
      }
    });
  }
  // The way out of a building: daylight through the doorway, and a rug in front of it.
  make("objDoormat", 96, 84, (g) => {
    g.fillStyle = O;
    g.beginPath();
    g.roundRect(18, 30, 60, 54, [16, 16, 0, 0]);
    g.fill();
    const day = g.createLinearGradient(0, 34, 0, 84);
    day.addColorStop(0, "#fff2c8");
    day.addColorStop(1, "#e8c070");
    g.fillStyle = day;
    g.beginPath();
    g.roundRect(24, 36, 48, 48, [12, 12, 0, 0]);
    g.fill();
    g.fillStyle = "rgba(255,240,190,0.35)";
    g.beginPath();
    g.moveTo(24, 84);
    g.lineTo(72, 84);
    g.lineTo(84, 60);
    g.lineTo(12, 60);
    g.closePath();
    g.fill();
    // Rug.
    g.fillStyle = O;
    g.beginPath();
    g.roundRect(10, 2, 76, 30, 6);
    g.fill();
    g.fillStyle = "#8a3a2a";
    g.beginPath();
    g.roundRect(13, 5, 70, 24, 5);
    g.fill();
    g.strokeStyle = "#e8c86a";
    g.lineWidth = 2;
    g.beginPath();
    g.roundRect(18, 9, 60, 16, 3);
    g.stroke();
  });
  make("objChest", 64, 64, chest(false));
  make("objChestOpen", 64, 64, chest(true));
  make("objLore", 60, 90, (g) => {
    g.fillStyle = "rgba(0,0,0,0.3)";
    g.beginPath();
    g.ellipse(30, 84, 22, 6, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = O;
    g.beginPath();
    g.roundRect(10, 10, 40, 76, [18, 18, 4, 4]);
    g.fill();
    const sg = g.createLinearGradient(0, 10, 0, 86);
    sg.addColorStop(0, "#b8b2a2");
    sg.addColorStop(1, "#7a7466");
    g.fillStyle = sg;
    g.beginPath();
    g.roundRect(13, 13, 34, 70, [15, 15, 3, 3]);
    g.fill();
    g.strokeStyle = "#9fe0ff";
    g.lineWidth = 2.5;
    g.shadowColor = "#9fe0ff";
    g.shadowBlur = 8;
    g.beginPath();
    g.moveTo(22, 30); g.lineTo(38, 30); g.moveTo(30, 24); g.lineTo(30, 60); g.moveTo(22, 50); g.lineTo(38, 44);
    g.stroke();
  });
  const waystone = (on: boolean) => (g: CanvasRenderingContext2D) => {
    g.fillStyle = "rgba(0,0,0,0.3)";
    g.beginPath();
    g.ellipse(36, 124, 30, 8, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = O;
    g.beginPath();
    g.moveTo(14, 124); g.lineTo(22, 30); g.lineTo(36, 6); g.lineTo(50, 30); g.lineTo(58, 124);
    g.fill();
    const sg = g.createLinearGradient(14, 0, 58, 0);
    sg.addColorStop(0, "#8a93a0");
    sg.addColorStop(1, "#5a616c");
    g.fillStyle = sg;
    g.beginPath();
    g.moveTo(18, 121); g.lineTo(25, 32); g.lineTo(36, 12); g.lineTo(47, 32); g.lineTo(54, 121);
    g.fill();
    g.fillStyle = on ? "#8fe3ff" : "#3a4a5a";
    if (on) {
      g.shadowColor = "#8fe3ff";
      g.shadowBlur = 14;
    }
    g.beginPath();
    g.moveTo(36, 40); g.lineTo(44, 58); g.lineTo(36, 76); g.lineTo(28, 58);
    g.fill();
  };
  make("objWaystone", 72, 130, waystone(false));
  make("objWaystoneOn", 72, 130, waystone(true));
  make("objDoor", 180, 150, (g) => {
    g.fillStyle = O;
    g.beginPath();
    g.roundRect(20, 20, 140, 128, [70, 70, 0, 0]);
    g.fill();
    g.fillStyle = "#4a3a2e";
    g.beginPath();
    g.roundRect(28, 28, 124, 118, [62, 62, 0, 0]);
    g.fill();
    g.strokeStyle = "#2a2018";
    g.lineWidth = 3;
    for (let x = 46; x < 150; x += 22) {
      g.beginPath();
      g.moveTo(x, 36);
      g.lineTo(x, 146);
      g.stroke();
    }
    g.fillStyle = "#7a7f86";
    g.fillRect(28, 70, 124, 10);
    g.fillRect(28, 110, 124, 10);
    g.fillStyle = "#c9a24a";
    g.beginPath();
    g.arc(90, 96, 12, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = O;
    g.fillRect(87, 92, 6, 12);
  });
  // The Stormspire Gate: a stormglass door in a slate arch, the seal-shaped hollow at its heart.
  make("objSpireDoor", 180, 170, (g) => {
    g.fillStyle = "rgba(0,0,0,0.3)";
    g.beginPath();
    g.ellipse(90, 164, 80, 7, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = O;
    g.beginPath();
    g.roundRect(12, 8, 156, 160, [78, 78, 0, 0]);
    g.fill();
    g.fillStyle = "#5a6478";
    g.beginPath();
    g.roundRect(18, 14, 144, 154, [72, 72, 0, 0]);
    g.fill();
    g.fillStyle = "#7a869c";
    for (let i = 0; i < 7; i++) {
      const a = Math.PI + (i + 0.5) * (Math.PI / 7);
      g.beginPath();
      g.arc(90 + Math.cos(a) * 64, 86 + Math.sin(a) * 64, 7, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = O;
    g.beginPath();
    g.roundRect(34, 34, 112, 134, [56, 56, 0, 0]);
    g.fill();
    const glass = g.createLinearGradient(0, 40, 0, 168);
    glass.addColorStop(0, "#cfe8ff");
    glass.addColorStop(0.5, "#8fb8e8");
    glass.addColorStop(1, "#4d6fa6");
    g.fillStyle = glass;
    g.beginPath();
    g.roundRect(40, 40, 100, 128, [50, 50, 0, 0]);
    g.fill();
    g.strokeStyle = "rgba(255,255,255,0.85)";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(70, 50);
    g.lineTo(62, 84);
    g.lineTo(74, 92);
    g.lineTo(64, 132);
    g.stroke();
    g.strokeStyle = "#2c3a58";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(90, 42);
    g.lineTo(90, 168);
    g.stroke();
    g.fillStyle = O;
    g.beginPath();
    g.arc(90, 106, 17, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#c9a24a";
    g.beginPath();
    g.arc(90, 106, 13, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#2c3a58";
    g.beginPath();
    g.moveTo(92, 96);
    g.lineTo(84, 108);
    g.lineTo(91, 108);
    g.lineTo(87, 117);
    g.lineTo(97, 103);
    g.lineTo(90, 103);
    g.closePath();
    g.fill();
  });
  make("objStairs", 120, 70, (g) => {
    for (let i = 0; i < 5; i++) {
      g.fillStyle = i % 2 ? "#6f6a60" : "#827c70";
      g.fillRect(10 + i * 4, 10 + i * 11, 100 - i * 8, 11);
    }
    g.fillStyle = "rgba(255,230,160,0.35)";
    g.fillRect(30, 0, 60, 16);
  });
  const arch = (open: boolean) => (g: CanvasRenderingContext2D) => {
    g.fillStyle = "rgba(0,0,0,0.3)";
    g.beginPath();
    g.ellipse(110, 214, 100, 12, 0, 0, Math.PI * 2);
    g.fill();
    if (open) {
      const lg = g.createLinearGradient(0, 0, 0, 214);
      lg.addColorStop(0, "rgba(255,245,200,0)");
      lg.addColorStop(0.4, "rgba(255,235,170,0.6)");
      lg.addColorStop(1, "rgba(255,220,140,0.9)");
      g.fillStyle = lg;
      g.fillRect(50, 0, 120, 214);
    }
    g.fillStyle = O;
    g.beginPath();
    g.moveTo(10, 214); g.lineTo(10, 90); g.quadraticCurveTo(110, -10, 210, 90); g.lineTo(210, 214); g.lineTo(170, 214); g.lineTo(170, 100);
    g.quadraticCurveTo(110, 30, 50, 100); g.lineTo(50, 214);
    g.fill();
    g.fillStyle = "#c9c0ad";
    g.beginPath();
    g.moveTo(16, 210); g.lineTo(16, 92); g.quadraticCurveTo(110, -2, 204, 92); g.lineTo(204, 210); g.lineTo(176, 210); g.lineTo(176, 102);
    g.quadraticCurveTo(110, 38, 44, 102); g.lineTo(44, 210);
    g.fill();
    g.fillStyle = open ? "#ffe08a" : "#6f7984";
    for (let i = 0; i < 7; i++) {
      const a = Math.PI + (i / 6) * Math.PI;
      g.beginPath();
      g.arc(110 + Math.cos(a) * 80, 98 + Math.sin(a) * 66, 5, 0, Math.PI * 2);
      g.fill();
    }
    if (!open) {
      g.fillStyle = "rgba(40,48,60,0.85)";
      g.beginPath();
      g.moveTo(50, 214); g.lineTo(50, 100); g.quadraticCurveTo(110, 30, 170, 100); g.lineTo(170, 214);
      g.fill();
      g.strokeStyle = "#8a93a0";
      g.lineWidth = 3;
      for (let x = 60; x < 170; x += 18) {
        g.beginPath();
        g.moveTo(x, 70);
        g.lineTo(x, 214);
        g.stroke();
      }
    }
  };
  make("objArch", 220, 220, arch(false));
  make("objArchOpen", 220, 220, arch(true));
  make("objBeam", 140, 420, (g) => {
    const lg = g.createLinearGradient(0, 0, 0, 420);
    lg.addColorStop(0, "rgba(255,250,220,0)");
    lg.addColorStop(0.5, "rgba(255,240,190,0.7)");
    lg.addColorStop(1, "rgba(255,225,150,0.95)");
    g.fillStyle = lg;
    g.beginPath();
    g.moveTo(40, 0); g.lineTo(100, 0); g.lineTo(130, 420); g.lineTo(10, 420);
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.7)";
    g.fillRect(62, 0, 16, 420);
  });
  make("objBrazier", 70, 110, (g) => {
    g.fillStyle = "rgba(0,0,0,0.3)";
    g.beginPath();
    g.ellipse(35, 104, 26, 6, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = O;
    g.fillRect(28, 60, 14, 44);
    g.beginPath();
    g.moveTo(8, 50); g.lineTo(62, 50); g.lineTo(52, 70); g.lineTo(18, 70);
    g.fill();
    g.fillStyle = "#6f6a60";
    g.beginPath();
    g.moveTo(12, 53); g.lineTo(58, 53); g.lineTo(50, 67); g.lineTo(20, 67);
    g.fill();
    const fg = g.createRadialGradient(35, 40, 2, 35, 36, 26);
    fg.addColorStop(0, "#fff6c8");
    fg.addColorStop(0.4, "#ffb347");
    fg.addColorStop(1, "rgba(232,98,44,0)");
    g.fillStyle = fg;
    g.beginPath();
    g.moveTo(14, 52); g.quadraticCurveTo(20, 20, 35, 4); g.quadraticCurveTo(50, 20, 56, 52);
    g.fill();
  });
  make("objLever", 50, 70, (g) => {
    g.fillStyle = O;
    g.fillRect(8, 50, 34, 16);
    g.fillStyle = "#6f6a60";
    g.fillRect(10, 52, 30, 12);
    g.strokeStyle = O;
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(25, 56); g.lineTo(36, 14);
    g.stroke();
    g.strokeStyle = "#9aa3ad";
    g.lineWidth = 4;
    g.stroke();
    g.fillStyle = "#d8453c";
    g.beginPath();
    g.arc(37, 12, 7, 0, Math.PI * 2);
    g.fill();
  });
  // A Stormspire conduit: a stormglass pylon on a gilded plinth. Dormant it is dull slate;
  // woken it blazes white-blue.
  const conduit = (lit: boolean) => (g: CanvasRenderingContext2D) => {
    if (lit) {
      const halo = g.createRadialGradient(45, 60, 6, 45, 60, 44);
      halo.addColorStop(0, "rgba(200,235,255,0.75)");
      halo.addColorStop(1, "rgba(160,210,255,0)");
      g.fillStyle = halo;
      g.fillRect(0, 10, 90, 100);
    }
    g.fillStyle = "rgba(0,0,0,0.3)";
    g.beginPath();
    g.ellipse(45, 124, 32, 6, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = O;
    g.fillRect(17, 100, 56, 26);
    g.fillStyle = "#c9a24a";
    g.fillRect(20, 103, 50, 10);
    g.fillStyle = "#a8842e";
    g.fillRect(20, 113, 50, 10);
    const shard = (x: number, top: number, w: number, fill: string, edge: string) => {
      g.fillStyle = O;
      g.beginPath();
      g.moveTo(x, top - 4); g.lineTo(x + w / 2 + 3, top + 18); g.lineTo(x + w / 2, 104); g.lineTo(x - w / 2, 104); g.lineTo(x - w / 2 - 3, top + 18);
      g.closePath();
      g.fill();
      g.fillStyle = fill;
      g.beginPath();
      g.moveTo(x, top); g.lineTo(x + w / 2, top + 18); g.lineTo(x + w / 2 - 2, 102); g.lineTo(x - w / 2 + 2, 102); g.lineTo(x - w / 2, top + 18);
      g.closePath();
      g.fill();
      g.fillStyle = edge;
      g.beginPath();
      g.moveTo(x, top); g.lineTo(x - w / 2, top + 18); g.lineTo(x - w / 2 + 2, 102); g.lineTo(x - 2, 102);
      g.closePath();
      g.fill();
    };
    const [fill, edge] = lit ? ["#bfe6ff", "#f4fbff"] : ["#56627a", "#77839b"];
    shard(28, 62, 14, fill, edge);
    shard(62, 58, 14, fill, edge);
    shard(45, 18, 24, fill, edge);
    if (lit) {
      g.strokeStyle = "#ffffff";
      g.lineWidth = 2.5;
      g.beginPath();
      g.moveTo(47, 30); g.lineTo(41, 52); g.lineTo(50, 58); g.lineTo(43, 84);
      g.stroke();
    }
  };
  make("objConduit", 90, 130, conduit(false));
  make("objConduitLit", 90, 130, conduit(true));
  make("lootBeam", 40, 220, (g) => {
    const lg = g.createLinearGradient(0, 0, 0, 220);
    lg.addColorStop(0, "rgba(255,255,255,0)");
    lg.addColorStop(1, "rgba(255,255,255,0.8)");
    g.fillStyle = lg;
    g.fillRect(12, 0, 16, 220);
    g.fillStyle = "rgba(255,255,255,0.25)";
    g.fillRect(4, 60, 32, 160);
  });
  make("dropGold", 48, 40, (g) => {
    for (const [x, y] of [[16, 30], [30, 30], [23, 22]]) {
      g.fillStyle = O;
      g.beginPath();
      g.ellipse(x, y, 10, 7, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#f2c94c";
      g.beginPath();
      g.ellipse(x, y - 1, 8, 5, 0, 0, Math.PI * 2);
      g.fill();
    }
  });
  make("dropBag", 48, 48, (g) => {
    g.fillStyle = O;
    g.beginPath();
    g.ellipse(24, 32, 18, 14, 0, 0, Math.PI * 2);
    g.fill();
    g.fillRect(18, 10, 12, 14);
    g.fillStyle = "#8a6a4a";
    g.beginPath();
    g.ellipse(24, 32, 15, 11, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#d8453c";
    g.fillRect(17, 20, 14, 3);
  });
}
