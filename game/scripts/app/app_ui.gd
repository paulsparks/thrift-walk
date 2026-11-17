extends CanvasLayer
const WELCOME_HEIGHT := 160.0
var _root: Control
var _panel: PanelContainer
var _content_scroll: ScrollContainer
var _box: VBoxContainer
var _loading_overlay: Control
var _loading_serial := 0
var _menu_height := WELCOME_HEIGHT
var _wishlist_loading := false
var _status: Label
var _hint: Label
var _email: LineEdit
var _password: LineEdit
var _busy := false
var _signing_out := false
var _stores: Array = []
var _selected := ""
var _inventory: Array = []
var _inventory_generation := 0
var _store_request := ""
var _store_request_name := ""
var _details: Dictionary = {}
var _wishlist_saved := false
var _wishlist_pending := false
var _wishlist_known := false
var _detail_generation := 0
var _session_check := false
var _next_session_check := 0
var _scroll := 0
var _inventory_scroll: ScrollContainer
var _error := ""
var _remove_command: Dictionary = {}
var _remove_serial := 0


func _ready() -> void:
	if Server.is_dedicated():
		return
	layer = 10
	_build_root()
	InputMode.changed.connect(_mode_changed)
	InputMode.store_requested.connect(refresh_inventory)
	Api.session_ended.connect(_expired)
	Api.account_changed.connect(_account_changed)
	Server.connection_error.connect(_connection_error)
	Server.placement_result.connect(_placement_result)
	Market.refreshed.connect(_world_refreshed)
	Market.preview_changed.connect(func(message: String) -> void: _hint.text = message)
	_check_login.call_deferred()


func _build_root() -> void:
	_root = Control.new()
	_root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_root)
	var dim := ColorRect.new()
	dim.color = Color(0.06, 0.1, 0.08, 0.52)
	dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	dim.name = "Dim"
	_root.add_child(dim)
	var center := CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	center.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_root.add_child(center)
	_panel = PanelContainer.new()
	_panel.custom_minimum_size = Vector2(520, 0)
	_panel.theme = MarketTheme.make()
	center.add_child(_panel)
	_box = VBoxContainer.new()
	_box.add_theme_constant_override("separation", 12)
	_content_scroll = ScrollContainer.new()
	_content_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_content_scroll.custom_minimum_size = Vector2(
		0, minf(_menu_height, get_viewport().get_visible_rect().size.y - 100)
	)
	_panel.add_child(_content_scroll)
	_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_content_scroll.add_child(_box)
	_loading_overlay = Control.new()
	_loading_overlay.mouse_filter = Control.MOUSE_FILTER_STOP
	_loading_overlay.visible = false
	_panel.add_child(_loading_overlay)
	var wash := ColorRect.new()
	wash.color = Color(0.965, 0.945, 0.902, 0.94)
	wash.mouse_filter = Control.MOUSE_FILTER_IGNORE
	wash.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_loading_overlay.add_child(wash)
	var spinner := LoadingSpinner.new()
	_loading_overlay.add_child(spinner)
	spinner.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	spinner.offset_left = -20
	spinner.offset_top = -20
	spinner.offset_right = 20
	spinner.offset_bottom = 20
	_hint = Label.new()
	_hint.set_anchors_and_offsets_preset(Control.PRESET_CENTER_BOTTOM)
	_hint.position = Vector2(-340, -88)
	_hint.custom_minimum_size = Vector2(680, 44)
	_hint.theme = _panel.theme
	_hint.add_theme_stylebox_override("normal", MarketTheme.surface(MarketTheme.PAPER, 18, 12))
	_hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_root.add_child(_hint)


