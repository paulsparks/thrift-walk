extends Node
## Run against the disposable integration backend; no real credentials are stored.
var _entered := false
var _connection_failure := ""
var _last_result: Dictionary = {}


func _ready() -> void:
	await get_tree().process_frame
	reparent(get_tree().root)
	await get_tree().create_timer(2).timeout
	var result := await Api.request(
		"/api/auth/sign-in/email",
		"POST",
		{
			"email":
			(
				OS.get_environment("TEST_EMAIL")
				if not OS.get_environment("TEST_EMAIL").is_empty()
				else "bob@example.test"
			),
			"password": "TestPassword123!"
		}
	)
	check((result.status as int) == 200, "native sign-in")
	check(not Api.cookies.is_empty(), "native memory cookie adapter")
	result = await Api.validate()
	check((result.status as int) == 200 and not Api.user.is_empty(), "native session validation")
	check(
		get_tree().current_scene.find_children("Player_*", "", false, false).is_empty(),
		"no player before admission"
	)
	Server.entered_world.connect(func() -> void: _entered = true)
	Server.connection_error.connect(func(message: String) -> void: _connection_failure = message)
	Server.placement_result.connect(func(reply: Dictionary) -> void: _last_result = reply)
	Server.connect_game()
	for i in 250:
		if _entered or not _connection_failure.is_empty():
			break
		await get_tree().create_timer(0.1).timeout
	if OS.get_environment("TEST_DUPLICATE") == "1":
		check(
			not _entered and _connection_failure.contains("already in the market"),
			"duplicate account rejected clearly"
		)
		print("DUPLICATE_ACCOUNT_PASS")
		get_tree().quit()
		return
	check(_entered, "authenticated admission and world readiness: " + _connection_failure)
	await get_tree().create_timer(2).timeout
	if OS.get_environment("TEST_HOLD") == "1":
		print("HOLDER_READY")
		await get_tree().create_timer(15).timeout
		get_tree().quit()
		return
	if OS.get_environment("TEST_ACCOUNT_SWITCH") == "1":
		var original_id := str(Api.user.id)
		AppUI.set("_inventory", [{"id": "stale-inventory"}])
		var switched := await Api.request(
			"/api/auth/sign-in/email",
			"POST",
			{"email": "bob@example.test", "password": "TestPassword123!"}
		)
		check((switched.status as int) == 200, "switch browser-equivalent cookie identity")
		var fresh_stores := await Api.request("/api/market/stores")
		check((fresh_stores.status as int) == 409, "changed-account inventory rejected")
		check(Server.account_id.is_empty(), "old world identity disconnected")
		check(not multiplayer.has_multiplayer_peer(), "old world connection closed")
		check((AppUI.get("_inventory") as Array).is_empty(), "old inventory cleared")
		check(InputMode.mode == InputMode.Mode.LOGIN, "account switch returns to admission")
		var current := await Api.validate()
		check(
			(current.status as int) == 200 and str(Api.user.id) != original_id,
			"new account available for reconnect"
		)
		print("ACCOUNT_SWITCH_PASS")
		get_tree().quit()
		return
	var world := get_tree().current_scene
	check(world.name == "DemoStore", "world loaded")
	var players := world.find_children("Player_*", "", false, false)
	check(not players.is_empty(), "player spawned after readiness")
	var local_player := get_viewport().get_camera_3d().get_parent() as PlayerController
	check(local_player.display_name == str(Api.user.name), "server-authenticated player name")
	var escape := InputEventKey.new()
	escape.keycode = KEY_ESCAPE
	escape.pressed = true
	InputMode.set_mode(InputMode.Mode.PAUSE)
	InputMode._input(escape)
	escape.pressed = false
	InputMode._input(escape)
	await get_tree().create_timer(0.5).timeout
	check(InputMode.mode == InputMode.Mode.PLAYING, "Escape resumes without reopening pause")
	var tab := InputEventKey.new()
	tab.keycode = KEY_TAB
	tab.pressed = true
	for mode: InputMode.Mode in [
		InputMode.Mode.PAUSE, InputMode.Mode.STORE, InputMode.Mode.DETAILS
	]:
		InputMode.set_mode(mode)
		InputMode.form_open = true
		InputMode._input(tab)
		check(
			InputMode.mode == InputMode.Mode.PLAYING,
			"Tab closes every game overlay, including forms"
		)
	Market.begin({"id": "preview-regression"})
	var preview_material := Market.get("_preview_material") as StandardMaterial3D
	for i in 50:
		Market._update_preview()
	check(
		(Market.get("_preview_material") as StandardMaterial3D) == preview_material,
		"preview reuses its material"
	)
	InputMode._input(tab)
	check(InputMode.mode == InputMode.Mode.PLAYING, "Tab cancels preview and closes UI")
	var view := local_player.get("_view") as PlayerView
	for next_mode: InputMode.Mode in [InputMode.Mode.PLAYING, InputMode.Mode.PLACING]:
		InputMode.set_mode(InputMode.Mode.PAUSE)
		var yaw := view.get_yaw()
		var pitch := view.get_pitch()
		InputMode.set_mode(next_mode)
		var warp := InputEventMouseMotion.new()
		warp.relative = Vector2(600, -300)
		local_player._unhandled_input(warp)
		check(view.get_yaw() == yaw and view.get_pitch() == pitch, "capture preserves look")
		for frame in 4:
			await get_tree().process_frame
		var motion := InputEventMouseMotion.new()
		motion.relative = Vector2(2, 1)
		local_player._unhandled_input(motion)
		local_player._unhandled_input(motion)
		if DisplayServer.get_name() != "headless":
			check(view.get_yaw() != yaw, "normal mouse look resumes")
	print("CAPTURE_CAMERA_PASS")
	print("INPUT_PREVIEW_NAMEPLATE_PASS")
	InputMode.set_mode(InputMode.Mode.STORE)
	check(not InputMode.gameplay(), "overlay suppresses gameplay")
	var inventory := await Api.request("/api/market/stores")
	check((inventory.status as int) == 200, "native inventory authorization")
	if OS.get_environment("TEST_OBSERVER") == "1":
		var saw_frame := false
		for i in 300:
			if not Market.placements.is_empty():
				saw_frame = true
			if saw_frame and Market.placements.is_empty():
				print("OBSERVER_SYNC_PASS")
				get_tree().quit()
				return
			await get_tree().create_timer(0.1).timeout
		check(false, "observer received committed addition and removal")
		return
	var item_id := OS.get_environment("TEST_ITEM_ID")
	var ui_item: Dictionary = {}
	if OS.get_environment("TEST_UI_PLACE") == "1":
		var stores: Array = inventory.data.stores
		check(not stores.is_empty(), "placement fixture has a store")
		var items := await Api.request("/api/market/inventory?storeId=" + str(stores[0].id))
		check(
			(items.status as int) == 200 and not (items.data.items as Array).is_empty(),
			"placement inventory"
		)
		ui_item = items.data.items[0]
		item_id = str(ui_item.id)
	if not item_id.is_empty():
		var command := {
			"op": "place",
			"itemId": item_id,
			"requestId": Api.request_id(),
			"x": snappedf(get_viewport().get_camera_3d().global_position.x, 0.1),
			"y": 2.3
		}
		if not ui_item.is_empty():
			await AppUI._place(ui_item)
			check(InputMode.mode == InputMode.Mode.PLACING, "inventory action starts preview")
			Market.set("_position", Vector3(command.x as float, command.y as float, -1.94))
			Market.set("_valid", true)
			var click := InputEventMouseButton.new()
			click.button_index = MOUSE_BUTTON_LEFT
			click.pressed = true
			Market._unhandled_input(click)
			command = (Market.get("_last_command") as Dictionary).duplicate(true)
			check(str(command.get("itemId", "")) == item_id, "preview preserves inventory item ID")
		else:
			Server.submit_placement(command)
		for i in 150:
			if not _last_result.is_empty():
				break
			await get_tree().create_timer(0.1).timeout
		check(
			(_last_result.get("status", 0) as int) == 200,
			"authoritative placement: " + Api.message(_last_result)
		)
		var placement: Dictionary = _last_result.data
		_last_result = {}
		Server.submit_placement(command)
		for i in 150:
			if not _last_result.is_empty():
				break
			await get_tree().create_timer(0.1).timeout
		check((_last_result.get("status", 0) as int) == 200, "idempotent placement retry")
		await Market.poll_world()
		check(Market.placements.has(str(placement.id)), "committed frame snapshot")
		await get_tree().create_timer(3).timeout
		_last_result = {}
		Server.submit_placement(
			{
				"op": "remove",
				"itemId": item_id,
				"requestId": Api.request_id(),
				"placementId": placement.id,
				"revision": placement.revision
			}
		)
		for i in 150:
			if not _last_result.is_empty():
				break
			await get_tree().create_timer(0.1).timeout
		check((_last_result.get("status", 0) as int) == 200, "authoritative removal")
	result = await Api.request("/api/auth/sign-out", "POST")
	check((result.status as int) == 200, "native sign-out")
	Server.disconnect_game()
	result = await Api.validate()
	check((result.status as int) == 401, "revoked session rejected")
	print("NATIVE_SMOKE_PASS")
	get_tree().quit()


func check(condition: bool, description: String) -> void:
	if not condition:
		push_error("NATIVE_SMOKE_FAIL: " + description)
		get_tree().quit(1)
		assert(condition, description)
