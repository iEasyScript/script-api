# Writing Project X scripts

This guide takes you from an empty folder to a script running in the client.
Everything here compiles against the published API jars — no engine source needed.

## 1. Set up a project

You need JDK 25. Clone the [starter template](https://github.com/iEasyScript/script-template),
or build the same structure yourself:

```
my-scripts/
├── build.gradle.kts
├── settings.gradle.kts
├── libs/                 <- the three API jars go here
└── src/main/kotlin/...   <- your scripts
```

The build file needs three things. Kotlin 2.3.20 and JVM toolchain 25, to match
the engine. The API jars as `compileOnly`. And coroutines, because scripts are
suspend functions.

```kotlin
dependencies {
    compileOnly(fileTree("libs") { include("*.jar") })
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.10.1")
}
```

`compileOnly` matters. The engine already has these classes loaded, so bundling
them into your jar would shadow the running engine and break in confusing ways.

## 2. Write a script

A script is a class extending `Script`, annotated so the engine can find it:

```kotlin
@ScriptDescription(
    name = "Example Woodcutter",
    version = "1.0.0",
    author = "Your Name",
    description = "Chops trees and drops the logs.",
)
class ExampleWoodcutter : Script() {

    override suspend fun loop() {
        if (interactClosestObject("Tree", "Chop down")) {
            waitForXPDrop()
            delay(240, 90)
        } else {
            delay(320, 200)
        }
    }
}
```

`loop()` is called repeatedly for as long as the script runs. `onStart()`,
`onStop()`, `onEvent()` and `render()` are optional overrides.

The annotation is how the engine discovers your script, so it is not optional.
`visible = false` hides a script from the list without removing it.

## 3. The one habit that matters

**React to outcomes. Never sleep a fixed amount and hope.**

The example waits on `waitForXPDrop()`, which returns when the game actually
granted experience. A fixed `delay(3000)` would be wrong twice over: too short
and you act before the action finished, too long and you idle obviously.

The engine gives you outcome-gated waits, all of which take a timeout so a
missed interaction cannot hang the script forever:

| Call | Waits until |
|---|---|
| `delayUntil(timeoutMillis) { ... }` | the predicate becomes true |
| `delayWhile(timeoutMillis) { ... }` | the predicate becomes false |
| `waitForEvent(timeoutMillis) { ... }` | a matching event arrives |
| `waitForXPDrop()` | experience is granted |

The second habit: **never interact without a minimum interval.** A loop that
interacts and returns is re-entered on the next tick. Without a delay on every
path, including early returns, that is dozens of clicks per second at one
object, which is both useless and the most obvious thing a script can do.

`delay(240, 90)` takes a mean and a spread, giving a randomised pause rather
than a constant. Use it everywhere instead of a fixed number.

## 4. State machines, for anything with phases

A script with distinct phases should extend `StateMachineScript` instead of
driving flags by hand:

```kotlin
class MyScript : StateMachineScript<MyScript>() {
    override fun getStartState(): State<MyScript> = Gathering
}

private object Gathering : State<MyScript>() {
    override suspend fun MyScript.checkNext(): State<MyScript>? =
        if (inventory.isFull) Banking else null

    override suspend fun MyScript.stateLoop() {
        // one phase's behaviour
    }
}
```

`checkNext()` returns the next state or null to stay put. `stateLoop()` is that
state's body.

## 5. Give the user settings

Implement `ConfigurableScript` and declare config items as properties. They
appear in the script's settings panel automatically:

```kotlin
class MyScript : Script(), ConfigurableScript {
    private val dropLogs = BooleanConfigItem(
        name = "Drop logs",
        description = "Drop instead of banking.",
        initialValue = true,
    )
}
```

Available types are `BooleanConfigItem`, `IntConfigItem`, `StringConfigItem`,
`OptionsConfigItem`, `EnumConfigItem`, `InfoDisplayConfigItem` and
`ConfigSection`. Read a value with `.value`.

## 6. Run it

```bash
./gradlew installScripts
```

That builds the jar and copies it to `~/.projectx/scripts/`, which is where the
engine loads script jars from. Start the engine and your script appears in the
list.

While iterating, rebuild and hot-reload rather than restarting the client. A
full restart per edit will cost you more time than writing the script.

## 7. Distributing

Your jar is yours. The API is published so you can build against it without the
engine source, and nothing requires you to open-source what you write or to
contribute it back.

Two practical notes. Scripts are compiled Kotlin, so a jar is decompilable —
treat obfuscation as a speed bump, not protection. And the API tracks the engine
build, so a jar built against one release is not guaranteed to load against
another. Say which engine version yours targets, and rebuild when it moves.

If you would rather share than sell, open a pull request against
[community-scripts](https://github.com/iEasyScript/community-scripts).