func _reset(title: String, height: float = 360.0) -> void:
	_clear_loading()
	for child in _box.get_children():
		_box.remove_child(child)
		child.queue_free()
	var width := 440.0
	_menu_height = height
	if InputMode.mode == InputMode.Mode.STORE:
		width = 860.0
		_menu_height = 520.0
	elif InputMode.mode == InputMode.Mode.DETAILS:
		width = 760.0
		_menu_height = 420.0
	if InputMode.mode == InputMode.Mode.PAUSE:
		_menu_height = 220.0
	_panel.custom_minimum_size.x = minf(width, get_viewport().get_visible_rect().size.x - 40)
	_content_scroll.custom_minimum_size.y = minf(
		_menu_height, get_viewport().get_visible_rect().size.y - 100
	)
	_content_scroll.scroll_vertical = 0
	var header := HBoxContainer.new()
	_box.add_child(header)
	var heading := label(title, header)
	heading.add_theme_font_size_override("font_size", 28)
	if InputMode.mode in [InputMode.Mode.STORE, InputMode.Mode.DETAILS]:
		button("Close", func() -> void: InputMode.set_mode(InputMode.Mode.PLAYING), header)
	_status = label("")
	_status.add_theme_color_override("font_color", Color("96502f"))
	_status.visible = false


func _start_loading() -> int:
	_loading_serial += 1
	_loading_overlay.show()
	return _loading_serial


func _finish_loading(serial: int) -> void:
	if serial == _loading_serial:
		_loading_overlay.hide()


func _clear_loading() -> void:
	_loading_serial += 1
	if is_instance_valid(_loading_overlay):
		_loading_overlay.hide()


func label(text: String, parent: Node = null) -> Label:
	var node := Label.new()
	node.text = text
	node.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	node.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	(parent if parent else _box).add_child(node)
	return node


func button(text: String, action: Callable, parent: Node = null, disabled: bool = false) -> Button:
	var node := Button.new()
	node.text = text
	node.disabled = disabled
	node.custom_minimum_size.y = 40
	node.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	node.pressed.connect(action)
	(parent if parent else _box).add_child(node)
	if (
		text in ["Resume", "Sign in", "Create store", "Place", "Add items in browser"]
		or text.begins_with("Continue as")
		or text.begins_with("View listing")
	):
		MarketTheme.primary(node)
	return node


func field(placeholder: String, value: String = "") -> LineEdit:
	var node := LineEdit.new()
	node.placeholder_text = placeholder
	node.text = value
	node.max_length = 254
	_box.add_child(node)
	return node


func _mode_changed() -> void:
	_clear_loading()
	_detail_generation += 1
	var mode := InputMode.mode
	_root.get_node("Dim").set(
		"visible", mode not in [InputMode.Mode.PLAYING, InputMode.Mode.PLACING]
	)
	_panel.visible = mode not in [InputMode.Mode.PLAYING, InputMode.Mode.PLACING]
	_hint.visible = mode == InputMode.Mode.PLACING
	if mode == InputMode.Mode.PAUSE:
		_reset("Paused")
		label("The market is still live.")
		button("Resume", func() -> void: InputMode.set_mode(InputMode.Mode.PLAYING)).grab_focus()
		button("Exit", sign_out)
	elif mode == InputMode.Mode.CONNECTING:
		_reset("Connecting")
		_start_loading()
	elif mode == InputMode.Mode.STORE:
		if _stores.is_empty():
			_reset("My Stores")
		else:
			_render_inventory()
		_start_loading()


func _check_login() -> void:
	InputMode.set_mode(InputMode.Mode.LOGIN)
	_reset("ThriftWalk", WELCOME_HEIGHT)
	if Api.signout_pending:
		_status.text = "Sign-out could not be confirmed. Retry to finish signing out."
		button("Retry sign-out", sign_out)
		return
	var epoch := Api.generation
	var loading := _start_loading()
	var result := await Api.validate()
	_finish_loading(loading)
	if epoch != Api.generation:
		return
	if (result.status as int) == 200:
		_reset("Welcome back", WELCOME_HEIGHT)
		button("Continue as " + str(Api.user.name), _connect_world).grab_focus()
		button("Use another account", sign_out)
	elif (result.status as int) == 401:
		_login_form()
	else:
		_status.text = Api.message(result)
		button("Retry", _check_login)


func _login_form(message: String = "") -> void:
	InputMode.set_mode(InputMode.Mode.LOGIN)
	_reset("Sign in to ThriftWalk")
	_status.text = message
	label("Email")
	_email = field("you@example.com")
	label("Password")
	_password = field("Password")
	_password.secret = true
	button("Sign in", _sign_in)
	var links := HBoxContainer.new()
	_box.add_child(links)
	button("Create account", func() -> void: Api.open_browser("/sign-up"), links)
	button("Forgot password?", func() -> void: Api.open_browser("/forgot-password"), links)
	_email.grab_focus()


