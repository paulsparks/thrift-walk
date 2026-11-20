extends Node
signal refreshed
signal preview_changed(message: String)
const FRAME := preload("res://scenes/objects/store/product_frame.tscn")
const ROTATION_STEP := PI / 12.0
var placements: Dictionary = {}
var frames: Dictionary[String, ProductFrame] = {}
var revision := -1
var _world: Node
var _polling := false
var _next_poll := 0
var _textures: Dictionary[String, Texture2D] = {}
var _models: Dictionary[String, PackedScene] = {}
var _preview_material: StandardMaterial3D
var _preview_elapsed := 0.0
var _preview_message := ""
var _preview: MeshInstance3D
var _position := Vector3.ZERO
var _surface_id := "demo-board"
var _yaw := 0.0
var _valid := false
var _preview_ready := false
var _item: Dictionary = {}
var _pending := false
var _request_id := ""
var _last_command: Dictionary = {}
var _failed_position := Vector3(INF, INF, INF)


func _ready() -> void:
	InputMode.cancel_placement.connect(cancel)
	Server.placement_result.connect(_result)


func clear() -> void:
	cancel()
	for frame: ProductFrame in frames.values():
		if is_instance_valid(frame):
			frame.queue_free()
	frames.clear()
	placements.clear()
	_textures.clear()
	_models.clear()
	revision = -1


func _process(_delta: float) -> void:
	var world := get_tree().current_scene
	if world != _world:
		clear()
		_world = world
	if world == null or world.name != "DemoStore":
		return
	if not _polling and Time.get_ticks_msec() >= _next_poll:
		poll_world()


func _physics_process(delta: float) -> void:
	_preview_elapsed += delta
	if is_instance_valid(_preview) and not _pending and _preview_elapsed >= 1.0 / 30.0:
		_preview_elapsed = 0.0
		_update_preview()


func poll_world() -> void:
	if _polling:
		return
	_polling = true
	_next_poll = Time.get_ticks_msec() + 2000
	var epoch := Api.generation
	var world := get_tree().current_scene
	var result := await Api.request(
		"/api/market/server/world" if Server.is_dedicated() else "/api/market/world",
		"POST" if Server.is_dedicated() else "GET",
		{},
		Server.is_dedicated()
	)
	if (
		world == get_tree().current_scene
		and epoch == Api.generation
		and (result.status as int) == 200
	):
		apply_snapshot(result.data as Dictionary)
		if Server.is_dedicated():
			Server.broadcast_snapshot(result.data as Dictionary)
	_polling = false


func apply_snapshot(data: Dictionary) -> void:
	var world := get_tree().current_scene
	if world == null or world.name != "DemoStore":
		return
	if _world != world:
		clear()
		_world = world
	var next := str(data.get("revision", -1)).to_int()
	if next <= revision:
		return
	revision = next
	var seen: Dictionary = {}
	for entry: Dictionary in data.get("placements", []):
		var id := str(entry.id)
		seen[id] = entry
		if not frames.has(id) or not is_instance_valid(frames[id]):
			var frame := FRAME.instantiate() as ProductFrame
			frame.name = "Frame_" + id
			world.add_child(frame)
			frames[id] = frame
		frames[id].update_data(entry)
	for id: String in frames.keys():
		if not seen.has(id):
			if is_instance_valid(frames[id]):
				frames[id].queue_free()
			frames.erase(id)
	placements = seen
	refreshed.emit()


func texture(id: String, thumbnail: bool = false, scan: bool = false) -> Texture2D:
	var key := id + (":scan" if scan else "") + (":thumb" if thumbnail else "")
	if _textures.has(key):
		return _textures[key]
	if id.is_empty():
		return null
	var epoch := Api.generation
	var http := HTTPRequest.new()
	http.timeout = 10
	http.body_size_limit = 10 * 1024 * 1024
	add_child(http)
	var url := Api.base_url + "/api/media/"
	url += (
		"models/" + id.uri_encode() + "?preview=1"
		if scan
		else id.uri_encode() + ("?thumb=1" if thumbnail else "")
	)
	http.max_redirects = 0
	if http.request(url, Api.cookie_headers()) != OK:
		http.queue_free()
		return null

	var result: Array = await http.request_completed
	http.queue_free()
	if (
		epoch != Api.generation
		or (result[0] as int) != HTTPRequest.RESULT_SUCCESS
		or (result[1] as int) != 200
	):
		return null
	var image := Image.new()
	var error := (
		image.load_png_from_buffer(result[3] as PackedByteArray)
		if scan
		else image.load_webp_from_buffer(result[3] as PackedByteArray)
	)
	if error != OK:
		return null
	var loaded := ImageTexture.create_from_image(image)
	# Bound the cache; world nodes keep their own texture references.
	if _textures.size() >= 128:
		_textures.clear()
	_textures[key] = loaded
	return loaded


