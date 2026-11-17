extends Node
var _clicks := 0


func _ready() -> void:
	await get_tree().process_frame
	Api.generation += 1
	Api.user.clear()
	for mode: InputMode.Mode in [
		InputMode.Mode.LOGIN,
		InputMode.Mode.CONNECTING,
		InputMode.Mode.STORE,
		InputMode.Mode.DETAILS
	]:
		InputMode.set_mode(mode)
		AppUI._reset("Menu test")
		AppUI.label("Content stays in place")
		await settle()
		var panel := AppUI.get("_panel") as Control
		var bounds := panel.get_global_rect()
		var first := AppUI._start_loading()
		await settle()
		check(panel.get_global_rect() == bounds, "spinner preserves menu bounds")
		var second := AppUI._start_loading()
		AppUI._finish_loading(first)
		check(
			(AppUI.get("_loading_overlay") as Control).visible, "stale request cannot hide spinner"
		)
		AppUI._finish_loading(second)
		await settle()
		check(panel.get_global_rect() == bounds, "completion preserves menu bounds")
		check(not (AppUI.get("_loading_overlay") as Control).visible, "spinner finishes")
	InputMode.set_mode(InputMode.Mode.PLAYING)
	await settle()
	if DisplayServer.get_name() != "headless":
		check(InputMode.pointer_captured(), "gameplay captures pointer")
	InputMode.set_mode(InputMode.Mode.STORE)
	AppUI._reset("Cursor test")
	var target := AppUI.button("Test click", func() -> void: _clicks += 1)
	var field := AppUI.field("Store name")
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size.y = 100
	(AppUI.get("_box") as VBoxContainer).add_child(scroll)
	var rows := VBoxContainer.new()
	scroll.add_child(rows)
	for index in 30:
		AppUI.label("Inventory row " + str(index), rows)
	await settle()
	if DisplayServer.get_name() != "headless":
		check(InputMode.pointer_captured(), "inventory retains lock")
		var loading := AppUI._start_loading()
		click_control(target)
		check(_clicks == 0, "loading overlay blocks duplicate actions")
		AppUI._finish_loading(loading)
		click_control(target)
		check(_clicks == 1, "virtual pointer clicks exactly once")
		click_control(field)
		var letter := InputEventKey.new()
		letter.keycode = KEY_X
		letter.unicode = 120
		letter.pressed = true
		get_viewport().push_input(letter, true)
		check(field.text == "x", "virtual pointer focuses text fields")
		check(InputMode.pointer_captured(), "form interaction retains lock")
		var motion := InputEventMouseMotion.new()
		motion.relative = (
			scroll.get_global_rect().get_center() - (InputMode.get("_cursor_position") as Vector2)
		)
		get_viewport().push_input(motion, true)
		var wheel := InputEventMouseButton.new()
		wheel.button_index = MOUSE_BUTTON_WHEEL_DOWN
		wheel.pressed = true
		get_viewport().push_input(wheel, true)
		await settle()
		check(scroll.scroll_vertical > 0, "virtual pointer scrolls inventory")
	var saved_cursor: Vector2 = InputMode.get("_cursor_position")
	InputMode._notification(NOTIFICATION_APPLICATION_FOCUS_OUT)
	await settle()
	check(InputMode.mode == InputMode.Mode.STORE, "focus loss preserves inventory")
	check(field.text == "x" or DisplayServer.get_name() == "headless", "focus loss preserves form")
	check(
		(InputMode.get("_cursor_position") as Vector2) == saved_cursor,
		"focus loss preserves cursor position"
	)
	if DisplayServer.get_name() != "headless":
		var recapture := InputEventMouseButton.new()
		recapture.button_index = MOUSE_BUTTON_LEFT
		recapture.pressed = true
		get_viewport().push_input(recapture, true)
		recapture = recapture.duplicate() as InputEventMouseButton
		recapture.pressed = false
		get_viewport().push_input(recapture, true)
		await settle()
		check(InputMode.pointer_captured(), "return click recaptures inventory")
		check(_clicks == 1, "return click does not activate a menu action")
	for preserved: InputMode.Mode in [InputMode.Mode.DETAILS, InputMode.Mode.PLACING]:
		InputMode.set_mode(preserved)
		InputMode._notification(NOTIFICATION_APPLICATION_FOCUS_OUT)
		await settle()
		check(InputMode.mode == preserved, "focus loss preserves details and placement")
	InputMode.set_mode(InputMode.Mode.STORE)
	var tab := InputEventKey.new()
	tab.keycode = KEY_TAB
	tab.pressed = true
	InputMode._input(tab)
	check(InputMode.mode == InputMode.Mode.PLAYING, "Tab closes virtual menu")
	if DisplayServer.get_name() != "headless":
		check(InputMode.pointer_captured(), "closing menu retains lock")
	InputMode.set_mode(InputMode.Mode.STORE)
	var escape := InputEventKey.new()
	escape.keycode = KEY_ESCAPE
	escape.pressed = true
	InputMode._input(escape)
	check(InputMode.mode == InputMode.Mode.PAUSE, "Escape opens real-cursor pause")
	check(not InputMode.pointer_captured(), "pause releases pointer")
	escape.pressed = false
	InputMode._input(escape)
	escape.pressed = true
	InputMode._input(escape)
	await settle()
	check(InputMode.mode == InputMode.Mode.PAUSE, "holding Escape keeps pause visible")
	check(not (AppUI.get("_hint") as Control).visible, "no return-to-market prompt")
	escape.pressed = false
	InputMode._input(escape)
	check(InputMode.mode == InputMode.Mode.PLAYING, "Escape release resumes")
	if DisplayServer.get_name() != "headless":
		await settle()
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
		InputMode._process(0.0)
		await get_tree().process_frame
		await get_tree().process_frame
		InputMode._process(0.0)
		check(
			InputMode.mode == InputMode.Mode.PAUSE,
			"browser-consumed Escape pauses within two frames"
		)
		InputMode.set_mode(InputMode.Mode.STORE)
		await settle()
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
		InputMode._process(0.0)
		InputMode._notification(NOTIFICATION_APPLICATION_FOCUS_OUT)
		await get_tree().create_timer(0.2).timeout
		check(InputMode.mode == InputMode.Mode.STORE, "blur cancels manual-unlock fallback")
	# Late results for a canceled request must not mutate a newer preview or removal.
	Market.begin({"id": "old-item"})
	Market.set("_request_id", "old-request")
	Market.set("_pending", true)
	Market.cancel()
	Market.begin({"id": "new-item"})
	Market.set("_request_id", "new-request")
	Market.set("_pending", true)
	AppUI.set("_remove_command", {"requestId": "remove-request"})
	AppUI.set("_busy", true)
	for status: int in [200, 422, 503]:
		Server.placement_result.emit({"requestId": "old-request", "status": status, "data": {}})
		check(is_instance_valid(Market.get("_preview")), "late result preserves new preview")
		check(Market.get("_pending") as bool, "late result preserves pending placement")
		check(AppUI.get("_busy") as bool, "unrelated result preserves pending removal")
	Server.placement_result.emit({"requestId": "new-request", "status": 200, "data": {}})
	check(not is_instance_valid(Market.get("_preview")), "matching success completes placement")
	check(AppUI.get("_busy") as bool, "placement success does not complete removal")
	Server.placement_result.emit({"requestId": "remove-request", "status": 200, "data": {}})
	check(not (AppUI.get("_busy") as bool), "matching success completes removal")
	AppUI.set("_remove_command", {"requestId": "new-removal"})
	AppUI.set("_remove_serial", 20)
	AppUI.set("_busy", true)
	AppUI._removal_timeout(19, "old-removal")
	check(AppUI.get("_busy") as bool, "old removal timer cannot interrupt a new removal")
	Server.placement_result.emit({"requestId": "new-removal", "status": 503, "data": {}})
	AppUI.set("_busy", true)
	AppUI._removal_timeout(20, "new-removal")
	check(AppUI.get("_busy") as bool, "completed removal timer cannot interrupt another action")
	AppUI.set("_busy", false)
	AppUI.set("_remove_command", {})
	Server._command_result({"status": 200, "data": {}})
	check(
		InputMode.mode == InputMode.Mode.CONNECTING, "old server response reports version mismatch"
	)
	print("MENU_LOADING_CURSOR_PASS")
	get_tree().quit()


func click_control(control: Control) -> void:
	var motion := InputEventMouseMotion.new()
	motion.relative = (
		control.get_global_rect().get_center() - (InputMode.get("_cursor_position") as Vector2)
	)
	get_viewport().push_input(motion, true)
	var click := InputEventMouseButton.new()
	click.button_index = MOUSE_BUTTON_LEFT
	click.pressed = true
	click.button_mask = MOUSE_BUTTON_MASK_LEFT
	get_viewport().push_input(click, true)
	click = click.duplicate() as InputEventMouseButton
	click.pressed = false
	click.button_mask = 0
	get_viewport().push_input(click, true)


func settle() -> void:
	for frame in 5:
		await get_tree().process_frame


func check(condition: bool, description: String) -> void:
	if not condition:
		push_error("MENU_SMOKE_FAIL: " + description)
		get_tree().quit(1)
		assert(condition, description)