func _sign_in() -> void:
	if _busy:
		return
	if not _email.text.contains("@") or _password.text.is_empty():
		_status.text = "Enter a valid email and your password."
		return
	_busy = true
	_set_buttons_disabled(true)
	_status.text = ""
	var loading := _start_loading()
	var result := await Api.request(
		"/api/auth/sign-in/email",
		"POST",
		{"email": _email.text.strip_edges(), "password": _password.text}
	)
	if is_instance_valid(_password):
		_password.text = ""
	if (result.status as int) == 200:
		var checked := await Api.validate()
		if (checked.status as int) == 200:
			_connect_world()
		else:
			_status.text = Api.message(checked)
	elif (result.status as int) in [400, 401, 403]:
		_status.text = "Invalid email or password."
	else:
		_status.text = "Connection failed. Please retry signing in."

	_busy = false
	_finish_loading(loading)
	_set_buttons_disabled(false)


func _set_buttons_disabled(value: bool) -> void:
	for child in _box.find_children("*", "Button", true, false):
		(child as Button).disabled = value


func _connect_world() -> void:
	Server.connect_game()


func _connection_error(message: String) -> void:
	if InputMode.mode == InputMode.Mode.LOGIN:
		return
	Server.disconnect_game()
	Market.cancel()
	InputMode.set_mode(InputMode.Mode.CONNECTING)
	_reset("Connection interrupted")
	_status.text = message
	button("Retry", _connect_world)
	button(
		"Return to login",
		func() -> void:
			Server.disconnect_game()
			Market.clear()
			get_tree().change_scene_to_file("res://scenes/app/login.tscn")
			_check_login()
	)


func _account_changed() -> void:
	Server.disconnect_game()
	_clear_private()
	InputMode.set_mode(InputMode.Mode.LOGIN)
	get_tree().change_scene_to_file("res://scenes/app/login.tscn")
	_check_login.call_deferred()


func _expired() -> void:
	if InputMode.mode == InputMode.Mode.LOGIN:
		return
	Server.disconnect_game()
	Api.clear()
	_clear_private()
	get_tree().change_scene_to_file("res://scenes/app/login.tscn")
	_login_form("Your session ended. Sign in again.")


func _clear_private() -> void:
	_busy = false
	Market.clear()
	_stores.clear()
	_inventory.clear()
	_selected = ""
	_details.clear()
	_inventory_generation += 1
	_remove_command.clear()
	_remove_serial += 1
	_store_request_name = ""
	_store_request = ""
	_error = ""


func sign_out() -> void:
	if _signing_out:
		return
	_signing_out = true
	_busy = true
	Api.signout_pending = true
	Server.disconnect_game()
	_clear_private()
	InputMode.set_mode(InputMode.Mode.LOGIN)
	_reset("Signing out")
	_start_loading()
	var result := await Api.request("/api/auth/sign-out", "POST")
	_busy = false
	_signing_out = false
	get_tree().change_scene_to_file("res://scenes/app/login.tscn")
	if (result.status as int) == 200:
		Api.signout_pending = false
		Api.clear()
		_login_form()
	else:
		_reset("Sign-out not confirmed")
		_status.text = "The server session may still be active. Retry to finish signing out."
		button("Retry sign-out", sign_out)


func refresh_inventory() -> void:
	if InputMode.mode != InputMode.Mode.STORE:
		return
	_inventory_generation += 1
	var version := _inventory_generation
	var epoch := Api.generation
	if is_instance_valid(_inventory_scroll):
		_scroll = _inventory_scroll.scroll_vertical
	_start_loading()
	_set_buttons_disabled(true)
	var result := await Api.request("/api/market/stores")
	if (
		version != _inventory_generation
		or epoch != Api.generation
		or InputMode.mode != InputMode.Mode.STORE
	):
		return
	if (result.status as int) != 200:
		_error = Api.message(result)
		_render_inventory(true)
		return
	_stores = result.data.stores
	if not _stores.any(func(store: Dictionary) -> bool: return str(store.id) == _selected):
		_selected = "" if _stores.is_empty() else str(_stores[0].id)
	if not _selected.is_empty():
		result = await Api.request("/api/market/inventory?storeId=" + _selected.uri_encode())
		if (
			version != _inventory_generation
			or epoch != Api.generation
			or InputMode.mode != InputMode.Mode.STORE
		):
			return
		if (result.status as int) != 200:
			_error = Api.message(result)
			_render_inventory(true)
			return
		_inventory = result.data.items
	_render_inventory()