func model(id: String) -> Node3D:
	if _models.has(id):
		return _models[id].instantiate() as Node3D
	if id.is_empty():
		return null
	var epoch := Api.generation
	var http := HTTPRequest.new()
	http.timeout = 30
	http.body_size_limit = 32 * 1024 * 1024
	add_child(http)
	http.max_redirects = 0
	if http.request(Api.base_url + "/api/media/models/" + id.uri_encode(), Api.cookie_headers()) != OK:
		http.queue_free()
		return null
	var result: Array = await http.request_completed
	http.queue_free()
	if (
		epoch != Api.generation
		or (result[0] as int) != HTTPRequest.RESULT_SUCCESS
		or (result[1] as int) != 200
	):
		return null
	var loaded := ScanModel.from_glb(result[3] as PackedByteArray)
	if loaded == null:
		return null
	var packed := PackedScene.new()
	if packed.pack(loaded) == OK:
		if _models.size() >= 16:
			_models.clear()
		_models[id] = packed
	return loaded


func begin(item: Dictionary) -> void:
	cancel()
	_item = item.duplicate(true)
	_surface_id = "lobby-table" if item.get("scanJobId") != null else "demo-board"
	_preview = MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = Vector3(0.6, 0.8, 0.06)
	_preview.mesh = mesh
	_preview.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_preview_material = StandardMaterial3D.new()
	_preview_material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_preview_material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_preview.material_override = _preview_material
	_preview_message = ""
	_preview_ready = item.get("scanJobId") == null
	get_tree().current_scene.add_child(_preview)
	InputMode.set_mode(InputMode.Mode.PLACING)
	if item.get("scanJobId") != null:
		_preview.mesh = null
		preview_changed.emit("Loading model…")
		_preview_model(str(item.scanJobId), _preview)


func _preview_model(id: String, target: MeshInstance3D) -> void:
	var loaded := await model(id)
	if not is_instance_valid(target) or target != _preview:
		if loaded != null:
			loaded.free()
		return
	if loaded == null:
		preview_changed.emit("Model unavailable. Esc to return to inventory")
		return
	for mesh: MeshInstance3D in loaded.get_children():
		mesh.material_override = _preview_material
		mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	target.add_child(loaded)
	_preview_ready = true


func cancel() -> void:
	if is_instance_valid(_preview):
		_preview.queue_free()
	_preview = null
	_valid = false
	_yaw = 0.0
	_preview_ready = false
	_item.clear()
	_failed_position = Vector3(INF, INF, INF)
	_pending = false
	_request_id = ""
	_last_command.clear()


# Geometry validation deliberately reports each distinct failure to the player.
# gdlint: disable=max-returns
func validate_position(
	pos: Vector3,
	origin: Vector3,
	player: PlayerController = null,
	check_overlap: bool = true,
	surface_id: String = "demo-board",
	yaw: float = 0.0
) -> String:
	var table := surface_id == "lobby-table"
	if not table and surface_id != "demo-board":
		return "Choose a display surface"
	if not pos.is_finite():
		return "Invalid item position"
	if not is_finite(yaw) or absf(yaw) > PI + 0.00001 or (not table and yaw != 0.0):
		return "Invalid item rotation"
	var half := 0.3 * (absf(cos(yaw)) + absf(sin(yaw)))
	if table:
		if (
			absf(pos.x) > 1.8 - half
			or absf(pos.z - 2.4) > 0.7 - half + 0.00001
			or absf(pos.y - 0.9) > 0.001
		):
			return "Keep the model on the table"
	elif absf(pos.x) > 2.7 or pos.y < 0.7 or pos.y > 2.9 or absf(pos.z + 1.94) > 0.001:
		return "Keep the frame inside the display wall"
	var second := pos.z if table else pos.y
	if (
		absf(pos.x * 10 - roundf(pos.x * 10)) > 0.001
		or absf(second * 10 - roundf(second * 10)) > 0.001
	):
		return "Choose a display surface"
	if origin.distance_to(pos) > 2.0:
		return (
			"Move within two meters of the table" if table else "Move within two meters of the wall"
		)
	if (table and origin.y <= pos.y) or (not table and origin.z <= pos.z):
		return "Aim at the tabletop" if table else "Use the front of the display wall"
	var world := get_tree().current_scene as Node3D
	if world == null:
		return "World unavailable"
	var inward := Vector3(0, 0.06, 0) if table else Vector3(0, 0, 0.15)
	var query := PhysicsRayQueryParameters3D.create(origin, pos - inward, 1)
	if player:
		query.exclude = [player.get_rid()]
	var hit := world.get_world_3d().direct_space_state.intersect_ray(query)
	var collider := hit.get("collider") as Node
	if (
		collider == null
		or not collider.is_in_group("display_surface")
		or str(collider.get_meta("surface_id", "")) != surface_id
	):
		return "Aim at a table" if table else "Choose a display wall"
	for entry: Dictionary in placements.values():
		var delta_second := (
			absf((entry.z as float) - pos.z) if table else absf((entry.y as float) - pos.y)
		)
		var other_yaw := entry.get("yaw", 0.0) as float
		var separation := half + 0.3 * (absf(cos(other_yaw)) + absf(sin(other_yaw))) + 0.01
		if (
			check_overlap
			and str(entry.get("surfaceId", "demo-board")) == surface_id
			and absf((entry.x as float) - pos.x) < (separation if table else 0.61)
			and delta_second < (separation if table else 0.81)
		):
			return "That space is occupied"
	return ""


