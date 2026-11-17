class_name LoadingSpinner
extends Control
## Shared, layout-independent progress indicator for menus and image slots.
var _angle := 0.0


func _ready() -> void:
	custom_minimum_size = Vector2(40, 40)
	mouse_filter = Control.MOUSE_FILTER_IGNORE


func _process(delta: float) -> void:
	if is_visible_in_tree():
		_angle = fmod(_angle + delta * TAU * 0.8, TAU)
		queue_redraw()


func _draw() -> void:
	var center := size * 0.5
	var radius := minf(size.x, size.y) * 0.5 - 4.0
	draw_arc(center, radius, 0, TAU, 48, Color("ded8ca"), 3.0, true)
	draw_arc(center, radius, _angle, _angle + TAU * 0.7, 36, MarketTheme.GREEN, 3.0, true)