func _render_inventory(stale: bool = false) -> void:
	InputMode.form_open = false
	_reset("My Stores")
	if not _error.is_empty():
		_status.text = _error
		button(
			"Dismiss message",
			func() -> void:
				_error = ""
				_render_inventory(stale)
		)
	if _stores.is_empty():
		label("Make a little corner of the market yours").add_theme_font_size_override(
			"font_size", 22
		)
		label("Create your store, add your finds, and give them a place in the neighborhood.")
		button("New store", _new_store, null, stale)
		button("Refresh", refresh_inventory)
		return
	var toolbar := HBoxContainer.new()
	_box.add_child(toolbar)
	var selector := HBoxContainer.new()
	selector.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	toolbar.add_child(selector)
	for store: Dictionary in _stores:
		var store_id := str(store.id)
		var choice := button(
			str(store.name),
			func() -> void:
				_selected = store_id
				_inventory.clear()
				_scroll = 0
				refresh_inventory(),
			selector,
			_busy
		)
		choice.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		choice.clip_text = true
		choice.tooltip_text = str(store.name)
		if store_id == _selected:
			MarketTheme.primary(choice)
	button("Refresh", refresh_inventory, toolbar)
	button(
		"3 of 3 stores" if _stores.size() >= 3 else "New store",
		_new_store,
		toolbar,
		stale or _stores.size() >= 3
	)
	var placed := (
		_inventory
		. filter(func(item: Dictionary) -> bool: return item.get("placementId") != null)
		. size()
	)
	(
		label(
			(
				"%s · %s items · %s on display%s"
				% [
					str(Api.user.get("name", "")),
					_inventory.size(),
					placed,
					" · Updating needed" if stale else ""
				]
			)
		)
		. add_theme_color_override("font_color", MarketTheme.MUTED)
	)
	_inventory_scroll = ScrollContainer.new()
	_inventory_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_inventory_scroll.custom_minimum_size = Vector2(
		0, clampf(get_viewport().get_visible_rect().size.y - 340, 140, 340)
	)
	_box.add_child(_inventory_scroll)
	var list := VBoxContainer.new()
	list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_inventory_scroll.add_child(list)
	if _inventory.is_empty():
		label(
			"Your next great find belongs here.\nAdd an item in the browser to get started.", list
		)
	for item: Dictionary in _inventory:
		var tag := PanelContainer.new()
		var style := MarketTheme.surface(Color("fffdf8"), 16, 12)
		style.border_color = Color("ded8ca")
		style.set_border_width_all(1)
		tag.add_theme_stylebox_override("panel", style)
		list.add_child(tag)
		var row := HBoxContainer.new()
		tag.add_child(row)
		_thumbnail(str(item.get("imageAssetId", "")), row)
		var info := VBoxContainer.new()
		info.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		info.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		row.add_child(info)
		label(str(item.name), info).add_theme_font_size_override("font_size", 19)
		var is_placed: bool = item.get("placementId") != null
		label("On display" if is_placed else "Available to display", info).add_theme_color_override(
			"font_color", MarketTheme.MUTED
		)
		var action: Button
		if is_placed:
			action = button("Remove frame", func() -> void: _remove(item), row, stale or _busy)
		elif (
			item.get("imageAssetId") == null
			or item.get("externalUrl") == null
			or item.get("_image_unavailable", false)
		):
			action = button(
				"Finish setup ↗",
				func() -> void: Api.open_browser("/my-store?store=" + _selected.uri_encode()),
				row
			)
		else:
			action = button("Place", func() -> void: _place(item), row, stale)
		action.custom_minimum_size.x = 112
		action.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	var footer := HBoxContainer.new()
	_box.add_child(footer)
	label("Manage your items on the website.", footer).add_theme_color_override(
		"font_color", MarketTheme.MUTED
	)
	button(
		"Add items in browser",
		func() -> void: Api.open_browser("/my-store?store=" + _selected.uri_encode()),
		footer
	)
	_inventory_scroll.set_deferred("scroll_vertical", _scroll)


