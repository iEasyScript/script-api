# Module Project X Script API

The API scripts are written against, in **Kotlin or Java**. Every page here is generated from the engine's own
source, so it always matches the release you compile against. Use the **Kotlin | Java** switch at the top to see
every signature as you would call it from your language.

**Start here**

- [Writing scripts](https://github.com/iEasyScript/script-api/blob/main/WRITING-SCRIPTS.md): the guide, from an empty
  project to a published script.
- [Sharing scripts](https://github.com/iEasyScript/script-api/blob/main/SHARING-SCRIPTS.md): getting a script onto the store.
- [Releases](https://github.com/iEasyScript/script-api/releases): every API version and what changed.

**Where things live**

| Package | What it holds |
|---|---|
| `com.projectx.script` | `Script` and `JavaScript`, the state-machine scripts, waits and settings |
| `com.projectx.script.api` | The action API: banking, abilities, equipment, teleports, the Grand Exchange and more |
| `com.projectx.script.event` | Events a script can listen for: chat, hitsplats, XP drops, var changes |
| `com.projectx.webwalker` | `webWalk`, links and paths |
| `com.projectx.traversal` | Traversals: the step builder (`TraversalBuilder`, `JavaTraversal` for Java) and `LocalNav` walking distances |
| `com.projectx.pathfinder` | Routes and reach: `routeToTile`, `routeToObject`, `routeToNPC`, `hasLineOfSight`, `WorldCollision`, walk maps |
| `com.projectx.game.nxt.entity` | Players, NPCs, objects and ground items |
| `com.projectx.game.items` | Items in the backpack, bank and equipment |
| `com.projectx.game.chat` | Chat messages and their types |
| `com.projectx.game.interfaces` | Reading and clicking game interfaces |
| `com.projectx.game.cs2` | Running the client's own clientscripts |
| `com.projectx.ui.backend.dsl` | The overlay DSL |
| `com.projectx.ui.compose` | Compose panels for a script's overlay |
| `com.projectx.util` | Helpers: rectangular `Area`, gaussian timing, number formatting |

Press **/** or use the search box at the top to find any class, function or property.
