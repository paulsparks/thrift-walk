class_name PlayerMovement
extends RefCounted

const WALK_SPEED := 4.5
const SPRINT_SPEED := 7.5
const JUMP_VELOCITY := 7.0
const GRAVITY := 25.0
const TERMINAL_VELOCITY := 35.0

var _body: CharacterBody3D
var _camera: Camera3D


func _init(body: CharacterBody3D, camera: Camera3D) -> void:
	_body = body
	_camera = camera


func simulate(input_frame: PlayerInputFrame, delta: float) -> void:
	_body.rotation.y = input_frame.yaw
	_camera.rotation.x = input_frame.pitch

	if _body.is_on_floor():
		if _body.velocity.y < 0.0:
			_body.velocity.y = 0.0

		if input_frame.jump:
			_body.velocity.y = JUMP_VELOCITY
	else:
		_body.velocity.y = maxf(
			_body.velocity.y - GRAVITY * delta,
			-TERMINAL_VELOCITY
		)

	var direction := (
		Basis(Vector3.UP, input_frame.yaw)
		* Vector3(input_frame.move.x, 0.0, input_frame.move.y)
	).normalized()

	var is_sprinting := input_frame.sprint and input_frame.move.y < 0.0
	var speed := SPRINT_SPEED if is_sprinting else WALK_SPEED

	_body.velocity.x = direction.x * speed
	_body.velocity.z = direction.z * speed

	_body.move_and_slide()
