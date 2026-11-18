# Module Project X Script API

The API scripts are written against, in **Kotlin or Java**. Every page here is generated from the engine's own
source, so it always matches the release you compile against.

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
| `com.projectx.game.nxt.entity` | Players, NPCs, objects and ground items |
| `com.projectx.game.interfaces` | Reading and clicking game interfaces |
| `com.projectx.ui.backend.dsl` | The overlay DSL |
| `com.projectx.ui.compose` | Compose panels for a script's overlay |

Press **/** or use the search box at the top to find any class, function or property.
