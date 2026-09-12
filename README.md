# Project X Script API

The public API for writing scripts against the Project X engine.

Scripts can be written in **Kotlin or Java**. The engine itself is closed
source. This repository publishes the compiled API it exposes to scripts, so you
can build scripts without the engine source.

## What is published

Each release carries two jars:

| Jar | What it is |
|---|---|
| `projectx-engine-api` | The script API: script types, the action and event API, game entities, the overlay DSL |
| `projectx-core` | Shared types scripts use, including tiles, coordinates and the cache library |

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

Build with JDK 25 and Kotlin 2.3.20 to match the engine. Java scripts extend
`JavaScript` rather than `Script`; the guide explains why.

The engine loads script jars from `~/.projectx/scripts/`.

## Where to start

Read [WRITING-SCRIPTS.md](WRITING-SCRIPTS.md) for the full guide, from an empty
folder to a script running in the client.

[script-template](https://github.com/iEasyScript/script-template) is a working
project wired up exactly this way, with one complete example script. Clone it,
drop the jars in `libs/`, and you have a build that compiles.

[community-scripts](https://github.com/iEasyScript/community-scripts) is the
shared collection, if you would rather contribute than publish your own.

## Versioning

The API tracks the engine build. A script compiled against one release is not
guaranteed to load against a different one, so rebuild when the engine updates.
