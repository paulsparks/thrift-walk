class_name PlayerView
extends RefCounted

const SENSITIVITY := 0.003
const BOB_FREQ := 2.2
const BOB_AMP := 0.04
const BOB_FADE_SPEED := 8.0
const REACH_DISTANCE := 3.0

var _camera: Camera3D
var _crosshair: ColorRect
var _yaw := 0.0
var _pitch := 0.0
var _bob_time := 0.0
var _bob_weight := 0.0


func _init(camera: Camera3D, crosshair: ColorRect) -> void:
	_camera = camera
	_crosshair = crosshair


func set_local_control(is_local: bool) -> void:
	_camera.current = is_local
	_crosshair.visible = is_local
	if is_local:
		Input.set_mouse_mode(Input.MOUSE_MODE_CAPTURED)


func apply_mouse_motion(relative: Vector2) -> void:
	_yaw = wrapf(_yaw - relative.x * SENSITIVITY, -PI, PI)
	_pitch = clamp(_pitch - relative.y * SENSITIVITY, deg_to_rad(-90.0), deg_to_rad(90.0))


func set_server_look(yaw: float, pitch: float) -> void:
	_yaw = yaw
	_pitch = pitch
	_camera.rotation.x = pitch


func get_yaw() -> float:
	return _yaw


func get_pitch() -> float:
	return _pitch


func update_head_bob(delta: float, velocity: Vector3, grounded: bool) -> void:
	var is_walking := Vector2(velocity.x, velocity.z).length() > 0.01 and grounded
	_bob_time += delta * velocity.length() * float(grounded)
	_bob_weight = lerpf(_bob_weight, 1.0 if is_walking else 0.0, 1.0 - exp(-BOB_FADE_SPEED * delta))
	_camera.position = _headbob(_bob_time) * _bob_weight + Vector3(0.0, 1.0, 0.0)


func get_raycast(world: World3D, viewport: Viewport) -> Dictionary:
	var mousepos := viewport.get_mouse_position()
	var origin := _camera.project_ray_origin(mousepos)
	var end := origin + _camera.project_ray_normal(mousepos) * REACH_DISTANCE
	var hold_pos := origin + _camera.project_ray_normal(mousepos) * REACH_DISTANCE / 2.5
	var query := PhysicsRayQueryParameters3D.create(origin, end, 2)
	var result := world.direct_space_state.intersect_ray(query)
	return {"collider": result.get("collider"), "hold_pos": hold_pos}


func _headbob(time: float) -> Vector3:
	return Vector3(sin(time * BOB_FREQ / 1.5) * BOB_AMP, sin(time * BOB_FREQ) * BOB_AMP, 0.0)
