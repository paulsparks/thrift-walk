class_name PlayerController
extends CharacterBody3D

## Movement is simulated only by the multiplayer server. The owning client
## submits intent, then every client receives the server's resulting state.
const RECONCILIATION_SPEED := 14.0
const HARD_SNAP_DISTANCE := 1.5

## Set by the server. Only this peer may submit input for this player.
var controlling_peer_id := 0
var hand_ray: Dictionary = {"collider": null, "hold_pos": null}

# Server-side input state. Input from anyone except the assigned peer is ignored.
var _move_input := Vector2.ZERO
var _wants_jump := false
var _wants_sprint := false
var _look_yaw := 0.0
var _look_pitch := 0.0
var _last_received_input_sequence := -1

# State received from the server. Clients interpolate it but never simulate it.
var _server_position := Vector3.ZERO
var _server_velocity := Vector3.ZERO
var _server_yaw := 0.0
var _server_pitch := 0.0
var _server_on_floor := false
var _has_server_state := false
var _has_unreconciled_server_state := false

# Client-side prediction state. Each saved input is replayed after the server
# acknowledges the input sequence it has simulated.
var _next_input_sequence := 0
var _pending_inputs: Array[PlayerInputFrame] = []

var _movement: PlayerMovement
var _view: PlayerView

@onready var camera: Camera3D = $Camera3D
@onready var crosshair: ColorRect = $Crosshair
@onready var playermodel: MeshInstance3D = $Playermodel


func _ready() -> void:
	_server_position = global_position
	_movement = PlayerMovement.new(self, camera)
	_view = PlayerView.new(camera, crosshair)
	_update_local_presentation()


func _is_local_controller() -> bool:
	return (
		controlling_peer_id != 0
		and multiplayer.has_multiplayer_peer()
		and multiplayer.get_unique_id() == controlling_peer_id
	)


func _update_local_presentation() -> void:
	var is_local := _is_local_controller()
	_view.set_local_control(is_local)
	playermodel.visible = not is_local


## Authority-only: clients cannot claim a player for themselves.
@rpc("authority", "call_local", "reliable")
func set_controlling_peer(peer_id: int) -> void:
	controlling_peer_id = peer_id
	_update_local_presentation()


func _unhandled_input(event: InputEvent) -> void:
	if not _is_local_controller():
		return
	if event is InputEventMouseMotion:
		var mouse_motion := event as InputEventMouseMotion
		_view.apply_mouse_motion(mouse_motion.relative)
		_look_yaw = _view.get_yaw()
		_look_pitch = _view.get_pitch()


func _physics_process(delta: float) -> void:
	if multiplayer.is_server():
		_simulate_server(delta)
		_sync_state.rpc(
			global_position,
			velocity,
			rotation.y,
			camera.rotation.x,
			is_on_floor(),
			_last_received_input_sequence
		)
	else:
		if _is_local_controller():
			_submit_and_predict_local_input(delta)
		else:
			_apply_remote_server_state(delta)
	_update_head_bob(delta)


func _submit_and_predict_local_input(delta: float) -> void:
	var input_frame := PlayerInputFrame.new()
	input_frame.sequence = _next_input_sequence
	input_frame.move = Input.get_vector("left", "right", "forwards", "backwards")
	input_frame.jump = Input.is_action_just_pressed("jump")
	input_frame.sprint = Input.is_action_pressed("sprint")
	input_frame.yaw = _view.get_yaw()
	input_frame.pitch = _view.get_pitch()
	input_frame.delta = delta
	_next_input_sequence += 1
	_pending_inputs.append(input_frame)
	_submit_input.rpc_id(
		1,
		input_frame.sequence,
		input_frame.move,
		input_frame.jump,
		input_frame.sprint,
		input_frame.yaw,
		input_frame.pitch
	)
	_simulate_input(delta, input_frame)
	_reconcile_prediction(delta)


@rpc("any_peer", "unreliable")
func _submit_input(
	sequence: int,
	input_dir: Vector2,
	jump_pressed: bool,
	sprint_pressed: bool,
	yaw: float,
	pitch: float
) -> void:
	if not multiplayer.is_server():
		return
	if multiplayer.get_remote_sender_id() != controlling_peer_id:
		return
	if sequence <= _last_received_input_sequence:
		return
	_last_received_input_sequence = sequence
	_move_input = input_dir.limit_length(1.0)
	_wants_jump = _wants_jump or jump_pressed
	_wants_sprint = sprint_pressed
	_look_yaw = wrapf(yaw, -PI, PI)
	_look_pitch = clamp(pitch, deg_to_rad(-90.0), deg_to_rad(90.0))


