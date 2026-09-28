# Playing with friends

The game server also serves the game page, so everyone uses one address.

```
npm run build     # build the game page (once, and again after changes)
npm start         # production server on port 2567: accounts only, no dev commands
```

Open `http://localhost:2567`. Production mode refuses `?guest=` logins and every `dev:*`
command, and limits password guessing (8 wrong tries per name per 10 minutes) and sign-ups
(6 per address per hour). Characters are saved in `server/data/floors.db`
(set `FLOORS_DB` to put it elsewhere). `PORT` changes the port.

## Same Wi-Fi / home network
1. `npm run build && npm start` on your PC.
2. Find your PC's address: run `ipconfig` and read the *IPv4 Address* (for example `192.168.1.20`).
3. Friends open `http://192.168.1.20:2567`.
4. The first time, Windows asks whether Node.js may use the network: allow **Private networks**.

## Friends elsewhere, from your PC
- **Easiest and private:** install [Tailscale](https://tailscale.com) on your PC and theirs, and they open
  `http://<your-tailscale-ip>:2567`. Nothing is exposed to the whole internet.
- **Open to anyone:** forward TCP port 2567 on your router to your PC and share your public IP.
  Only do this if you are comfortable running a public server from your PC.

## Online all the time
Any host that runs Docker works (a small VPS, Fly.io, Railway, Render):
```
docker build -t floors .
docker run -d -p 2567:2567 -v floors-data:/data --restart unless-stopped floors
```
- Keep `/data` on a persistent volume, or characters are lost when the container is replaced.
- Behind HTTPS (most platforms add it), the page connects with `wss://` automatically.
- One server process holds the whole world; it comfortably handles a few dozen players.

## Admin
The account **Ofir** is the admin (change or add names with `FLOORS_ADMINS=Ofir,Someone`).
Admins see an **ADMIN** button at the top of the screen (or press **F10** / the `` ` `` key):
players online (go to, bring, heal, kick), teleport anywhere (also by clicking the map),
world events, enemy spawning, any item at any rarity, level, gold, XP, skill points,
weapon mastery, quests, map reveal, Floor 2, server stats and announcements.

In production an admin name can only be **registered from the server machine itself**
(`http://localhost:2567`), so nobody else can claim it first. On a remote host, start once with
`FLOORS_ADMIN_SETUP=1`, create the account, then restart without it.
