import { type Zone } from "@floors/shared";

const $ = (sel: string) => document.querySelector<HTMLElement>(sel)!;

let emptyIcon = "";
/** A dim "+" medallion for an empty skill slot. */
function emptySlotIcon() {
  if (emptyIcon) return emptyIcon;
  const c = document.createElement("canvas");
  c.width = c.height = 96;
  const g = c.getContext("2d")!;
  g.fillStyle = "rgba(0,0,0,0.25)";
  g.beginPath();
  g.roundRect(4, 4, 88, 88, 16);
  g.fill();
  g.strokeStyle = "rgba(232,197,90,0.55)";
  g.lineWidth = 6;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(48, 30);
  g.lineTo(48, 66);
  g.moveTo(30, 48);
  g.lineTo(66, 48);
  g.stroke();
  emptyIcon = c.toDataURL();
  return emptyIcon;
}

/** DOM overlay HUD: stays crisp at any zoom and never covers the play space. */
export class Hud {
  private bannerTimer = 0;
  private cache = new Map<string, string | number | boolean>();

  private set(key: string, value: string | number | boolean, apply: () => void) {
    if (this.cache.get(key) === value) return;
    this.cache.set(key, value);
    apply();
  }

  vitals(hp: number, hpMax: number, stamina: number, staminaMax: number, exhausted: boolean, level: number) {
    const hpFrac = Math.max(0, hp / Math.max(1, hpMax));
    this.set("hp", hp, () => {
      $(".bar.hp .fill").style.transform = `scaleX(${hpFrac})`;
      $(".bar.hp .trail").style.transform = `scaleX(${hpFrac})`;
      $(".bar.hp .val").textContent = `${Math.ceil(hp)} / ${hpMax}`;
      $("#vitals").classList.toggle("low", hpFrac < 0.3);
    });
    this.set("st", Math.round(stamina), () => {
      $(".bar.stamina .fill").style.transform = `scaleX(${Math.max(0, stamina / staminaMax)})`;
    });
    this.set("ex", exhausted, () => $(".bar.stamina").classList.toggle("exhausted", exhausted));
    this.set("lv", level, () => ($("#level").textContent = String(level)));
  }

  /** The drink doing you good (name, colour, minutes left), or nothing. */
  drink(m: { name: string; color: string; min: number } | undefined) {
    this.set("drink", m ? `${m.name}|${m.min}` : "", () => {
      const box = $("#drink");
      box.hidden = !m;
      if (m) box.innerHTML = `<i style="background:${m.color}"></i>${m.name} · ${m.min} min`;
    });
  }

  /** Clicking an empty skill slot (to open the skill tree). */
  onEmptySkillSlot?: () => void;

  /**
   * The two skill slots: the skill's icon, a clock-face cooldown with seconds left, and a
   * pulsing "learn something" hint on empty slots while you have points to spend.
   */
  skills(slots: { icon?: string; name: string; cd: number; max: number }[], canLearn: boolean) {
    for (let i = 0; i < 2; i++) {
      const el = $(`#slot-skill${i + 1}`);
      const sl = slots[i];
      if (!el.classList.contains("skill")) {
        el.classList.add("skill");
        el.prepend(Object.assign(document.createElement("img"), { className: "sicon", alt: "" }));
        el.append(Object.assign(document.createElement("span"), { className: "cdnum" }));
        el.addEventListener("click", () => {
          if (el.classList.contains("empty")) this.onEmptySkillSlot?.();
        });
      }
      this.set(`si${i}`, sl.icon ?? "", () => {
        const img = el.querySelector<HTMLImageElement>(".sicon")!;
        img.src = sl.icon ?? emptySlotIcon();
        el.classList.toggle("empty", !sl.icon);
        el.title = sl.icon ? sl.name : "Empty slot: learn a skill in the skill tree";
      });
      this.set(`sl${i}`, !sl.icon && canLearn, () => el.classList.toggle("learnable", !sl.icon && canLearn));
      const frac = sl.max > 0 ? Math.min(1, sl.cd / sl.max) : 0;
      const secs = Math.ceil(sl.cd / 60);
      this.set(`sc${i}`, Math.round(frac * 90), () => {
        (el.querySelector(".cd") as HTMLElement).style.background = frac > 0 ? `conic-gradient(rgba(10,8,6,0.72) ${frac * 360}deg, transparent 0)` : "none";
        if (frac === 0) {
          el.classList.remove("ready");
          void el.offsetWidth;
          el.classList.add("ready");
        }
      });
      this.set(`sn${i}`, secs, () => (el.querySelector(".cdnum")!.textContent = secs > 0 ? String(secs) : ""));
    }
  }

