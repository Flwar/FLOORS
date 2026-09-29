import * as Phaser from "phaser";

/**
 * Phaser 4 bug fix. Container.addHandler listens for a child's DESTROY event with
 * `onChildDestroyed`, but removeHandler unhooks `remove` instead, so every time a child
 * leaves a container a listener is left behind on it. Anything that re-parents or re-orders
 * children often (our character rigs did, every frame) piles up thousands of them, and each
 * later removal scans the whole pile: the game slowed down the longer it ran, and with it
 * every message from the server (the "ms" climbed until a refresh).
 */
export function installPhaserFixes() {
  const proto = Phaser.GameObjects.Container.prototype as unknown as {
    removeHandler(go: Phaser.GameObjects.GameObject): void;
    onChildDestroyed(go: Phaser.GameObjects.GameObject): void;
    __fixed?: boolean;
  };
  if (proto.__fixed) return;
  proto.__fixed = true;
  const removeHandler = proto.removeHandler;
  proto.removeHandler = function (this: typeof proto, go: Phaser.GameObjects.GameObject) {
    go.off(Phaser.GameObjects.Events.DESTROY, this.onChildDestroyed, this);
    removeHandler.call(this, go);
  };
}
