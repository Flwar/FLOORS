import { type Zone } from "@floors/shared";

const $ = (sel: string) => document.querySelector<HTMLElement>(sel)!;

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

  skills(names: [string, string], cds: [number, number], maxCds: [number, number], unlocked: [boolean, boolean]) {
    for (let i = 0; i < 2; i++) {
      const el = $(`#slot-skill${i + 1}`);
      this.set(`sn${i}`, names[i], () => (el.querySelector(".name")!.textContent = names[i]));
      this.set(`su${i}`, unlocked[i], () => el.classList.toggle("locked", !unlocked[i]));
      const frac = maxCds[i] > 0 ? Math.min(1, cds[i] / maxCds[i]) : 0;
      const q = Math.round(frac * 40);
      this.set(`sc${i}`, q, () => {
        (el.querySelector(".cd") as HTMLElement).style.transform = `scaleY(${frac})`;
        if (q === 0) {
          el.classList.remove("ready");
          void el.offsetWidth;
          el.classList.add("ready");
        }
      });
    }
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
