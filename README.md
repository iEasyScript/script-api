# Project X Script API

The public API for writing scripts against the Project X engine.

The engine itself is closed source. This repository publishes the compiled API
it exposes to scripts, so you can build scripts without the engine source.

## What is published

Each release carries three jars:

| Jar | What it is |
|---|---|
| `projectx-engine-api` | The script API: script types, the action and event API, game entities, the overlay DSL |
| `projectx-core` | Shared types scripts use, including tiles, coordinates and the cache library |
| `projectx-official-scripts` | First-party scripts, for community scripts that build on them |

Download them from [Releases](https://github.com/iEasyScript/script-api/releases).

## Using it

Put the jars in a `libs/` directory and depend on them:

```kotlin
dependencies {
    compileOnly(fileTree("libs") { include("*.jar") })
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.10.1")
}
```

`compileOnly` is deliberate. The engine already has these classes loaded, so
bundling them into your script jar would shadow the running engine.

Build with JDK 25 and Kotlin 2.3.20 to match the engine.

The engine loads script jars from `~/.projectx/scripts/`.

## Where to start

[community-scripts](https://github.com/iEasyScript/community-scripts) is a
working project wired up exactly this way. Clone it, drop the jars in `libs/`,
and you have a build that compiles.

## Versioning

The API tracks the engine build. A script compiled against one release is not
guaranteed to load against a different one, so rebuild when the engine updates.
