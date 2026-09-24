# Writing Project X scripts

Scripts can be written in **Kotlin or Java**. This guide covers both, from an
empty folder to a script running in the client. Everything compiles against the
published API — no engine source needed.

If you are choosing: Kotlin gives you the API directly and reads more cleanly.
Java is fully supported through a small base class that keeps it safe. Nothing
in the API is limited to one language:

- every Kotlin helper that waits has a Java `Wait` of the same name
- every call that takes a `Tile` has a form that takes coordinates
- Java has its own overlay builder and state machine

The two languages can live in the same project and the same jar.

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
├── gradle.properties      <- projectxApiVersion=1.16.0
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
    mavenCentral { content { excludeGroup("com.projectx") } }
    ivy {
        url = uri("https://github.com/iEasyScript/script-api/releases/download")
        patternLayout {
            ivy("v[revision]/ivy-[module]-[revision].xml")
            artifact("v[revision]/[artifact]-[revision](-[classifier]).[ext]")
        }
        metadataSources {
            ivyDescriptor()
            artifact()
        }
        content { includeGroup("com.projectx") }
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

The `ivy(...)` line pulls in the API's sources as well as its jars, so ctrl+click
on any API call opens the Kotlin behind it rather than decompiled bytecode.

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
For overlays, also `import static com.projectx.ui.backend.dsl.Overlay.*;` (see
[Show an overlay](#6-show-an-overlay)).

`onStart()`, `onStop()`, `onEvent()`, `render()` and `shouldInterrupt()` are
optional overrides in both languages.

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
| `Wait.event(predicate, timeoutMs)` | Until an event the predicate accepts arrives |
| `Wait.chatContaining(type, text)` | Until a chat message of that type containing the text |
| `Wait.webWalk(x, y, plane)` | Walks there from anywhere on the world map, taking stairs, ladders and shortcuts, opening doors and using unlocked lodestones on the way; see [Walking anywhere](#walking-anywhere-the-web-walker) |
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

### Reacting to danger mid-wait: shouldInterrupt

To react to something urgent in the middle of a long wait, override
`shouldInterrupt()`. It works in both languages:

- **Checking:** the engine checks it about every 50 ms while the script waits.
- **Java:** returning `true` abandons the current wait and the sequences and
  loops around it, and `onLoop()` runs straight away.
- **Kotlin:** returning `true` cancels the current `loop()` pass at its next
  wait, and the next pass starts straight away.

Keep it cheap. Make it false again once you are handling the situation, or every
wait is cut short.

```java
@Override
protected boolean shouldInterrupt() {
    return standingInFloorMarker() && !alreadyDodging();
}
```

```kotlin
override fun shouldInterrupt() = standingInFloorMarker() && !alreadyDodging()
```

Kotlin can also guard a single block rather than the whole pass.
`interruptWhen(condition) { ... }` runs the block, cancels it once the condition
holds, and returns `null` if it was cancelled:

```kotlin
val mined = interruptWhen({ standingInFloorMarker() }) {
    rock.interact("Mine")
    waitForXPDrop()
    true
}
if (mined == null) dodge()
```

### Every Kotlin helper that waits has a Wait

Kotlin helpers that wait are `suspend` functions, which Java cannot call. Each
one has a `Wait` factory of the same name that the engine runs for you. When
the helper reports an outcome, pass an `onResult` callback. The engine calls it
when the helper finishes, and a later step can read what it stored:

```java
private boolean summoned;

@Override
public Wait onLoop() {
    return Wait.sequence(
        () -> Wait.familiarSummonFamiliar(Familiar.SPIRIT_WOLF, ok -> summoned = ok),
        () -> summoned ? Wait.castAndWaitForCd(Ability.SURGE) : Wait.abort());
}
```

`shouldInterrupt()` cuts these waits short like any other. When it does,
`onResult` is not called.

| Kotlin | Java |
|---|---|
| `waitForEvent`, `waitForChatContaining`, `waitForXPDrop` | `Wait.event`, `Wait.chatContaining`, `Wait.xpDrop` |
| `waitUntilIdle`, `waitUntilStoppedMoving` | `Wait.untilIdle`, `Wait.untilStoppedMoving` |
| `waitUntilNotMoving`, `waitUntilNotAniMoving` | `Wait.untilNotMoving`, `Wait.untilNotAniMoving` |
| `delayTicks`, `delayBetween`, `delay(mean, variance)` | `Wait.ticks`, `Wait.between`, `Wait.ms` |
| `pauseOthersFor` | `Wait.pauseOthersFor` |
| `webWalk`, `useLodestone`, `teleportWithGroupSystem` | `Wait.webWalk`, `Wait.useLodestone`, `Wait.teleportWithGroupSystem` |
| `randomizedWorldHop`, `randomizedWorldHopQuick`, `checkWorldPop` | `Wait.randomizedWorldHop`, `Wait.randomizedWorldHopQuick`, `Wait.checkWorldPop` |
| `clickKey`, `findAndPickupItems`, `checkPorter`, `captureSerenSpirit` | `Wait.clickKey`, `Wait.findAndPickupItems`, `Wait.checkPorter`, `Wait.captureSerenSpirit` |
| `togglePrayer`, `toggleQuickPrayers` | `Wait.togglePrayer`, `Wait.toggleQuickPrayers` |
| `castAndWaitForCd`, `castWithAdren`, `castIf`, `smartCast`, `castWithEffectStacks` | `Wait.` + the same names |
| `makeX`, `makeXSelect`, `makeXConfirm`, `selectMakeCategory`, `makeXReaction` | `Wait.` + the same names |
| `smithSetQuantity`, `smithSelectTier`, `smithSelectItem`, `smithMake` | `Wait.` + the same names |
| `familiarSummonFamiliar`, `familiarRenewFromBank`, `familiarRenewFromInterface`, `familiarRecall`, `familiarDismiss`, `familiarTakeScrolls`, `familiarCastSpecial` | `Wait.` + the same names |
| `bobGiveAllItems`, `bobTakeAllItems`, `bobGiveItem`, `bobTake` | `Wait.` + the same names |
| `bobStore`, `bobWithdraw` (pairs) | `Wait.bobStoreById` / `bobStoreByName`, `Wait.bobWithdrawById` / `bobWithdrawByName` (a `Map` of amounts) |
| `joinInstance`, `confirmInstanceDialogue`, `startOrRejoinInstance` | `Wait.` + the same names |
| `typeText`, `pressKey` | `Wait.` + the same names |
| `geOpen`, `geBuy`, `geSell`, `geAbort`, `geCollectAll`, `awaitGrandExchangePrices` | `Wait.` + the same names; `Wait.geBuyInSlot` / `geSellInSlot` to pick the slot |

Kotlin lambdas become Java types in these factories: a condition is a
`BooleanSupplier`, and a name match is a `Predicate<String>`.

### Java-friendly calls

Kotlin's `Tile` is a value class, so any member that takes or returns one
compiles to a name Java cannot call. Every such call has a coordinate form:

| Kotlin | Java |
|---|---|
| `thing.tile` | `thing.getTileX()`, `getTileY()`, `getPlane()` on NPCs, players, scene objects, ground items, lodestones, `TileArea` and the `ManualGroundItem` event; `getCenterX()`, `getCenterY()`, `getPlane()` on `DangerZone` |
| `walkTo(tile, minimap)`, `dive(tile)` | `walkToTile(x, y[, plane][, minimap])`, `diveToTile(x, y[, plane])` |
| `findClosestObjectToTile(tile, ...)` and `findClosestReachableObjectToTile`, `findClosestObjectToTileWithOption` | the same names with `(x, y, plane, ...)` |
| `interactClosestReachableObjectToTile(tile, ...)` | `interactClosestReachableObjectToTile(x, y, plane, ...)` |
| `getAllObjectsWithinRange(tile, range)` | `getAllObjectsWithinRange(x, y, plane, range)` |
| `calculateClosestSafeTile(tile, ...)`, `calculateClosestReachableSafeTile(tile, ...)` | the same names with `(x, y, plane, ...)` |
| `bresenhamLos(start, end, obstacles)` | `bresenhamLos(startX, startY, endX, endY, obstacles)` |
| `DangerZone(tile, radius)`, `TileArea(tile, sizeX, sizeY)` | `new DangerZone(x, y, plane, radius)`, `new TileArea(x, y, plane, sizeX, sizeY)` |
| `Area.Rectangular(tile, tile)`, `Area.Circular(tile, radius)`, `Area.Polygonal(tiles)` | `new Area.Rectangular(x1, y1, x2, y2, plane)`, `new Area.Circular(x, y, plane, radius)`, `new Area.Polygonal(xs, ys, plane)` |
| `area.contains(tile)` | `area.contains(x, y, plane)` |
| `area.getRandomCoordinate()`, `getRandomWalkableCoordinate()`, `getCentroid()` | `area.randomTile()`, `randomWalkableTile()`, `centreTile()`, which return a `Tile` object with `getX()`, `getY()` and `getLevel()` |
| drawing `tile(tile, color)`, `tileArea`, `textOnTile`, `imageOnTile` | the same names with `(x, y, plane, ...)` |

Also:

- **Default arguments:** a Kotlin parameter with a default is optional from
  Java too, so `interactClosestObject("Tree", "Chop down")` works without a
  range.
- **Static members:** a class's companion members are called statically, for
  example `Bank.doBankAction(id)`, `InstanceSystem.hasOngoingInstance()`,
  `Equipment.Slot.getItem(slot)`, `Familiar.getName(id)` and
  `WebWalker.findPathAsync(...)`.
- **Singleton objects:** a standalone object is reached through `INSTANCE`, for
  example `MakeX.INSTANCE.isOpen()`, `Smithing.INSTANCE.getQuantity()`,
  `ImGuiColors.INSTANCE.getWHITE()`. It stays that way so that script jars
  already compiled against these objects keep loading.
- **Other helpers:** `isLoggedIn()` and `isPlayerLoading()`;
  `InstanceSystem.startInstance()`, `rejoinInstance()`, `hasOngoingInstance()`;
  and `getMiningStamina()`, mining stamina in points.

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

### Seren spirits

A Seren spirit appears at random while you skill in a Grace of the elves, and
capturing it sends a reward to your bank. Skilling scripts should take them:
call `captureSerenSpirit()` at the top of the loop, and let long waits end
early when one turns up.

```kotlin
override suspend fun loop() {
    if (captureSerenSpirit()) return
    // ...
    delayUntil(60_000) { !localPlayer.isAnimating || findSerenSpirit() != null }
}
```

```java
@Override
public Wait onLoop() {
    if (SerenSpiritsKt.findSerenSpirit() != null) return Wait.captureSerenSpirit();
    // ...
}
```

`captureSerenSpirit` returns true when it caught one. A spirit that is still
there after a capture, usually someone else's, is skipped for a minute.
`findSerenSpirit(range)` finds the nearest one; both look 15 tiles out by
default.

### Walking anywhere: the web walker

`walkToTile` clicks one tile, so it only reaches places the game can path to in
one go. The web walker plans the whole route from the game cache's collision
data and walks it: it clicks ahead along the route, opens closed doors on the
way, and plans again if you drift off or stop moving. Planning runs off the
game thread, so a long route never freezes the client.

Routes are not limited to one floor. Alongside walking, the search can take a
**link**: a staircase, a ladder, an agility shortcut, a cave entrance or a
curated door. Links are the only edges that change plane, so a destination
upstairs or underground is reachable, and the walker performs each one for you
when it reaches it - walking up to the object, clicking it, and waiting to
arrive on the other side.

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

// Or from coordinates, without building a Tile:
webWalkTo(3185, 3436, plane = 0)
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
| `NO_PATH` | No route: walled off, or it needs a teleport the walker does not know |
| `TOO_FAR` | The search gave up before reaching it |
| `NOT_IN_WORLD` | The player or the destination is inside an instance |
| `STUCK` | The player stopped making progress, even after planning again |
| `STOPPED` | The script stopped while walking |
| `OTHER_FLOOR` | No longer produced: routes cross floors. Kept so older scripts still compile |

#### Looking at a route without walking it

```kotlin
val result = findWebPath(Tile.of(3185, 3436, 0))   // suspends; plans off the game thread
if (canWebWalkTo(Tile.of(3185, 3436, 0))) { /* it is reachable */ }
```

A `WebPath` is the route tile by tile. Because a route can change floor, the
plane is per step:

| Call | What it gives you |
|---|---|
| `size`, `lastIndex` | How many steps |
| `getX(i)`, `getY(i)`, `getPlane(i)` | The tile of step `i` |
| `tile(i)`, `tiles` | The same as a `Tile` |
| `crossesDoor(i)` | Step `i` passes a door found in the cache |
| `linkAt(i)` | The `WebLink` taken to reach step `i`, or null when it was walked |
| `nextDoor(from)`, `nextLink(from)` | The next of each at or after `from`, or -1 |
| `changesPlane`, `linkCount`, `doorCount` | What the route needed |

Java scripts use `WebWalker.findPathAsync(startX, startY, destX, destY, plane)`,
which completes with the same result. Never call the blocking
`WebWalker.findPath(...)` from a script body: scripts run on the game thread.

#### Links, and when one is left out

A `WebLink` says where it starts (`from`), where it comes out (`to`), the object
to click (`objectId`) and the option to use (`action`); both endpoints are
`WebArea` rectangles, because a staircase drops you anywhere in the room at the
top. `WebLinks.all` is the whole set and `WebLinks.from(x, y, plane)` is what can
be taken from one tile.

Some links are gated - an agility level, a quest varbit, coins for a fare. Those
conditions read live game state, so they are evaluated once on the game thread
before the search starts (`WebLinkPermissions.snapshot()`), and a link the
account cannot use is left out of the route. A condition the engine does not
recognise counts as met, so an unknown gate costs a re-plan rather than making a
place unreachable.

The link set is curated, so a route that needs something not in it reports
`NO_PATH`. Teleports other than lodestones are not part of a route yet.

If your script finds its own way somewhere the set does not cover, hand it to
the walker and later routes are planned straight through it:

```kotlin
// Standing at `from`, clicking object 130300's "Climb-up" put us at `to`.
WebLinks.registerObjectLink(
    from.x, from.y, from.plane,
    to.x, to.y, to.plane,
    objectId = 130300, action = "Climb-up", costTiles = 3,
)
```

Registering the same way through twice is a no-op, and registered links last
until the client restarts.

Some ways through ask where to go rather than simply moving you - Kharid-et's
fort entrance opens a "Choose destination." list, and the player stays outside
until it is answered. A link carries its answer:

```kotlin
WebLinks.register(
    WebLink(
        kind = WebLinkKind.OBJECT,
        from = WebArea(3372, 3376, 3179, 3183, 0),
        to = WebArea(2445, 2449, 7615, 7619, 0),
        cost = 3000, action = "Enter", objectId = 116920,
        searchRadius = 16, requirements = emptyList(),
    ).choosing("Main fortress"),
)
```

The walker waits for the dialog and picks the option whose text contains it.

`Lodestone.X.isUnlocked()` tells you whether a lodestone is unlocked, and
`useLodestone(Lodestone.X)` teleports to one yourself. `openLodestoneMap()`
opens the lodestone network from the minimap (either minimap layout) and
`isLodestoneUiOpen` tells you when it is open. Lunar Isle, Bandit Camp
and the City of Um report locked, because no unlock var is known for them; the
walker never picks them.

### Time sprites

A time sprite is Archaeology's rockertunity: one settles on an excavation
hotspot for a while, and digging the patch it chose is worth considerably more
than carrying on where you are. Unlike a Seren spirit there is nothing to click
- it only says where to dig.

| Kotlin | Java | What it gives you |
|---|---|---|
| `findTimeSprite(range)` | same | The nearest sprite, or null |
| `timeSpriteTile(range)` | same | The tile it settled on, or null |
| `timeSpriteElsewhere(tile)` | `timeSpriteElsewhereThan(x, y, plane)` | A sprite is up somewhere other than the patch being dug |

Aim the next dig at the sprite, and end a long one early when a sprite appears
elsewhere - the same shape as `findSerenSpirit()`:

```kotlin
val sprite = timeSpriteTile()
val target = sprite?.let { closestHotspotTo(it) } ?: closestHotspot()
target?.interact("Excavate")

delayUntil(180_000) {
    inventory.isFull || findSerenSpirit() != null || timeSpriteElsewhere(target.tile)
}
```

### Typing

`typeText(text)` types into whatever has keyboard focus (a search box, an amount
prompt) the way a physical keyboard does: key-down, the character the OS
translates it to, a human-length hold, key-up, with shift held for capitals and
typing-speed gaps between keys. `pressKey(Key.RETURN)` presses a single key the
same way. Only letters, digits, space, tab, newline and backspace can be typed;
`canTypeText(text)` checks first, and `typeText` returns false without pressing
anything otherwise.

`clickKey` is unchanged: it sends a bare key-down and key-up with no character,
which is right for keybinds but types nothing into a text field.

### The Grand Exchange

`GrandExchange` reads the exchange from the client's own state, so offers stay
current with the window closed. From Java its members are static:
`GrandExchange.isOpen()`, `GrandExchange.offers()`.

| Call | What it gives you |
|---|---|
| `GrandExchange.isOpen` | Whether the exchange window is open |
| `GrandExchange.offers()` / `offer(slot)` | Every slot (0-7): status, `BUY`/`SELL`, item, price, quantity, completed quantity and gold |
| `GrandExchange.activeOffers()` / `firstEmptySlot()` | Slots with an offer / the first free one, or -1 |
| `GrandExchange.collectable(slot)` / `hasCollectable()` | Items or coins waiting to be collected |
| `GrandExchange.isSettingUpOffer`, `setupItemId`, `setupQuantity`, `setupPrice`, `setupMarketPrice` | The buy/sell screen, including the exchange's guide price |
| `GrandExchange.searchResults()` | The item search list, as row slot to item name |
| `GrandExchange.itemForms(itemId)` | An item and its banknote, which the exchange treats as one item |
| `coinPouch.count(995)` | Coins in the money pouch |

An offer's `status` is `EMPTY`, `ADDING`, `ACTIVE`, `COMPLETING`, `ABORTING` or
`FINISHED`. A finished offer `isCompleted` when everything traded and
`isAborted` otherwise; `remainingQuantity` is what is left.

Actions wait for the server's answer and return whether it worked:

| Kotlin | Does |
|---|---|
| `geOpen()` | Opens the exchange through the nearest clerk or banker |
| `geBuy(itemId, quantity, price)` | Searches for the item, sets quantity and price, confirms |
| `geSell(itemId, quantity, price)` | Offers the item from the backpack, noted or not |
| `geAbort(slot)` | Aborts an offer and waits until it has finished |
| `geCollectAll()` | Collects every slot (coins go to the money pouch) |

`geBuy` and `geSell` use the first empty slot unless you pass one. They return
false if the window is not open, the slot is taken or locked, or the item cannot
be found, typed or offered. The exchange can ask you to confirm a sale far below
the guide price; that prompt is not answered for you, so the call returns false.

The exchange withholds 2% of each sale, rounded down per item; items sold for
under 50 coins and bonds are exempt. Buy limits run for four hours from the first
purchase.

Live prices come from the [RuneScape Wiki's real-time price
API](https://prices.runescape.wiki/rs). Refresh, then read the local copy:

```kotlin
if (awaitGrandExchangePrices()) {
    val price = GrandExchangePrices.price(itemId)   // high = instant buy, low = instant sell
    val limit = GrandExchangePrices.item(itemId)?.buyLimit
    val volume = GrandExchangePrices.dailyVolume(itemId)
}
```

Set `GrandExchangePrices.userAgent` to your script's name and a contact: the wiki
asks every API user for one. Refreshes are limited to one a minute and never
block the game. In Java, return `Wait.awaitGrandExchangePrices()` or poll
`GrandExchangePrices.refresh()`.

The exchange state is read on the Windows client; on other platforms
`GrandExchange.isSupported` is false and every slot reads as empty.

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
| `waitForEvent(timeout) { ... }` | `Wait.event(e -> ..., timeout)` | a matching event arrives |
| `waitUntilIdle(maxTicks, checks)` | `Wait.untilIdle(maxTicks, checks)` | the player stops moving and animating |
| `delay(mean, variance)` | `Wait.ms(mean, variance)` | a randomised pause elapses |
| `delayTicks(ticks, jitterMs)` | `Wait.ticks(ticks, jitterMs)` | game ticks elapse |

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

Java scripts extend `JavaStateMachineScript` and write each phase as a
`JavaState`, most neatly as enum constants. `checkNext()` works the same way,
and `onLoop()` is the phase's body, returning its wait:

```java
public class MyScript extends JavaStateMachineScript<MyScript> {
    @Override
    public JavaState<MyScript> getStartState() {
        return Phase.GATHERING;
    }
}

enum Phase implements JavaState<MyScript> {
    GATHERING {
        public JavaState<MyScript> checkNext(MyScript script) {
            return getInventory().isFull() ? BANKING : null;
        }

        public Wait onLoop(MyScript script) {
            return interactClosestObject("Tree", "Chop down") ? Wait.xpDrop() : Wait.ms(320, 200);
        }
    },
    BANKING {
        public JavaState<MyScript> checkNext(MyScript script) {
            return getInventory().isEmpty() ? GATHERING : null;
        }

        public Wait onLoop(MyScript script) {
            return Wait.webWalk(3185, 3436, 0);
        }
    }
}
```

A state can also override `onEvent(script, event)` to see the events that
arrive while it is current.

Kotlin's `Traversal` builder, which strings walking and interaction steps into a
state, has no Java form: in Java, write those steps as a `Wait.sequence`.

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

```java
public class MyScript extends JavaScript implements ConfigurableScript {
    private final BooleanConfigItem dropLogs =
        new BooleanConfigItem("Drop logs", "Drop instead of banking.", true);
    private final IntConfigItem range = new IntConfigItem("Range", "Search range in tiles.", 20);
}
```

Available types are `BooleanConfigItem`, `IntConfigItem`, `StringConfigItem`,
`OptionsConfigItem`, `EnumConfigItem`, `InfoDisplayConfigItem` and
`ConfigSection`. Read a value with `.value`, or `getValue()` from Java. The
trailing constructor arguments are optional in both languages.

## 6. Show an overlay

Override `render()` to draw a window of your own or to mark things in the game
world. The engine calls it every frame, so read state there but do not act on
it.

Kotlin builds windows with `ImGuiDsl`:

```kotlin
override fun render() {
    ImGuiDsl.window("My Script") {
        section("Status")
        text("Logs: $logs")
        xpProgressBar(Skill.WOODCUTTING)
        button("Stop") { stop() }
    }
    ImGuiDsl.backgroundDrawList {
        tile(targetTile, ImGuiColors.GREEN)
    }
}
```

Java uses `Overlay`, whose builders take the scope as their first argument and a
lambda for the content:

```java
import static com.projectx.ui.backend.dsl.Overlay.*;

@Override
public void render() {
    window("My Script", w -> {
        section(w, "Status");
        text(w, "Logs: " + logs);
        xpProgressBar(w, Skill.WOODCUTTING);
        button(w, "Stop", this::stop);
    });
    backgroundDrawList(draw -> draw.tile(targetX, targetY, 0, ImGuiColors.INSTANCE.getGREEN()));
}
```

`Overlay` covers the controls scripts use:

| Kind | What `Overlay` has |
|---|---|
| Text | `text`, `section`, `separator`, `sameLine`, `spacing`, `progressBar`, `xpProgressBar`, `image` |
| Controls | `button`, `checkbox`, `inputText`, `inputInt`, `sliderInt`, `sliderFloat`, `combo`, `selectable` |
| Layout | `group`, `child`, `collapsingHeader`, `treeNode`, `table`, `properties` with `row` and `valueRow`, `tabBar` with `tabItem`, `listBox`, `styleColor`, `itemWidth` |
| Window setup | `setNextWindowPos` and `setNextWindowSize`, with the flags as ints: `WINDOW_NO_RESIZE`, `WINDOW_ALWAYS_AUTO_RESIZE`, `COND_FIRST_USE_EVER` and the rest |
| State | `persistentState`, `boolState`, `intState`, `floatState`, `stringState`, for values that last between frames |

### Panels drawn with Compose (Kotlin)

The overlay itself is drawn with [Compose](https://www.jetbrains.com/compose-multiplatform/),
and a Kotlin script can draw its panel the same way. The engine shows it as a card
beside the other script windows, in the overlay's look. Implement `ComposePanel`
and write `Panel()` as an ordinary composable:

```kotlin
class MyFisher : Script(), ComposePanel {
    private var status by mutableStateOf("Starting")
    private var spot by mutableStateOf("Net")
    private val freeSlots by live(28) { inventory.freeSlots }

    override suspend fun loop() {
        status = "Fishing"
        if (interactClosestNPC("Fishing spot", spot)) waitForXPDrop(Skill.FISHING)
    }

    @Composable
    override fun Panel() {
        Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            Stat("Status", status, color = Palette.running)
            Stat("Free slots", freeSlots.toString())
        }
        Dropdown(spot, listOf("Net", "Bait", "Lure"), { spot = it })
        ActionButton("Stop", { stop() })
    }
}
```

**`Panel()` must never read the game.** It runs on the render thread while the
game thread is changing the game's memory, so a read there can see a half-written
value or crash the client. Give the panel state it can simply display:

- `mutableStateOf` properties that `loop()` writes. The panel redraws when they change.
- `live(initial) { ... }`, which runs its block on the game thread, every 250 ms
  unless you pass `everyMillis`, and holds the result as state. Use it for values
  the panel shows but `loop()` does not otherwise track, like free slots or hitpoints.

Button handlers and other callbacks also run on the render thread. Setting state
from them is fine, as the `Dropdown` above does. For anything that acts on the
game, set a flag and let `loop()` act on it.

`panelTitle` overrides the card's title, which is the script's name otherwise. A
panel that throws is taken down and logged, and the other cards keep drawing.

The overlay's own components are there to use, so a panel matches the rest of the
UI:

| Package | What it has |
|---|---|
| `com.projectx.ui.compose.components` | `Stat`, `ProgressBar`, `ActionButton` (with `ButtonTone`), `IconButton`, `Pill`, `Toggle`, `ToggleChip`, `Dropdown`, `Segmented`, `PillTabs`, `IntSlider`, `NumberInput`, `TextInput`, `TextArea`, `ColorField`, `MenuButton`, `Card`, `Section`, `SettingRow`, `Hint`, `Readout`, `DataTable` with `TableColumn`, `EmptyState`, `Divider` |
| `com.projectx.ui.compose.theme` | `Palette` for the overlay's colours, and `LocalType` for its text styles |

Plain Compose (`Row`, `Column`, `BasicText`, `Canvas` and the rest) works too.
Text fields take an `OverlayText` (in `com.projectx.ui.compose`). Keep it in a
property, such as `private val note = OverlayText.of(setting(""))`, rather than making
one inside `Panel()`. A new one each frame would lose the keyboard focus.

The build needs the Compose compiler plugin and Compose itself. Compose is
`compileOnly` for the same reason as the API, since the engine already ships it.
Keep the versions below matched to the engine; release notes say when they change.

```kotlin
plugins {
    kotlin("jvm") version "2.4.0"
    kotlin("plugin.compose") version "2.4.0"
}

repositories {
    mavenCentral()
    google()
    // ... the script-api repository as above
}

dependencies {
    compileOnly("org.jetbrains.compose.desktop:desktop:1.12.1")
}
```

Java scripts, and Kotlin scripts that prefer it, keep using `render()` with
`ImGuiDsl` or `Overlay` as above. Those windows are drawn as Compose cards too, so
they get the same look without changing anything.

### Experience per hour

For a skilling script, `SkillTracker` does the tracking and draws a finished
window: runtime, level and levels gained, XP gained and per hour, time to the
next level, a progress bar, and any counts you report.

```kotlin
private val tracker = SkillTracker(Skill.WOODCUTTING)

override suspend fun loop() {
    // ...
    if (logCut) tracker.add("Logs")
}

override fun render() = tracker.window("My Woodcutter")
```

```java
private final SkillTracker tracker = new SkillTracker(Skill.WOODCUTTING);

@Override
public void render() {
    tracker.window("My Woodcutter");
}
```

Give it no skills to show every skill that gains experience. It starts
measuring the first time it is drawn while you are logged in; `reset()` starts
again. To put it inside a window of your own, call `tracker.draw(scope)`. The
numbers are there too: `xpGained`, `xpPerHour`, `levelsGained`,
`millisToLevel`, `countOf`, `countPerHour` and `runtimeMillis`.

## 7. Run it

```bash
./gradlew installScripts
```

That builds the jar and copies it to `~/.projectx/scripts/`, which is where the
engine loads script jars from. Kotlin and Java scripts ship in the same jar and
are discovered the same way. Start the engine, or click **Reload** in the
overlay's Library tab, then find your script in the **Store** tab under **Your
scripts** and click **Add** to put it in your Library.

While iterating, rebuild and hot-reload rather than restarting the client.

## 8. Distributing

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

[SHARING-SCRIPTS.md](SHARING-SCRIPTS.md) covers handing out or selling a jar in
full: how the engine loads it, building a jar that works on someone else's PC,
obfuscation, and what buyers should know.