func _update_preview() -> void:
	if not _preview_ready:
		return
	var camera := get_viewport().get_camera_3d()
	if camera == null:
		return
	var origin := camera.global_position
	var ray := -camera.global_basis.z
	var table := _surface_id == "lobby-table"
	var distance := -1.0
	if table and absf(ray.y) > 0.001:
		distance = (0.9 - origin.y) / ray.y
	elif not table and absf(ray.z) > 0.001:
		distance = (-1.94 - origin.z) / ray.z
	var pos := origin + ray * maxf(distance, 0.0)
	pos = (
		Vector3(snappedf(pos.x, 0.1), 0.9, snappedf(pos.z, 0.1))
		if table
		else Vector3(snappedf(pos.x, 0.1), snappedf(pos.y, 0.1), -1.94)
	)
	if pos == _failed_position:
		return
	_failed_position = Vector3(INF, INF, INF)
	var reason := (
		validate_position(
			pos, origin, camera.get_parent() as PlayerController, true, _surface_id, _yaw
		)
		if distance > 0
		else ("Aim at a table" if table else "Choose a display wall")
	)
	_valid = reason.is_empty()
	_position = pos
	_preview.position = pos
	_preview.rotation.y = _yaw
	var color := Color(0.3, 0.65, 0.4, 0.55) if _valid else Color(0.9, 0.3, 0.2, 0.55)
	if _preview_material.albedo_color != color:
		_preview_material.albedo_color = color
	var message := "Click to aim"
	if InputMode.pointer_captured():
		message = (
			("Click to place · Scroll to rotate" if table else "Click to place")
			if _valid
			else reason
		)
	if message != _preview_message:
		_preview_message = message
		preview_changed.emit(message)


func _unhandled_input(event: InputEvent) -> void:
	if InputMode.mode != InputMode.Mode.PLACING or _pending:
		return
	if event is InputEventMouseButton and _surface_id == "lobby-table" and _preview_ready:
		var mouse := event as InputEventMouseButton
		if mouse.pressed and mouse.button_index in [MOUSE_BUTTON_WHEEL_UP, MOUSE_BUTTON_WHEEL_DOWN]:
			var direction := 1.0 if mouse.button_index == MOUSE_BUTTON_WHEEL_UP else -1.0
			_yaw = wrapf(_yaw + direction * ROTATION_STEP, -PI, PI)
			_preview.rotation.y = _yaw
			_failed_position = Vector3(INF, INF, INF)
			_update_preview()
			get_viewport().set_input_as_handled()
			return
	if (
		event is InputEventMouseButton
		and (event as InputEventMouseButton).pressed
		and (event as InputEventMouseButton).button_index == MOUSE_BUTTON_LEFT
	):
		if Input.mouse_mode != Input.MOUSE_MODE_CAPTURED:
			Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
			get_viewport().set_input_as_handled()
			return
		if not _valid:
			return
		_pending = true
		_request_id = Api.request_id()
		_last_command = {
			"op": "place",
			"requestId": _request_id,
			"itemId": _item.id,
			"x": _position.x,
			"y": _position.y,
			"z": _position.z,
			"surfaceId": _surface_id,
			"yaw": _yaw
		}
		Server.submit_placement(_last_command)
		preview_changed.emit("Saving…")
		_retry_pending(_request_id)


func _retry_pending(id: String) -> void:
	await get_tree().create_timer(15).timeout
	if _pending and id == _request_id:
		preview_changed.emit("Connection interrupted. Reconciling… Esc to return to inventory")
		poll_world()
		Server.submit_placement(_last_command)
		_retry_pending(id)


func _result(result: Dictionary) -> void:
	if not is_instance_valid(_preview) or not _pending or result.get("requestId") != _request_id:
		return
	if (result.status as int) == 0 or (result.status as int) >= 500:
		# The commit may have succeeded. Keep the exact command pending; its
		# existing retry timer reconciles and reuses the same idempotency key.
		preview_changed.emit("Connection interrupted. Reconciling… Esc to return to inventory")
		poll_world()
		return
	_pending = false
	if (result.status as int) == 200:
		cancel()
		poll_world()
		InputMode.set_mode(InputMode.Mode.PLAYING)
	else:
		preview_changed.emit(Api.message(result))
		# Preserve the error until the user deliberately chooses a new position.
		_valid = false
		_failed_position = _position
		if str((result.data as Dictionary).get("code", "")) == "ALREADY_PLACED":
			cancel()
			InputMode.set_mode(InputMode.Mode.STORE)
			InputMode.store_requested.emit()