func _simulate_server(delta: float) -> void:
	var input_frame := PlayerInputFrame.new()
	input_frame.move = _move_input
	input_frame.jump = _wants_jump
	input_frame.sprint = _wants_sprint
	input_frame.yaw = _look_yaw
	input_frame.pitch = _look_pitch
	_simulate_input(delta, input_frame)
	_wants_jump = false


func _simulate_input(delta: float, input_frame: PlayerInputFrame) -> void:
	_movement.simulate(input_frame, delta)


@rpc("authority", "call_remote", "unreliable_ordered")
func _sync_state(
	server_position: Vector3,
	server_velocity: Vector3,
	server_yaw: float,
	server_pitch: float,
	server_on_floor: bool,
	acknowledged_input_sequence: int
) -> void:
	_server_position = server_position
	_server_velocity = server_velocity
	_server_yaw = server_yaw
	_server_pitch = server_pitch
	_server_on_floor = server_on_floor
	_last_received_input_sequence = acknowledged_input_sequence
	_has_server_state = true
	_has_unreconciled_server_state = true


func _apply_remote_server_state(delta: float) -> void:
	if not _has_server_state:
		return
	var weight := 1.0 - exp(-20.0 * delta)
	global_position = global_position.lerp(_server_position, weight)
	velocity = _server_velocity
	rotation.y = lerp_angle(rotation.y, _server_yaw, weight)
	camera.rotation.x = lerp(camera.rotation.x, _server_pitch, weight)
	_view.set_server_look(_server_yaw, camera.rotation.x)


func _reconcile_prediction(delta: float) -> void:
	if not _has_unreconciled_server_state:
		return
	_has_unreconciled_server_state = false
	while (
		not _pending_inputs.is_empty()
		and _pending_inputs[0].sequence <= _last_received_input_sequence
	):
		_pending_inputs.pop_front()

	# Rewind to the server's collision-checked state, then replay only input the
	# server has not seen yet. Each recorded frame uses its own delta instead of
	# reusing the current frame time, which is especially important for jumping.
	var predicted_position := global_position
	var predicted_velocity := velocity
	global_position = _server_position
	velocity = _server_velocity
	rotation.y = _server_yaw
	_view.set_server_look(_server_yaw, _server_pitch)
	for input_frame in _pending_inputs:
		_simulate_input(input_frame.delta, input_frame)
	if not _pending_inputs.is_empty():
		var latest_input: PlayerInputFrame = _pending_inputs[_pending_inputs.size() - 1]
		_view.set_server_look(latest_input.yaw, latest_input.pitch)

	var replayed_position := global_position
	var replayed_velocity := velocity
	var error_distance := predicted_position.distance_to(replayed_position)
	if error_distance > HARD_SNAP_DISTANCE:
		return

	# Small corrections are blended instead of snapping the camera every server
	# snapshot. Large errors still snap so a bad collision state cannot persist.
	var correction_weight := 1.0 - exp(-RECONCILIATION_SPEED * delta)
	global_position = predicted_position.lerp(replayed_position, correction_weight)
	velocity = predicted_velocity.lerp(replayed_velocity, correction_weight)


func _update_head_bob(delta: float) -> void:
	var grounded := is_on_floor() if _is_local_controller() else _server_on_floor
	_view.update_head_bob(delta, velocity, grounded)


func _input(event: InputEvent) -> void:
	if not _is_local_controller():
		return
	if event is InputEventMouseButton:
		var mouse_event := event as InputEventMouseButton
		if mouse_event.pressed and mouse_event.button_index == MOUSE_BUTTON_LEFT:
			Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	if event is InputEventKey:
		var key_event := event as InputEventKey
		if key_event.pressed and key_event.keycode == KEY_ESCAPE:
			Input.mouse_mode = Input.MOUSE_MODE_VISIBLE


func _process(_delta: float) -> void:
	if not _is_local_controller():
		return
	hand_ray = _view.get_raycast(get_world_3d(), get_viewport())
