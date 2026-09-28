import type { Session } from "../net.ts";

/** Title screen: log in or create an account. Resolves once a world room is joined. */
export function showLogin(session: Session): Promise<void> {
  const root = document.getElementById("login")!;
  root.classList.remove("hidden");
  const form = root.querySelector("form")!;
  const user = root.querySelector<HTMLInputElement>("#login-user")!;
  const pass = root.querySelector<HTMLInputElement>("#login-pass")!;
  const err = root.querySelector<HTMLElement>(".login-error")!;
  const createBtn = root.querySelector<HTMLButtonElement>("#login-create")!;
  const buttons = root.querySelectorAll("button");

  return new Promise((resolve) => {
    const attempt = async (register: boolean) => {
      err.textContent = "";
      if (!user.value.trim() || !pass.value) {
        err.textContent = "Enter a name and password.";
        return;
      }
      buttons.forEach((b) => (b.disabled = true));
      try {
        await session.login(user.value.trim(), pass.value, register);
        root.classList.add("hidden");
        resolve();
      } catch (e) {
        err.textContent = e instanceof Error ? e.message : "Couldn't reach the world.";
      } finally {
        buttons.forEach((b) => (b.disabled = false));
      }
    };
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      void attempt(false);
    });
    createBtn.addEventListener("click", () => void attempt(true));
    user.focus();
  });
}