func _thumbnail(id: String, parent: Node, large: bool = false) -> void:
	var rect := TextureRect.new()
	rect.custom_minimum_size = Vector2(240, 220) if large else Vector2(84, 84)
	rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	parent.add_child(rect)
	var spinner := LoadingSpinner.new()
	rect.add_child(spinner)
	spinner.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	spinner.offset_left = -20
	spinner.offset_top = -20
	spinner.offset_right = 20
	spinner.offset_bottom = 20
	var loaded := await Market.texture(id, not large)
	if is_instance_valid(rect):
		spinner.queue_free()
		rect.texture = loaded
		if loaded == null:
			var placeholder := Label.new()
			placeholder.text = "Image unavailable" if large else "No image"
			placeholder.add_theme_font_size_override("font_size", 12)
			rect.add_child(placeholder)


func _new_store() -> void:
	InputMode.form_open = true
	_inventory_generation += 1
	_reset("New store")
	label("Store name")
	var name_field := field("Store name", str(Api.user.get("name", "My")) + "’s Store")
	name_field.max_length = 120
	button("Create store", func() -> void: _create_store(name_field.text))
	button("Back", refresh_inventory)
	name_field.grab_focus()


func _create_store(store_name: String) -> void:
	if _busy:
		return
	if store_name.strip_edges().is_empty():
		_status.text = "Enter a store name."
		return
	if _store_request_name != store_name:
		_store_request_name = store_name
		_store_request = Api.request_id()
	_busy = true
	_set_buttons_disabled(true)
	var loading := _start_loading()
	var result := await Api.request(
		"/api/market/stores", "POST", {"name": store_name, "requestId": _store_request}
	)
	_busy = false
	_finish_loading(loading)
	if InputMode.mode != InputMode.Mode.STORE:
		return
	_set_buttons_disabled(false)
	if (result.status as int) == 200:
		_selected = str(result.data.id)
		_store_request_name = ""
		refresh_inventory()
	else:
		_status.text = Api.message(result)


func _place(item: Dictionary) -> void:
	if _busy:
		return
	_busy = true
	var loading := _start_loading()
	var epoch := Api.generation
	var checked := await Api.validate()
	if epoch != Api.generation or InputMode.mode != InputMode.Mode.STORE:
		_busy = false
		_finish_loading(loading)
		return
	if (checked.status as int) == 200:
		var texture := await Market.texture(str(item.get("imageAssetId", "")), true)
		_busy = false
		_finish_loading(loading)
		if epoch != Api.generation or InputMode.mode != InputMode.Mode.STORE:
			return
		if texture == null:
			item["_image_unavailable"] = true
			_error = "Image unavailable. Finish setup in browser, or Refresh to retry."
			_render_inventory()
			return
		Market.begin(item)
	else:
		_busy = false
		_finish_loading(loading)
		_error = Api.message(checked)
		_render_inventory(true)


func _remove(item: Dictionary) -> void:
	if _busy:
		return
	_busy = true
	_remove_serial += 1
	var serial := _remove_serial
	_set_buttons_disabled(true)
	_start_loading()
	if str(_remove_command.get("placementId", "")) != str(item.placementId):
		_remove_command = {
			"op": "remove",
			"requestId": Api.request_id(),
			"itemId": item.id,
			"placementId": item.placementId,
			"revision": item.placementRevision
		}
	Server.submit_placement(_remove_command)
	var request_id := str(_remove_command.requestId)
	await get_tree().create_timer(15).timeout
	_removal_timeout(serial, request_id)


func _removal_timeout(serial: int, request_id: String) -> void:
	if not _busy or serial != _remove_serial or _remove_command.get("requestId") != request_id:
		return
	_remove_serial += 1
	_busy = false
	_error = "Removal not confirmed. Refreshing authoritative inventory; retry if still placed."
	refresh_inventory()


