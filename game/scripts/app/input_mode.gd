extends Node
signal changed
signal store_requested
signal cancel_placement
enum Mode { LOGIN, CONNECTING, PLAYING, PAUSE, STORE, PLACING, DETAILS }
## Godot's web backend treats chorded-button pointermove events as mouse motion.
## Filter those before the engine consumes potentially stale Firefox deltas.
## https://github.com/godotengine/godot/issues/118908
const WEB_MOUSE_MOTION_FILTER := """
(() => {
    if (window.thriftMouseMotionFilterInstalled) return;
    window.thriftMouseMotionFilterInstalled = true;
    window.addEventListener('pointermove', (event) => {
        if (document.pointerLockElement && event.pointerType === 'mouse' && event.button >= 0) {
            event.stopImmediatePropagation();
        }
    }, true);
})();
"""
var mode: Mode = Mode.LOGIN
var form_open := false
var _captured_once := false
var _resume_on_release := false
var _look_after_frame := 0
var _discard_capture_motion := true
var _cursor: MenuCursor
var _cursor_position := Vector2.ZERO
var _recapture_click := false
var _discard_menu_motion := false
var _routing_pointer := false
var _focused_unlock_frame := -1


func _ready() -> void:
	if OS.has_feature("web"):
		JavaScriptBridge.eval(WEB_MOUSE_MOTION_FILTER, true)
	var layer := CanvasLayer.new()
	layer.layer = 100
	add_child(layer)
	_cursor = MenuCursor.new()
	_cursor.hide()
	layer.add_child(_cursor)


func menu_cursor_active() -> bool:
	return mode in [Mode.STORE, Mode.DETAILS]


func _uses_pointer_lock(next: Mode) -> bool:
	return next in [Mode.PLAYING, Mode.PLACING, Mode.STORE, Mode.DETAILS]


func _route_menu_pointer(event: InputEvent) -> bool:
	if (
		_routing_pointer
		or not menu_cursor_active()
		or not pointer_captured()
		or not event is InputEventMouse
	):
		return false
	if event is InputEventMouseMotion and _discard_menu_motion:
		_discard_menu_motion = false
		get_viewport().set_input_as_handled()
		return true
	if event is InputEventMouseMotion:
		_cursor_position += (event as InputEventMouseMotion).relative
	_cursor_position = _cursor_position.clamp(
		Vector2.ZERO, get_viewport().get_visible_rect().size - Vector2.ONE
	)
	_cursor.position = _cursor_position
	var mouse := event.duplicate() as InputEventMouse
	mouse.position = _cursor_position
	mouse.global_position = _cursor_position
	# Hover tracking runs before _input. Redispatch once with the software
	# coordinates so the GUI uses the same position for hover, clicks and drags.
	_routing_pointer = true
	get_viewport().push_input(mouse, true)
	_routing_pointer = false
	get_viewport().set_input_as_handled()
	return true


func set_mode(next: Mode, capture: bool = true) -> void:
	var had_lock := pointer_captured()
	var was_menu := menu_cursor_active()
	mode = next
	_focused_unlock_frame = -1
	form_open = false
	_captured_once = had_lock and _uses_pointer_lock(next)
	_recapture_click = false
	_resume_on_release = false
	if _uses_pointer_lock(next) and capture:
		_capture_pointer()
	else:
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	if is_instance_valid(_cursor):
		if menu_cursor_active() and not was_menu:
			_cursor_position = get_viewport().get_visible_rect().size * 0.5
		_cursor.position = _cursor_position
		_cursor.visible = menu_cursor_active() and pointer_captured()
	if is_instance_valid(Context.object):
		Context.object.emit_signal("looked_away")
	Context.object = null
	Context.tooltip = ""
	changed.emit()


func _capture_pointer() -> void:
	if pointer_captured():
		return
	_discard_capture_motion = true
	_look_after_frame = Engine.get_process_frames() + 2
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED


