class_name MenuCursor
extends Control
## Software pointer used while the browser retains pointer lock.


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	custom_minimum_size = Vector2(24, 30)
	scale = Vector2(0.5, 0.5)


func _draw() -> void:
	var arrow := PackedVector2Array(
		[
			Vector2.ZERO,
			Vector2(0, 23),
			Vector2(6, 17),
			Vector2(11, 28),
			Vector2(16, 26),
			Vector2(11, 15),
			Vector2(20, 15),
			Vector2.ZERO
		]
	)
	draw_colored_polygon(arrow, Color("fffdf8"))
	draw_polyline(arrow, MarketTheme.INK, 2.0, true)