func _placement_result(result: Dictionary) -> void:
	if _remove_command.is_empty() or result.get("requestId") != _remove_command.get("requestId"):
		return
	_remove_serial += 1
	_busy = false
	if (result.status as int) == 200:
		_remove_command.clear()
		Market.poll_world()
	else:
		_error = Api.message(result)
	refresh_inventory()


func show_details(data: Dictionary) -> void:
	_details = data
	_wishlist_known = false
	_wishlist_loading = true
	_wishlist_pending = false
	InputMode.set_mode(InputMode.Mode.DETAILS)
	_render_details()
	var version := _detail_generation
	var result := await Api.request("/api/market/wishlist?itemId=" + str(data.itemId).uri_encode())
	if version != _detail_generation or InputMode.mode != InputMode.Mode.DETAILS:
		return
	_wishlist_loading = false
	if (result.status as int) == 200:
		_wishlist_saved = (result.data.saved as bool)
		_wishlist_known = true
	else:
		_error = Api.message(result)
	_render_details()


func _render_details() -> void:
	_reset(str(_details.get("name", "Item unavailable")))
	if not Market.placements.has(str(_details.get("id", ""))):
		label("This item is no longer on display.")
		return
	var content := HBoxContainer.new()
	_box.add_child(content)
	_thumbnail(str(_details.get("imageAssetId", "")), content, true)
	var copy := VBoxContainer.new()
	copy.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	content.add_child(copy)
	label(str(_details.get("storeName", "")), copy).add_theme_color_override(
		"font_color", MarketTheme.MUTED
	)
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(0, 180)
	copy.add_child(scroll)
	label(str(_details.get("details", "")), scroll)
	if not _error.is_empty():
		_status.text = _error
	var url := str(_details.get("externalUrl", ""))
	if url.begins_with("https://") and not url.get_slice("/", 2).contains("@"):
		button("View listing on " + url.get_slice("/", 2), func() -> void: Api.open_browser(url))
	button(
		"Remove from wishlist" if _wishlist_saved else "Add to wishlist",
		_toggle_wishlist,
		null,
		_wishlist_pending or not _wishlist_known
	)
	if not _wishlist_known and not _wishlist_loading:
		button("Retry wishlist", func() -> void: show_details(_details))
	if _wishlist_loading or _wishlist_pending:
		_start_loading()


func _toggle_wishlist() -> void:
	if _wishlist_pending:
		return
	_wishlist_pending = true
	_render_details()
	var version := _detail_generation
	var result := await Api.request(
		"/api/market/wishlist",
		"POST",
		{"itemId": _details.itemId, "saved": not _wishlist_saved, "requestId": Api.request_id()}
	)
	if version != _detail_generation:
		return
	_wishlist_pending = false
	if (result.status as int) == 200:
		_wishlist_saved = (result.data.saved as bool)
		_error = ""
	else:
		_error = Api.message(result)
	_render_details()


func _world_refreshed() -> void:
	if InputMode.mode != InputMode.Mode.DETAILS:
		return
	var next: Dictionary = Market.placements.get(str(_details.get("id", "")), {})
	if next != _details:
		if not next.is_empty():
			_details = next
		_render_details()


func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_FOCUS_IN and is_instance_valid(_root):
		_next_session_check = 0
		if InputMode.mode == InputMode.Mode.STORE and not InputMode.form_open:
			refresh_inventory()


func _process(_delta: float) -> void:
	if is_instance_valid(_content_scroll) and _panel.visible:
		_status.visible = not _status.text.is_empty()
		_content_scroll.custom_minimum_size.y = minf(
			_menu_height, get_viewport().get_visible_rect().size.y - 100
		)
	if (
		Server.is_dedicated()
		or Api.user.is_empty()
		or _session_check
		or InputMode.mode == InputMode.Mode.LOGIN
	):
		return
	if Time.get_ticks_msec() >= _next_session_check:
		_validate_session()


func _validate_session() -> void:
	_session_check = true
	_next_session_check = Time.get_ticks_msec() + 25000
	var result := await Api.validate()
	_session_check = false
	if (result.status as int) not in [200, 401] and InputMode.mode != InputMode.Mode.LOGIN:
		_connection_error("Session validation unavailable. Reconnect to retry.")