  potionIcon(url: string) {
    const el = $("#slot-potion");
    if (el.querySelector(".picon")) return;
    el.prepend(Object.assign(document.createElement("img"), { className: "picon", src: url, alt: "" }));
    el.title = "Healing tonic";
  }

  potions(count: number) {
    this.set("pot", count, () => {
      $("#slot-potion .count").textContent = String(count);
      $("#slot-potion").classList.toggle("locked", count <= 0);
    });
  }

  weapon(name: string) {
    this.set("wn", name, () => ($("#weapon-name").textContent = name));
  }

  zone(zone: Zone) {
    const banner = $("#zone-banner");
    banner.querySelector(".zone-name")!.textContent = zone.name;
    banner.querySelector(".zone-kind")!.textContent = zone.safe ? "Safe zone" : "Danger";
    banner.className = zone.safe ? "safe show" : "danger show";
    clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => banner.classList.remove("show"), 2600);
  }

  title(name: string, sub: string) {
    const banner = $("#zone-banner");
    banner.querySelector(".zone-name")!.textContent = name;
    banner.querySelector(".zone-kind")!.textContent = sub;
    banner.className = "boss show";
    clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => banner.classList.remove("show"), 3600);
  }

  boss(show: boolean, name = "", hp = 0, hpMax = 1, posture = 0) {
    this.set("bossShow", show, () => $("#boss").classList.toggle("hidden", !show));
    if (!show) return;
    this.set("bossName", name, () => ($("#boss .boss-name").textContent = name));
    const f = Math.max(0, hp / hpMax);
    this.set("bossHp", hp, () => {
      $("#boss .boss-fill").style.transform = `scaleX(${f})`;
      $("#boss .boss-trail").style.transform = `scaleX(${f})`;
    });
    this.set("bossPosture", posture, () => ($("#boss .posture-fill").style.transform = `scaleX(${posture / 255})`));
  }

  /** The tower's clock: a sun or a moon, and the time (or nothing, underground). */
  clock(text: string | undefined, night: boolean) {
    this.set("clock", text ? `${text}|${night}` : "", () => {
      $("#clock").innerHTML = text ? `<i class="${night ? "moon" : "sun"}"></i>${text} · ` : "";
    });
  }

  online(count: number) {
    this.set("online", count, () => ($("#online").textContent = String(count)));
  }

  ping(ms: number) {
    const r = Math.round(ms);
    this.set("ping", r, () => ($("#ping").textContent = r > 0 ? String(r) : "–"));
  }

  status(text: string) {
    $("#status").textContent = text;
  }

  dead(show: boolean, sub = "") {
    this.set("dead", show, () => $("#death").classList.toggle("hidden", !show));
    this.set("deadSub", sub, () => ($("#death .sub").textContent = sub));
  }

  judgement(on: boolean) {
    this.set("judge", on, () => $("#vignette").classList.toggle("judgement", on));
  }

  hurtVignette(strength: number) {
    const v = $("#vignette");
    if (v.classList.contains("judgement")) return;
    v.style.transition = "none";
    v.style.opacity = String(strength);
    requestAnimationFrame(() => {
      v.style.transition = "opacity 0.6s";
      v.style.opacity = "0";
    });
  }

  flash(alpha = 0.35, ms = 140) {
    const f = $("#flash");
    f.style.transition = "none";
    f.style.opacity = String(alpha);
    requestAnimationFrame(() => {
      f.style.transition = `opacity ${ms}ms ease-out`;
      f.style.opacity = "0";
    });
  }
}