func accept_mouse_motion() -> bool:
	if not controls_active() or not _captured_once:
		return false
	# Cursor recentering and queued UI motion must not rotate the camera.
	if _discard_capture_motion:
		_discard_capture_motion = false
		return false
	return Engine.get_process_frames() > _look_after_frame


func pointer_captured() -> bool:
	if OS.has_feature("web"):
		return JavaScriptBridge.eval("document.pointerLockElement !== null") as bool
	return Input.mouse_mode == Input.MOUSE_MODE_CAPTURED


func controls_active() -> bool:
	return mode in [Mode.PLAYING, Mode.PLACING] and pointer_captured() and get_window().has_focus()


func gameplay() -> bool:
	return mode == Mode.PLAYING and controls_active()


func _restore_pointer(event: InputEvent) -> bool:
	# The first click after returning only restores capture. It must not
	# activate a menu button or place the item underneath the real cursor.
	if event is InputEventMouse and _uses_pointer_lock(mode):
		if _recapture_click and event is InputEventMouseButton:
			if (
				(event as InputEventMouseButton).button_index == MOUSE_BUTTON_LEFT
				and not (event as InputEventMouseButton).pressed
			):
				_recapture_click = false
			get_viewport().set_input_as_handled()
			return true
		if not pointer_captured():
			if event is InputEventMouseButton:
				if (
					(event as InputEventMouseButton).pressed
					and (event as InputEventMouseButton).button_index == MOUSE_BUTTON_LEFT
				):
					_recapture_click = true
					_discard_menu_motion = true
					_capture_pointer()
			get_viewport().set_input_as_handled()
			return true
	return false


func _input(event: InputEvent) -> void:
	if _restore_pointer(event):
		return
	if _route_menu_pointer(event):
		return
	if not event is InputEventKey:
		return
	var key := event as InputEventKey
	if key.keycode not in [KEY_ESCAPE, KEY_TAB] or key.echo:
		return
	if mode in [Mode.LOGIN, Mode.CONNECTING]:
		return
	if not key.pressed:
		if _resume_on_release:
			set_mode(Mode.PLAYING)
		get_viewport().set_input_as_handled()
		return
	if key.keycode == KEY_TAB:
		if mode == Mode.PLAYING:
			set_mode(Mode.STORE)
			store_requested.emit()
		else:
			if mode == Mode.PLACING:
				cancel_placement.emit()
			set_mode(Mode.PLAYING)
	elif mode != Mode.PAUSE:
		if mode == Mode.PLACING:
			cancel_placement.emit()
		set_mode(Mode.PAUSE)
	else:
		# Escape itself is the browser's unlock gesture. Keep pause visible
		# until that gesture finishes instead of showing an uncaptured game.
		_resume_on_release = true
	get_viewport().set_input_as_handled()


func _notification(what: int) -> void:
	if what != NOTIFICATION_APPLICATION_FOCUS_OUT:
		return
	release_for_focus_change()


func release_for_focus_change() -> void:
	_resume_on_release = false
	_recapture_click = false
	_focused_unlock_frame = -1
	if _uses_pointer_lock(mode):
		_captured_once = false
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE


func _process(_delta: float) -> void:
	var captured := pointer_captured()
	_cursor.visible = menu_cursor_active() and captured
	if not _uses_pointer_lock(mode):
		if captured:
			Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
		return
	if captured:
		_focused_unlock_frame = -1
		if not _captured_once:
			_look_after_frame = Engine.get_process_frames() + 2
		_captured_once = true
	else:
		# Browsers may consume Escape to unlock without forwarding the key.
		# Give queued focus notifications one frame to arrive, without a
		# visible timed gap between cursor release and the pause menu.
		if _captured_once:
			_focused_unlock_frame = Engine.get_process_frames()
		_captured_once = false
		if _focused_unlock_frame >= 0 and Engine.get_process_frames() > _focused_unlock_frame:
			_focused_unlock_frame = -1
			if get_window().has_focus():
				if mode == Mode.PLACING:
					cancel_placement.emit()
				set_mode(Mode.PAUSE)
