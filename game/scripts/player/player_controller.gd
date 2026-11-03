class_name PlayerController
extends CharacterBody3D

const WALK_SPEED: float = 4.5
const SPRINT_SPEED: float = 7.5
const CROUCH_SPEED: float = 2.5
const JUMP_VELOCITY: float = 7.0
const SENSITIVITY: float = 0.003
const BOB_FREQ: float = 2.2
const BOB_AMP: float = 0.04
const GRAVITY: float = 25.0
const TERMINAL_VELOCITY: float = 35.0
const REACH_DISTANCE: float = 3
const ITEM_SCROLL_ROTATE_SPEED: float = 0.2
const BOB_FADE_SPEED: float = 8.0  # higher = returns to origin faster
# NOTE: Disabling crouch for now because browsers close the tab on Ctrl+W
const CROUCH_DISABLED: bool = true

var speed: float = WALK_SPEED
var t_bob: float = 0.0
var bob_weight: float = 0.0
var current_gravity: float = 12.0
var held_prop_mesh: MeshInstance3D = null
var can_stand: bool = true
var held_prop_y_rotation: Variant = null

var hand_ray: Dictionary = {"collider": null, "hold_pos": null}

@onready var camera: Camera3D = $Camera3D
@onready var top_half_1: CollisionShape3D = $TopHalf1
@onready var top_half_2: CollisionShape3D = $TopHalf2


func _ready() -> void:
	Input.set_mouse_mode(Input.MOUSE_MODE_CAPTURED)


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion:
		var mouse_motion: InputEventMouseMotion = event

		rotate_y(-mouse_motion.relative.x * SENSITIVITY)
		camera.rotate_x(-mouse_motion.relative.y * SENSITIVITY)
		camera.rotation.x = clamp(camera.rotation.x, deg_to_rad(-90), deg_to_rad(90))
		return


func _physics_process(delta: float) -> void:
	# Add the gravity
	if is_on_floor():
		current_gravity = GRAVITY
	else:
		current_gravity = clamp(pow(current_gravity, 1.01), GRAVITY, TERMINAL_VELOCITY)
	velocity += Vector3.DOWN * current_gravity * delta

	# Handle jump
	if Input.is_action_just_pressed("jump") and is_on_floor():
		velocity.y = JUMP_VELOCITY

	# Get the input direction and handle the movement/deceleration
	var input_dir: Vector2 = Input.get_vector("left", "right", "forwards", "backwards")
	var direction: Vector3 = (transform.basis * Vector3(input_dir.x, 0, input_dir.y)).normalized()

	# Pick the speed: crouch beats sprint, and sprint only works while moving forwards
	var is_crouching: bool = (
		(!CROUCH_DISABLED && Input.is_action_pressed("crouch")) or not can_stand
	)
	var is_sprinting: bool = (
		Input.is_action_pressed("sprint") and not is_crouching and input_dir.y < 0.0
	)
	if is_crouching:
		speed = CROUCH_SPEED
	elif is_sprinting:
		speed = SPRINT_SPEED
	else:
		speed = WALK_SPEED

	if direction:
		velocity.x = direction.x * speed
		velocity.z = direction.z * speed
	else:
		velocity.x = 0
		velocity.z = 0

	# Head bob
	var is_walking: bool = direction != Vector3.ZERO and is_on_floor()
	t_bob += delta * velocity.length() * float(is_on_floor())
	bob_weight = lerpf(bob_weight, 1.0 if is_walking else 0.0, 1.0 - exp(-BOB_FADE_SPEED * delta))
	camera.transform.origin = (
		_headbob(t_bob) * bob_weight + (Vector3(0, 1, 0))
		if (can_stand and not (!CROUCH_DISABLED && Input.is_action_pressed("crouch")))
		else Vector3(0, 0.2, 0)
	)

	move_and_slide()


func _input(event: InputEvent) -> void:
	if event.is_action_pressed("crouch"):
		top_half_1.disabled = true
		top_half_2.disabled = true

	# Grab the mouse as soon as the player clicks inside the game screen
	if event is InputEventMouseButton:
		var mouse_event: InputEventMouseButton = event
		if mouse_event.pressed:
			if mouse_event.button_index == MOUSE_BUTTON_LEFT:
				Input.mouse_mode = Input.MOUSE_MODE_CAPTURED

	# Release the mouse if they hit the Escape key (browser also handles this)
	if event is InputEventKey:
		var key_event: InputEventKey = event
		if key_event.pressed:
			if key_event.keycode == KEY_ESCAPE:
				Input.mouse_mode = Input.MOUSE_MODE_VISIBLE


func _headbob(time: float) -> Vector3:
	var pos: Vector3 = Vector3.ZERO
	pos.y = sin(time * BOB_FREQ) * BOB_AMP
	pos.x = sin(time * BOB_FREQ / 1.5) * BOB_AMP
	return pos


func _process(_delta: float) -> void:
	if can_stand and not Input.is_action_pressed("crouch"):
		top_half_1.disabled = false
		top_half_2.disabled = false

	# Handle what the player is looking at
	hand_ray = _handle_raycast()


func _on_top_half_area_body_entered(body: Node3D) -> void:
	if not body is PlayerController:
		can_stand = false


func _on_top_half_area_body_exited(body: Node3D) -> void:
	if not body is PlayerController:
		can_stand = true


func _handle_raycast() -> Dictionary:
	var space_state: PhysicsDirectSpaceState3D = get_world_3d().direct_space_state
	var mousepos: Vector2 = get_viewport().get_mouse_position()
	var origin: Vector3 = camera.project_ray_origin(mousepos)
	var end: Vector3 = origin + camera.project_ray_normal(mousepos) * REACH_DISTANCE
	var hold_pos: Vector3 = origin + camera.project_ray_normal(mousepos) * REACH_DISTANCE / 2.5
	var query: PhysicsRayQueryParameters3D = PhysicsRayQueryParameters3D.create(origin, end, 2)
	var result: Dictionary = space_state.intersect_ray(query)
	var collider: Variant = result.get("collider")

	return {"collider": collider, "hold_pos": hold_pos}
