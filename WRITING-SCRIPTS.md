# Writing Project X scripts

Scripts can be written in **Kotlin or Java**. This guide covers both, from an
empty folder to a script running in the client. Everything compiles against the
published API — no engine source needed.

If you are choosing: Kotlin gives you the API directly and reads more cleanly.
Java is fully supported through a small base class that keeps it safe. The two
can live in the same project and the same jar.

## 1. Set up a project

Clone the [starter template](https://github.com/iEasyScript/script-template),
which has one working script in each language, and open it in IntelliJ IDEA. The
build downloads the API and, if needed, JDK 25 itself. Or build the same structure
yourself:

**Use IntelliJ IDEA 2026.1 or newer.** The API is built with Kotlin 2.4, and older
IDEs cannot read its classes: every `com.projectx` import shows as
`Cannot resolve symbol` even though `./gradlew build` succeeds. Update through
the JetBrains Toolbox or Help → Check for Updates.

```
my-scripts/
├── build.gradle.kts
├── settings.gradle.kts
├── gradle.properties      <- projectxApiVersion=1.7.0
├── src/main/kotlin/...    <- Kotlin scripts
└── src/main/java/...      <- Java scripts
```

The build file needs Kotlin 2.4.0 and JVM toolchain 25 to match the engine, the
`java` plugin if you want Java scripts, the API as `compileOnly`, and coroutines.
The API is served from the script-api GitHub releases, so it needs its own
repository entry:

```kotlin
plugins {
    java
    kotlin("jvm") version "2.4.0"
}

repositories {
    mavenCentral()
    exclusiveContent {
        forRepository {
            ivy {
                url = uri("https://github.com/iEasyScript/script-api/releases/download")
                patternLayout { artifact("v[revision]/[artifact]-[revision].[ext]") }
                metadataSources { artifact() }
            }
        }
        filter { includeGroup("com.projectx") }
    }
}

dependencies {
    val projectxApi = providers.gradleProperty("projectxApiVersion").get()
    compileOnly("com.projectx:projectx-engine-api:$projectxApi")
    compileOnly("com.projectx:projectx-core:$projectxApi")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.11.0")
}
```

`compileOnly` matters. The engine already has these classes loaded, so bundling
them into your jar would shadow the running engine and break in confusing ways.

## 2. Write a script

Both languages use the same `@ScriptDescription` annotation. That annotation is
how the engine discovers your script, so it is not optional.

### Kotlin

Extend `Script` and implement `loop()`, which is a suspend function:

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

### Java

Extend `JavaScript` and implement `onLoop()`, which returns a `Wait`:

```java
@ScriptDescription(
    name = "Example Java Woodcutter",
    version = "1.0.0",
    author = "Your Name",
    description = "Chops trees and drops the logs."
)
public class ExampleJavaWoodcutter extends JavaScript {

    @Override
    public Wait onLoop() {
        if (interactClosestObject("Tree", "Chop down", 20)) {
            return Wait.xpDrop();
        }
        return Wait.ms(320, 200);
    }
}
```

Import the API as static methods: `import static com.projectx.script.api.APIKt.*;`

`onStart()`, `onStop()`, `onEvent()` and `render()` are optional overrides in
both languages.

### Why Java returns a Wait instead of waiting

Script bodies run on the client's main-logic tick, on the game thread. So a
script must never block — a `Thread.sleep` would freeze the client.

Kotlin handles this with suspend functions. Java cannot: the Kotlin `loop()`
receives a continuation that Java has no way to honour. The trap is that calling
a suspend helper from Java **compiles cleanly with no warning**, then silently
fails to wait. You get a loop spinning at tick rate, clicking dozens of times a
second — useless, and the most obvious thing a script can do.

So `onLoop()` returns the wait it wants and the engine performs it properly.
`loop()` is final in `JavaScript`, so you cannot reach the unsafe path by
accident.

### The waits Java can return

| Wait | What the engine does |
|---|---|
| `Wait.ms(millis)` / `Wait.ms(mean, variance)` | A fixed pause, or a randomised one around `mean` |
| `Wait.between(min, max)` | A pause picked evenly between `min` and `max` ms |
| `Wait.ticks(ticks)` / `Wait.ticks(ticks, jitterMs)` | Game ticks of 600 ms (fractions allowed), plus up to `jitterMs` |
| `Wait.until(condition, timeoutMs)` | Until the condition is true, or the timeout |
| `Wait.whileTrue(condition, timeoutMs)` | While the condition is true, or the timeout |
| `Wait.untilIdle(maxTicks, idleChecks)` | Until the player has stopped moving and animating for `idleChecks` ticks in a row |
| `Wait.untilStoppedMoving(maxTicks, stillChecks)` | Until the player has stopped moving for `stillChecks` ticks in a row, ignoring animation: use after clicking a rock, altar or anything you walk to and keep working at |
| `Wait.xpDrop()` | Until the next experience drop |
| `Wait.webWalk(x, y, plane)` | Walks there from anywhere on the world map, opening doors and using unlocked lodestones on the way; see [Walking anywhere](#walking-anywhere-the-web-walker) |
| `Wait.ticks(ticks, minJitter, maxJitter)` | Game ticks plus a jitter picked between `minJitter` and `maxJitter` ms |
| `Wait.sequence(step, step, ...)` | Runs steps in order, each performing its own wait |
| `Wait.loop(step)` | Runs a step again and again, performing its wait each time, until it returns `null` |
| `Wait.abort()` | Returned from a step: ends the sequences and loops around it |

`Wait.sequence` is how Java writes "click, wait, click, wait" without blocking.
Each step is a lambda that acts, then returns its wait, or `null` for none. A
step only runs once the previous wait has finished, so it sees the game as it is
by then:

```java
return Wait.sequence(
    () -> { interactClosestObject("Portal", "Enter", 30); return Wait.ticks(3, 120); },
    () -> surge() ? Wait.ticks(1) : null,
    () -> { interactClosestObject("Portal", "Enter", 30); return Wait.untilIdle(10, 2); });
```

A step can return another `Wait.sequence` or a `Wait.loop`; it runs in full
before the next step. A loop is the non-blocking `while`:

```java
return Wait.loop(() -> {
    if (conduitIsFull()) {
        return null;                  // ends the loop
    }
    conduit.interactOrFirst("Repair");
    return Wait.ticks(3);
});
```

Steps can run seconds after `onLoop()` returned. If your script keeps a snapshot
of the game (NPCs, objects, inventory) in fields, refresh it in
`beforeEachStep()`, which the engine calls before every step:

```java
@Override
protected void beforeEachStep() {
    refreshSnapshot();
}
```

The engine also pauses `Script.LOOP_PASS_MILLIS` ms after every loop pass, on
top of the wait you returned.

To react to something urgent in the middle of a long wait, override
`shouldInterrupt()`. The engine checks it about every 50 ms while any wait runs
and before every step; returning `true` abandons the wait and the sequences and
loops around it, and `onLoop()` runs straight away. Keep it cheap, and make it
false again once you are handling the situation, or every wait is cut short:

```java
@Override
protected boolean shouldInterrupt() {
    return standingInFloorMarker() && !alreadyDodging();
}
```

### Java-friendly calls

Some Kotlin API members take a `Tile`, which compiles to a mangled name Java
cannot call. Use these instead:

- `getLocalPlayer().getTileX()` / `getTileY()`, and the same on any NPC, player
  or scene object
- `walkToTile(x, y)`, `walkToTile(x, y, minimap)`, `diveToTile(x, y)`
- `isLoggedIn()` and `isPlayerLoading()`
- `InstanceSystem.startInstance()`, `rejoinInstance()`, `hasOngoingInstance()`
- `getMiningStamina()`: mining stamina in points

### Positions, interaction and items

Use these instead of writing your own:

| Call | What it gives you |
|---|---|
| `thing.getCenterX()` / `getCenterY()` | Centre of an NPC, player or object's footprint, in tiles |
| `thing.distanceTo(x, y)` | Distance in tiles from that centre |
| `playerDistanceTo(x, y)` | Distance from the player |
| `closestObject(list)` / `closestEntity(list)` | The one nearest the player |
| `isTileSafe(x, y, markers, safeDistance)` | Whether a tile is clear of `{x, y}` floor markers |
| `nearestSafeTile(markers, safeDistance, range)` | Where to step to get clear, as `{x, y}` |
| `isTileInZones(x, y, zones)` | Whether a tile is inside any square zone, each `{centreX, centreY, radius}`: a 3x3 marker is radius 1, a 7x7 radius 3 |
| `safeTileOutside(zones, range, preferX, preferY)` | The nearest tile you can actually walk to outside every zone, as `{x, y}`, preferring one near `preferX, preferY` |
| `tileBeside(object)` | The tile just outside an object's footprint nearest you |
| `thing.interactOrFirst(option)` | The named option, or the first one if it is missing |
| `actionBarItemSlot(itemIds...)` | The action bar slot holding one of those items |
| `useInventoryOrActionBarItem(option, itemIds...)` | Use an item from the pack, or the action bar if it is not there |
| `getInventory().findByNameContaining(text)` | The first item whose name contains `text` |
| `getInventory().getUsedSlots()` | How many slots are filled |
| `isPlayerIdle()`, `isPlayerBusy()`, `isDiveReady()` | Player state checks |
| `npc.headbarFill(type)` | The current fill of an NPC's or player's headbar of that type, or -1 while it is not shown |

| `getVarps().getVar(id)` / `getVarps().getVarBit(id)` | Any player var |

If a script of yours needs a general helper that is not here, ask for it in
the API rather than keeping a private copy.

### Walking anywhere: the web walker

`walkToTile` clicks one tile, so it only reaches places the game can path to in
one go. The web walker plans the whole route from the game cache's collision
data and walks it: it clicks ahead along the route, opens closed doors on the
way, and plans again if you drift off or stop moving. Planning runs off the
game thread, so a long route never freezes the client.

On a long walk it also considers the lodestones you have unlocked: it compares
walking the whole way with teleporting to one of the three unlocked lodestones
nearest the destination and walking from there (a teleport counts as about 30
tiles of walking), and teleports when that is quicker. If the lodestone map does
not open or the teleport does not arrive, it walks instead.

Java returns it as a wait. Pass a callback to find out how it ended:

```java
return Wait.webWalk(3185, 3436, 0, 2, result -> {
    if (!result.isSuccess()) {
        System.out.println("Could not walk to the bank: " + result);
    }
});
```

Kotlin calls it directly and gets the result back:

```kotlin
val result = webWalk(Tile.of(3185, 3436, 0), arriveDistance = 2)
if (result.status != WebWalkStatus.ARRIVED) println("Could not walk to the bank: $result")
```

In a state machine, add it as a traversal node:

```kotlin
Traversal.traversal(next = Banking(), finishedCondition = { bank.isOpen }) {
    webWalk(Tile.of(3185, 3436, 0))
    interactObj(name = "Bank booth", action = "Bank") { bank.isOpen }
}
```

The arrive distance is how close counts as there, in tiles with diagonals
counting as one; it defaults to 2. To walk without lodestones, pass
`useLodestones = false` in Kotlin, or `false` after the callback in Java:
`Wait.webWalk(x, y, plane, 2, null, false)`.

Every walk ends with a `WebWalkResult`: its `status` says what happened,
`message` says why, and `lodestone` names the lodestone it teleported to, if it
used one.

| Status | Meaning |
|---|---|
| `ARRIVED` | Within the arrive distance of the destination |
| `NO_PATH` | No walkable route: walled off, or it needs stairs, a ladder, a shortcut or a teleport |
| `TOO_FAR` | The search gave up before reaching it |
| `OTHER_FLOOR` | The destination is on a different plane from the player |
| `NOT_IN_WORLD` | The player or the destination is inside an instance |
| `STUCK` | The player stopped making progress, even after planning again |
| `STOPPED` | The script stopped while walking |

To look at a route without walking it, use `WebWalker.findPathAsync(startX,
startY, destX, destY, plane)`, which completes with a result whose `getPath()`
holds every tile (`getX(i)`, `getY(i)`, `crossesDoor(i)`). Kotlin scripts can
suspend on `WebWalker.findPath(this, from, to)` instead. Never call the blocking
`WebWalker.findPath(...)` from a script body: scripts run on the game thread.

Apart from lodestones, routes stay on one plane and do not use stairs, ladders,
shortcuts or other teleports.

`Lodestone.X.isUnlocked()` tells you whether a lodestone is unlocked, and
`useLodestone(Lodestone.X)` teleports to one yourself. `openLodestoneMap()`
opens the lodestone network from the minimap (either minimap layout) and
`isLodestoneUiOpen` tells you when it is open. Lunar Isle, Bandit Camp
and the City of Um report locked, because no unlock var is known for them; the
walker never picks them.

## 3. The one habit that matters

**React to outcomes. Never sleep a fixed amount and hope.**

Both examples wait on an experience drop, which returns when the game actually
granted experience. A fixed three-second delay would be wrong twice over: too
short and you act before the action finished, too long and you idle obviously.

Every wait takes a timeout, so a missed interaction cannot hang the script.

| Kotlin | Java | Waits until |
|---|---|---|
| `delayUntil(timeout) { ... }` | `Wait.until(() -> ..., timeout)` | the predicate becomes true |
| `delayWhile(timeout) { ... }` | `Wait.whileTrue(() -> ..., timeout)` | the predicate becomes false |
| `waitForXPDrop()` | `Wait.xpDrop()` | experience is granted |
| `waitForEvent(timeout) { ... }` | — | a matching event arrives |
| `delay(mean, variance)` | `Wait.ms(mean, variance)` | a randomised pause elapses |

The second habit: **never interact without a minimum interval.** A loop that
interacts and returns is re-entered on the next tick. Without a delay on every
path, including early returns, that is click spam.

Use the randomised forms rather than a constant. A delay that is always exactly
400ms is a recognisable pattern.

## 4. State machines, for anything with phases

Kotlin scripts with distinct phases should extend `StateMachineScript` rather
than driving flags by hand:

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

There is no Java equivalent of `StateMachineScript`. In Java, model phases with
an enum field and switch on it inside `onLoop()`.

## 5. Give the user settings

Implement `ConfigurableScript` and declare config items as fields. They appear
in the script's settings panel automatically. This works in both languages:

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
`ConfigSection`. Read a value with `.value`, or `getValue()` from Java.

## 6. Run it

```bash
./gradlew installScripts
```

That builds the jar and copies it to `~/.projectx/scripts/`, which is where the
engine loads script jars from. Kotlin and Java scripts ship in the same jar and
are discovered the same way. Start the engine and your script appears in the list.

While iterating, rebuild and hot-reload rather than restarting the client.

## 7. Distributing

Your jar is yours. The API is published so you can build against it without the
engine source, and nothing requires you to open-source what you write or to
contribute it back.

Two practical notes. Scripts are compiled JVM bytecode, so a jar is
decompilable — treat obfuscation as a speed bump, not protection. And the API
tracks the engine build, so a jar built against one release is not guaranteed to
load against another. Say which engine version yours targets, and rebuild when
it moves.

If you would rather share than sell, open a pull request against
[community-scripts](https://github.com/iEasyScript/community-scripts).
